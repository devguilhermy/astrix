import { describe, expect, it } from 'bun:test';
import { RADLAB_PROFILE } from '@astrix/data';
import type { SimState } from '../contracts';
import { MODEL, createStarterDesign } from '../catalog';
import { computeBudgets, quoteAddPart, quoteRemovePart, quoteSetPropellant } from '../design';
import { DAY, hohmann, lightTime, rocketDeltaV } from '../physics';
import { next } from '../rng';
import { scoreMission } from '../score';
import { issueCommand } from './commands';
import { createSim, markPracticeRetry } from './state';
import { failureReport, history, telemetry } from './selectors';
import { skipCruise, stepSim } from './step';
import { accepted, advanceTo, command, commandAndWait, commission, referenceDesign, resolveCommand } from './testSupport';

function arrive(state: SimState): SimState {
 const skipped = skipCruise(state);
 expect(skipped.events.map(e => e.kind)).toEqual(['CAPTURE_BURN']);
 const confirmed = command(skipped.state, { kind: 'CAPTURE_CONFIRM' });
 const decision = stepSim(confirmed, 10);
 expect(decision.events.map(e => e.kind)).toEqual(['CAPTURE_DONE']);
 expect(decision.state.t).toBe(skipped.state.t);
 return decision.state;
}
describe('deterministic, immutable flight transactions', () => {
 it('matches the pinned mulberry32 arithmetic and keeps explicit RNG state', () => {
  let seed = 42;
  const closure = (): number => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let explicit = 42;
  for (let i = 0; i < 100; i++) { const [value, state] = next(explicit); expect(value).toBe(closure()); explicit = state; }
 });
 it('never mutates inputs, survives structured clone and repeats exactly', () => {
  const original = commission(createSim(referenceDesign('FIRST_LIGHT'), 42)), snapshot = structuredClone(original);
  const pointed = commandAndWait(original, { kind: 'POINT', mode: 'TARGET' });
  const switched = commandAndWait(pointed, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true });
  const a = advanceTo(switched, switched.t + DAY), b = advanceTo(structuredClone(switched), switched.t + DAY);
  expect(original).toEqual(snapshot); expect(a).toEqual(b); expect(telemetry(a).storedMB).toBeGreaterThan(0);
  expect(JSON.parse(JSON.stringify(a))).toEqual(a);
 });
 it('applies real ownership to commands and requires explicit SAFE exit', () => {
  let state = commission(createSim(referenceDesign('FIRST_LIGHT'), 42));
  expect(issueCommand(state, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true }, 'GROUND_COMMS')).toMatchObject({ code: 'ROLE_LOCKED' });
  expect(issueCommand(state, { kind: 'POINT', mode: 'EARTH' }, 'GROUND_COMMS')).toMatchObject({ code: 'ROLE_LOCKED' });
  state = commandAndWait(state, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true });
  state = commandAndWait(state, { kind: 'SAFE', on: true });
  expect(telemetry(state)).toMatchObject({ safe: true, mode: 'SAFE', downlinkRequested: false, instruments: [{ partId: 'CAM_EO', on: false, lost: false }] });
  const point = resolveCommand(state, { kind: 'POINT', mode: 'TARGET' });
  expect(point.receipt).toMatchObject({ status: 'REFUSED', refusal: { code: 'MODE_FORBIDS' } });
  const instrument = resolveCommand(point.state, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true });
  expect(instrument.receipt).toMatchObject({ status: 'REFUSED', refusal: { code: 'MODE_FORBIDS' } });
  state = commandAndWait(instrument.state, { kind: 'SAFE', on: false });
  expect(telemetry(state)).toMatchObject({ safe: false, mode: 'SUN', instruments: [{ on: false }] });
  expect(issueCommand(state, { kind: 'POINT', mode: 'TARGET' }, 'SCIENCE').ok).toBe(true);
  expect(issueCommand(state, { kind: 'POINT', mode: 'TARGET' }, 'SPACECRAFT').ok).toBe(true);
 });
 it('stops large frames at the first decision, then resumes without repeating the edge', () => {
  let state = createSim(referenceDesign('FIRST_LIGHT'), 42), passT = 0;
  for (let n = 0; n < 100; n++) {
   const result = stepSim(state, 4000); state = result.state;
   const decision = result.events.find(e => e.autoPause);
   if (decision) expect(state.t).toBe(decision.t);
   if (decision?.kind === 'PASS_START') { passT = state.t; break; }
  }
  expect(passT).toBeGreaterThan(0);
  const resumed = stepSim(state, 10);
  expect(resumed.state.t).toBe(passT + 10);
  expect(resumed.events.some(e => e.kind === 'PASS_START' && e.autoPause)).toBe(false);
  const limited = stepSim(createSim(referenceDesign('FIRST_LIGHT'), 42), 1e8);
  expect(limited.state.t).toBeLessThanOrEqual(4000);
  expect(limited.events.some(e => e.autoPause)).toBe(true);
 });
 it('queues through contact, refuses invalid arrival state and actually returns image data', () => {
  let state = commission(createSim(referenceDesign('FIRST_LIGHT'), 42));
  const requested = issueCommand(state, { kind: 'DOWNLINK', on: true }, 'ALL');
  if (!requested.ok) throw new Error(requested.code);
  expect(telemetry(requested.value).commandQueue.at(-1)?.status).toBe('WAITING_CONTACT');
  const bad = resolveCommand(state, { kind: 'DOWNLINK', on: true });
  // A hold name is not a v4 transmitter prerequisite; an empty store still refuses.
  expect(bad.receipt).toMatchObject({ status: 'REFUSED', refusal: { code: 'STORAGE_EMPTY' } });
  expect(telemetry(bad.state).attitude.hold).toBe('SUN');
  expect(telemetry(bad.state).downlinkActive).toBe(false);
  state = commandAndWait(bad.state, { kind: 'POINT', mode: 'EARTH' });
  const empty = resolveCommand(state, { kind: 'DOWNLINK', on: true });
  expect(empty.receipt).toMatchObject({ status: 'REFUSED', refusal: { code: 'STORAGE_EMPTY' } });
  state = commandAndWait(empty.state, { kind: 'POINT', mode: 'TARGET' });
  state = commandAndWait(state, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true });
  state = advanceTo(state, state.t + 4 * 3600);
  expect(telemetry(state).storedMB).toBeGreaterThan(0); expect(telemetry(state).downlinkedMB).toBe(0);
  state = commandAndWait(state, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: false });
  state = commandAndWait(state, { kind: 'POINT', mode: 'EARTH' });
  state = commandAndWait(state, { kind: 'DOWNLINK', on: true });
  const before = telemetry(state).downlinkedMB;
  state = advanceTo(state, state.t + 10);
  expect(telemetry(state).downlinkedMB).toBeGreaterThan(before);
  expect(telemetry(state).objective.value).toBeCloseTo(telemetry(state).downlinkedMB, 9);
 });
 it('caps storage and pauses once per crossing instead of once per warped frame', () => {
  let state = createSim(referenceDesign('FIRST_LIGHT'), 42);
  state = command(state, { kind: 'POINT', mode: 'TARGET' }); state = command(state, { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true });
  let storageT = 0;
  for (let i = 0; i < 200; i++) {
   const result = stepSim(state, 4000); state = result.state;
   if (result.events.some(e => e.kind === 'STORAGE_NEAR_FULL')) { storageT = state.t; break; }
  }
  expect(storageT).toBeGreaterThan(0);
  expect(telemetry(state).storedMB).toBeGreaterThanOrEqual(1800);
  const resumed = stepSim(state, 1000); expect(resumed.state.t).toBeGreaterThan(storageT); expect(resumed.events.some(e => e.kind === 'STORAGE_NEAR_FULL')).toBe(false);
  state = advanceTo(resumed.state, storageT + 2 * DAY);
  expect(telemetry(state).storedMB).toBeLessThanOrEqual(telemetry(state).storageMB);
  expect(state.dataLostMB).toBeGreaterThan(0);
 });
 it('distinguishes low battery from brownout, forces SAFE and captures the first immutable fatal facts', () => {
  const base = accepted(quoteAddPart(createStarterDesign('FIRST_LIGHT', 'ASPIRING'), 'CAM_EO', 'ALL')).next;
  const d = accepted(quoteRemovePart(base, 'SOLAR_BODY', 'ALL')).next;
  let state = createSim(d, 42), low = 0, brownouts = 0;
  while (!telemetry(state).ended && state.t < 2 * DAY) {
   const result = stepSim(state, 4000); state = result.state;
   for (const event of result.events) {
    if (event.kind === 'BATTERY_LOW') { low++; expect(telemetry(state).socWh).toBeGreaterThan(0); }
    if (event.kind === 'BROWNOUT') { brownouts++; expect(telemetry(state)).toMatchObject({ safe: true, mode: 'SAFE', socWh: 0 }); }
   }
  }
  expect(low).toBe(1); expect(brownouts).toBe(1); expect(telemetry(state).ended).toBe(true);
  const report = failureReport(state); expect(report?.causeKey).toBe('failure.BATTERY_DEPLETED.title');
  expect(report?.facts[0].key).toBe('fact.BATTERY');
  expect(failureReport(stepSim(state, DAY).state)).toEqual(report);
 });
 it('requires an explicit assisted practice retry instead of granting free Cadet repair', () => {
  const base = accepted(quoteAddPart(createStarterDesign('FIRST_LIGHT', 'ASPIRING'), 'CAM_EO', 'ALL')).next;
  const d = accepted(quoteRemovePart(base, 'SOLAR_BODY', 'ALL')).next;
  const checkpoint = createSim(d, 42), saved = structuredClone(checkpoint);
  let state = advanceTo(checkpoint, 4 * DAY);
  expect(telemetry(state).ended).toBe(true);
  expect(failureReport(state)?.causeKey).toBe('failure.BATTERY_DEPLETED.title');
  const score = scoreMission(state, d, { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 });
  expect(score.outcome).toBe('FAILURE'); expect(score.stars).toBe(0);
  state = markPracticeRetry(checkpoint);
  expect(telemetry(state).assisted).toBe(true);
  expect((state.audit as { kind: string }[]).at(-1)?.kind).toBe('REWIND');
  expect(telemetry(state).socWh).toBe(telemetry(saved).socWh);
  expect(checkpoint).toEqual(saved);
 });
});
describe('historical profile, exact events and Mars arrival', () => {
 it('replays actual RadLab hourly means, never shields dose in SAFE, and pauses once at exact storm boundaries', () => {
  let state = createSim(referenceDesign('STORM_WATCH'), 42);
  state = advanceTo(state, 9 * DAY);
  expect(telemetry(state).doseUGyH).toBe(RADLAB_PROFILE.hourly[0].meanUGyH);
  const safe = command(state, { kind: 'SAFE', on: true }); expect(telemetry(safe).doseUGyH).toBe(telemetry(state).doseUGyH);
  state = advanceTo(safe, 9 * DAY + 3600);
  expect(telemetry(state).doseUGyH).toBe(RADLAB_PROFILE.hourly[1].meanUGyH);
  const resumed = stepSim(state, 10); expect(resumed.state.t).toBe(state.t + 10); expect(resumed.events.some(e => e.kind === 'SOLAR_STORM_START')).toBe(false);
  state = advanceTo(resumed.state, 11 * DAY); expect(telemetry(state).doseUGyH).toBe(RADLAB_PROFILE.stats.median);
  expect(telemetry(state).safe).toBe(true);
 });
 it('skips exactly the Hohmann transfer, pauses for capture and consumes physically correct fuel', () => {
  const d = referenceDesign('RED_RELAY'), b = computeBudgets(d), start = createSim(d, 42), skipped = skipCruise(start);
  expect(telemetry(start).cruise).toBe(true);
  expect(skipped.state.t).toBe(hohmann().transferSec); expect(skipped.state.t / DAY).toBeCloseTo(258.9, 0);
  expect(telemetry(skipped.state)).toMatchObject({ cruise: false, capturePending: true, ended: false });
  expect(stepSim(skipped.state, DAY).state.t).toBe(skipped.state.t);
  const captured = command(skipped.state, { kind: 'CAPTURE_CONFIRM' });
  const beforeFuel = b.deltaV!.propellantKg, afterFuel = captured.propellantKg as number, dry = b.massKg.used - beforeFuel;
  expect(afterFuel).toBeGreaterThan(0); expect(afterFuel).toBeLessThan(beforeFuel);
  expect(rocketDeltaV(dry + afterFuel, beforeFuel - afterFuel, 220)).toBeCloseTo(b.deltaV!.requiredKms, 10);
  expect(captured.elapsed).toBe(0); expect(telemetry(captured).capturePending).toBe(false);
  expect(stepSim(captured, 100).events.map(e => e.kind)).toEqual(['CAPTURE_DONE']);
 });
 it('fails capture with no fuel instead of inventing an orbit or consuming negative fuel', () => {
  const d = accepted(quoteSetPropellant(referenceDesign('RED_RELAY'), 0, 'ALL')).next;
  const arrival = skipCruise(createSim(d, 42)).state;
  const state = command(arrival, { kind: 'CAPTURE_CONFIRM' });
  expect(telemetry(state)).toMatchObject({ ended: true, capturePending: true });
  expect(failureReport(state)?.causeKey).toBe('failure.CAPTURE_FAILED.title');
  expect(state.propellantKg).toBe(0);
 });
 it('delivers commands at exact one-way light time after contact and refuses impossible arrivals', () => {
  let state = arrive(createSim(referenceDesign('RED_RELAY'), 42));
  const issuedAt = state.t;
  state = command(state, { kind: 'POINT', mode: 'TARGET' });
  expect(telemetry(state).mode).toBe('SUN'); expect(telemetry(state).queued).toBe(1);
  expect(telemetry(state).commandQueue.at(-1)).toMatchObject({ status: 'WAITING_CONTACT', issuedAt, transmittedAt: null, applyAt: null });
  let guard = 0;
  while (telemetry(state).commandQueue.at(-1)?.status === 'WAITING_CONTACT') { state = stepSim(state, 120).state; if (++guard > 10000) throw new Error('No Mars uplink'); }
  const transmitted = telemetry(state).commandQueue.at(-1)!;
  expect(transmitted.applyAt!).toBeCloseTo(transmitted.transmittedAt! + lightTime(transmitted.transmittedAt!, referenceDesign('RED_RELAY').orbit!.epochUTC), 8);
  state = advanceTo(state, transmitted.applyAt! - .001); expect(telemetry(state).mode).toBe('SUN');
  state = advanceTo(state, transmitted.applyAt!); expect(telemetry(state).mode).toBe('TARGET'); expect(telemetry(state).commandQueue.at(-1)?.status).toBe('DELIVERED');
  state = commandAndWait(state, { kind: 'SAFE', on: true });
  const refused = resolveCommand(state, { kind: 'INSTRUMENT', partId: 'SS_MAPPER', on: true });
  expect(telemetry(refused.state).safe).toBe(true); expect(refused.receipt).toMatchObject({ status: 'REFUSED', refusal: { code: 'MODE_FORBIDS' } });
  state = commandAndWait(refused.state, { kind: 'SAFE', on: false });
  state = commandAndWait(state, { kind: 'INSTRUMENT', partId: 'SS_MAPPER', on: true });
  expect(telemetry(state).safe).toBe(false); expect(telemetry(state).instruments[0].on).toBe(true);
 });
 it('does not count unrelated measurements as the delivered-image objective', () => {
  let d = accepted(quoteAddPart(createStarterDesign('FIRST_LIGHT', 'ASPIRING'), 'CAM_EO', 'ALL')).next;
  d = accepted(quoteAddPart(d, 'RAD_MON', 'ALL')).next;
  let state = commandAndWait(commission(createSim(d, 42)), { kind: 'INSTRUMENT', partId: 'RAD_MON', on: true });
  state = advanceTo(state, state.t + 4 * 3600);
  for (let n = 0; n < 10000 && !telemetry(state).inContact; n++) state = stepSim(state, 10).state;
  state = commandAndWait(state, { kind: 'DOWNLINK', on: true }); state = advanceTo(state, state.t + DAY);
  expect(telemetry(state).downlinkedMB).toBeGreaterThan(0); expect(telemetry(state).objective.value).toBe(0);
 });
 it('retains history under a fixed cap and does not copy it at substeps without samples', () => {
  const start = createSim(referenceDesign('FIRST_LIGHT'), 42), stepped = stepSim(start, 10).state;
  expect(history(start)).toBe(history(stepped));
  const recorded = advanceTo(stepped, MODEL.historyEverySec.v);
  expect(history(recorded)).not.toBe(history(start)); expect(history(start)).toHaveLength(1);
 });
});

it('charges radio receive power, not transmit power, once the persistent send request empties storage', () => {
 const base = accepted(quoteAddPart(createStarterDesign('FIRST_LIGHT', 'ASPIRING'), 'CAM_EO', 'ALL')).next;
 const d = accepted(quoteAddPart(base, 'RAD_MON', 'ALL')).next;
 let s = commandAndWait(commission(createSim(d, 42)), { kind: 'INSTRUMENT', partId: 'RAD_MON', on: true });
 s = advanceTo(s, s.t + 100);
 s = commandAndWait(s, { kind: 'INSTRUMENT', partId: 'RAD_MON', on: false });
 for (let i = 0; i < 10000 && !telemetry(s).inContact; i++) s = stepSim(s, 10).state;
 s = commandAndWait(s, { kind: 'DOWNLINK', on: true });
 for (let i = 0; i < 20000 && telemetry(s).storedMB > 0; i++) s = stepSim(s, 10).state;
 expect(telemetry(s)).toMatchObject({ storedMB: 0, downlinkRequested: true, downlinkActive: false });
 s = stepSim(s, 10).state;
 expect(s.loadW).toBe(telemetry(s).loadW);
 expect(telemetry(s).loadW).toBeCloseTo(2.3, 12);
});
