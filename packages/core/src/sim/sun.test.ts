import { describe, expect, test } from 'bun:test';
import type { LevelId, OrbitChoice } from '../contracts';
import { CONSTANTS, DAY, planetPosition, solarInput, sunLineOfSight } from '../physics';
import { certifyQuickDesign, commitTurn, createTurnGame, restoreTurnGame, turnDecision } from '../gameplay';
import { defaultQuickDesign, missionOffers, quickDesignBrief } from '../quickDesign';
import { editAsCopy, missionById } from '../mission/library';
import { validateMissionDefinition } from '../mission/validate';
import { SUN_AHEAD } from '../mission/solarOrbits';
import { exportInitialOrbit, parseInitialOrbit } from '../interop/gmat';
import { MODEL, PART_BY_ID } from '../catalog';
import { ENGINEERING, THERMAL_MODELS } from '../models';
import { environmentAt } from './environment';
import { createSim, flight, generatedPowerW } from './state';
import { history, telemetry } from './selectors';
import { stepSim } from './step';
import { issueCommand } from './commands';
import type { TurnGameState } from '../gameplayTypes';

const AU = CONSTANTS.EARTH.distanceKm.v, C = CONSTANTS.c.v, R_SUN = CONSTANTS.SUN.radius.v;
const len = (v: readonly number[]): number => Math.hypot(v[0], v[1], v[2]);
const sim = (level: LevelId = 'ASPIRING', initialOrbit?: OrbitChoice) => {
 const config = { ...defaultQuickDesign('SUN_SENTINEL', level), ...(initialOrbit ? { initialOrbit } : {}) }, brief = quickDesignBrief(config);
 expect(brief.blockers).toEqual([]);
 return createSim(brief.design, config.seed);
};
/** The epoch puts Earth at ecliptic longitude 51.6°; a perihelion at 231.6° puts the craft directly behind the Sun. */
const CONJUNCTION: OrbitChoice = { ...SUN_AHEAD, argPeriapsisDeg: 231.618 };

describe('Sun-centred environment', () => {
 test('the Sun constants come from the NSSDCA Sun fact sheet', () => {
  expect(CONSTANTS.SUN.mu.v).toBe(CONSTANTS.sunMu.v);
  expect(CONSTANTS.SUN.radius.v).toBe(695700);
  expect(CONSTANTS.SUN.rotationSec.v).toBeCloseTo(25.38 * DAY, 6);
  for (const q of [CONSTANTS.SUN.mu, CONSTANTS.SUN.radius, CONSTANTS.SUN.rotationSec]) expect(q.p).toMatchObject({ kind: 'source', src: 'nssdc-sun' });
  expect(planetPosition('SUN', 1234)).toEqual([0, 0, 0]);
 });
 test('position is Sun-relative, sunDir points at the Sun and nothing eclipses it', () => {
  const s = flight(sim());
  for (let t = 0; t <= 3 * DAY; t += DAY / 8) {
   const e = environmentAt(s, t), r = len(e.positionKm);
   expect(e.centralBody).toBe('SUN');
   expect(r / AU).toBeGreaterThan(0.95); expect(r / AU).toBeLessThan(0.97);
   expect(len(e.sunDir)).toBeCloseTo(1, 12);
   for (const i of [0, 1, 2]) expect(e.sunDir[i]).toBeCloseTo(-e.positionKm[i] / r, 12);
   expect(e.sunlit).toBe(true);
   expect(e.stationPosKm).toBeNull();
   // earthPosKm is the craft relative to Earth's centre.
   const earth = planetPosition('EARTH', t, s.epochUTC);
   for (const i of [0, 1, 2]) expect(e.earthPosKm[i]).toBeCloseTo(e.positionKm[i] - earth[i], 3);
  }
 });
 test('solar input scales with (1 AU / r)² in power and heat', () => {
  expect(solarInput('SUN', [AU, 0, 0])).toBeCloseTo(1, 12);
  expect(solarInput('SUN', [0, 0.5 * AU, 0])).toBeCloseTo(4, 12);
  expect(solarInput('SUN', [0.3 * AU, 0, 0])).toBeCloseTo(1 / 0.09, 9);
  expect(solarInput('EARTH', [1, 2, 3])).toBe(1);
  const s = flight(sim('EXPERT')), factor = (AU / len(s.positionKm)) ** 2;
  expect(factor).toBeGreaterThan(1.09);
  expect(generatedPowerW(s)).toBeCloseTo(s.ratedSolarW * factor * Math.max(0, Math.cos(s.attitude.panelSunDeg * Math.PI / 180)) * s.arrayFactor, 6);
  const stepped = flight(stepSim(s, 60).state), m = THERMAL_MODELS.SMALLSAT;
  // No planetary infrared about the Sun: the external load is the inverse-square solar input alone.
  expect(stepped.externalHeatW).toBeCloseTo(ENGINEERING.solarFlux.v * (AU / len(s.positionKm)) ** 2 * m.absorbingM2.v, 6);
 });
 test('assumed background dose is labelled as an assumption', () => {
  const s = flight(sim());
  expect(s.doseUGyH).toBe(MODEL.sunBackground.v);
  expect(MODEL.sunBackground.p.kind).toBe('assumption');
 });
});

