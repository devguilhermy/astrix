// Closed registry of objective evaluators. Each reads physical evidence (delivered data, orbit state, ascent state, encounter, propellant); nothing is visual.
import type { SimEvent } from '../contracts';
import type { ObjectiveDef } from '../mission/types';
import type { ObjectiveEvidence, ObjectiveState } from '../flight/types';
import { ATMOSPHERE_TOP_KM } from '../flight/ascent';
import { orbitInfo, muOf, radiusOf } from '../flight/conic';
import type { FlightState } from './state';
import { ascentActive, centralStateAt } from './trajectory';

export interface ObjectiveRuntime { id: string; state: ObjectiveState; held: number; metAt: number | null; actual: number | null }
export const initObjectives = (defs: readonly ObjectiveDef[]): ObjectiveRuntime[] => defs.map(o => ({ id: o.id, state: 'IN_PROGRESS', held: 0, metAt: null, actual: null }));

interface Reading { actual: number | null; target: number | null; unit: string; source: ObjectiveEvidence['source']; holds: boolean; failed: boolean; progress: number; detail: Record<string, number | string> }
const ratio = (value: number, target: number): number => target > 0 ? Math.max(0, Math.min(1, value / target)) : value >= target ? 1 : 0;

function read(s: FlightState, o: ObjectiveDef, runtime: ReadonlyMap<string, ObjectiveRuntime>): Reading {
 const spec = o.spec, c = ascentActive(s) ? null : centralStateAt(s, s.t), info = c ? orbitInfo(c.r, c.v, muOf(c.body)) : null, alt = c ? Math.hypot(...c.r) - radiusOf(c.body) : 0;
 switch (spec.kind) {
  case 'DELIVERED_PRODUCT': return { actual: s.missionDownlinkedMB, target: spec.targetMB, unit: 'MB', source: 'DELIVERED_DATA', holds: s.missionDownlinkedMB + 1e-9 >= spec.targetMB, failed: false, progress: ratio(s.missionDownlinkedMB, spec.targetMB), detail: { storedMB: s.missionStoredMB } };
  case 'INSTRUMENT_HOURS': return { actual: s.radiationHours, target: spec.targetHours, unit: 'h', source: 'DELIVERED_DATA', holds: s.radiationHours + 1e-9 >= spec.targetHours, failed: false, progress: ratio(s.radiationHours, spec.targetHours), detail: {} };
  case 'APOGEE_BAND': {
   const peak = Math.max(s.traj.maxAltKm, c && c.body === 'EARTH' ? alt : 0), passed = s.traj.peakPassed, inBand = peak >= spec.minAltKm - 1e-9 && peak <= spec.maxAltKm + 1e-9;
   return { actual: peak, target: (spec.minAltKm + spec.maxAltKm) / 2, unit: 'km', source: 'ASCENT_STATE', holds: passed && inBand, failed: peak > spec.maxAltKm + 1e-9 || passed && peak < spec.minAltKm - 1e-9, progress: Math.max(0, Math.min(1, peak / spec.minAltKm)), detail: { minAltKm: spec.minAltKm, maxAltKm: spec.maxAltKm, peakPassed: passed ? 1 : 0 } };
  }
  case 'RETURN_BOUNDARY': {
   const dep = runtime.get(spec.afterObjectiveId), crossed = s.traj.crossings[String(spec.altitudeKm)];
   return { actual: crossed === undefined ? null : spec.altitudeKm, target: spec.altitudeKm, unit: 'km', source: 'ASCENT_STATE', holds: dep?.state === 'MET' && crossed !== undefined && crossed >= (dep.metAt ?? 0) - 1e-6, failed: dep?.state === 'FAILED', progress: dep?.state === 'MET' ? 0.5 : 0, detail: {} };
  }
  case 'BOUND_ORBIT': {
   const ok = !!info && !!c && c.body === spec.body && info.kind === 'ELLIPSE' && !info.rectilinear, rp = info ? info.rpKm - radiusOf(spec.body) : 0, ra = info && info.raKm !== null ? info.raKm - radiusOf(spec.body) : 0;
   const inc = info ? info.incRad * 180 / Math.PI : 0;
   const holds = ok && rp >= spec.minSafePeriapsisAltKm && rp >= spec.periapsisAltKm.min && rp <= spec.periapsisAltKm.max && ra >= spec.apoapsisAltKm.min && ra <= spec.apoapsisAltKm.max && (!spec.inclinationDeg || inc >= spec.inclinationDeg.min && inc <= spec.inclinationDeg.max);
   return { actual: ok ? rp : null, target: (spec.periapsisAltKm.min + spec.periapsisAltKm.max) / 2, unit: 'km', source: 'ORBIT_STATE', holds, failed: false, progress: holds ? 0.5 : 0, detail: ok ? { periapsisAltKm: rp, apoapsisAltKm: ra, inclinationDeg: inc, bodyOrbit: 1 } : {} };
  }
  case 'ESCAPE': {
   const ok = !!info && !!c && c.body === 'EARTH' && info.kind !== 'ELLIPSE', outbound = !!c && c.r[0] * c.v[0] + c.r[1] * c.v[1] + c.r[2] * c.v[2] > 0, vinf = info?.vInfKms ?? 0;
   return { actual: ok ? vinf : null, target: spec.minExcessSpeedKms, unit: 'km/s', source: 'ORBIT_STATE', holds: ok && outbound && info!.rpKm - radiusOf('EARTH') >= spec.minPeriapsisAltKm && vinf + 1e-9 >= spec.minExcessSpeedKms, failed: false, progress: ok ? 0.5 : 0, detail: ok ? { periapsisAltKm: info!.rpKm - radiusOf('EARTH'), energyKm2s2: info!.energy } : {} };
  }
  case 'ENTRY_INTERFACE': { const crossed = s.traj.crossings[String(spec.altitudeKm)]; return { actual: crossed === undefined ? null : spec.altitudeKm, target: spec.altitudeKm, unit: 'km', source: 'ORBIT_STATE', holds: crossed !== undefined, failed: false, progress: crossed === undefined ? 0 : 1, detail: { atSec: crossed ?? -1, thresholdAboveAtmosphereKm: ATMOSPHERE_TOP_KM } }; }
  case 'ENCOUNTER_DISTANCE': {
   const e = s.traj.encounter, inBand = !!e && e.closestKm >= spec.minDistanceKm && e.closestKm <= spec.maxDistanceKm;
   return { actual: e ? e.closestKm : null, target: (spec.minDistanceKm + spec.maxDistanceKm) / 2, unit: 'km', source: 'ENCOUNTER', holds: inBand, failed: !!e && !inBand, progress: e ? (inBand ? 1 : 0) : 0, detail: e ? { atSec: e.atSec } : {} };
  }
  case 'PROPELLANT_RESERVE': return { actual: s.propellantKg, target: spec.minKg, unit: 'kg', source: 'PROPELLANT', holds: s.propellantKg + 1e-9 >= spec.minKg, failed: s.propellantKg + 1e-9 < spec.minKg, progress: ratio(s.propellantKg, spec.minKg), detail: {} };
  case 'CREW_SUPPORT_THROUGH_RECOVERY': return { actual: s.crew ? (s.crew.phase === 'COMPLETE' ? 1 : 0) : null, target: 1, unit: '', source: 'CREW', holds: !!s.crew && s.crew.phase === 'COMPLETE' && (!s.firstFailure || s.firstFailure.causeKey === 'failure.OBJECTIVE_MISSED.title'), failed: !!s.firstFailure && s.firstFailure.causeKey === 'failure.CREW_SUPPORT_LOST.title', progress: s.crew?.phase === 'COMPLETE' ? 1 : 0, detail: {} };
  case 'CREW_ORBIT_HOURS': { const hours = ((s.crew?.orbitEndSec ?? s.elapsed)) / 3600; return { actual: hours, target: spec.hours, unit: 'h', source: 'CREW', holds: hours + 1e-9 >= spec.hours, failed: false, progress: ratio(hours, spec.hours), detail: {} }; }
 }
}

