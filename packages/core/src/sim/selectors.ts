import type { FailureReport, HistorySample, LinkTelemetry, SimState, Telemetry } from '../contracts';
import { ENGINEERING, THERMAL_MODELS, isTechnical } from '../models';
import { DAY, lightTime } from '../physics';
import { crewTelemetry } from './crew';
import { bootEnergyWh, bootPowerW } from './commands';
import { stationRangeKm, availableRadioRate, electricalLoadW, flight, generatedPowerW, heaterDemandW, recordAudit, cloneFlight, transmittingRate, uplinkAvailable } from './state';
import { allRequiredMet, evidenceOf, primaryObjective } from './objectives';
import { ascentActive, flightTelemetry, nextTrajectoryBoundary } from './trajectory';
import { CONSTANTS } from '../physics';
import { copyAttitude } from './attitude';

export function telemetry(state: SimState): Telemetry {
 const s = flight(state), technical = isTechnical(s.design.levelId), m = THERMAL_MODELS[s.design.busId];
 const rate = transmittingRate(s), normalRate = availableRadioRate(s);
 let reason: LinkTelemetry['unavailableReason'] = 'NONE';
 if (s.deployment.antenna !== 'NOT_APPLICABLE' && s.deployment.antenna !== 'DEPLOYED') reason = 'DEPLOYMENT';
 else if (!s.lineOfSight) reason = 'GEOMETRY';
 else if (!s.stationAvailable) reason = 'STATION';
 else if (s.computerState !== 'RUNNING') reason = 'COMPUTER';
 else if (s.socWh <= 0) reason = 'POWER';
 else if (s.safe) reason = 'SAFE';
 else if (normalRate > 0 && rate === 0 && s.downlinkRequested && s.design.parts.every(i => i.partId !== 'RADIO_UHF' && i.partId !== 'CREW_RADIO') && s.attitude.antennaEarthDeg >= 90) reason = 'POINTING';
 else if (technical && s.linkQuality < (s.linkMode === 'ROBUST' ? ENGINEERING.robustThreshold.v : ENGINEERING.normalThreshold.v)) reason = 'QUALITY';
 else if (!s.downlinkRequested) reason = 'NO_REQUEST';
 else if (s.storedMB <= 0) reason = 'EMPTY';
 const planned = s.design.definition.environment.durationSec + (s.crew ? 21600 : 0);
 return {
  mass: { retainedKg: s.dryMassKg + s.propellantKg - (s.crew?.ventedKg ?? 0), launchKg: s.launchMassKg },
  clock: { phase: s.cruise ? 'CRUISE' : s.crew?.phase ?? 'OPERATE', plannedSec: s.cruise ? s.arrivalT : planned, remainingSec: s.ended ? 0 : s.cruise ? Math.max(0, s.arrivalT - s.t) : s.crew?.phase === 'RECOVERY' ? s.crew.recoveryRemainingSec : s.crew?.phase === 'DEORBIT' ? s.crew.recoveryRemainingSec + Math.max(0, (s.queue.find(q => q.command.kind === 'CREW_DEORBIT' && q.status === 'IN_TRANSIT')?.applyAt ?? s.t) - s.t) : Math.max(0, planned - s.elapsed) },
  crew: s.crew ? crewTelemetry(s.crew, s.socWh > 0, s.elapsed) : null, deployment: { ...s.deployment },
  levelId: s.design.levelId, rulesVersion: s.design.rulesVersion, assisted: s.assisted, remainderSec: s.remainderSec,
  thermal: technical ? { temperatureK: s.temperatureK, operatingMinK: m.operatingMinK.v, operatingMaxK: m.operatingMaxK.v, survivalMinK: m.survivalMinK.v, survivalMaxK: m.survivalMaxK.v, heaterMode: s.heaterMode, heaterW: heaterDemandW(s), externalW: s.externalHeatW, internalW: s.internalHeatW, radiatedW: s.radiatedW, trendKPerHour: s.thermalTrend, inhibited: s.thermalInhibited, survivalDwellSec: s.thermalSurvivalSec } : null,
  powerLife: { arrayFactor: s.arrayFactor, batteryFactor: s.batteryFactor, nominalCapacityWh: s.nominalCapacityWh, eolArrayFactor: technical ? ENGINEERING.arrayEol.v : 1, eolBatteryFactor: technical ? ENGINEERING.batteryEol.v : .9, capacityLostWh: s.capacityLostWh },
  attitude: copyAttitude(s.attitude),
  pointing: { ...s.pointing, remainingSec: s.pointingReadyAt === null ? s.pointing.remainingSec : Math.max(0, s.pointingReadyAt - s.t) },
  link: { lineOfSight: s.lineOfSight, stationAllocated: s.stationAvailable, uplinkAvailable: uplinkAvailable(s), effective: reason === 'NONE', mode: s.linkMode, quality: s.linkQuality, normalRateKbps: normalRate, robustRateKbps: normalRate * ENGINEERING.robustRate.v, activeRateKbps: s.storedMB > 0 ? rate : 0, unavailableReason: reason, nextOpportunitySec: s.nextPassSec, scheduling: 'CONTACT_GATED' },
  computer: { state: s.computerState, cooldownRemainingSec: Math.max(0, s.cooldownUntil - s.t), recoveryRemainingSec: s.bootReadyAt === null ? 0 : Math.max(0, s.bootReadyAt - s.t), bootEnergyWh: bootEnergyWh(s), bootPowerW: bootPowerW(s), resets: s.resets, recoveries: s.recoveries },
  capture: s.mars ? { nominalKms: s.captureNominalKms, planningKms: s.capturePlanningKms, realizedKms: s.captureRequiredKms, availableKms: s.captureAvailableKms, reserveKms: s.captureAvailableKms - s.capturePlanningKms, propellantKg: s.propellantKg, uncertaintyFraction: s.captureUncertainty } : null,
  t: s.t, socWh: s.socWh, capacityWh: s.capacityWh, genW: generatedPowerW(s), loadW: electricalLoadW(s), sunlit: s.sunlit, inContact: s.inContact,
  storedMB: s.storedMB, storageMB: s.storageMB, downlinkedMB: s.downlinkedMB, doseUGyH: s.doseUGyH, mode: s.mode, safe: s.safe,
  lightTimeSec: s.mars ? lightTime(s.t, s.epochUTC) : s.design.definition.environment.commLightTime ? stationRangeKm(s) / CONSTANTS.c.v : null, queued: s.queue.reduce((n, q) => n + (q.status === 'WAITING_CONTACT' || q.status === 'IN_TRANSIT' ? 1 : 0), 0),
  objective: ((p) => ({ metricKey: p.metricKey, value: p.value, target: p.target }))(primaryObjective(s)),
  flight: flightTelemetry(s), evidence: evidenceOf(s), outcome: s.ended ? (s.firstFailure || s.sessionEnded || !allRequiredMet(s) ? 'FAILURE' : 'SUCCESS') : 'PROVISIONAL', definition: { id: s.design.missionId, digest: s.design.definitionDigest, revision: s.design.definition.revision, origin: s.design.definition.origin },
  positionKm: [...s.positionKm], sunDir: [...s.sunDir], stationPosKm: s.stationPosKm ? [...s.stationPosKm] : null,
  instruments: s.instruments.map(i => ({ partId: i.partId, on: i.on, lost: i.lost, dutyFraction: i.dutyFraction })), commandQueue: s.queue.map(q => ({ ...q, command: q.command.kind === 'ATTITUDE_TARGET' ? { ...q.command, q: [...q.command.q] as const } : { ...q.command } })),
  downlinkRequested: s.downlinkRequested, downlinkActive: rate > 0 && s.storedMB > 0,
  ended: s.ended, endedByTeam: s.sessionEnded, cruise: s.cruise, capturePending: s.capturePending, nextPassSec: s.nextPassSec,
 };
}
export function history(state: SimState): readonly HistorySample[] {
 const s = flight(state);
 return s.sampleHead === 0 ? s.samples : [...s.samples.slice(s.sampleHead), ...s.samples.slice(0, s.sampleHead)];
}
export function failureReport(state: SimState): FailureReport | null { return flight(state).firstFailure; }

