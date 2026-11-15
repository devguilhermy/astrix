import { describe, expect, it } from 'bun:test';
import type { Command, LevelId, SimEvent, SimState } from '../contracts';
import { createStarterDesign, scenarioById } from '../catalog';
import { launchReadiness } from '../design';
import { missionRequirements } from '../journey';
import { scoreMission } from '../score';
import { issueCommand } from './commands';
import { failureReport, telemetry } from './selectors';
import { createSim } from './state';
import { stepSim } from './step';

const signed = { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true } as const;
const team = { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 };

/** Reference crew procedures use only public requests, receipts, telemetry and time advances. */
function flyCrew(level: LevelId): void {
 const design = createStarterDesign('CREW_PATHFINDER', level);
 expect(launchReadiness(design, signed)).toEqual([]);
 let state: SimState = createSim(design, scenarioById('CREW_PATHFINDER').seed);
 const events: SimEvent[] = [];
 const executed = new Set<string>();
 const receipts = new Set<string>();
 let recoveryStartedAt: number | null = null;
 let recoveryWaterKg: number | null = null;
 let guard = 0;
 const issue = (cmd: Command): void => {
  const result = issueCommand(state, cmd, 'ALL', { role: 'ALL', playerId: 'crew-pilot' });
  if (!result.ok) throw new Error(`${cmd.kind} refused at issue: ${result.code} ${JSON.stringify(result.values)}`);
  state = result.value;
 };
 while (!telemetry(state).ended) {
  const t = telemetry(state), crew = t.crew!;
  for (const receipt of t.commandQueue) {
   if (!receipts.has(receipt.id) && receipt.status === 'DELIVERED') {
    receipts.add(receipt.id); executed.add(receipt.command.kind);
   } else if (!receipts.has(receipt.id) && (receipt.status === 'REFUSED' || receipt.status === 'EXPIRED')) {
    // A reset may invalidate an accepted ground request; reassess actual state.
    receipts.add(receipt.id);
    if (!receipt.refusal) throw new Error(`Resolved request ${receipt.id} has no refusal reason`);
    expect(['COMMAND_INVALIDATED', 'COMPUTER_REBOOTING', 'COMMAND_EXPIRED']).toContain(receipt.refusal.code);
   }
  }
  const pending = t.commandQueue.filter(q => q.status === 'WAITING_CONTACT' || q.status === 'IN_TRANSIT');
  const onboardPending = pending.some(q => q.transport === 'ONBOARD');
  const groundPending = pending.some(q => q.transport === 'GROUND');
  if (!onboardPending && (crew.phase === 'ON_ORBIT' || crew.phase === 'RECOVERY') && crew.activeScrubberKg <= 1e-8 && crew.spareScrubberKg > 0) issue({ kind: 'CREW_CARTRIDGE' });
  else if (!onboardPending && (crew.phase === 'ON_ORBIT' || crew.phase === 'RECOVERY') && crew.leakActive && !crew.isolated) issue({ kind: 'CREW_ISOLATE', isolated: true });
  else if (!onboardPending && (crew.phase === 'ON_ORBIT' || crew.phase === 'RECOVERY') && crew.isolated && crew.inspiredOxygenMmHg < 147) issue({ kind: 'CREW_REPRESSURIZE' });
  else if (!onboardPending && !groundPending && crew.phase === 'ON_ORBIT' && t.t >= 72 * 3600 && crew.returnWindowOpen && t.objective.value >= t.objective.target) {
   issue({ kind: 'CREW_DEORBIT' });
  } else if (!groundPending && crew.phase === 'ON_ORBIT') {
   if (t.computer.state === 'REBOOTING' && t.computer.cooldownRemainingSec <= 0) issue({ kind: 'RECOVER_COMPUTER' });
   else if (t.computer.state !== 'RUNNING') { /* The cooldown and paid boot advance below. */ }
   else if (t.safe) issue({ kind: 'SAFE', on: false });
   else if (level === 'EXPERT' && t.pointing.faulted && t.pointing.reacquisitions === 0 && t.pointing.state !== 'REACQUIRING') issue({ kind: 'REACQUIRE_POINTING' });
   else if (t.pointing.state === 'REACQUIRING') { /* Wait for actual reacquisition. */ }
   else if (level === 'EXPERT' && t.link.quality < 1 && t.link.mode !== 'ROBUST') issue({ kind: 'LINK_MODE', mode: 'ROBUST' });
   else if (level === 'EXPERT' && t.link.quality === 1 && t.link.mode !== 'NORMAL') issue({ kind: 'LINK_MODE', mode: 'NORMAL' });
   else if (t.objective.value < t.objective.target) {
    const observer = t.instruments.find(i => i.partId === 'CREW_OBSERVER')!;
    if (t.attitude.hold !== 'TARGET') issue({ kind: 'POINT', mode: 'TARGET' });
    else if (t.storedMB < 150 && !observer.on) issue({ kind: 'INSTRUMENT', partId: 'CREW_OBSERVER', on: true });
    else if (t.storedMB >= 150 && observer.on) issue({ kind: 'INSTRUMENT', partId: 'CREW_OBSERVER', on: false });
    else if (t.storedMB >= 150 && !t.downlinkRequested) issue({ kind: 'DOWNLINK', on: true });
   } else {
    const observer = t.instruments.find(i => i.partId === 'CREW_OBSERVER')!;
    if (observer.on) issue({ kind: 'INSTRUMENT', partId: 'CREW_OBSERVER', on: false });
    else if (t.downlinkRequested) issue({ kind: 'DOWNLINK', on: false });
    else if (t.attitude.hold !== 'SUN') issue({ kind: 'POINT', mode: 'SUN' });
   }
  }
  const remainingToNominal = 72 * 3600 - state.t - telemetry(state).remainderSec;
  const step = remainingToNominal > 0 ? Math.min(300, remainingToNominal) : 300;
  const advanced = stepSim(state, step);
  state = advanced.state;
  for (const event of advanced.events) {
   events.push(event);
   if (event.kind === 'CREW_RECOVERY') { recoveryStartedAt = event.t; recoveryWaterKg = telemetry(state).crew!.waterKg; }
  }
  if (++guard > 20000) throw new Error(`Crew pilot made no terminal progress: ${JSON.stringify(telemetry(state))}`);
 }
 const final = telemetry(state), crew = final.crew!;
 expect(failureReport(state)).toBeNull();
 expect(final.objective.value).toBeGreaterThanOrEqual(final.objective.target);
 expect(crew).toMatchObject({ phase: 'COMPLETE', earlyReturn: false, fanWorking: true });
 expect(crew.orbitSec).toBeGreaterThanOrEqual(72 * 3600);
 expect(recoveryStartedAt).not.toBeNull();
 expect(final.t - recoveryStartedAt!).toBeCloseTo(6 * 3600, 6);
 expect(crew.waterKg).toBeLessThan(recoveryWaterKg!);
 expect(final.t).toBeGreaterThanOrEqual(72 * 3600 + 10 + 6 * 3600);
 expect(events.some(e => e.kind === 'CREW_CARTRIDGE_SATURATED')).toBe(true);
 expect(executed.has('CREW_CARTRIDGE')).toBe(true);
 expect(executed.has('CREW_DEORBIT')).toBe(true);
 expect(missionRequirements(design, state).find(r => r.id === 'CREW-SUPPORT-01')?.result).toBe('PASS');
 expect(missionRequirements(design, state).find(r => r.id === 'CREW-DURATION-01')?.result).toBe('PASS');
 expect(scoreMission(state, design, team).outcome).toBe('SUCCESS');
 if (level === 'EXPERT') {
  for (const kind of ['CREW_LEAK', 'POINTING_DEGRADED', 'POINTING_SETTLED', 'COMPUTER_RESET', 'COMPUTER_RECOVERED', 'LINK_DEGRADED', 'LINK_RECOVERED'] as const) expect(events.some(e => e.kind === kind)).toBe(true);
  for (const kind of ['CREW_ISOLATE', 'CREW_REPRESSURIZE', 'REACQUIRE_POINTING', 'RECOVER_COMPUTER', 'LINK_MODE']) expect(executed.has(kind)).toBe(true);
  expect(final.commandQueue.some(q => q.command.kind === 'CREW_REPRESSURIZE' && q.status === 'DELIVERED' && q.resolvedAt !== null && q.resolvedAt >= recoveryStartedAt!)).toBe(true);
  expect(final.pointing.reacquisitions).toBe(1);
  expect(final.computer.recoveries).toBe(1);
 }
}

describe('nominal crew reference flights', () => {
 for (const level of ['ASPIRING', 'EXPERT'] as const) it(`CREW_PATHFINDER ${level} completes 72 hours and recovery`, () => flyCrew(level), 60000);
});
