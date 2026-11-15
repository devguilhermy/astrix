import { describe, expect, it } from 'bun:test';
import type { LevelId, ScenarioId, SimState } from '../contracts';
import { MODEL, scenarioById } from '../catalog';
import { computeBudgets, launchReadiness } from '../design';
import { DAY } from '../physics';
import { scoreMission } from '../score';
import { createSim } from './state';
import { failureReport, history, telemetry } from './selectors';
import { skipCruise, stepSim } from './step';
import { command, referenceDesign } from './testSupport';

/** Reference pilot uses only public commands and visible onboard telemetry. */
function fly(scenario: ScenarioId, level: LevelId): SimState {
 const d = referenceDesign(scenario, level);
 expect(launchReadiness(d, { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true })).toEqual([]);
 let s = createSim(d, 42), stage: 'OBSERVE' | 'SEND' | 'DONE' = 'OBSERVE';
 const mars = scenario === 'RED_RELAY', technical = level === 'EXPERT', instrument = mars ? 'SS_MAPPER' : scenario === 'STORM_WATCH' ? 'RAD_MON' : 'CAM_EO';
 if (mars) { s = skipCruise(s).state; s = command(s, { kind: 'CAPTURE_CONFIRM' }); s = stepSim(s, 0).state; }
 else {
  for (const system of ['WINGS', 'ANTENNA'] as const) {
   const key = system === 'WINGS' ? 'wings' : 'antenna';
   if (telemetry(s).deployment[key] === 'NOT_APPLICABLE') continue;
   s = command(s, { kind: 'DEPLOY', system });
   while (telemetry(s).queued) s = stepSim(s, 30).state;
   if (telemetry(s).deployment[key] === 'ANOMALOUS') { s = command(s, { kind: 'DEPLOY_RETRY', system }); while (telemetry(s).queued) s = stepSim(s, 30).state; }
   expect(telemetry(s).deployment[key]).toBe('DEPLOYED');
  }
 }
 const arrival = mars ? s.t : 0, target = scenarioById(scenario).target.v;
 let guard = 0;
 while (!telemetry(s).ended) {
  const t = telemetry(s);
  if (t.queued === 0) {
   if (technical && t.computer.state === 'REBOOTING' && t.computer.cooldownRemainingSec <= 0) s = command(s, { kind: 'RECOVER_COMPUTER' });
   else if (t.computer.state !== 'RUNNING') { /* The paid reboot interval actually advances below. */ }
   else if (t.safe) s = command(s, { kind: 'SAFE', on: false });
   else if (technical && t.pointing.faulted && t.pointing.reacquisitions === 0 && t.pointing.state !== 'REACQUIRING') s = command(s, { kind: 'REACQUIRE_POINTING' });
   else if (t.pointing.state === 'REACQUIRING') { /* No science or repeat recovery request during acquisition. */ }
   else if (technical && t.link.quality < 1 && t.link.mode !== 'ROBUST') s = command(s, { kind: 'LINK_MODE', mode: 'ROBUST' });
   else if (technical && t.link.quality === 1 && t.link.mode !== 'NORMAL') s = command(s, { kind: 'LINK_MODE', mode: 'NORMAL' });
   else {
    if (t.objective.value >= target) stage = 'DONE';
    if (scenario !== 'STORM_WATCH' && stage !== 'DONE') {
     if (stage === 'OBSERVE' && t.storedMB >= (mars ? 6500 : 1000)) stage = 'SEND';
     if (stage === 'SEND' && t.storedMB < .001) stage = 'OBSERVE';
    }
    const desired = stage === 'DONE' || scenario === 'STORM_WATCH' ? 'SUN' : stage === 'OBSERVE' ? 'TARGET' : 'EARTH';
    const shouldObserve = stage === 'OBSERVE';
    if (t.instruments[0].on !== shouldObserve) s = command(s, { kind: 'INSTRUMENT', partId: instrument, on: shouldObserve });
    else if (t.pointing.requested !== desired) s = command(s, { kind: 'POINT', mode: desired });
    else if (stage === 'SEND' && t.mode === 'EARTH' && t.pointing.state === 'SETTLED' && !t.downlinkRequested && t.storedMB > 0 && (technical || t.inContact)) s = command(s, { kind: 'DOWNLINK', on: true });
    else if (stage === 'DONE' && t.downlinkRequested) s = command(s, { kind: 'DOWNLINK', on: false });
   }
  }
  // All decisions are explicitly acknowledged by the next public step. Technical
  // faults and receipt refusal remain observable; none is patched out for the pilot.
  s = stepSim(s, stage === 'DONE' || scenario === 'STORM_WATCH' ? 3600 : 120).state;
  if (++guard > 150000) throw new Error('Reference control recipe exceeded fixed work guard');
 }
 const final = telemetry(s);
 if (final.objective.value + 1e-8 < target || failureReport(s)) throw new Error(JSON.stringify({ scenario, level, elapsedDays: (final.t - arrival) / DAY, progress: final.objective, failure: failureReport(s), battery: final.socWh, temperatureK: final.thermal?.temperatureK, receipts: final.commandQueue.filter(q => q.status !== 'DELIVERED') }));
 expect(final.objective.value).toBeGreaterThanOrEqual(target - 1e-8);
 expect(failureReport(s)).toBeNull();
 expect(final.t - arrival).toBeCloseTo(scenarioById(scenario).durationDays.v * DAY, 5);
 expect(history(s).length).toBeLessThanOrEqual(MODEL.historyCap.v);
 const score = scoreMission(s, d, { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 });
 expect(score.outcome).toBe('SUCCESS'); expect(score.identity.levelId).toBe(level);
 if (technical) {
  expect(final.pointing.reacquisitions).toBe(1); expect(final.computer.recoveries).toBe(1);
  expect(final.powerLife.arrayFactor).toBeLessThan(1); expect(final.powerLife.batteryFactor).toBeLessThan(1);
  expect(score.interventionEnergyWh).toBeGreaterThan(0);
 }
 if (mars) { expect(history(s).length).toBeLessThanOrEqual(MODEL.historyCap.v); expect(final.capture!.propellantKg).toBeGreaterThanOrEqual(0); }
 return s;
}
describe('mission and level reference recipes', () => {
 for (const level of ['ASPIRING', 'EXPERT'] as const) for (const scenario of ['FIRST_LIGHT', 'STORM_WATCH', 'RED_RELAY'] as const) {
  it(`${scenario} ${level} completes`, () => { fly(scenario, level); }, 60000);
 }
});

it('provides a real modeled Storm Watch uplink during its authored eight-hour allocation', () => {
 const d = referenceDesign('STORM_WATCH', 'EXPERT');
 expect(computeBudgets(d).orbit!.contactMinPerDay).toBeGreaterThan(0);
});