describe('Deep Space Network contact from a Sun-centred orbit', () => {
 test('line of sight to Earth is blocked only by the solar disc', () => {
  const earth = planetPosition('EARTH', 0, SUN_AHEAD.epochUTC), u = earth.map(x => x / len(earth));
  const behind = u.map(x => -x * AU) as [number, number, number];
  expect(sunLineOfSight(behind, 0, SUN_AHEAD.epochUTC)).toBe(false);
  // Craft and Earth are both 1 AU from the Sun, so the segment between them passes the Sun at half the craft's sideways offset.
  const side: [number, number, number] = [u[1], -u[0], 0], k = 1 / len(side);
  const grazing = behind.map((x, i) => x + side[i] * k * 2.2 * R_SUN) as [number, number, number], hidden = behind.map((x, i) => x + side[i] * k * 1.8 * R_SUN) as [number, number, number];
  expect(sunLineOfSight(grazing, 0, SUN_AHEAD.epochUTC)).toBe(true);
  expect(sunLineOfSight(hidden, 0, SUN_AHEAD.epochUTC)).toBe(false);
  // A craft between Earth and the Sun, or beside them, sees Earth.
  expect(sunLineOfSight(earth.map(x => x * 0.5) as [number, number, number], 0, SUN_AHEAD.epochUTC)).toBe(true);
  expect(sunLineOfSight([u[1] * AU, -u[0] * AU, 0], 0, SUN_AHEAD.epochUTC)).toBe(true);
 });
 test('the leading orbit is in DSN contact during the allocation; a conjunction orbit is not', () => {
  const ahead = telemetry(sim());
  expect(ahead.link.lineOfSight).toBe(true); expect(ahead.inContact).toBe(true); expect(ahead.stationPosKm).toBeNull();
  const conj = flight(sim('ASPIRING', CONJUNCTION)), t = telemetry(conj);
  expect(t.link.lineOfSight).toBe(false); expect(t.inContact).toBe(false); expect(t.link.unavailableReason).toBe('GEOMETRY');
  // The next opportunity search sees no contact inside a day while the Sun stays in the way.
  expect(conj.nextPassAt).toBeNull();
 });
 test('allocation gates contact like the Mars DSN rule, at every level', () => {
  for (const level of ['ASPIRING', 'EXPERT'] as const) {
   const s = flight(sim(level));
   expect(environmentAt(s, 4 * 3600).inContact).toBe(true);
   expect(environmentAt(s, 12 * 3600).inContact).toBe(false);
   expect(environmentAt(s, 12 * 3600).lineOfSight).toBe(true);
  }
 });
 test('light time and link rate follow the spacecraft-Earth range', () => {
  const state = sim(), s = flight(state), t = telemetry(state), range = len(s.earthPosKm);
  expect(range / AU).toBeGreaterThan(1.6); expect(range / AU).toBeLessThan(1.8);
  expect(t.lightTimeSec).toBeCloseTo(range / C, 9);
  expect(t.lightTimeSec!).toBeGreaterThan(800);
  const xband = PART_BY_ID.SS_XBAND.rateKbps!.v;
  expect(t.link.normalRateKbps).toBeCloseTo(Math.min(6000, xband * (AU / range) ** 2), 6);
  // A ground command waits for contact, then travels for the one-way light time.
  const q = issueCommand(state, { kind: 'POINT', mode: 'EARTH' }, 'ALL');
  if (!q.ok) throw new Error(q.code);
  const entry = flight(q.value).queue.at(-1)!;
  expect(entry.status).toBe('IN_TRANSIT');
  expect(entry.applyAt! - entry.transmittedAt!).toBeCloseTo(range / C, 6);
 });
 test('no flight view is published and history carries Sun-relative samples', () => {
  const state = sim(), t = telemetry(state);
  expect(t.flight).toBeNull();
  expect(t.objective.target).toBe(6000);
 });
});

