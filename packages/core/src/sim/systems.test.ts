import { describe, expect, it } from 'bun:test';
import type { Design, SimState } from '../contracts';
import { createStarterDesign } from '../catalog';
import { computeBudgets, launchReadiness, planPropellant, previewOrbit, quoteSetOrbit } from '../design';
import { ENGINEERING, RULES_VERSION, lifeFactor, thermalEquilibriumK, thermalStepK } from '../models';
import { DAY, hohmann, lightTime, rocketDeltaV, sunDirection } from '../physics';
import { scoreMission } from '../score';
import { applyCommand, applyDueCommands, issueCommand } from './commands';
import { createSim, flight, markPracticeRetry } from './state';
import { failureReport, telemetry } from './selectors';
import { skipCruise, stepSim } from './step';
import { accepted, advanceTo, command, referenceDesign } from './testSupport';
import { attitudeHardware, holdTarget, refreshAttitude } from './attitude';
import { attitudeDistance } from '../attitude';

const signed = { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true };
/** Isolated contact fixture for subsystem unit cases; playability uses actual geometry. */
function connected(state: SimState) { const s = flight(structuredClone(state)); s.inContact = true; s.lineOfSight = true; s.stationAvailable = true; return s; }
function technical(scenario: Design['scenarioId'] = 'FIRST_LIGHT') { return flight(createSim(referenceDesign(scenario, 'EXPERT'), 42)); }

