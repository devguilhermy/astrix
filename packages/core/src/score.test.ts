import { describe, expect, it } from 'bun:test';
import type { TeamStats } from './contracts';
import { createStarterDesign, missionById } from './mission/library';
import { computeBudgets } from './design';
import { scoreMission, scoreStars, summarizeMission } from './score';
import { referenceDesign } from './sim/testSupport';
import { createSim, flight } from './sim/state';

const solo: TeamStats = { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 };
describe('explained score model', () => {
 it('uses exact star boundaries', () => {
  for (const [points, stars] of [[0, 0], [19, 0], [20, 1], [39, 1], [40, 2], [59, 2], [60, 3], [79, 3], [80, 4], [94, 4], [95, 5], [100, 5]] as const) expect(scoreStars(points)).toBe(stars);
 });
 it('weights actual progress, difficulty budget, healthy time, margins and team exactly once', () => {
  const d = referenceDesign('STORM_WATCH');
  // A controlled completed-time snapshot isolates score arithmetic from propagation tests.
  const s = { ...flight(createSim(d, 42)), elapsed: 1000, radiationHours: 12, healthySec: 800, marginBadSec: 300 };
  const team: TeamStats = { roles: 4, signoffs: 4, blockedSignoffAttempts: 1, sev3Raised: 2, sev3ResolvedBeforeLaunch: 1 };
  const result = scoreMission(s, d, team), values = Object.fromEntries(result.components.map(c => [c.key, c.value]));
  expect(result.components.map(c => c.weight)).toEqual([.45, .15, .2, .1, .1]);
  expect(values['score.objective']).toBe(.5); expect(values['score.health']).toBe(.8); expect(values['score.margins']).toBe(.7); expect(values['score.team']).toBe(4 / 6);
  expect(values['score.efficiency']).toBeCloseTo((computeBudgets(d).cost.limit - computeBudgets(d).cost.used) / computeBudgets(d).cost.limit, 12);
  expect(result.total).toBe(Math.round(100 * (.45 * .5 + .15 * values['score.efficiency'] + .2 * .8 + .1 * .7 + .1 * (4 / 6))));
  expect(result.identity.levelId).toBe('ASPIRING');
  expect(result.identity).toMatchObject({ levelId: d.levelId, rulesVersion: d.rulesVersion, seed: 42, assisted: false });
  expect(result.outcome).toBe('PROVISIONAL');
 });
 it('does not reward unbounded signoffs and caps every component', () => {
  const d = referenceDesign('FIRST_LIGHT'), s = { ...flight(createSim(d, 42)), elapsed: 100, healthySec: 200, marginBadSec: 200, missionDownlinkedMB: 99999 };
  const score = scoreMission(s, d, { ...solo, roles: 4, signoffs: 1000, sev3Raised: 2, sev3ResolvedBeforeLaunch: 100 });
  expect(score.components.every(c => c.value >= 0 && c.value <= 1)).toBe(true);
  expect(score.total).toBeLessThanOrEqual(100);
 });
 it('keeps weight/room and generation/eclipse statuses separate with revision identity', () => {
  const d = createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING'), b = computeBudgets(d);
  const summary = summarizeMission(d, { ...b, power: { avgGenW: 100, avgLoadW: 10, marginPct: 900, eclipseWh: 20, usableBatteryWh: 8 } }, null);
  expect(summary.fit).toEqual({ mass: 'FITS', room: 'FITS' });
  expect(summary.energy).toEqual({ generation: 'ENOUGH', eclipseBattery: 'SHORT' });
  expect(summary.sourceRevision).toBe(d.revision);
  expect(summary.progress).toMatchObject({ value: 0, target: 1500, metricKey: 'metric.DOWNLINK_MB' });
 });
});
