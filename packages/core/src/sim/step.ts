import type { SimEvent, SimEventKind, SimState } from '../contracts';
import { MODEL, PART_BY_ID, scenarioById } from '../catalog';
import { ENGINEERING, THERMAL_MODELS, isTechnical, lifeFactor, thermalStepK } from '../models';
import { DAY, clamp, solarFactor } from '../physics';
import { applyDueCommands, bootPowerW } from './commands';
import { fail } from './failure';
import { advanceCrew, CREW_MODEL } from './crew';
import { cloneFlight, electricalLoadW, enterSafe, flight, generatedPowerW, heaterDemandW, objectiveValue, recordAudit, sample, stormBounds, transmittingRate, updateEnvironment, type FlightState } from './state';
import { advanceAttitude, attitudeHardware, refreshAttitude } from './attitude';

function emit(s: FlightState, events: SimEvent[], kind: SimEventKind, autoPause: boolean, values: Record<string, number | string> = {}): void { events.push({ kind, t: s.t, autoPause, values }); }
/** Faults win ties with command arrivals: a command never runs on a just-reset computer. */
function scheduled(s: FlightState, events: SimEvent[]): void {
 const scenario = scenarioById(s.design.scenarioId), technical = isTechnical(s.design.levelId), [stormStart, stormEnd] = stormBounds(s);
 if (!s.stormStarted && s.elapsed >= stormStart) { s.stormStarted = true; emit(s, events, 'SOLAR_STORM_START', true, { doseUGyH: s.doseUGyH, source: scenario.body === 'EARTH' ? 'radlab-iss-2024-05-10' : 'model.marsStormDose' }); }
 if (!s.stormEnded && s.elapsed >= stormEnd) { s.stormEnded = true; emit(s, events, 'SOLAR_STORM_END', true); }
 if (!s.aged && s.elapsed >= s.agingAt) {
  s.aged = true;
  if (!technical) { s.capacityWh *= 1 - MODEL.batteryAgingFraction.v; s.batteryFactor = s.capacityWh / s.nominalCapacityWh; s.socWh = Math.min(s.socWh, s.capacityWh); }
  emit(s, events, 'BATTERY_AGING', true, { capacityWh: s.capacityWh, arrayFactor: s.arrayFactor, batteryFactor: s.batteryFactor, continuous: technical ? 1 : 0 });
 }
 if (scenario.body === 'EARTH' && !s.outageStarted && s.elapsed >= s.outageAt) {
  s.outageStarted = true; s.outageActive = true; s.stationAvailable = false; s.inContact = false; s.downlinkActive = false; s.nextPassAt = null; s.nextPassCheckedAt = -DAY;
  emit(s, events, 'GROUND_OUTAGE', true, { durationHours: MODEL.outageHours.v });
 }
 if (!technical) return;
 if (!s.pointingFaultSeen && s.elapsed >= s.pointingFaultAt) {
  s.pointingFaultSeen = true; s.pointing.faulted = true; s.pointing.state = 'DEGRADED'; s.pointing.quality = 0; s.pointingReadyAt = null;
  emit(s, events, 'POINTING_DEGRADED', true, { cause: 'sensor-actuator-fallback', reacquireSec: ENGINEERING.reacquireSec.v, fallbackAccuracyScale: ENGINEERING.fallbackAccuracyScale.v });
 }
 if (!s.resetSeen && s.elapsed >= s.resetAt) {
  s.resetSeen = true; s.resets++; s.computerState = 'REBOOTING'; s.commandEpochStartedAt = s.t; s.cooldownUntil = s.t + ENGINEERING.resetCooldownSec.v; s.bootReadyAt = null; enterSafe(s);
  emit(s, events, 'COMPUTER_RESET', true, { cause: 'authored-onboard-reset', cooldownSec: ENGINEERING.resetCooldownSec.v, bootSec: ENGINEERING.bootSec.v, bootPowerW: bootPowerW(s) });
 }
 if (!s.linkDegradeSeen && s.elapsed >= s.linkDegradeAt) {
  s.linkDegradeSeen = true; s.linkQuality = ENGINEERING.degradedLinkQuality.v;
  emit(s, events, 'LINK_DEGRADED', true, { quality: s.linkQuality, robustRateFactor: ENGINEERING.robustRate.v });
 }
 if (!s.linkRestoreSeen && s.elapsed >= s.linkRestoreAt) { s.linkRestoreSeen = true; s.linkQuality = 1; emit(s, events, 'LINK_RECOVERED', true); }
 if (s.pointingReadyAt !== null && s.t + 1e-8 >= s.pointingReadyAt) {
  const reacquired = s.pointing.state === 'REACQUIRING';
  if (reacquired) s.pointing.reacquisitions++;
  s.mode = s.pointing.requested; s.pointingReadyAt = null;
  s.pointing.state = s.pointing.faulted && !s.pointing.reacquisitions ? 'DEGRADED' : 'SETTLED';
  s.pointing.quality = s.pointing.state === 'DEGRADED' ? 0 : Math.cos(attitudeHardware(s).accuracy);
  refreshAttitude(s);
  emit(s, events, 'POINTING_SETTLED', reacquired, { quality: s.pointing.quality, reacquired: reacquired ? 1 : 0, interventionEnergyWh: s.interventionEnergyWh });
 }
 if (s.bootReadyAt !== null && s.t + 1e-8 >= s.bootReadyAt && s.computerState === 'RECOVERING') {
  s.bootReadyAt = null; s.computerState = 'RUNNING'; s.recoveries++; enterSafe(s);
  emit(s, events, 'COMPUTER_RECOVERED', true, { durationSec: ENGINEERING.bootSec.v, energyWh: bootPowerW(s) * ENGINEERING.bootSec.v / 3600, interventionEnergyWh: s.interventionEnergyWh });
 }
}
/** Absolute grid plus immutable event deadlines, never a fresh grid per RAF call. */
function nextBoundary(s: FlightState): number {
 let target = s.arrivalT + (Math.floor((s.t - s.arrivalT + 1e-7) / MODEL.fixedStepSec.v) + 1) * MODEL.fixedStepSec.v;
 const [start, stop] = stormBounds(s), technical = isTechnical(s.design.levelId);
 if (!s.stormStarted && start > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + start);
 if (!s.stormEnded && stop > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + stop);
 if (!s.aged && s.agingAt > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + s.agingAt);
 if (!s.outageStarted && s.design.orbit!.body === 'EARTH' && s.outageAt > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + s.outageAt);
 if (technical) {
  if (!s.pointingFaultSeen && s.pointingFaultAt > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + s.pointingFaultAt);
  if (!s.resetSeen && s.resetAt > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + s.resetAt);
  if (!s.linkDegradeSeen && s.linkDegradeAt > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + s.linkDegradeAt);
  if (!s.linkRestoreSeen && s.linkRestoreAt > s.elapsed + 1e-8) target = Math.min(target, s.arrivalT + s.linkRestoreAt);
 }
 if (technical || s.design.orbit!.body === 'MARS') {
  const offset = scenarioById(s.design.scenarioId).stationAllocationStartSec.v, dayStart = Math.floor((s.t - offset) / DAY) * DAY + offset, allocationEnd = dayStart + ENGINEERING.allocationHours.v * 3600;
  target = Math.min(target, allocationEnd > s.t + 1e-8 ? allocationEnd : dayStart + DAY);
 }
 if (!s.crew) target = Math.min(target, s.arrivalT + scenarioById(s.design.scenarioId).durationDays.v * DAY);
 if (s.crew?.phase === 'RECOVERY') target = Math.min(target, s.t + s.crew.recoveryRemainingSec);
 if (s.pointingReadyAt !== null && s.pointingReadyAt > s.t + 1e-8) target = Math.min(target, s.pointingReadyAt);
 if (s.bootReadyAt !== null && s.bootReadyAt > s.t + 1e-8) target = Math.min(target, s.bootReadyAt);
 for (const entry of s.queue) {
  if (entry.status !== 'WAITING_CONTACT' && entry.status !== 'IN_TRANSIT') continue;
  if (entry.expiresAt > s.t + 1e-8) target = Math.min(target, entry.expiresAt);
  if (entry.status === 'IN_TRANSIT' && entry.applyAt !== null && entry.applyAt > s.t + 1e-8) target = Math.min(target, entry.applyAt);
 }
 return target;
}
/** Explicit midpoint radiative integration; minimum thermal time constant >10,000 s. */
function integrateThermal(s: FlightState, dt: number, events: SimEvent[]): void {
 if (!isTechnical(s.design.levelId)) return;
 const m = THERMAL_MODELS[s.design.busId], body = scenarioById(s.design.scenarioId).body;
 s.externalHeatW = m.bodyHeatW.v + (s.sunlit ? ENGINEERING.solarFlux.v * solarFactor(body) * m.absorbingM2.v : 0);
 // All modeled electrical draw ends as heat in this one-bus approximation.
 const suppliedW = Math.min(s.loadW, Math.max(0, s.genW + s.socWh * 3600 / dt));
 s.heaterW = Math.min(s.heaterW, suppliedW); s.internalHeatW = Math.max(0, suppliedW - s.heaterW);
 const input = s.externalHeatW + s.internalHeatW + s.heaterW + (s.crew ? CREW_MODEL.count * CREW_MODEL.heatMJPerPersonDay * 1e6 / DAY : 0);
 const k = ENGINEERING.sigma.v * m.emissivity.v * m.radiatorM2.v;
 const initial = s.temperatureK;
 s.temperatureK = thermalStepK(s.design.busId, initial, input, dt);
 s.radiatedW = k * s.temperatureK ** 4; s.thermalTrend = (s.temperatureK - initial) * 3600 / dt;
 const outside = s.temperatureK < m.operatingMinK.v || s.temperatureK > m.operatingMaxK.v;
 s.thermalBadSec = outside ? s.thermalBadSec + dt : 0;
 if (s.thermalBadSec >= ENGINEERING.payloadDwellSec.v && !s.thermalInhibited) { s.thermalInhibited = true; emit(s, events, 'THERMAL_INHIBIT', true, { temperatureK: s.temperatureK, minK: m.operatingMinK.v, maxK: m.operatingMaxK.v }); }
 else if (!outside && s.thermalInhibited) { s.thermalInhibited = false; emit(s, events, 'THERMAL_RECOVERED', true, { temperatureK: s.temperatureK }); }
 s.thermalSurvivalSec = s.temperatureK < m.survivalMinK.v || s.temperatureK > m.survivalMaxK.v ? s.thermalSurvivalSec + dt : 0;
 if (s.thermalSurvivalSec >= ENGINEERING.thermalDwellSec.v && !s.ended) fail(s, 'THERMAL_SURVIVAL', events, s.t + dt);
}
function powerAndScience(s: FlightState, dt: number, oldElapsed: number, events: SimEvent[]): void {
 const scenario = scenarioById(s.design.scenarioId), technical = isTechnical(s.design.levelId);
 s.genW = generatedPowerW(s); s.heaterW = heaterDemandW(s); s.heaterOn = s.heaterW > 0; s.loadW = electricalLoadW(s);
 const radioRate = transmittingRate(s);
 if (s.pointing.state === 'REACQUIRING') s.interventionEnergyWh += ENGINEERING.reacquirePower.v * (s.design.busId === 'SMALLSAT' ? 10 : 1) * dt / 3600;
 if (s.computerState === 'RECOVERING') s.interventionEnergyWh += bootPowerW(s) * dt / 3600;
 integrateThermal(s, dt, events);
 s.socWh = clamp(s.socWh + (s.genW - s.loadW) * dt / 3600, 0, s.capacityWh);
 if (s.socWh <= 0) {
  s.depletedSec += dt; enterSafe(s);
  if (s.computerState === 'RECOVERING') { s.computerState = 'REBOOTING'; s.bootReadyAt = null; s.cooldownUntil = s.t + ENGINEERING.resetCooldownSec.v; }
  if (!s.emptyLatched) { s.emptyLatched = true; s.commandEpochStartedAt = s.t + dt; emit(s, events, 'BROWNOUT', true, { socWh: 0 }); }
 } else { s.depletedSec = 0; if (s.socWh > s.capacityWh * .05) s.emptyLatched = false; }
 const soc = s.capacityWh ? s.socWh / s.capacityWh : 0;
 if (soc <= MODEL.batteryLowPct.v / 100 && !s.lowLatched) { s.lowLatched = true; emit(s, events, 'BATTERY_LOW', true, { socPct: soc * 100 }); }
 else if (soc > .25) s.lowLatched = false;
 s.downlinkActive = !s.ended && !s.safe && s.socWh > 0 && radioRate > 0 && s.storedMB > 0 && s.computerState === 'RUNNING';
 if (s.downlinkActive) {
  const sent = Math.min(s.storedMB, radioRate * dt / 8000), objectiveSent = sent * (s.storedMB > 0 ? s.missionStoredMB / s.storedMB : 0);
  s.storedMB = Math.max(0, s.storedMB - sent); s.missionStoredMB = Math.max(0, s.missionStoredMB - objectiveSent); s.downlinkedMB += sent; s.missionDownlinkedMB += objectiveSent;
 }
 const [start, end] = stormBounds(s);
 let radiationRecorded = false;
 for (const instrument of s.instruments) {
  if (!instrument.on || instrument.lost || s.safe || s.socWh <= 0 || s.thermalInhibited || s.computerState !== 'RUNNING' || s.ended) continue;
  const p = PART_BY_ID[instrument.partId];
  if (p.requiresTarget && s.attitude.instrumentTargetDeg > p.coneHalfAngleDeg!.v || p.requiresLight && !s.sunlit) continue;
  const rate = p.rateKbps!.v * instrument.qty * instrument.dutyFraction;
  const generated = rate * dt / 8000, retained = Math.min(generated, Math.max(0, s.storageMB - s.storedMB));
  s.storedMB += retained; s.dataLostMB += generated - retained;
  const required = scenario.id === 'FIRST_LIGHT' || scenario.id === 'CREW_PATHFINDER' ? p.metric === 'IMAGES' : scenario.id === 'RED_RELAY' ? p.metric === 'MAPS' : p.metric === 'RADIATION_HOURS';
  if (required) s.missionStoredMB += retained;
  if (required && p.metric === 'RADIATION_HOURS' && retained >= generated - 1e-9) radiationRecorded = true;
 }
 if (scenario.id === 'STORM_WATCH' && radiationRecorded) {
  // Multiple monitors do not multiply hours; fractional duty does scale exposure.
  let duty = 0;
  for (const i of s.instruments) if (i.on && !i.lost && PART_BY_ID[i.partId].metric === 'RADIATION_HOURS') duty = Math.max(duty, i.dutyFraction);
  s.radiationHours += Math.max(0, Math.min(oldElapsed + dt, end) - Math.max(oldElapsed, start)) / 3600 * duty;
 }
 if (s.storageMB > 0 && s.storedMB >= s.storageMB * .9 && !s.storageLatched) { s.storageLatched = true; emit(s, events, 'STORAGE_NEAR_FULL', true, { storedMB: s.storedMB, storageMB: s.storageMB }); }
 else if (s.storedMB < s.storageMB * .8) s.storageLatched = false;
 // No per-frame randomness or dose-derived irreversible loss in practice. Technical
 // faults are seeded once at run creation and handled by the scheduled state machines.
 if (s.depletedSec >= MODEL.brownoutFatalHours.v * 3600 && !s.ended) fail(s, 'BATTERY_DEPLETED', events, s.t + dt);
 if (soc >= MODEL.healthThreshold.v && !s.ended) s.healthySec += dt;
 if (soc < MODEL.healthThreshold.v || s.storageMB > 0 && s.storedMB / s.storageMB >= .8 || technical && (s.thermalInhibited || s.pointing.state !== 'SETTLED' || s.computerState !== 'RUNNING')) s.marginBadSec += dt;
}
function updateLife(s: FlightState, events: SimEvent[]): void {
 if (!isTechnical(s.design.levelId)) return;
 const duration = scenarioById(s.design.scenarioId).durationDays.v * DAY;
 s.arrayFactor = lifeFactor(s.elapsed, duration, ENGINEERING.arrayEol.v); s.batteryFactor = lifeFactor(s.elapsed, duration, ENGINEERING.batteryEol.v);
 s.capacityWh = s.nominalCapacityWh * s.batteryFactor;
 if (s.socWh > s.capacityWh) {
  const lost = s.socWh - s.capacityWh; s.capacityLostWh += lost; s.socWh = s.capacityWh;
  if (!s.capacityClampNotified) { s.capacityClampNotified = true; emit(s, events, 'CAPACITY_CLAMPED', false, { lostWh: lost, capacityWh: s.capacityWh }); }
 }
}
export function skipCruise(state: SimState): { state: SimState; events: readonly SimEvent[] } {
 const old = flight(state);
 if (!old.cruise || old.ended) return { state, events: [] };
 const s = cloneFlight(old);
 s.t = s.arrivalT; s.elapsed = 0; s.remainderSec = 0; s.cruise = false; s.capturePending = true; s.nextSampleAt = s.t + MODEL.historyEverySec.v;
 updateEnvironment(s); s.samples = [...s.samples, sample(s, true)];
 return { state: s, events: [{ kind: 'CAPTURE_BURN', t: s.t, autoPause: true, values: { cruiseDays: s.arrivalT / DAY, requiredKms: s.captureRequiredKms, nominalKms: s.captureNominalKms, planningKms: s.capturePlanningKms, availableKms: s.captureAvailableKms, propellantKg: s.propellantKg } }] };
}
export function stepSim(state: SimState, dtSec: number): { state: SimState; events: readonly SimEvent[] } {
 const old = flight(state);
 if (!Number.isFinite(dtSec) || dtSec < 0) throw new RangeError('Simulation advance must be finite and non-negative');
 if (old.pendingEvents.length) { const s = cloneFlight(old), events = s.pendingEvents; s.pendingEvents = []; for (const event of events) recordAudit(s, { t: event.t, kind: event.kind, actor: null, owner: 'ALL', transport: 'SYSTEM', revision: s.design.revision, detail: JSON.stringify(event.values) }); return { state: s, events }; }
 if (old.ended || dtSec === 0 && old.remainderSec === 0) return { state, events: [] };
 if (old.cruise) return skipCruise(state);
 if (old.capturePending) return { state, events: [] };
 const s = cloneFlight(old), events: SimEvent[] = [], target = s.t + s.remainderSec + dtSec;
 s.remainderSec = 0;
 let steps = 0, historyCloned = false, auditedEvents = 0;
 // Events must enter the audit at their physical boundary, before later command
 // receipts in the same stepSim call. Deferring them to the call's end makes
 // audit ordering depend on the caller's display-frame partition.
 const auditEvents = (): void => {
  while (auditedEvents < events.length) {
   const event = events[auditedEvents++];
   recordAudit(s, { t: event.t, kind: event.kind, actor: null, owner: 'ALL', transport: 'SYSTEM', revision: s.design.revision, detail: JSON.stringify(event.values) });
  }
 };
 while (s.t < target - 1e-8 && !s.ended && steps < MODEL.maxFrameSteps.v) {
  const eventCountAtStart = events.length;
  scheduled(s, events); auditEvents(); applyDueCommands(s, events); auditEvents();
  if (events.some(e => e.autoPause)) break;
  const end = nextBoundary(s), dt = end - s.t;
  if (end > target + 1e-8) break;
  if (dt <= 0) break;
  const wasContact = s.inContact, oldElapsed = s.elapsed;
  // Integrate the left-hand state; no pre-fault or unsettled science leaks across a boundary.
  const priorEventCount = events.length;
  powerAndScience(s, dt, oldElapsed, events);
  advanceCrew(s, dt, events);
  s.t = end; s.elapsed = s.t - s.arrivalT;
  // Integration-threshold events describe the end of their actual integration interval.
  for (let i = priorEventCount; i < events.length; i++) events[i] = { ...events[i], t: end };
  auditEvents();
  const priorPointing = s.pointing.state;
  updateEnvironment(s); advanceAttitude(s,dt);
  if (priorPointing === 'ACQUIRING' && s.pointing.state === 'SETTLED') emit(s,events,'POINTING_SETTLED',false,{ quality: s.pointing.quality, reacquired: 0 });
  updateLife(s, events); auditEvents();
  scheduled(s, events); auditEvents(); applyDueCommands(s, events); auditEvents();
  if (s.pointingReadyAt !== null) s.pointing.remainingSec = Math.max(0, s.pointingReadyAt - s.t);
  if (s.inContact !== wasContact) { if (s.inContact) { emit(s, events, 'PASS_START', !s.firstPassSeen); s.firstPassSeen = true; } else emit(s, events, 'PASS_END', false); }
  const scenario = scenarioById(s.design.scenarioId);
  if (!s.objectiveSeen && objectiveValue(s) + 1e-9 >= scenario.target.v) { s.objectiveSeen = true; emit(s, events, 'OBJECTIVE_MET', true, { value: objectiveValue(s), target: scenario.target.v }); }
  if (!s.crew && s.elapsed + 1e-8 >= scenario.durationDays.v * DAY && !s.ended) {
   if (objectiveValue(s) + 1e-9 < scenario.target.v) fail(s, 'OBJECTIVE_MISSED', events);
   s.ended = true; emit(s, events, 'MISSION_END', true, { value: objectiveValue(s), target: scenario.target.v });
  }
  if (s.crew?.phase === 'COMPLETE' && s.ended) { if (objectiveValue(s) + 1e-9 < scenario.target.v) fail(s, 'OBJECTIVE_MISSED', events); emit(s, events, 'MISSION_END', true, { value: objectiveValue(s), target: scenario.target.v, earlyReturn: (s.crew.orbitEndSec ?? 0) < 72 * 3600 ? 1 : 0, orbitSec: s.crew.orbitEndSec ?? 0 }); }
  auditEvents();
  if (s.t + 1e-8 >= s.nextSampleAt || s.ended || events.length > eventCountAtStart) {
   if (!historyCloned) { s.samples = s.samples.slice(); historyCloned = true; }
   const value = sample(s, s.ended || events.length > eventCountAtStart);
   if (s.samples.length >= MODEL.historyCap.v) { let ordinary = 0; const reduced = s.samples.filter((entry, index) => index === 0 || entry.eventBoundary || ordinary++ % 2 === 0); s.samples = reduced.length < s.samples.length ? reduced : reduced.filter((_entry, index) => index % 2 === 0); s.historyIntervalSec *= 2; s.historyDecimated = true; }
   if (s.samples[s.samples.length - 1]?.t !== value.t) s.samples.push(value);
   if (s.t + 1e-8 >= s.nextSampleAt) s.nextSampleAt = s.t + s.historyIntervalSec;
  }
  steps++;
  if (events.some(e => e.autoPause)) break;
 }
 const paused = events.some(e => e.autoPause);
 // A decision discards unrequested post-decision playback. Only sub-ticks or the
 // explicit work-cap backlog are carried; nothing silently runs behind a pause.
 if (!s.ended && !paused) s.remainderSec = Math.max(0, target - s.t);
 if (steps >= MODEL.maxFrameSteps.v && s.t < target - 1e-8 && !paused) emit(s, events, 'WARP_LIMITED', true, { requestedSec: dtSec, advancedSec: s.t - old.t, remainingSec: s.remainderSec });
 auditEvents();
 return { state: s, events };
}