describe('Sun missions: offers, definitions and interchange', () => {
 test('missionOffers lists the Sun mission only under the Sun', () => {
  for (const level of ['ASPIRING', 'EXPERT'] as const) {
   expect(missionOffers('SUN', level).map(o => o.missionId)).toEqual(['SUN_SENTINEL']);
   expect(missionOffers('SUN', level)[0].destination).toBe('SUN');
   for (const body of ['EARTH', 'MOON', 'MARS'] as const) expect(missionOffers(body, level).some(o => o.missionId === 'SUN_SENTINEL')).toBe(false);
   expect(missionOffers('MARS', level).map(o => o.missionId)).toEqual(['RED_RELAY']);
  }
 });
 test('the built-in is a provided heliocentric orbit with no cruise, capture or storm', () => {
  const d = missionById('SUN_SENTINEL');
  expect(d.start).toMatchObject({ kind: 'PROVIDED_ORBIT', body: 'SUN' });
  expect(d.trajectory).toEqual({ model: 'HELIOCENTRIC_CONIC' });
  expect(d.environment).toMatchObject({ stationId: 'DSN', storm: null, commLightTime: false, durationSec: 30 * DAY });
  expect(d.termination.failOn).not.toContain('CAPTURE_FAILED');
  const s = flight(sim());
  expect(s.cruise).toBe(false); expect(s.capturePending).toBe(false); expect(s.captured).toBe(true); expect(s.outageAt).toBe(Number.MAX_SAFE_INTEGER);
 });
 test('custom Sun definitions validate, and contradictions are named', () => {
  const copy = editAsCopy(missionById('SUN_SENTINEL'), { name: 'Mine', description: 'd', objectiveSummary: 's' }, { id: 'user.sun-copy' });
  expect(validateMissionDefinition(copy).ok).toBe(true);
  const issues = (v: unknown) => { const r = validateMissionDefinition(v); return r.ok ? [] : r.issues.map(i => `${i.path}:${i.code}`); };
  expect(issues({ ...copy, trajectory: { model: 'PATCHED_CONICS', bodies: ['EARTH'], maneuvers: { allowed: false, maxBurns: 0 } } })).toContain('trajectory:CONTRADICTION');
  expect(issues({ ...copy, start: { ...copy.start, orbit: { ...SUN_AHEAD, smaKm: 0.2 * AU } } })).toContain('start.orbit:RANGE');
  expect(issues({ ...copy, environment: { ...copy.environment, storm: { startSec: 86400, endSec: 2 * 86400, dose: 'MARS_ASSUMED' } } })).toContain('environment.storm:UNSUPPORTED');
  expect(issues({ ...copy, environment: { ...copy.environment, stationId: 'GS_MIDLAT' } })).toContain('environment.stationId:CONTRADICTION');
  const red = editAsCopy(missionById('RED_RELAY'), { name: 'R', description: 'd', objectiveSummary: 's' }, { id: 'user.red-copy' });
  expect(issues({ ...red, trajectory: { model: 'HELIOCENTRIC_CONIC' } })).toContain('trajectory:CONTRADICTION');
 });
 test('GMAT initial state round-trips through a Sun-centred frame', () => {
  const script = exportInitialOrbit(SUN_AHEAD);
  expect(script).toContain('GMAT AstrixSunFrame.Origin = Sun;');
  const back = parseInitialOrbit(script, 'Astrix');
  expect({ ...back, epochUTC: SUN_AHEAD.epochUTC }).toEqual(SUN_AHEAD);
 });
});

