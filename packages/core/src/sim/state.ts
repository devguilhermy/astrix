import { RADLAB_PROFILE } from '@astrix/data';
import type { AuditEntry, CommandQueueEntry, ComputerTelemetry, Design, FailureReport, HeaterMode, HistorySample, LinkMode, PointingMode, PointingTelemetry, SimEvent, SimState } from '../contracts';
import { MODEL, PART_BY_ID, scenarioById } from '../catalog';
import { computeBudgets, launchReadiness, ROLES } from '../design';
import { ENGINEERING, RULES_VERSION, THERMAL_MODELS, isTechnical, stationAllocated } from '../models';
import { DAY, elementsForOrbit, hohmann, inStationContact, linkRateKbps, marsLineOfSight, orbitPosition, solarFactor, stationPosition, type Elements, type Vec3 } from '../physics';
import { next } from '../rng';
import { initialCrew, type CrewState } from './crew';
import type { DeploymentStatus } from '../contracts';
import type { AttitudeTelemetry } from '../contracts';
import { antennaGain } from '../attitude';
import { copyAttitude, holdTarget, refreshAttitude, requestHold } from './attitude';
import { environmentAt } from './environment';

export interface InstrumentState { partId: string; on: boolean; lost: boolean; qty: number; dutyFraction: number }
export interface FlightState extends SimState {
 audit: AuditEntry[]; auditDecimated: boolean; crew: CrewState | null; deployment: { wings: DeploymentStatus; antenna: DeploymentStatus }; launchMassKg: number; sessionEnded: boolean;
 version: 4; attitude: AttitudeTelemetry; t: number; design: Design; seed: number; rng: number; assisted: boolean; remainderSec: number;
 elapsed: number; arrivalT: number; cruise: boolean; capturePending: boolean; captured: boolean; ended: boolean; elements: Elements; finePointing: boolean;
 capacityWh: number; nominalCapacityWh: number; arrayFactor: number; batteryFactor: number; capacityLostWh: number; capacityClampNotified: boolean; socWh: number; genW: number; loadW: number; ratedSolarW: number; baseLoadW: number;
 mode: PointingMode; safe: boolean; downlinkRequested: boolean; downlinkActive: boolean;
 storedMB: number; missionStoredMB: number; storageMB: number; downlinkedMB: number; missionDownlinkedMB: number; dataLostMB: number; radiationHours: number;
 positionKm: Vec3; sunDir: Vec3; stationPosKm: Vec3 | null; sunlit: boolean; inContact: boolean; lineOfSight: boolean; stationAvailable: boolean; doseUGyH: number;
 instruments: InstrumentState[]; queue: CommandQueueEntry[]; nextCommandId: number;
 propellantKg: number; dryMassKg: number; ispSec: number; captureRequiredKms: number; captureNominalKms: number; capturePlanningKms: number; captureUncertainty: number; captureAvailableKms: number;
 stormActive: boolean; stormStarted: boolean; stormEnded: boolean; agingAt: number; aged: boolean; outageAt: number; outageStarted: boolean; outageActive: boolean;
 firstPassSeen: boolean; lowLatched: boolean; emptyLatched: boolean; storageLatched: boolean; objectiveSeen: boolean;
 depletedSec: number; healthySec: number; marginBadSec: number;
 temperatureK: number; heaterMode: HeaterMode; heaterOn: boolean; ratedHeaterW: number; heaterW: number; externalHeatW: number; internalHeatW: number; radiatedW: number; thermalTrend: number; thermalBadSec: number; thermalSurvivalSec: number; thermalInhibited: boolean;
 pointing: PointingTelemetry; pointingReadyAt: number | null; pointingFaultAt: number; pointingFaultSeen: boolean;
 linkMode: LinkMode; linkQuality: number; linkDegradeAt: number; linkRestoreAt: number; linkDegradeSeen: boolean; linkRestoreSeen: boolean;
 computerState: ComputerTelemetry['state']; resetAt: number; resetSeen: boolean; commandEpochStartedAt: number; cooldownUntil: number; bootReadyAt: number | null; resets: number; recoveries: number; interventionEnergyWh: number;
 firstFailure: FailureReport | null; pendingEvents: SimEvent[];
 samples: HistorySample[]; sampleHead: number; nextSampleAt: number; historyIntervalSec: number; historyDecimated: boolean;
 nextPassSec: number | null; nextPassAt: number | null; nextPassCheckedAt: number;
}
export function flight(state: SimState): FlightState {
 if (state.version !== 4 || (state as FlightState).design?.rulesVersion !== RULES_VERSION) throw new TypeError('Unsupported ASTRIX flight state/rules version');
 return state as FlightState;
}
/** Clone each mutable branch once per public transaction, never per integration tick. */
export function cloneFlight(s: FlightState): FlightState {
 return { ...s, attitude: copyAttitude(s.attitude), audit: s.audit.slice(), crew: s.crew ? { ...s.crew, warnings: { ...s.crew.warnings }, pressureSamples: s.crew.pressureSamples.slice() } : null, deployment: { ...s.deployment }, pointing: { ...s.pointing }, instruments: s.instruments.map(i => ({ ...i })), queue: s.queue.slice(), pendingEvents: s.pendingEvents.slice(), positionKm: [...s.positionKm], sunDir: [...s.sunDir], stationPosKm: s.stationPosKm ? [...s.stationPosKm] : null };
}
export function markPracticeRetry(state: SimState): SimState {
 const s = flight(state);
 if (s.design.levelId !== 'ASPIRING') throw new RangeError('Technical attempts cannot rewind a practice checkpoint');
 const retry = cloneFlight(s); retry.assisted = true; recordAudit(retry, { t: retry.t, kind: 'REWIND', actor: null, owner: 'ALL', transport: 'SESSION', revision: retry.design.revision, detail: 'Assisted checkpoint restore; later branch discarded' }); return retry;
}
export function createSim(design: Design, seed: number): SimState {
 const ready = launchReadiness(design, Object.fromEntries(ROLES.map(r => [r, true])) as Record<typeof ROLES[number], boolean>);
 if (ready.length) throw new RangeError(`Cannot launch invalid design: ${ready.map(r => r.code).join(', ')}`);
 const d: Design = Object.freeze({ ...design, orbit: Object.freeze({ ...design.orbit! }), parts: Object.freeze(design.parts.map(p => Object.freeze({ ...p }))) });
 const b = computeBudgets(d), scenario = scenarioById(d.scenarioId), mars = scenario.body === 'MARS', technical = isTechnical(d.levelId);
 let capacity = 0, solar = 0, baseLoad = 0, storage = 0, isp = 0, heater = 0;
 const instruments: InstrumentState[] = [];
 for (const item of d.parts) {
  const p = PART_BY_ID[item.partId];
  capacity += (p.capacityWh?.v ?? 0) * item.qty; solar += (p.generationW?.v ?? 0) * item.qty; storage += (p.storageMB?.v ?? 0) * item.qty; heater += (p.heaterW?.v ?? 0) * item.qty;
  if (p.category === 'INSTRUMENT') instruments.push({ partId: p.id, on: false, lost: false, qty: item.qty, dutyFraction: 1 });
  else if (p.category !== 'PROPULSION') baseLoad += p.powerW.v * item.qty;
  if (p.ispSec) isp = p.ispSec.v;
 }
 let rng = seed >>> 0;
 const draw = (): number => { const [value, state] = next(rng); rng = state; return value; };
 const agingRoll = draw(), outageRoll = draw(), pointingRoll = draw(), resetRoll = draw(), captureRoll = draw();
 const duration = scenario.durationDays.v * DAY, uncertainty = technical && mars ? ENGINEERING.captureLow.v + captureRoll * (ENGINEERING.captureHigh.v - ENGINEERING.captureLow.v) : 0;
 const nominalCapture = b.deltaV?.requiredKms ?? 0;
 const loadedPropellant = d.parts.reduce((sum, part) => sum + (part.propellantKg ?? 0) * part.qty, 0);
 const s: FlightState = {
  audit: [], auditDecimated: false, crew: d.scenarioId === 'CREW_PATHFINDER' ? initialCrew() : null, deployment: { wings: d.parts.some(p => p.partId === 'SOLAR_WINGS') ? 'STOWED' : 'NOT_APPLICABLE', antenna: d.busId === 'CUBESAT_3U' ? 'STOWED' : 'NOT_APPLICABLE' }, launchMassKg: b.massKg.used, sessionEnded: false,
  version: 4, attitude: { q: [0,0,0,1], target: [0,0,0,1], rateRadSec: 0, hold: 'SUN', panelSunDeg: 0, instrumentTargetDeg: 0, antennaEarthDeg: 0 }, t: 0, design: d, seed: seed >>> 0, rng, assisted: false, remainderSec: 0, elapsed: 0, arrivalT: mars ? hohmann().transferSec : 0, cruise: mars, capturePending: false, captured: !mars, ended: false, elements: elementsForOrbit(d.orbit!), finePointing: d.parts.some(i => PART_BY_ID[i.partId].finePointing),
  capacityWh: capacity, nominalCapacityWh: capacity, arrayFactor: 1, batteryFactor: 1, capacityLostWh: 0, capacityClampNotified: false, socWh: capacity, genW: 0, loadW: baseLoad, ratedSolarW: solar, baseLoadW: baseLoad,
  mode: 'SUN', safe: false, downlinkRequested: false, downlinkActive: false,
  storedMB: 0, missionStoredMB: 0, storageMB: storage, downlinkedMB: 0, missionDownlinkedMB: 0, dataLostMB: 0, radiationHours: 0,
  positionKm: [0, 0, 0], sunDir: [0, 0, 0], stationPosKm: null, sunlit: true, inContact: false, lineOfSight: false, stationAvailable: false, doseUGyH: 0,
  instruments, queue: [], nextCommandId: 1,
  propellantKg: loadedPropellant, dryMassKg: b.massKg.used - loadedPropellant, ispSec: isp, captureRequiredKms: nominalCapture * (1 + uncertainty), captureNominalKms: nominalCapture, capturePlanningKms: nominalCapture * (technical ? 1 + ENGINEERING.captureHigh.v : MODEL.captureMargin.v), captureUncertainty: uncertainty, captureAvailableKms: b.deltaV?.availableKms ?? 0,
  stormActive: false, stormStarted: false, stormEnded: false, agingAt: duration * (MODEL.agingDayFraction.v + (agingRoll - .5) * .2), aged: false,
  outageAt: DAY * (1 + outageRoll * Math.max(1, scenario.durationDays.v - 2)), outageStarted: false, outageActive: false,
  firstPassSeen: false, lowLatched: false, emptyLatched: false, storageLatched: false, objectiveSeen: false,
  depletedSec: 0, healthySec: 0, marginBadSec: 0,
  temperatureK: THERMAL_MODELS[d.busId].initialK.v, heaterMode: 'AUTO', heaterOn: false, ratedHeaterW: heater, heaterW: 0, externalHeatW: 0, internalHeatW: 0, radiatedW: 0, thermalTrend: 0, thermalBadSec: 0, thermalSurvivalSec: 0, thermalInhibited: false,
  pointing: { requested: 'SUN', state: 'SETTLED', remainingSec: 0, quality: 1, faulted: false, reacquisitions: 0 }, pointingReadyAt: null, pointingFaultAt: duration * (.16 + pointingRoll * .04), pointingFaultSeen: false,
  linkMode: 'NORMAL', linkQuality: 1, linkDegradeAt: duration * .55, linkRestoreAt: duration * .55 + DAY, linkDegradeSeen: false, linkRestoreSeen: false,
  computerState: 'RUNNING', resetAt: duration * (.35 + resetRoll * .03), resetSeen: false, commandEpochStartedAt: 0, cooldownUntil: 0, bootReadyAt: null, resets: 0, recoveries: 0, interventionEnergyWh: 0,
  firstFailure: null, pendingEvents: [], samples: [], sampleHead: 0, historyIntervalSec: MODEL.historyEverySec.v, historyDecimated: false, nextSampleAt: MODEL.historyEverySec.v, nextPassSec: null, nextPassAt: null, nextPassCheckedAt: -DAY,
 };
 updateEnvironment(s);
 s.attitude.q = holdTarget(s,'SUN'); refreshAttitude(s);
 s.samples.push(sample(s));
 return s;
}
const STORM_BOUNDS: Readonly<Record<Design['scenarioId'], readonly [number, number]>> = {
 CREW_PATHFINDER: [Infinity, Infinity], FIRST_LIGHT: [Infinity, Infinity], STORM_WATCH: [9 * DAY, 11 * DAY],
 RED_RELAY: [MODEL.marsStormDay.v * DAY, (MODEL.marsStormDay.v + MODEL.marsStormHours.v / 24) * DAY],
};
export function stormBounds(s: FlightState): readonly [number, number] { return STORM_BOUNDS[s.design.scenarioId]; }
export function updateEnvironment(s: FlightState): void {
 const body = scenarioById(s.design.scenarioId).body, localT = s.captured ? s.elapsed : 0, technical = isTechnical(s.design.levelId);
 Object.assign(s,environmentAt(s,s.t));
 const [start, end] = stormBounds(s);
 s.stormActive = s.elapsed >= start && s.elapsed < end;
 if (body === 'MARS') s.doseUGyH = s.stormActive ? MODEL.marsStormDose.v : MODEL.marsBackground.v;
 else if (s.design.scenarioId === 'STORM_WATCH' && s.stormActive) {
  const hour = Math.min(RADLAB_PROFILE.hourly.length - 1, Math.floor((s.elapsed - start) / 3600));
  s.doseUGyH = RADLAB_PROFILE.hourly[hour].meanUGyH;
 } else s.doseUGyH = RADLAB_PROFILE.stats.median;
 if (s.inContact) { s.nextPassSec = 0; s.nextPassAt = s.t; s.nextPassCheckedAt = s.t; }
 else if (!s.cruise && !s.capturePending && (s.nextPassAt !== null ? s.t >= s.nextPassAt : s.t - s.nextPassCheckedAt >= DAY)) {
  s.nextPassCheckedAt = s.t; s.nextPassAt = null;
  if (s.crew && s.outageActive) s.nextPassAt = s.arrivalT + s.outageAt + MODEL.outageHours.v * 3600;
  for (let dt = 60; !s.crew && dt <= DAY; dt += 60) {
   if (body === 'EARTH' && s.outageStarted && s.elapsed + dt >= s.outageAt && s.elapsed + dt < s.outageAt + MODEL.outageHours.v * 3600) continue;
   if ((technical || body === 'MARS') && !stationAllocated(s.t + dt, scenarioById(s.design.scenarioId).stationAllocationStartSec.v)) continue;
   const p = orbitPosition(s.design.orbit!, localT + dt);
   if (body === 'EARTH' ? inStationContact(p, stationPosition(s.t + dt, 'EARTH', MODEL.stationLat.v, MODEL.stationLon.v, undefined, s.design.orbit!.epochUTC), MODEL.minElevation.v) : marsLineOfSight(p, s.t + dt, s.design.orbit!.epochUTC)) { s.nextPassAt = s.t + dt; break; }
  }
 }
 if (!s.inContact) s.nextPassSec = s.nextPassAt === null ? null : Math.max(0, s.nextPassAt - s.t);
 refreshAttitude(s);
}
export function sample(s: FlightState, eventBoundary = false): HistorySample { return { attitude: copyAttitude(s.attitude), t: s.t, eventBoundary, phase: s.cruise ? 'CRUISE' : s.capturePending ? 'CAPTURE' : s.crew?.phase ?? (s.ended ? 'COMPLETE' : 'OPERATE'), positionKm: [...s.positionKm], sunDir: [...s.sunDir], stationPosKm: s.stationPosKm ? [...s.stationPosKm] : null, retainedKg: s.dryMassKg + s.propellantKg - (s.crew?.ventedKg ?? 0), socPct: s.capacityWh ? s.socWh / s.capacityWh * 100 : 0, storedPct: s.storageMB ? s.storedMB / s.storageMB * 100 : 0, downlinkedMB: s.downlinkedMB, doseUGyH: s.doseUGyH, inContact: s.inContact ? 1 : 0, temperatureK: isTechnical(s.design.levelId) ? s.temperatureK : null, arrayFactor: s.arrayFactor, capacityWh: s.capacityWh, pointingQuality: s.pointing.quality, linkQuality: s.linkQuality, computerState: s.computerState }; }
export function objectiveValue(s: FlightState): number { return scenarioById(s.design.scenarioId).metric === 'RADIATION_HOURS' ? s.radiationHours : s.missionDownlinkedMB; }
export function availableRadioRate(s: FlightState): number {
 let rate = 0;
 for (const item of s.design.parts) {
  const p = PART_BY_ID[item.partId];
  if (s.deployment.antenna !== 'NOT_APPLICABLE' && s.deployment.antenna !== 'DEPLOYED') continue;
  if (p.category === 'RADIO' && p.id !== 'SS_UHF_RELAY') rate += linkRateKbps(p.rateKbps!.v, scenarioById(s.design.scenarioId).body, s.t, s.design.orbit!.epochUTC) * item.qty;
 }
 return rate;
}
export function uplinkAvailable(s: FlightState): boolean { return s.inContact && s.linkQuality >= ENGINEERING.robustThreshold.v; }
export function transmittingRate(s: FlightState): number {
 if (s.deployment.antenna !== 'NOT_APPLICABLE' && s.deployment.antenna !== 'DEPLOYED') return 0;
 if (!s.downlinkRequested || !s.inContact || s.safe || s.socWh <= 0 || !s.captured || s.computerState !== 'RUNNING') return 0;
 const technical = isTechnical(s.design.levelId), threshold = s.linkMode === 'ROBUST' ? ENGINEERING.robustThreshold.v : ENGINEERING.normalThreshold.v;
 if (technical && s.linkQuality < threshold) return 0;
 let rate = 0;
 for (const item of s.design.parts) {
  const p = PART_BY_ID[item.partId];
  if (p.category !== 'RADIO' || p.id === 'SS_UHF_RELAY') continue;
  rate += linkRateKbps(p.rateKbps!.v, scenarioById(s.design.scenarioId).body, s.t, s.design.orbit!.epochUTC) * item.qty * (p.directional ? antennaGain(s.attitude.antennaEarthDeg,p.beamHalfAngleDeg!.v) : 1);
 }
 return rate * (technical && s.linkMode === 'ROBUST' ? ENGINEERING.robustRate.v : 1);
}
export function enterSafe(s: FlightState): void {
 s.safe = true; requestHold(s,'SAFE'); s.pointingReadyAt = null; s.downlinkRequested = false; s.downlinkActive = false;
 for (const i of s.instruments) i.on = false;
}
export function heaterDemandW(s: FlightState): number {
 if (!isTechnical(s.design.levelId) || s.socWh <= 0 || s.heaterMode === 'OFF') return 0;
 const automatic = s.temperatureK <= ENGINEERING.heaterOnK.v || s.heaterOn && s.temperatureK < ENGINEERING.heaterOffK.v;
 return s.heaterMode === 'ON' || automatic ? s.ratedHeaterW : 0;
}
export function generatedPowerW(s: FlightState): number {
 const factor = Math.max(0, Math.cos(s.attitude.panelSunDeg * Math.PI / 180));
 const stowedW = s.deployment.wings === 'STOWED' || s.deployment.wings === 'ANOMALOUS' ? s.design.parts.filter(i => i.partId === 'SOLAR_WINGS').reduce((n, i) => n + (PART_BY_ID[i.partId].generationW?.v ?? 0) * i.qty, 0) : 0;
 return s.sunlit ? (s.ratedSolarW - stowedW) * solarFactor(scenarioById(s.design.scenarioId).body) * factor * s.arrayFactor : 0;
}
export function electricalLoadW(s: FlightState): number {
 let load = s.baseLoadW + heaterDemandW(s);
 if (s.crew && !s.crew.fanOn) load = Math.max(0, load - 100);
 const rate = transmittingRate(s);
 for (const item of s.design.parts) {
  const p = PART_BY_ID[item.partId];
  if (p.category === 'RADIO' && rate > 0 && s.storedMB > 0 && p.id !== 'SS_UHF_RELAY' && (!p.directional || antennaGain(s.attitude.antennaEarthDeg,p.beamHalfAngleDeg!.v) > 0)) {
   load += ((p.txPowerW?.v ?? p.powerW.v) * (s.linkMode === 'ROBUST' && isTechnical(s.design.levelId) ? ENGINEERING.robustPower.v : 1) - p.powerW.v) * item.qty;
  }
 }
 if (!s.safe && s.computerState === 'RUNNING' && !s.thermalInhibited) for (const i of s.instruments) if (i.on && !i.lost) load += PART_BY_ID[i.partId].powerW.v * i.qty * i.dutyFraction;
 if (s.pointing.state === 'REACQUIRING') load += ENGINEERING.reacquirePower.v * (s.design.busId === 'SMALLSAT' ? 10 : 1);
 if (s.computerState === 'RECOVERING') load += ENGINEERING.bootPower.v * (s.design.busId === 'SMALLSAT' ? 10 : 1);
 return load;
}

/** Bounded attempt trail; retain the first and newest records when capacity is reached. */
export function recordAudit(s: FlightState, entry: AuditEntry): void {
 if (s.audit.length >= 2048) { s.audit = s.audit.filter((_entry, i) => i % 2 === 0); s.auditDecimated = true; }
 s.audit.push(entry);
}