/** Next known actionable time, not a promise that an unmodeled event cannot occur first. */
export function nextBoundary(state: SimState): { kind: string; inSec: number } | null {
 const s = flight(state); if (s.ended) return null;
 if (s.cruise) return { kind: 'ARRIVAL', inSec: Math.max(0, s.arrivalT - s.t) };
 if (ascentActive(s)) return { kind: 'ASCENT', inSec: 1800 };
 const candidates: { kind: string; inSec: number }[] = [];
 const trajectory = nextTrajectoryBoundary(cloneFlight(s));
 if (Number.isFinite(trajectory)) candidates.push({ kind: 'TRAJECTORY', inSec: Math.max(0, trajectory - s.t) });
 if (s.nextPassSec !== null && s.nextPassSec > 0) candidates.push({ kind: 'CONTACT', inSec: s.nextPassSec });
 for (const q of s.queue) if (q.status === 'IN_TRANSIT' && q.applyAt !== null && q.applyAt > s.t) candidates.push({ kind: 'COMMAND', inSec: q.applyAt - s.t });
 if (s.crew) {
  const c = s.crew, crew = crewTelemetry(c, s.socWh > 0, s.elapsed);
  candidates.push({ kind: 'CREW_STORE', inSec: Math.max(0, crew.daysRemaining * DAY) });
  if (c.fanOn && s.socWh > 0 && c.scrubberKg > 0) candidates.push({ kind: 'CARTRIDGE', inSec: c.scrubberKg / (4 * 1.085) * DAY });
  if ((!c.fanOn || s.socWh <= 0 || c.scrubberKg <= 0) && crew.co2MmHg < 6) candidates.push({ kind: 'CREW_CO2_LIMIT', inSec: (6 - crew.co2MmHg) / (4 * 1.085 / 24 / .044 * 8.314462618 * 297 / 8 / 133.322) * 3600 });
 }
 if (s.crew?.phase === 'RECOVERY') candidates.push({ kind: 'RECOVERY', inSec: s.crew.recoveryRemainingSec });
 else if (s.crew && s.crew.phase === 'ON_ORBIT') { const window = crewTelemetry(s.crew, s.socWh > 0, s.elapsed); if (window.nextReturnWindowSec !== null && window.nextReturnWindowSec > 0) candidates.push({ kind: 'RETURN_WINDOW', inSec: window.nextReturnWindowSec }); else if (window.returnWindowOpen) candidates.push({ kind: 'RETURN_WINDOW_CLOSE', inSec: window.returnWindowRemainingSec }); }
 else if (!s.crew) candidates.push({ kind: 'MISSION_END', inSec: Math.max(0, s.design.definition.environment.durationSec - s.elapsed) });
 return candidates.sort((a, b) => a.inSec - b.inSec)[0] ?? null;
}
export function endMission(state: SimState): SimState {
 const old = flight(state); if (old.ended) return state;
 const s = cloneFlight(old); s.ended = true; s.sessionEnded = true; s.remainderSec = 0; s.downlinkActive = false;
 s.pendingEvents.push({ kind: 'SESSION_ENDED', t: s.t, autoPause: true, values: {} });
 recordAudit(s, { t: s.t, kind: 'SESSION_ENDED', actor: null, owner: 'ALL', transport: 'SESSION', revision: s.design.revision, detail: 'Ended by team' });
 return s;
}
export function attemptAudit(state: SimState) { const s = flight(state); return { entries: s.audit.slice(), decimated: s.auditDecimated }; }

export function historyInfo(state: SimState): { decimated: boolean; intervalSec: number } { const s = flight(state); return { decimated: s.historyDecimated, intervalSec: s.historyIntervalSec }; }