const play = (level: LevelId): TurnGameState => {
 const config = defaultQuickDesign('SUN_SENTINEL', level), proof = certifyQuickDesign(config);
 expect(['READY', 'STRETCHED']).toContain(proof.status);
 let game = createTurnGame(config, proof);
 for (const planId of proof.witness) {
  const d = turnDecision(game);
  expect(d.plans.some(p => p.id === planId)).toBe(true);
  const r = commitTurn(game, { decisionId: d.id, baseRevision: game.revision, planId, idempotencyKey: `sun-${game.revision}` });
  if (!r.ok) throw new Error(r.message);
  game = r.value.state;
 }
 return game;
};
describe('Sun Sentinel is certified and playable', () => {
 for (const level of ['ASPIRING', 'EXPERT'] as const) test(`${level}: a committed turn sequence reaches success with Sun-relative history`, () => {
  const game = play(level), t = telemetry(game.sim);
  expect(t.outcome).toBe('SUCCESS');
  expect(t.evidence.every(e => !e.required || e.state === 'MET')).toBe(true);
  expect(flight(game.sim).missionDownlinkedMB).toBeGreaterThanOrEqual(6000);
  expect(game.receipts.some(r => r.planId === 'observe')).toBe(true);
  expect(game.receipts.some(r => r.planId === 'transmit')).toBe(true);
  const samples = history(game.sim);
  expect(samples.length).toBeGreaterThan(2);
  for (const sample of samples) {
   const r = len(sample.positionKm);
   expect(r / AU).toBeGreaterThan(0.95); expect(r / AU).toBeLessThan(0.97);
   expect(len(sample.sunDir)).toBeCloseTo(1, 9);
   for (const i of [0, 1, 2]) expect(sample.sunDir[i]).toBeCloseTo(-sample.positionKm[i] / r, 9);
   expect(sample.stationPosKm).toBeNull();
   expect(sample.flight).toBeUndefined();
  }
  // Saves replay to the identical state.
  expect(restoreTurnGame(structuredClone(game))).toEqual(game);
 }, 120000);
 test('every kit, ambition and approach certifies at both levels', () => {
  for (const level of ['ASPIRING', 'EXPERT'] as const) for (const approach of ['CAUTIOUS', 'BALANCED', 'FAST'] as const) for (const kit of ['LIGHT', 'ENDURANCE', 'SCIENCE'] as const) for (const ambition of ['SHORT', 'STANDARD', 'AMBITIOUS'] as const) {
   const p = certifyQuickDesign({ ...defaultQuickDesign('SUN_SENTINEL', level), approach, kit, ambition });
   expect(['READY', 'STRETCHED'], `${level} ${approach} ${kit} ${ambition}`).toContain(p.status);
   expect(p.outcome).toBe('SUCCESS');
  }
 }, 240000);
 test('the Expert kit carries a second radiator because nothing shades the craft', () => {
  const b = quickDesignBrief(defaultQuickDesign('SUN_SENTINEL', 'EXPERT'));
  expect(b.design.parts.find(p => p.partId === 'SS_RADIATOR')?.qty).toBe(2);
  expect(b.budgets.orbit?.eclipseFrac).toBe(0);
  expect(b.budgets.technical!.thermalHotEquilibriumK).toBeLessThan(THERMAL_MODELS.SMALLSAT.operatingMaxK.v);
  expect(b.budgets.technical!.thermalColdEquilibriumK).toBeGreaterThan(THERMAL_MODELS.SMALLSAT.operatingMinK.v);
 });
});