const reserve = (o: ObjectiveDef): boolean => o.spec.kind === 'PROPELLANT_RESERVE';
/** Accumulate dwell, latch MET (reserves are re-evaluated), fail on a missed deadline or a permanently impossible condition. */
export function updateObjectives(s: FlightState, dt: number, events: SimEvent[]): void {
 const defs = s.design.definition.objectives, runtime = new Map(s.objectives.map(r => [r.id, r]));
 for (let pass = 0; pass < 2; pass++) for (const o of defs) {
  const r = runtime.get(o.id)!;
  if (r.state === 'FAILED' || r.state === 'MET' && !reserve(o)) continue;
  const reading = read(s, o, runtime);
  r.actual = reading.actual;
  if (reading.holds) r.held += pass === 0 ? dt : 0; else if (pass === 0) r.held = 0;
  if (reading.holds && r.held + 1e-9 >= o.dwellSec) {
   if (r.state !== 'MET') { r.state = 'MET'; r.metAt = s.t; events.push({ kind: 'OBJECTIVE_MET', t: s.t, autoPause: o.required, values: { id: o.id, value: reading.actual ?? 0, target: reading.target ?? 0, kind: o.spec.kind } }); }
  } else if (reading.failed || o.deadlineSec !== null && s.elapsed + 1e-8 >= o.deadlineSec) { r.state = 'FAILED'; r.metAt = null; }
  else if (reserve(o)) r.state = 'IN_PROGRESS';
 }
}
export function evidenceOf(s: FlightState): ObjectiveEvidence[] {
 const runtime = new Map(s.objectives.map(r => [r.id, r]));
 return s.design.definition.objectives.map(o => {
  const r = runtime.get(o.id)!, reading = read(s, o, runtime);
  return { id: o.id, kind: o.spec.kind, required: o.required, owner: o.owner, state: r.state, progress: r.state === 'MET' ? 1 : reading.progress, actual: r.state === 'MET' && r.actual !== null ? r.actual : reading.actual, target: reading.target, unit: reading.unit, source: reading.source, dwellHeldSec: r.held, dwellRequiredSec: o.dwellSec, metAtSec: r.metAt, detail: reading.detail };
 });
}
/** Success is every required objective MET. Optional objectives and averages never rescue or sink it. */
export const allRequiredMet = (s: FlightState): boolean => s.design.definition.objectives.every(o => !o.required || s.objectives.find(r => r.id === o.id)?.state === 'MET');
export const anyRequiredFailed = (s: FlightState): boolean => s.design.definition.objectives.some(o => o.required && s.objectives.find(r => r.id === o.id)?.state === 'FAILED');
const primaryDef = (s: FlightState): ObjectiveDef => s.design.definition.objectives.find(o => o.required) ?? s.design.definition.objectives[0];
export const metricKeyOf = (kind: ObjectiveDef['spec']['kind']): string => kind === 'DELIVERED_PRODUCT' ? 'metric.DOWNLINK_MB' : kind === 'INSTRUMENT_HOURS' ? 'metric.RADIATION_HOURS' : `metric.${kind}`;
/** First required objective, the legacy "objective value": delivered MB, radiation hours, etc. */
export function primaryObjective(s: FlightState): { id: string; metricKey: string; value: number; target: number } {
 const o = primaryDef(s), reading = read(s, o, new Map(s.objectives.map(r => [r.id, r])));
 return { id: o.id, metricKey: metricKeyOf(o.spec.kind), value: reading.actual ?? 0, target: reading.target ?? 0 };
}
export const objectiveValue = (s: FlightState): number => primaryObjective(s).value;
