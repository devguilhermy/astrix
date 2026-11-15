import { describe, expect, it } from 'bun:test';
import { computeBudgets } from '../design';
import { crewReturnWindow, crewReturnFuel } from '../return';
import { scoreMission } from '../score';
import { missionRequirements } from '../journey';
import { createStarterDesign } from '../catalog';
import { createSim } from './state';
import { issueCommand } from './commands';
import { history, nextBoundary, telemetry } from './selectors';
import { stepSim } from './step';

describe('crew support transaction boundaries', () => {
 it('consumes time for onboard procedures without radio and retains mass during metabolism', () => {
  const initial = createSim(createStarterDesign('CREW_PATHFINDER', 'ASPIRING'), 73);
  const issued = issueCommand(initial, { kind: 'CREW_FAN', on: false }, 'SPACECRAFT', { role: 'SPACECRAFT', playerId: 'operator' });
  expect(issued.ok).toBe(true);
  if (!issued.ok) return;
  expect(telemetry(issued.value).crew?.fanOn).toBe(true);
  expect(telemetry(issued.value).commandQueue.at(-1)).toMatchObject({ status: 'IN_TRANSIT', transport: 'ONBOARD', actor: { playerId: 'operator' } });
  expect(nextBoundary(issued.value)?.kind).toBe('COMMAND');
  const result = stepSim(issued.value, 60), after = telemetry(result.state), before = telemetry(initial);
  expect(after.crew?.fanOn).toBe(false);
  expect(after.crew!.waterKg).toBeLessThan(before.crew!.waterKg);
  expect(after.mass.retainedKg).toBeCloseTo(before.mass.retainedKg, 8);
  expect(history(result.state)[0].t).toBe(0);
 });
});
 it('exposes a finite unpowered-scrubber CO₂ rise without changing retained mass', () => {
  let state = createSim(createStarterDesign('CREW_PATHFINDER', 'ASPIRING'), 73);
  const issued = issueCommand(state, { kind: 'CREW_FAN', on: false }, 'SPACECRAFT');
  if (!issued.ok) throw new Error(issued.code);
  state = issued.value;
  while (state.t < 60) state = stepSim(state, 60).state;
  const initial = telemetry(state);
  while (state.t < 660 && !telemetry(state).ended) state = stepSim(state, 600).state;
  const final = telemetry(state);
  expect(final.crew!.co2MmHg - initial.crew!.co2MmHg).toBeGreaterThan(1.4);
  expect(final.crew!.co2MmHg - initial.crew!.co2MmHg).toBeLessThan(1.8);
  expect(final.mass.retainedKg).toBeCloseTo(initial.mass.retainedKg, 8);
 });

it('guards deorbit by the authored window and computes a positive fuel reserve', () => {
 const d = createStarterDesign('CREW_PATHFINDER', 'ASPIRING');
 const state = createSim(d, 73);
 const early = issueCommand(state, { kind: 'CREW_DEORBIT' }, 'LAUNCH_ORBIT');
 expect(early).toMatchObject({ ok: false, code: 'NOT_READY', values: { nextSec: 12 * 3600 } });
 expect(telemetry(state).crew?.returnWindowOpen).toBe(false);
 expect(telemetry(state).crew?.nextReturnWindowSec).toBe(12 * 3600);
});

