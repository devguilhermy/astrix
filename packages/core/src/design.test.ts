import { describe, expect, it } from 'bun:test';
import * as api from './index';
import type { CoreAPI, Design, LevelId, Quote, RoleId } from './contracts';
import { BUSES, CAPTURE_ORBITS, MODEL, PARTS, RIDES, listAssumptions, listSources } from './catalog';
import { createStarterDesign, listMissions, missionById } from './mission/library';
import { computeBudgets, launchReadiness, planPropellant, previewOrbit, quoteAddPart, quoteRemovePart, quoteSetOrbit, quoteSetPropellant, quoteSetRide, rolesAffectedBy } from './design';
import { CORE_I18N_DEFAULTS, I18N_KEYS, CATALOG_I18N_KEYS } from './i18nKeys';
import { CONSTANTS, withOrbitAltitudes, makeOrbit } from './physics';
import { LEVELS } from './models';
import { summarizeMission } from './score';

const implementation: CoreAPI = api;
const signoffs: Record<RoleId, boolean> = { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true };
function accepted<T>(quote: Quote<T>): T { if (!quote.ok) throw new Error(`${quote.code}: ${JSON.stringify(quote.values)}`); return quote.value; }
describe('catalogue provenance and stable consumer API', () => {
 it('qualifies hardware, constants, buses, difficulty and model numbers with resolvable provenance', () => {
  const sources = new Set(listSources().map(s => s.id));
  expect(sources.size).toBe(listSources().length);
  const walk = (value: unknown): void => {
   if (!value || typeof value !== 'object') return;
   if ('v' in value) {
    expect(value).toHaveProperty('p');
    const q = value as { v: unknown; p: { kind: string; src?: string; note?: string } };
    expect(Number.isFinite(q.v)).toBe(true);
    if (q.p.kind === 'source') expect(sources.has(q.p.src!)).toBe(true); else { expect(q.p.kind).toBe('assumption'); expect(q.p.note!.length).toBeGreaterThan(10); }
   } else for (const item of Object.values(value)) walk(item);
  };
  walk(PARTS); walk(BUSES); walk(MODEL); walk(LEVELS); walk(CONSTANTS); walk(RIDES); walk(listMissions({ origin: 'BUILTIN' }));
  for (const p of PARTS) for (const field of ['massKg', 'volume', 'cost', 'powerW'] as const) expect(p[field]).toHaveProperty('p');
  expect(new Set(PARTS.map(p => p.id)).size).toBe(PARTS.length);
 });
 it('exports every emitted catalogue locale key with an English authoring default', () => {
  expect(new Set(I18N_KEYS).size).toBe(I18N_KEYS.length);
  for (const key of CATALOG_I18N_KEYS) expect(CORE_I18N_DEFAULTS[key]?.length).toBeGreaterThan(0);
 });
});
describe('design refusals, boundaries and complete starter behavior', () => {
 it('supplies editable charged-for starter hardware valid at every difficulty', () => {
  for (const scenario of listMissions({ origin: 'BUILTIN' })) for (const difficulty of Object.keys(LEVELS) as LevelId[]) {
   const design = createStarterDesign(scenario, difficulty), budgets = computeBudgets(design);
   const readiness = launchReadiness(design, signoffs);
   expect(readiness.some(r => r.code === 'UNSUPPORTED_RULES')).toBe(false);
   if (scenario.id !== 'CREW_PATHFINDER') {
    const missing = scenario.vehicle.requiredPartIds.find(id => !design.parts.some(part => part.partId === id));
    expect(missing).toBeDefined();
    expect(readiness).toContainEqual(expect.objectContaining({ code: 'REQUIRES_PART', values: { needs: missing } }));
   }
   expect(budgets.cost.used).toBeGreaterThan(BUSES[design.busId].cost.v);
   expect(budgets.cost.used).toBeLessThanOrEqual(budgets.cost.limit);
   expect(budgets.massKg.used).toBeLessThan(budgets.massKg.limit);
   expect(design.parts.every(i => PARTS.find(p => p.id === i.partId)?.busId === design.busId)).toBe(true);
   const removed = accepted(quoteRemovePart(design, design.parts[0].partId, 'ALL')).next;
   expect(removed.parts.length).toBe(design.parts.length - 1);
   expect(rolesAffectedBy(design, removed)).toEqual(['SPACECRAFT']);
  }
 });
 it('uses required role, compatibility, uniqueness, volume, mass, cost, dependency order', () => {
  const d = createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING');
  expect(quoteAddPart(d, 'SS_XBAND', 'SCIENCE')).toMatchObject({ ok: false, code: 'ROLE_LOCKED' });
  expect(quoteAddPart(d, 'SS_XBAND', 'ALL')).toMatchObject({ ok: false, code: 'RIDE_MISMATCH' });
  expect(quoteAddPart(d, 'ADCS_WHEELS', 'ALL')).toMatchObject({ ok: false, code: 'DUPLICATE_UNIQUE' });
  const packed: Design = { ...d, parts: [{ partId: 'BATT_40', qty: 10 }] };
  expect(quoteAddPart(packed, 'CAM_EO', 'ALL')).toMatchObject({ ok: false, code: 'NO_SLOT' });
  const exactMass: Design = { ...d, parts: [{ partId: 'SOLAR_BODY', qty: 23 }, { partId: 'RADIO_UHF', qty: 1 }] };
  expect(quoteAddPart(exactMass, 'OBC', 'ALL')).toMatchObject({ ok: false, code: 'MASS_OVER_LIMIT' });
  const costly: Design = { ...d, parts: [{ partId: 'RADIO_SBAND', qty: 8 }, { partId: 'ADCS_MAG', qty: 1 }] };
  expect(quoteAddPart(costly, 'RADIO_SBAND', 'ALL')).toMatchObject({ ok: false, code: 'OVER_BUDGET' });
  const noAdcs = accepted(quoteRemovePart(d, 'ADCS_MAG', 'ALL')).next;
  expect(quoteAddPart(noAdcs, 'RADIO_SBAND', 'ALL')).toMatchObject({ ok: false, code: 'REQUIRES_PART' });
 });
 it('enforces strict SmallSat mass, tank and non-negative finite fuel with atomic refusal', () => {
  let d = accepted(quoteAddPart(createStarterDesign(missionById('RED_RELAY'), 'ASPIRING'), 'SS_PROP_MONO', 'ALL')).next;
  const original = structuredClone(d), dry = computeBudgets(d).massKg.used;
  expect(quoteSetPropellant(d, 180 - dry, 'ALL')).toMatchObject({ ok: false, code: 'MASS_OVER_LIMIT' });
  expect(quoteSetPropellant(d, 121, 'ALL')).toMatchObject({ ok: false, code: 'PROPELLANT_OVER_TANK' });
  for (const invalid of [-1, NaN, Infinity]) expect(quoteSetPropellant(d, invalid, 'ALL')).toMatchObject({ ok: false, code: 'PROPELLANT_OVER_TANK' });
  expect(d).toEqual(original);
  d = accepted(quoteSetPropellant(d, 180 - dry - .000001, 'ALL')).next;
  expect(computeBudgets(d).massKg.used).toBeLessThan(180);
  expect(quoteSetPropellant(d, 1, 'LAUNCH_ORBIT')).toMatchObject({ ok: false, code: 'ROLE_LOCKED' });
 });
 it('validates ride and exact offered paths without silently swapping orbits', () => {
  const d = createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING');
  expect(quoteSetRide(d, 'RIDE_MARS_TRANSFER', 'ALL')).toMatchObject({ ok: false, code: 'RIDE_MISMATCH' });
  expect(quoteSetOrbit(d, withOrbitAltitudes(d.orbit!, 421, 421, 51.6), 'ALL')).toMatchObject({ ok: false, code: 'ORBIT_NOT_OFFERED' });
  const custom = accepted(quoteSetRide(d, 'RIDE_SMALL_LAUNCHER', 'ALL')).next;
  expect(quoteSetOrbit(custom, makeOrbit('EARTH', 350, 350, 98, d.orbit!.epochUTC), 'ALL').ok).toBe(true);
  expect(quoteSetOrbit(custom, makeOrbit('EARTH', 349.99, 349.99, 98, d.orbit!.epochUTC), 'ALL')).toMatchObject({ code: 'ORBIT_NOT_OFFERED' });
  expect(quoteSetOrbit(custom, makeOrbit('EARTH', 400, 800, 45, d.orbit!.epochUTC), 'ALL')).toMatchObject({ code: 'ORBIT_NOT_OFFERED' });
  expect(quoteSetRide(d, 'RIDE_SMALL_LAUNCHER', 'SCIENCE')).toMatchObject({ code: 'ROLE_LOCKED' });
 });
 it('reports missing hardware and every unsigned role without power-based launch coercion', () => {
  const d = createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING');
  const noRadio = accepted(quoteRemovePart(d, 'RADIO_UHF', 'ALL')).next;
  expect(launchReadiness(noRadio, { ...signoffs, SCIENCE: false })).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NOT_READY', values: { missing: 'radio' } }), expect.objectContaining({ code: 'SIGNOFF_BLOCKED', values: { role: 'SCIENCE' } })]));
  const withPayload = accepted(quoteAddPart(d, 'CAM_EO', 'ALL')).next;
  const noSolar = accepted(quoteRemovePart(withPayload, 'SOLAR_BODY', 'ALL')).next;
  expect(computeBudgets(noSolar).power!.avgGenW).toBe(0);
  expect(launchReadiness(noSolar, signoffs)).toEqual([]);
 });
 it('uses the same quotes for Guided paths and Technical manual edits', () => {
  const d = createStarterDesign(missionById('RED_RELAY'), 'ASPIRING');
  for (const preset of api.listOrbitPresets(d)) {
   const preview = accepted(previewOrbit(d, preset.id, 'ALL'));
   const manual = accepted(quoteSetOrbit(d, preset.orbit, 'ALL'));
   expect(preview.next).toEqual(manual.next);
   expect(preview.after).toEqual(computeBudgets(manual.next));
   expect(preview.before).toEqual(computeBudgets(d));
  }
  expect(previewOrbit(d, 'MARS_CLOSE', 'SCIENCE')).toMatchObject({ code: 'ROLE_LOCKED' });
 });
 it('plans fuel for actual dry hardware and never bypasses mass/tank/cost checks', () => {
  let d = accepted(quoteAddPart(createStarterDesign(missionById('RED_RELAY'), 'ASPIRING'), 'SS_PROP_MONO', 'ALL')).next;
  d = accepted(quoteAddPart(d, 'SS_MAPPER', 'ALL')).next;
  const fuel = accepted(planPropellant(d, 'ALL'));
  expect(fuel.requiredKg).toBeGreaterThan(0);
  expect(fuel.after.deltaV!.availableKms).toBeCloseTo(fuel.after.deltaV!.requiredKms * 1.1, 9);
  const closeOrbit = accepted(quoteSetOrbit(d, CAPTURE_ORBITS[0], 'ALL')).next;
  const before = structuredClone(closeOrbit), rejected = planPropellant(closeOrbit, 'ALL');
  expect(rejected.ok).toBe(false); expect(closeOrbit).toEqual(before);
  expect(planPropellant(d, 'LAUNCH_ORBIT')).toMatchObject({ code: 'ROLE_LOCKED' });
 });
 it('keeps forecast unknown when the path is missing and recomputes custom paths exactly', () => {
  const d = createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING'), unknown = { ...d, orbit: null };
  const b = computeBudgets(unknown);
  expect(b.power).toBeNull(); expect(b.data).toBeNull(); expect(b.orbit).toBeNull();
  expect(summarizeMission(unknown, b, null).energy).toEqual({ generation: 'UNKNOWN', eclipseBattery: 'UNKNOWN' });
  expect(computeBudgets(d)).toEqual(computeBudgets(structuredClone(d)));
 });
});
