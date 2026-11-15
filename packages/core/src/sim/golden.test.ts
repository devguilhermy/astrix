import { describe, expect, it } from 'bun:test';
import type { Command, Design, SimEvent, SimState } from '../contracts';
import { listOrbitPresets } from '../catalog';
import { computeBudgets, previewOrbit, quoteSetOrbit } from '../design';
import { DAY } from '../physics';
import { scoreMission } from '../score';
import { issueCommand } from './commands';
import { createSim } from './state';
import { telemetry } from './selectors';
import { stepSim } from './step';
import { accepted, commission, referenceDesign } from './testSupport';

const team = { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 };
/** Replay timed public requests through different display-frame partitions. */
function trace(design: Design, frameSec: number) {
 let state: SimState = commission(createSim(design, 42));
 const events: SimEvent[] = [], commands: { t: number; command: Command; result: string }[] = [];
 const log: { t: number; cmd: Command }[] = [];
 for (let day = 0; day < 3; day++) {
  const base = day * DAY;
  log.push({ t: base, cmd: { kind: 'POINT', mode: 'TARGET' } }, { t: base, cmd: { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true } }, { t: base + 4 * 3600, cmd: { kind: 'INSTRUMENT', partId: 'CAM_EO', on: false } }, { t: base + 4 * 3600, cmd: { kind: 'POINT', mode: 'EARTH' } }, { t: base + 6 * 3600, cmd: { kind: 'DOWNLINK', on: true } });
 }
 for (const entry of [...log, { t: 3 * DAY, cmd: null }]) {
  let guard = 0;
  while (state.t < entry.t - 1e-7) {
   const remaining = entry.t - state.t - telemetry(state).remainderSec;
   const result = stepSim(state, Math.min(frameSec, Math.max(0, remaining)));
   events.push(...result.events); state = result.state;
   if (++guard > 200000) throw new Error('Replay did not reach the timed command');
  }
  if (entry.cmd) {
   const quote = issueCommand(state, entry.cmd, 'ALL');
   commands.push({ t: state.t, command: entry.cmd, result: quote.ok ? 'OK' : quote.code });
   if (quote.ok) state = quote.value;
  }
 }
 return { seed: 42, budgets: computeBudgets(design), commands, events, score: scoreMission(state, design, team), state };
}
describe('rules-v4 consumer replay invariants rather than incidental serialized numeric wording', () => {
 for (const profile of ['ASPIRING', 'EXPERT'] as const) {
  it(`${profile} matches absolute-tick events, receipts, histories, objective and RNG across frame partitions`, () => {
   const d = referenceDesign('FIRST_LIGHT', profile);
   const a = trace(d, 7), b = trace(structuredClone(d), 3600);
   expect(a).toEqual(b);
   expect(a.state.t).toBe(3 * DAY);
   expect(a.commands.some(c => c.result === 'OK')).toBe(true);
   expect(a.score.identity).toMatchObject({ levelId: profile, rulesVersion: 4, seed: 42 });
   expect(Math.hypot(...telemetry(a.state).attitude.q)).toBeCloseTo(1,12);
  }, 30000);
 }
 it('flies preset and equivalent manual orbit edits with identical commands and scores', () => {
  const base = referenceDesign('FIRST_LIGHT'), preset = listOrbitPresets(base)[1];
  const guided = accepted(previewOrbit(base, preset.id, 'ALL')).next, manual = accepted(quoteSetOrbit(base, preset.orbit, 'ALL')).next;
  expect(trace(guided, 120)).toEqual(trace(manual, 120));
 }, 30000);
});