it('records recovered early success only when actual data and support are achieved', () => {
 const d = createStarterDesign('CREW_PATHFINDER', 'ASPIRING');
 const advance = (initial: ReturnType<typeof createSim>, target: number) => {
  let s = initial, guard = 0;
  while (s.t < target && !telemetry(s).ended) { s = stepSim(s, Math.min(1000, target - s.t - telemetry(s).remainderSec)).state; if (++guard > 50000) throw new Error('no progress'); }
  return s;
 };
 const apply = (s: ReturnType<typeof createSim>, c: Parameters<typeof issueCommand>[1]) => { const q = issueCommand(s, c, 'ALL'); if (!q.ok) throw new Error(q.code); return q.value; };
 let state = createSim(d, 73);
 state = apply(state, { kind: 'POINT', mode: 'TARGET' });
 state = apply(state, { kind: 'INSTRUMENT', partId: 'CREW_OBSERVER', on: true });
 state = advance(state, 6000);
 state = apply(state, { kind: 'INSTRUMENT', partId: 'CREW_OBSERVER', on: false });
 state = apply(state, { kind: 'DOWNLINK', on: true });
 state = advance(state, 8000);
 expect(telemetry(state).objective.value).toBeGreaterThanOrEqual(100);
 state = advance(state, 12 * 3600);
 state = apply(state, { kind: 'CREW_DEORBIT' });
 state = advance(state, 12 * 3600 + 10 + 6 * 3600);
 expect(telemetry(state).crew).toMatchObject({ phase: 'COMPLETE', earlyReturn: true });
 expect(scoreMission(state, d, { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 }).outcome).toBe('SUCCESS');
 const support = missionRequirements(d, state).find(r => r.id === 'CREW-SUPPORT-01');
 expect(support).toMatchObject({ target: 'support-through-recovery', unit: 'h', result: 'PASS' });
 expect(support!.actual).toBeCloseTo(state.t / 3600, 8);
 expect(missionRequirements(d, state).find(r => r.id === 'CREW-DURATION-01')?.result).toBe('FAIL');
});

it('does not award success for recovery without the data objective', () => {
 const d = createStarterDesign('CREW_PATHFINDER', 'ASPIRING');
 let s = createSim(d, 73), guard = 0;
 while (s.t < 12 * 3600 && !telemetry(s).ended) { s = stepSim(s, Math.min(1000, 12 * 3600 - s.t - telemetry(s).remainderSec)).state; if (++guard > 50000) throw new Error('no progress'); }
 const q = issueCommand(s, { kind: 'CREW_DEORBIT' }, 'ALL'); if (!q.ok) throw new Error(q.code); s = q.value;
 while (!telemetry(s).ended) { s = stepSim(s, 1000).state; if (++guard > 50000) throw new Error('no recovery'); }
 expect(telemetry(s).crew?.phase).toBe('COMPLETE');
 const results = missionRequirements(d, s);
 expect(results.find(r => r.id === 'CREW-SUPPORT-01')?.result).toBe('PASS');
 expect(results.find(r => r.id === 'SCI-DATA-01')?.result).toBe('FAIL');
 expect(results.find(r => r.id === 'CREW-DURATION-01')?.result).toBe('FAIL');
 expect(scoreMission(s, d, { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 }).outcome).toBe('FAILURE');
});

it('integrates crew metabolism consistently across advance partitions', () => {
 const initial = createSim(createStarterDesign('CREW_PATHFINDER', 'ASPIRING'), 73);
 const run = (chunk: number) => {
  let s = initial, guard = 0;
  while (s.t < 1800 && !telemetry(s).ended) {
   s = stepSim(s, Math.min(chunk, 1800 - s.t - telemetry(s).remainderSec)).state;
   if (++guard > 10000) throw new Error('no progress');
  }
  return telemetry(s);
 };
 const a = run(10), b = run(1000);
 expect(a.t).toBe(b.t);
 expect(a.crew!.waterKg).toBeCloseTo(b.crew!.waterKg, 10);
 expect(a.crew!.cabinCO2Kg).toBeCloseTo(b.crew!.cabinCO2Kg, 10);
 expect(a.mass.retainedKg).toBeCloseTo(b.mass.retainedKg, 10);
});

it('uses explicit return window edges and finite positive rocket-equation fuel', () => {
 expect(crewReturnWindow(12 * 3600 - 1)).toMatchObject({ open: false, nextSec: 1 });
 expect(crewReturnWindow(12 * 3600)).toMatchObject({ open: true, remainingSec: 600 });
 expect(crewReturnWindow(12 * 3600 + 600)).toMatchObject({ open: false, nextSec: 4800 });
 const d = createStarterDesign('CREW_PATHFINDER', 'ASPIRING');
 const fuel = crewReturnFuel(d.orbit!, computeBudgets(d).massKg.used, 320);
 expect(fuel).toBeGreaterThan(0);
 expect(fuel).toBeLessThan(d.parts.find(p => p.partId === 'CREW_PROPULSION')!.propellantKg!);
});