describe('immutable mission profile and shared launch authority', () => {
 it('freezes a paid design snapshot and rejects unsupported rules, while starters do not contain free mission payloads', () => {
  const d = referenceDesign('FIRST_LIGHT', 'EXPERT'), s = flight(createSim(d, 42));
  expect(Object.isFrozen(s.design)).toBe(true); expect(Object.isFrozen(s.design.parts)).toBe(true);
  expect(telemetry(s)).toMatchObject({ levelId: 'EXPERT', rulesVersion: RULES_VERSION, assisted: false });
  const starter = createStarterDesign('FIRST_LIGHT', 'EXPERT');
  expect(starter.parts.some(p => p.partId === 'CAM_EO' || p.partId === 'HEATER_6')).toBe(false);
  expect(launchReadiness(starter, signed).some(r => r.code === 'REQUIRES_PART')).toBe(true);
  expect(launchReadiness({ ...d, rulesVersion: RULES_VERSION + 1 }, signed)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNSUPPORTED_RULES' })]));
  expect(() => createSim({ ...d, rulesVersion: RULES_VERSION + 1 }, 42)).toThrow();
  expect(() => markPracticeRetry(s)).toThrow();
  expect(issueCommand(s, { kind: 'HEATER', mode: 'ON' }, 'SCIENCE')).toMatchObject({ code: 'ROLE_LOCKED' });
  expect(issueCommand(createSim(referenceDesign('FIRST_LIGHT'), 42), { kind: 'HEATER', mode: 'ON' }, 'ALL')).toMatchObject({ code: 'LEVEL_FORBIDS' });
 });
 it('refuses a real BOL-pass/EOL-fail hardware combination using the actual forecast coefficients', () => {
  const base = referenceDesign('FIRST_LIGHT', 'EXPERT');
  const d: Design = { ...base, parts: [...base.parts.filter(p => !['SOLAR_WINGS', 'CAM_EO', 'RADIO_SBAND'].includes(p.partId)), { partId: 'RADIO_SBAND', qty: 1 }, { partId: 'SOLAR_BODY', qty: 2 }, { partId: 'CAM_EO', qty: 2 }, { partId: 'MAG', qty: 4 }] };
  const b = computeBudgets(d);
  expect(b.technical!.bolGenerationW).toBeGreaterThan(b.power!.avgLoadW);
  expect(b.technical!.eolGenerationW).toBeLessThan(b.power!.avgLoadW);
  const refusal = launchReadiness(d, signed).find(r => r.code === 'POWER_EOL_SHORT');
  expect(refusal?.values.generationW).toBe(b.technical!.eolGenerationW);
  expect(refusal?.values.requiredW).toBe(b.power!.avgLoadW);
 });
 it('keeps wide-orbit eclipse refusal and funds balanced-orbit capture instead of waiving reserve', () => {
  const balanced = referenceDesign('RED_RELAY', 'EXPERT');
  const b = computeBudgets(balanced);
  expect(b.technical!.eclipseRequiredWh).toBeLessThan(b.technical!.eolUsableBatteryWh);
  expect(launchReadiness(balanced, signed)).toEqual([]);
  const preset = accepted(previewOrbit(balanced, 'MARS_WIDE', 'ALL')).next;
  // Equinox departure places the arrival Sun near the allowed equatorial plane;
  // aligning only the apsides cannot remove the real obliquity/beta angle.
  const epochUTC = '2026-03-20T12:00:00Z';
  const sun = sunDirection('MARS', hohmann().transferSec, undefined, epochUTC);
  const wideOrbit = accepted(quoteSetOrbit(preset, { ...preset.orbit!, epochUTC, argPeriapsisDeg: Math.atan2(sun[1], sun[0]) * 180 / Math.PI }, 'ALL')).next;
  const wide = accepted(planPropellant(wideOrbit, 'ALL')).next;
  const w = computeBudgets(wide);
  expect(w.technical!.eclipseRequiredWh).toBeGreaterThan(w.technical!.eolUsableBatteryWh);
  expect(launchReadiness(wide, signed)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ECLIPSE_RESERVE_SHORT' })]));
  expect(b.deltaV!.requiredKms).toBeGreaterThan(w.deltaV!.requiredKms);
  expect(b.deltaV!.propellantKg).toBeGreaterThan(w.deltaV!.propellantKg);
  expect(b.massKg.used).toBeLessThan(b.massKg.limit);
  expect(b.cost.used).toBeLessThanOrEqual(b.cost.limit);
 });
});
describe('T1 thermal conservation, convergence and paid heater control', () => {
 it('retains analytic equilibrium and converges between 10-second and 5-second midpoint steps', () => {
  for (const bus of ['CUBESAT_3U', 'SMALLSAT'] as const) {
   const watts = bus === 'SMALLSAT' ? 100 : 8, equilibrium = thermalEquilibriumK(bus, watts);
   expect(thermalStepK(bus, equilibrium, watts, 10)).toBeCloseTo(equilibrium, 12);
   let coarse = 330, fine = 330;
   for (let n = 0; n < DAY / 10; n++) { coarse = thermalStepK(bus, coarse, watts, 10); fine = thermalStepK(bus, thermalStepK(bus, fine, watts, 5), watts, 5); }
   expect(Math.abs(coarse - fine)).toBeLessThan(.001);
   expect(coarse).toBeGreaterThanOrEqual(equilibrium - .001);
   expect(coarse).toBeLessThan(330);
  }
 });
 it('debits actual heater electricity and restores heat rather than granting a free thermal controller', () => {
  const initial = connected(technical()); initial.temperatureK = 270; initial.socWh = 30;
  const off = stepSim(command(initial, { kind: 'HEATER', mode: 'OFF' }), 10).state;
  const on = stepSim(command(initial, { kind: 'HEATER', mode: 'ON' }), 10).state;
  expect(telemetry(on).socWh).toBeCloseTo(telemetry(off).socWh - 6 * 10 / 3600, 10);
  expect(telemetry(on).thermal!.temperatureK).toBeGreaterThan(telemetry(off).thermal!.temperatureK);
  const thermostat = connected(technical()); thermostat.temperatureK = 277;
  expect(telemetry(thermostat).thermal!.heaterW).toBe(6);
  thermostat.heaterOn = true; thermostat.temperatureK = 283;
  expect(telemetry(thermostat).thermal!.heaterW).toBe(6);
  thermostat.temperatureK = 287;
  expect(telemetry(thermostat).thermal!.heaterW).toBe(0);
 });
 it('inhibits payload after operating dwell and records terminal survival dwell without erasing achieved science', () => {
  const initial = technical(); initial.temperatureK = 220; initial.heaterMode = 'OFF'; initial.missionDownlinkedMB = 1500;
  const inhibited = advanceTo(initial, 30);
  expect(telemetry(inhibited).thermal!.inhibited).toBe(true);
  expect(telemetry(inhibited).ended).toBe(false);
  const failed = advanceTo(inhibited, ENGINEERING.thermalDwellSec.v);
  expect(failureReport(failed)?.causeKey).toBe('failure.THERMAL_SURVIVAL.title');
  expect(failureReport(failed)?.facts[0].values.dwellSec).toBeGreaterThanOrEqual(600);
  const score = scoreMission(failed, initial.design, { roles: 1, signoffs: 1, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 });
  expect(score).toMatchObject({ outcome: 'FAILURE', scienceAchieved: true, stars: 0 });
 });
});
describe('T2 life envelope and T3 finite/degraded pointing', () => {
 it('applies monotonic factors once with no negative capacity or energy creation', () => {
  for (const eol of [ENGINEERING.arrayEol.v, ENGINEERING.batteryEol.v]) {
   const factors = [0, .25, .5, 1, 2].map(fraction => lifeFactor(fraction * DAY, DAY, eol));
   expect(factors[0]).toBe(1); expect(factors.at(-1)).toBe(eol);
   for (let n = 1; n < factors.length; n++) expect(factors[n]).toBeLessThanOrEqual(factors[n - 1]);
  }
  const initial = technical(), next = flight(advanceTo(initial, 3600));
  expect(next.capacityWh).toBeCloseTo(initial.nominalCapacityWh * lifeFactor(3600, 14 * DAY, ENGINEERING.batteryEol.v), 12);
  expect(next.socWh).toBeLessThanOrEqual(next.capacityWh);
  expect(next.arrayFactor).toBeLessThanOrEqual(initial.arrayFactor);
 });
 it('requires finite geometric slew and preserves actual progress across repeated requests', () => {
  let s: SimState = command(connected(technical()), { kind: 'POINT', mode: 'TARGET' });
  s = command(connected(s), { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true });
  s = advanceTo(s, 20); const before = telemetry(s).attitude.q;
  s = command(connected(s), { kind: 'POINT', mode: 'TARGET' });
  expect(telemetry(s).attitude.q).toEqual(before);
  s = advanceTo(s, 30);
  expect(telemetry(s).storedMB).toBe(0);
  expect(telemetry(s).pointing.state).toBe('ACQUIRING');
  s = advanceTo(s, 3600);
  expect(telemetry(s).attitude.instrumentTargetDeg).toBeLessThan(15);
  expect(telemetry(s).storedMB).toBeGreaterThan(0);
 });
 it('charges finite reacquisition time/energy and keeps degraded coarse hardware after recovery', () => {
  const initial = connected(technical()); initial.pointing.faulted = true; initial.pointing.state = 'DEGRADED'; initial.pointing.quality = 0; initial.socWh = 30;
  let s = command(initial, { kind: 'REACQUIRE_POINTING' });
  expect(telemetry(s).pointing.state).toBe('REACQUIRING');
  s = advanceTo(s, ENGINEERING.reacquireSec.v);
  expect(telemetry(s).pointing).toMatchObject({ state: 'SETTLED', faulted: true, reacquisitions: 1 });
  expect(telemetry(s).pointing.quality).toBeCloseTo(Math.cos(attitudeHardware(flight(s)).accuracy),12);
  expect(flight(s).interventionEnergyWh).toBeCloseTo(2 * 180 / 3600, 12);
  expect(applyCommand(flight(s), { kind: 'REACQUIRE_POINTING' }, [])?.code).toBe('NOT_READY');
 });
 it('scales actual instrument data and power through declared duty control', () => {
  const initial = connected(technical('STORM_WATCH'));
  let full = command(initial, { kind: 'INSTRUMENT', partId: 'RAD_MON', on: true });
  const half = command(connected(full), { kind: 'DUTY_CYCLE', partId: 'RAD_MON', fraction: .5 });
  expect(telemetry(full).loadW - telemetry(half).loadW).toBeCloseTo(.25, 12);
  full = stepSim(full, 10).state;
  expect(telemetry(stepSim(half, 10).state).storedMB).toBeCloseTo(telemetry(full).storedMB / 2, 12);
 });
});
describe('T4 contact allocation and expiring requests, T5 reset recovery', () => {
 it('distinguishes contact gating, propagation and receipt expiry with every timestamp retained', () => {
  const initial = technical(); initial.inContact = false;
  let s = flight(command(initial, { kind: 'POINT', mode: 'TARGET' }));
  expect(s.queue.at(-1)).toMatchObject({ status: 'WAITING_CONTACT', transmittedAt: null, applyAt: null, issuedAt: 0 });
  const expiry = 17; s.queue = s.queue.map(e => ({ ...e, expiresAt: expiry }));
  s = flight(advanceTo(s, 100));
  expect(s.queue.at(-1)).toMatchObject({ status: 'EXPIRED', resolvedAt: expiry, expiresAt: expiry, issuedAt: 0, transmittedAt: null });
  expect(telemetry(s).mode).toBe('SUN');
  const received = connected(technical());
  received.queue.push({ id: 'equal-expiry', actor: { role: 'ALL' }, transport: 'GROUND', command: { kind: 'POINT', mode: 'TARGET' }, issuedAt: 0, transmittedAt: 0, applyAt: 0, expiresAt: 0, resolvedAt: null, status: 'IN_TRANSIT' });
  applyDueCommands(received, []);
  expect(received.queue[0].status).toBe('EXPIRED');
 });
 it('starts Technical Mars propagation at actual transmitted contact, not request time, then settles pointing at receipt plus acquisition', () => {
  let s = command(skipCruise(technical('RED_RELAY')).state, { kind: 'CAPTURE_CONFIRM' });
  s = stepSim(s, 0).state;
  const issuedAt = s.t;
  expect(telemetry(s).link.stationAllocated).toBe(false);
  s = command(s, { kind: 'POINT', mode: 'TARGET' });
  expect(telemetry(s).commandQueue.at(-1)?.status).toBe('WAITING_CONTACT');
  let guard = 0;
  while (telemetry(s).commandQueue.at(-1)?.status === 'WAITING_CONTACT') {
   s = stepSim(s, 120).state;
   if (++guard > 2000) throw new Error('No real Mars uplink window found');
  }
  const transmitted = telemetry(s).commandQueue.at(-1)!;
  expect(transmitted.transmittedAt!).toBeGreaterThan(issuedAt);
  expect(transmitted.applyAt!).toBeCloseTo(transmitted.transmittedAt! + lightTime(transmitted.transmittedAt!, flight(s).design.orbit!.epochUTC), 8);
  s = advanceTo(s, transmitted.applyAt! - .001);
  expect(telemetry(s).commandQueue.at(-1)?.status).toBe('IN_TRANSIT');
  s = advanceTo(s, transmitted.applyAt!);
  expect(telemetry(s).commandQueue.at(-1)).toMatchObject({ status: 'DELIVERED', issuedAt, resolvedAt: transmitted.applyAt });
  expect(telemetry(s).pointing.state).toBe('ACQUIRING');
  const rate = attitudeHardware(flight(s)).rate, distance = attitudeDistance(telemetry(s).attitude.q,telemetry(s).attitude.target);
  const acquired = transmitted.applyAt! + Math.ceil((distance/rate+120)/10)*10;
  s = advanceTo(s,acquired);
  expect(telemetry(s).attitude.instrumentTargetDeg).toBeLessThan(10);
  expect(telemetry(s).mode).toBe('TARGET');
 });
 it('only robust mode tolerates the degraded quality envelope and never defeats geometry or station allocation', () => {
  const s = connected(technical()); s.deployment.antenna = 'DEPLOYED'; s.mode = 'EARTH'; s.pointing.requested = 'EARTH'; s.downlinkRequested = true; s.storedMB = 100; s.linkQuality = .45;
  s.attitude.q = holdTarget(s,'EARTH'); refreshAttitude(s);
  expect(telemetry(s).link.activeRateKbps).toBe(0);
  expect(telemetry(s).link.unavailableReason).toBe('QUALITY');
  s.linkMode = 'ROBUST'; expect(telemetry(s).link.activeRateKbps).toBeGreaterThan(0);
  s.inContact = false; s.stationAvailable = false;
  expect(telemetry(s).link.activeRateKbps).toBe(0); expect(telemetry(s).link.unavailableReason).toBe('STATION');
  s.stationAvailable = true; s.lineOfSight = false;
  expect(telemetry(s).link.unavailableReason).toBe('GEOMETRY');
 });
 it('lets reset win exact command-arrival ties, enforces cooldown and boot energy, retains data and refuses stale requests', () => {
  const initial = technical(); initial.resetAt = 10; initial.storedMB = 100; initial.missionStoredMB = 100;
  initial.queue.push({ id: 'arrival-tie', actor: { role: 'ALL' }, transport: 'GROUND', command: { kind: 'INSTRUMENT', partId: 'CAM_EO', on: true }, issuedAt: 0, transmittedAt: 0, applyAt: 10, expiresAt: 1000, resolvedAt: null, status: 'IN_TRANSIT' });
  let s = flight(stepSim(initial, 10).state);
  expect(s.queue[0]).toMatchObject({ status: 'REFUSED', resolvedAt: 10, refusal: { code: 'COMPUTER_REBOOTING' } });
  expect(s.computerState).toBe('REBOOTING'); expect(s.storedMB).toBe(100);
  expect(applyCommand(s, { kind: 'RECOVER_COMPUTER' }, [])?.code).toBe('RECOVERY_COOLDOWN');
  s = flight(advanceTo(s, 310)); s.socWh = 0;
  expect(applyCommand(s, { kind: 'RECOVER_COMPUTER' }, [])?.code).toBe('INSUFFICIENT_ENERGY');
  s.socWh = 20; expect(applyCommand(s, { kind: 'RECOVER_COMPUTER' }, [])).toBeNull();
  s = flight(advanceTo(s, 430));
  expect(telemetry(s)).toMatchObject({ safe: true, downlinkRequested: false, computer: { state: 'RUNNING', recoveries: 1 }, instruments: [{ on: false }] });
  expect(s.storedMB).toBe(100); expect(s.interventionEnergyWh).toBeCloseTo(3 * 120 / 3600, 12);
  s.queue.push({ id: 'stale-after-boot', actor: { role: 'ALL' }, transport: 'GROUND', command: { kind: 'SAFE', on: false }, issuedAt: 0, transmittedAt: 0, applyAt: s.t, expiresAt: 1000, resolvedAt: null, status: 'IN_TRANSIT' });
  applyDueCommands(s, []);
  expect(s.queue.at(-1)?.refusal?.code).toBe('COMMAND_INVALIDATED'); expect(s.safe).toBe(true);
 });
});
describe('T6 seeded capture-demand reserve', () => {
 it('plans the upper envelope and consumes only the seeded realized burn demand', () => {
  const d = referenceDesign('RED_RELAY', 'EXPERT'), a = createSim(d, 42), b = createSim(d, 42);
  expect(telemetry(a).capture).toEqual(telemetry(b).capture);
  const before = telemetry(a).capture!;
  expect(before.realizedKms).toBeGreaterThanOrEqual(before.nominalKms * .96);
  expect(before.realizedKms).toBeLessThanOrEqual(before.planningKms);
  expect(before.availableKms).toBeCloseTo(before.planningKms, 9);
  const arrived = skipCruise(a).state, captured = flight(command(arrived, { kind: 'CAPTURE_CONFIRM' }));
  const consumed = before.propellantKg - captured.propellantKg;
  expect(rocketDeltaV(captured.dryMassKg + captured.propellantKg, consumed, captured.ispSec)).toBeCloseTo(before.realizedKms, 10);
  expect(captured.propellantKg).toBeGreaterThanOrEqual(0);
  expect(telemetry(captured).capture!.realizedKms).toBe(before.realizedKms);
 });
});
