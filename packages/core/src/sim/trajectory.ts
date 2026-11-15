// Authoritative flight-path state: conic segments, patched Earth/Moon frames, finite-resource impulsive burns, predicted events and telemetry.
import type { BodyId, SimEvent, SimEventKind } from '../contracts';
import type { AscentProgram, BurnSpec } from '../mission/types';
import type { BurnReceipt, FlightStateView, FlightTelemetry, MissionPhase, OrbitTelemetry, StateVector, TrajectoryEvent, ScheduledBurnView } from '../flight/types';
import { ATMOSPHERE_TOP_KM, advanceAscent, ascentSample, flightPathDeg, isAscentActive, nextSubstep, startAscent, type AscentState } from '../flight/ascent';
import { LAUNCHER_BY_ID } from '../flight/launchers';
import { MOON_SOI_RADIUS_KM, moonState } from '../flight/moon';
import { add, burnVector, conicAtDt, conicFromElements, conicFromState, dotv, len, muOf, orbitInfo, radiusOf, scale, sub, timeToApsis, unit, type ConicState } from '../flight/conic';
import { CONSTANTS, elementsForOrbit, type Vec3 } from '../physics';
import type { FlightState } from './state';

export interface StageInv { dryKg: number; propKg: number; ispSec: number; restartsLeft: number; attached: boolean }
export interface PlannedBurn { spec: BurnSpec; fireAt: number | null }
export type PredictedKind = 'SOI_ENTRY' | 'SOI_EXIT' | 'SURFACE_IMPACT' | 'ENTRY_INTERFACE' | 'PERIAPSIS' | 'APOAPSIS';
export interface Predicted { t: number; kind: PredictedKind; body: BodyId; values: Record<string, number | string> }
export interface TrajState {
 conic: ConicState | null; ascent: AscentState | null; stage: StageInv | null; burns: PlannedBurn[]; burnCount: number; receipts: BurnReceipt[]; events: TrajectoryEvent[];
 version: number; pred: { version: number; fromT: number; items: Predicted[] } | null;
 maxAltKm: number; peakPassed: boolean; encounter: { closestKm: number; atSec: number } | null; soiEntryAt: number | null; crossings: Record<string, number>; lastAscentSampleAt: number;
}
export const TRAJECTORY_EVENT_RING = 64;
export const MAX_SCAN_SEC = 20 * 86400;
const G0 = CONSTANTS.g0.v;

export function cloneTraj(t: TrajState): TrajState {
 return { ...t, burns: t.burns.map(b => ({ ...b })), receipts: t.receipts.slice(), events: t.events.slice(), stage: t.stage ? { ...t.stage } : null, ascent: t.ascent ? { ...t.ascent, r: [...t.ascent.r] as Vec3, v: [...t.ascent.v] as Vec3 } : null, encounter: t.encounter ? { ...t.encounter } : null, crossings: { ...t.crossings }, pred: t.pred ? { ...t.pred, items: t.pred.items.slice() } : null };
}
const blankTraj = (): TrajState => ({ conic: null, ascent: null, stage: null, burns: [], burnCount: 0, receipts: [], events: [], version: 0, pred: null, maxAltKm: 0, peakPassed: false, encounter: null, soiEntryAt: null, crossings: {}, lastAscentSampleAt: -Number.MAX_SAFE_INTEGER });

export const patchedConics = (s: Pick<FlightState, 'design'>): boolean => s.design.definition.trajectory.model === 'PATCHED_CONICS';
export const moonModelled = (s: Pick<FlightState, 'design'>): boolean => { const t = s.design.definition.trajectory; return t.model === 'PATCHED_CONICS' && t.bodies.includes('MOON'); };
const watchAltitudes = (s: Pick<FlightState, 'design'>): number[] => s.design.definition.objectives.flatMap(o => o.spec.kind === 'ENTRY_INTERFACE' || o.spec.kind === 'RETURN_BOUNDARY' ? [o.spec.altitudeKm] : []);
const needsApsis = (s: Pick<FlightState, 'design'>): boolean => s.design.definition.objectives.some(o => o.spec.kind === 'APOGEE_BAND' || o.spec.kind === 'ENCOUNTER_DISTANCE' || o.spec.kind === 'BOUND_ORBIT' && o.spec.body === 'MOON');

/** Mission launch mass handed to the launcher: the whole designed spacecraft. */
export function initTrajectory(s: Pick<FlightState, 'design' | 'arrivalT' | 'epochUTC'>, spacecraftMassKg: number): { traj: TrajState; failure: 'NO_LAUNCH_PLAN' | null } {
 const d = s.design, def = d.definition, traj = blankTraj(), start = def.start;
 if (start.kind === 'PROVIDED_ORBIT') {
  const orbit = d.orbit!;
  traj.conic = conicFromElements(orbit.body, s.arrivalT, elementsForOrbit(orbit));
  if (start.stage) {
   const launcher = LAUNCHER_BY_ID[start.stage.launcherId], stage = launcher.stages[launcher.stages.length - 1];
   traj.stage = { dryKg: stage.dryKg, propKg: start.stage.propellantKg, ispSec: stage.ispVacSec, restartsLeft: stage.restarts, attached: true };
  }
 } else {
  const plan = d.launch;
  const ascent = plan ? startAscent(plan.launcherId, plan.program, spacecraftMassKg, start.site, s.epochUTC) : null;
  if (!ascent || ascent.phase === 'FAILED') return { traj, failure: 'NO_LAUNCH_PLAN' };
  traj.ascent = ascent;
 }
 traj.burns = d.burns.map(spec => ({ spec, fireAt: null }));
 traj.burnCount = d.burns.length;
 return { traj, failure: null };
}

export const ascentActive = (s: Pick<FlightState, 'traj'>): boolean => isAscentActive(s.traj.ascent);
export function stageMassKg(s: Pick<FlightState, 'traj'>): number { const st = s.traj.stage; return st && st.attached ? st.dryKg + st.propKg : 0; }
export function totalMassKg(s: Pick<FlightState, 'traj' | 'dryMassKg' | 'propellantKg'>): number { return ascentActive(s) ? massDuringAscent(s) : s.dryMassKg + s.propellantKg + stageMassKg(s); }
function massDuringAscent(s: Pick<FlightState, 'traj'>): number { return ascentSample(s.traj.ascent!).massKg; }

/** Central-body-relative state at t. Before Mars capture the legacy analytic path is frozen at its epoch state. */
/** Position and velocity (km, km/s) about the body whose gravity currently governs the craft. */
export interface CentralState { body: BodyId; r: Vec3; v: Vec3 }
export function centralStateAt(s: Pick<FlightState, 'traj' | 'captured'>, t: number): CentralState {
 const tr = s.traj;
 if (tr.ascent) return { body: 'EARTH', r: tr.ascent.r, v: tr.ascent.v };
 const c = tr.conic!, x = conicAtDt(c, s.captured ? Math.max(0, t - c.t0) : 0);
 return { body: c.body, r: x.r, v: x.v };
}
export function earthStateAt(s: Pick<FlightState, 'traj' | 'captured' | 'epochUTC'>, t: number): { r: Vec3; v: Vec3 } {
 const c = centralStateAt(s, t);
 if (c.body !== 'MOON') return { r: c.r, v: c.v };
 const m = moonState(t, s.epochUTC);
 return { r: add(c.r, m.r), v: add(c.v, m.v) };
}

const FRAME: Readonly<Record<BodyId, StateVector['frame']>> = { EARTH: 'EARTH_J2000EQ', MOON: 'MOON_J2000EQ', MARS: 'MARS_J2000EQ' };
const vec = (body: BodyId, t: number, epochUTC: string, r: Vec3, v: Vec3): StateVector => ({ body, frame: FRAME[body], epochSec: t, epochUTC: new Date(Date.parse(epochUTC) + t * 1000).toISOString(), rKm: [r[0], r[1], r[2]], vKms: [v[0], v[1], v[2]] });
export function stateView(s: Pick<FlightState, 'traj' | 'captured' | 'epochUTC'>, t: number): FlightStateView {
 const c = centralStateAt(s, t), e = earthStateAt(s, t);
 return { central: vec(c.body, t, s.epochUTC, c.r, c.v), earth: vec('EARTH', t, s.epochUTC, e.r, e.v), moon: null, moonEphemeris: null, altitudeKm: len(c.r) - radiusOf(c.body), speedKms: len(c.v) };
}
/** Full view including the Moon states for patched Earth/Moon missions. */
export function fullView(s: FlightState, t: number): FlightStateView {
 const base = stateView(s, t);
 if (!moonModelled(s)) return base;
 const m = moonState(t, s.epochUTC), c = centralStateAt(s, t), e = earthStateAt(s, t);
 const rel = { r: sub(e.r, m.r), v: sub(e.v, m.v) };
 return { ...base, moon: vec('MOON', t, s.epochUTC, rel.r, rel.v), moonEphemeris: vec('EARTH', t, s.epochUTC, m.r, m.v), central: c.body === 'MOON' ? vec('MOON', t, s.epochUTC, c.r, c.v) : base.central };
}

export function orbitTelemetry(s: FlightState): OrbitTelemetry {
 const c = centralStateAt(s, s.t), mu = muOf(c.body), info = orbitInfo(c.r, c.v, mu), R = radiusOf(c.body);
 const conic = s.traj.conic ?? conicFromState(c.body, s.t, c.r, c.v);
 const peri = s.traj.ascent ? timeToApsis(conicFromState(c.body, s.t, c.r, c.v), s.t, 'PERIAPSIS') : timeToApsis(conic, s.t, 'PERIAPSIS');
 const apo = s.traj.ascent ? timeToApsis(conicFromState(c.body, s.t, c.r, c.v), s.t, 'APOAPSIS') : timeToApsis(conic, s.t, 'APOAPSIS');
 const impact = (s.traj.pred?.items ?? []).find(p => p.kind === 'SURFACE_IMPACT' && p.t > s.t);
 return {
  kind: info.kind, body: c.body, smaKm: info.kind === 'PARABOLA' ? 0 : info.aKm, ecc: info.e, inclinationDeg: info.incRad * 180 / Math.PI, periapsisAltKm: info.rpKm - R, apoapsisAltKm: info.raKm === null ? null : info.raKm - R, periodSec: info.periodSec,
  specificEnergyKm2s2: info.energy, vInfKms: info.vInfKms, timeToPeriapsisSec: peri, timeToApoapsisSec: apo, impacts: info.rpKm < R, impactInSec: impact ? impact.t - s.t : null,
 };
}

export function missionPhase(s: FlightState): MissionPhase {
 if (s.ended) return 'COMPLETE';
 if (ascentActive(s)) return 'ASCENT';
 if (s.cruise) return 'CRUISE';
 if (s.capturePending) return 'ENCOUNTER';
 const c = centralStateAt(s, s.t), info = orbitInfo(c.r, c.v, muOf(c.body));
 if (c.body === 'MOON') return info.kind === 'ELLIPSE' ? 'CAPTURED' : 'ENCOUNTER';
 if (c.body === 'MARS') return 'OPERATE';
 return info.kind === 'ELLIPSE' && info.rpKm - radiusOf('EARTH') >= ATMOSPHERE_TOP_KM ? 'OPERATE' : 'COAST';
}

export function flightTelemetry(s: FlightState): FlightTelemetry {
 const a = s.traj.ascent, active = isAscentActive(a), st = s.traj.stage;
 return {
  phase: missionPhase(s), view: fullView(s, s.t), orbit: orbitTelemetry(s),
  mass: { totalKg: totalMassKg(s), spacecraftDryKg: s.dryMassKg, spacecraftPropellantKg: s.propellantKg, stage: st ? { attached: st.attached, dryKg: st.dryKg, propellantKg: st.propKg, restartsLeft: st.restartsLeft } : null },
  ascent: a && (active || a.phase === 'HANDOFF') ? { stageIndex: a.phase === 'S1' ? 0 : 1, thrustKN: a.thrustKN, throttle: a.thrustKN > 0 ? 1 : 0, dynamicPressurePa: a.qPa, downrangeKm: ascentSample(a).downrangeKm, flightPathDeg: flightPathDeg(a), cutoff: a.cutoff, separatedAtSec: a.separatedAtSec } : null,
  burns: s.traj.receipts.slice(), scheduled: s.traj.burns.map((b): ScheduledBurnView => ({ burn: b.spec, fireAtSec: b.fireAt, status: b.fireAt === null ? 'PLANNED' : 'ARMED' })), trajectoryEvents: s.traj.events.slice(),
  limits: ['model.limit.pointMassGravity', 'model.limit.impulsiveBurns', 'model.limit.ascentAtmosphere', 'model.limit.moonOnRails', 'model.limit.patchedConics', 'model.limit.noReentry'],
 };
}

export function recordTrajectoryEvent(s: FlightState, e: TrajectoryEvent): void {
 s.traj.events.push(e);
 if (s.traj.events.length > TRAJECTORY_EVENT_RING) s.traj.events.splice(0, s.traj.events.length - TRAJECTORY_EVENT_RING);
}

// ---- prediction ------------------------------------------------------------------------------------------------------
function bisect(f: (t: number) => number, lo: number, hi: number): number {
 // f(lo) and f(hi) have opposite signs; return the post-crossing edge within 1 ms.
 const flo = f(lo) > 0;
 for (let n = 0; n < 48 && hi - lo > 1e-3; n++) { const mid = (lo + hi) / 2; if ((f(mid) > 0) === flo) lo = mid; else hi = mid; }
 return hi;
}
export function predictEvents(s: FlightState): Predicted[] {
 const c = s.traj.conic;
 if (!c || s.cruise && !s.captured) return [];
 const out: Predicted[] = [], t0 = s.t, def = s.design.definition, tEnd = Math.min(s.arrivalT + def.environment.durationSec, t0 + MAX_SCAN_SEC), R = radiusOf(c.body), mu = c.mu, body = c.body;
 const at = (t: number) => conicAtDt(c, Math.max(0, t - c.t0));
 const now = at(t0), info = orbitInfo(now.r, now.v, mu), ifaces = body === 'EARTH' ? watchAltitudes(s) : [];
 if (needsApsis(s)) {
  const tp = timeToApsis(c, t0, 'PERIAPSIS'), ta = timeToApsis(c, t0, 'APOAPSIS');
  if (tp !== null && t0 + tp <= tEnd) out.push({ t: t0 + tp, kind: 'PERIAPSIS', body, values: { radiusKm: info.rpKm, altitudeKm: info.rpKm - R } });
  if (ta !== null && info.raKm !== null && t0 + ta <= tEnd) out.push({ t: t0 + ta, kind: 'APOAPSIS', body, values: { radiusKm: info.raKm, altitudeKm: info.raKm - R } });
 }
 const dMoon = CONSTANTS.MOON.distanceKm.v;
 const soiPossible = moonModelled(s) && (body === 'MOON' ? info.kind !== 'ELLIPSE' || (info.raKm ?? 0) >= MOON_SOI_RADIUS_KM * 0.98 : info.kind !== 'ELLIPSE' || (info.raKm ?? 0) >= dMoon - MOON_SOI_RADIUS_KM - 2000);
 const surfacePossible = info.rpKm < R, ifacePossible = ifaces.some(alt => info.rpKm < R + alt);
 if (surfacePossible || ifacePossible || soiPossible) {
  const earthMoon = (t: number): number => { const x = at(t), m = moonState(t, s.epochUTC); return len(sub(x.r, m.r)); };
  const radius = (t: number): number => len(at(t).r);
  const soi = (t: number): number => body === 'EARTH' ? earthMoon(t) - MOON_SOI_RADIUS_KM : len(at(t).r) - MOON_SOI_RADIUS_KM;
  let t = t0, prevRadius = radius(t0), prevSoi = soiPossible ? soi(t0) : 0, prevRv = now.r[0] * now.v[0] + now.r[1] * now.v[1] + now.r[2] * now.v[2];
  let terminal = false;
  for (let n = 0; n < 40000 && t < tEnd && !terminal; n++) {
   const h = Math.max(1, Math.min(600, 0.04 * Math.sqrt(prevRadius ** 3 / mu))), tn = Math.min(tEnd, t + h), x = at(tn), rn = len(x.r);
   if (surfacePossible && prevRadius > R && rn <= R) { const te = bisect(q => len(at(q).r) - R, t, tn), xe = at(te); out.push({ t: te, kind: 'SURFACE_IMPACT', body, values: { speedKms: len(xe.v), latitudeDeg: Math.asin(xe.r[2] / len(xe.r)) * 180 / Math.PI } }); terminal = true; }
   for (const alt of ifaces) if (prevRadius > R + alt && rn <= R + alt && prevRv < 0) { const te = bisect(q => len(at(q).r) - (R + alt), t, tn); out.push({ t: te, kind: 'ENTRY_INTERFACE', body, values: { altitudeKm: alt } }); }
   if (soiPossible && !terminal) {
    const g = soi(tn);
    if (body === 'EARTH' && prevSoi > 0 && g <= 0) { const te = bisect(soi, t, tn); out.push({ t: te, kind: 'SOI_ENTRY', body: 'MOON', values: { distanceKm: MOON_SOI_RADIUS_KM } }); terminal = true; }
    if (body === 'MOON' && prevSoi < 0 && g >= 0) { const te = bisect(soi, t, tn); out.push({ t: te, kind: 'SOI_EXIT', body: 'EARTH', values: { distanceKm: MOON_SOI_RADIUS_KM } }); terminal = true; }
    prevSoi = g;
   }
   prevRv = x.r[0] * x.v[0] + x.r[1] * x.v[1] + x.r[2] * x.v[2]; prevRadius = rn; t = tn;
  }
 }
 // A terminal event truncates later analytic apsides: they would belong to a different segment.
 const stop = out.filter(p => p.kind === 'SURFACE_IMPACT' || p.kind === 'SOI_ENTRY' || p.kind === 'SOI_EXIT').reduce((m, p) => Math.min(m, p.t), Infinity);
 return out.filter(p => p.t <= stop + 1e-9).sort((a, b) => a.t - b.t);
}
export function predicted(s: FlightState): readonly Predicted[] {
 const tr = s.traj;
 if (!tr.conic || ascentActive(s)) return [];
 if (!tr.pred || tr.pred.version !== tr.version) tr.pred = { version: tr.version, fromT: s.t, items: predictEvents(s) };
 return tr.pred.items;
}

// ---- burns -----------------------------------------------------------------------------------------------------------
/** Resolve each pending burn's ignition instant against the current segment; null while its trigger cannot occur yet. */
export function armBurns(s: FlightState): void {
 const tr = s.traj, c = tr.conic;
 if (!c) return;
 for (const b of tr.burns) {
  const g = b.spec.trigger;
  if (g.kind === 'AT_TIME') b.fireAt = s.arrivalT + g.tSec;
  else if (g.kind === 'AT_APSIS') {
   if (g.body !== undefined && g.body !== c.body) { b.fireAt = null; continue; }
   const from = Math.max(s.t, s.arrivalT + g.notBeforeSec);
   const dt = timeToApsis(c, from, g.apsis);
   b.fireAt = dt === null ? null : from + dt;
  } else if (b.fireAt !== null && tr.soiEntryAt === null) b.fireAt = null;
 }
}
export function nextTrajectoryBoundary(s: FlightState): number {
 let best = Infinity;
 for (const p of predicted(s)) if (p.t > s.t + 1e-8) { best = Math.min(best, p.t); break; }
 for (const b of s.traj.burns) if (b.fireAt !== null && b.fireAt > s.t + 1e-8) best = Math.min(best, b.fireAt);
 return best;
}
export function burnCapacityRefusal(s: FlightState, spec: BurnSpec): 'BURN_NOT_ALLOWED' | 'BURN_LIMIT' | 'BURN_DUPLICATE_ID' | 'BURN_TRIGGER_PAST' | null {
 const tr = s.design.definition.trajectory;
 if (tr.model !== 'PATCHED_CONICS' || !tr.maneuvers.allowed) return 'BURN_NOT_ALLOWED';
 if (s.traj.burnCount >= tr.maneuvers.maxBurns) return 'BURN_LIMIT';
 if (s.traj.burns.some(b => b.spec.id === spec.id) || s.traj.receipts.some(r => r.id === spec.id)) return 'BURN_DUPLICATE_ID';
 if (spec.trigger.kind === 'AT_TIME' && s.arrivalT + spec.trigger.tSec <= s.t + 1e-8) return 'BURN_TRIGGER_PAST';
 return null;
}
export function addBurn(s: FlightState, spec: BurnSpec): void { s.traj.burns.push({ spec, fireAt: null }); s.traj.burnCount++; armBurns(s); }
export function cancelBurn(s: FlightState, id: string): boolean {
 const i = s.traj.burns.findIndex(b => b.spec.id === id);
 if (i < 0) return false;
 const spec = s.traj.burns[i].spec, c = centralStateAt(s, s.t);
 s.traj.burns.splice(i, 1);
 s.traj.receipts.push({ id, status: 'CANCELLED', atSec: s.t, source: spec.source, requestedDvKms: len(spec.dv), achievedDvKms: 0, propellantUsedKg: 0, before: vec(c.body, s.t, s.epochUTC, c.r, c.v), after: null, reason: 'cancelled before ignition' });
 return true;
}
export function separateStage(s: FlightState, events: SimEvent[]): boolean {
 const st = s.traj.stage;
 if (!st || !st.attached) return false;
 st.attached = false;
 recordTrajectoryEvent(s, { kind: 'PAYLOAD_SEPARATION', t: s.t, body: centralStateAt(s, s.t).body, values: { stageDryKg: st.dryKg, residualPropKg: st.propKg } });
 events.push({ kind: 'STAGE_SEPARATION', t: s.t, autoPause: false, values: { stageDryKg: st.dryKg, residualPropKg: st.propKg } });
 return true;
}
export const rocketPropellantKg = (m0: number, dvKms: number, ispSec: number): number => m0 * (1 - Math.exp(-dvKms * 1000 / (ispSec * G0)));
const rocketDvKms = (m0: number, propKg: number, ispSec: number): number => ispSec * G0 / 1000 * Math.log(m0 / (m0 - propKg));

/** Execute one ideal impulsive burn at the current instant. Never grants propellant: a short inventory yields a partial burn or a refusal. */
export function executeBurn(s: FlightState, spec: BurnSpec, events: SimEvent[]): BurnReceipt {
 const c = centralStateAt(s, s.t), before = vec(c.body, s.t, s.epochUTC, c.r, c.v), requested = len(spec.dv);
 const receipt = (status: BurnReceipt['status'], achieved: number, used: number, after: StateVector | null, reason?: string): BurnReceipt => ({ id: spec.id, status, atSec: s.t, source: spec.source, requestedDvKms: requested, achievedDvKms: achieved, propellantUsedKg: used, before, after, ...(reason ? { reason } : {}) });
 const done = (r: BurnReceipt): BurnReceipt => { s.traj.receipts.push(r); s.traj.burns = s.traj.burns.filter(b => b.spec.id !== spec.id); if (s.traj.receipts.length > 64) s.traj.receipts.shift(); events.push({ kind: 'BURN_EXECUTED', t: s.t, autoPause: true, values: { id: spec.id, status: r.status, requestedDvKms: r.requestedDvKms, achievedDvKms: r.achievedDvKms, propellantKg: r.propellantUsedKg, reason: r.reason ?? '' } }); recordTrajectoryEvent(s, { kind: 'BURN', t: s.t, body: c.body, values: { id: spec.id, status: r.status, achievedDvKms: r.achievedDvKms } }); return r; };
 if (s.computerState !== 'RUNNING' || s.safe) return done(receipt('MISSED', 0, 0, null, 'flight computer not available (safe mode or reboot)'));
 if (spec.source === 'SPACECRAFT') {
  if (s.ispSec <= 0) return done(receipt('REFUSED', 0, 0, null, 'NO_PROPULSION'));
  if (s.traj.stage?.attached) separateStage(s, events);
 } else if (!s.traj.stage || !s.traj.stage.attached) return done(receipt('REFUSED', 0, 0, null, 'NO_STAGE'));
 else if (s.traj.stage.restartsLeft <= 0) return done(receipt('REFUSED', 0, 0, null, 'NO_RESTART'));
 const stage = spec.source === 'UPPER_STAGE' ? s.traj.stage! : null, isp = stage ? stage.ispSec : s.ispSec, avail = stage ? stage.propKg : s.propellantKg, m0 = totalMassKg(s);
 const needed = rocketPropellantKg(m0, requested, isp), used = Math.min(needed, avail);
 if (used <= 1e-9) return done(receipt('REFUSED', 0, 0, null, 'PROPELLANT_SHORT'));
 const achieved = needed <= avail + 1e-9 ? requested : rocketDvKms(m0, used, isp), scaleBy = requested > 0 ? achieved / requested : 0;
 const dv = scale(burnVector(c.r, c.v, spec.frame, spec.dv), scaleBy), v = add(c.v, dv);
 if (stage) { stage.propKg -= used; stage.restartsLeft--; } else s.propellantKg = Math.max(0, s.propellantKg - used);
 s.traj.conic = conicFromState(c.body, s.t, c.r, v); s.traj.version++; s.traj.pred = null;
 return done(receipt(needed <= avail + 1e-9 ? 'EXECUTED' : 'PARTIAL', achieved, used, vec(c.body, s.t, s.epochUTC, c.r, v), needed <= avail + 1e-9 ? undefined : 'propellant exhausted before the requested delta-v'));
}

// ---- event application -----------------------------------------------------------------------------------------------
export interface TrajectoryHooks { impact: (events: SimEvent[]) => void }
/** Apply everything that is due at s.t: predicted events first (frame changes, impact), then burns, so state changes never reorder. */
export function applyTrajectory(s: FlightState, events: SimEvent[], hooks: TrajectoryHooks): void {
 const tr = s.traj;
 if (!tr.conic || ascentActive(s) || s.ended) return;
 if (tr.burns.some(b => b.fireAt === null)) armBurns(s);
 for (let guard = 0; guard < 16 && !s.ended; guard++) {
  const due = predicted(s).find(p => p.t <= s.t + 1e-6 && p.t > (tr.pred?.fromT ?? -Infinity) - 1e-9);
  if (!due) break;
  const c = centralStateAt(s, s.t);
  // Drop the consumed event before any state change invalidates the cache.
  const consumed = tr.pred!.items.indexOf(due); tr.pred!.items = tr.pred!.items.filter((_, i) => i !== consumed); tr.pred!.fromT = s.t;
  if (due.kind === 'SOI_ENTRY' || due.kind === 'SOI_EXIT') {
   const m = moonState(s.t, s.epochUTC), entering = due.kind === 'SOI_ENTRY';
   const r = entering ? sub(c.r, m.r) : add(c.r, m.r), v = entering ? sub(c.v, m.v) : add(c.v, m.v);
   tr.conic = conicFromState(entering ? 'MOON' : 'EARTH', s.t, r, v); tr.version++; tr.pred = null; if (entering) tr.soiEntryAt = s.t;
   recordTrajectoryEvent(s, { kind: due.kind, t: s.t, body: entering ? 'MOON' : 'EARTH', values: { rKm: len(r), speedKms: len(v) } });
   events.push({ kind: due.kind, t: s.t, autoPause: true, values: { body: entering ? 'MOON' : 'EARTH', rKm: len(r), speedKms: len(v) } });
   armBurns(s);
   for (const b of tr.burns) if (b.spec.trigger.kind === 'AT_SOI_ENTRY' && entering) b.fireAt = s.t + b.spec.trigger.delaySec;
  } else if (due.kind === 'SURFACE_IMPACT') {
   recordTrajectoryEvent(s, { kind: 'SURFACE_IMPACT', t: s.t, body: due.body, values: due.values });
   events.push({ kind: 'SURFACE_IMPACT', t: s.t, autoPause: true, values: { body: due.body, ...due.values } });
   hooks.impact(events);
  } else if (due.kind === 'ENTRY_INTERFACE') {
   tr.crossings[String(due.values.altitudeKm)] = s.t;
   recordTrajectoryEvent(s, { kind: 'ENTRY_INTERFACE', t: s.t, body: due.body, values: due.values });
   events.push({ kind: 'ENTRY_INTERFACE', t: s.t, autoPause: true, values: { ...due.values } });
  } else if (due.kind === 'APOAPSIS') {
   tr.maxAltKm = Math.max(tr.maxAltKm, Number(due.values.altitudeKm)); if (due.body === 'EARTH') tr.peakPassed = true;
   recordTrajectoryEvent(s, { kind: 'APOAPSIS', t: s.t, body: due.body, values: due.values });
  } else {
   if (due.body === 'MOON' && tr.soiEntryAt !== null) {
    const closest = Number(due.values.radiusKm);
    if (!tr.encounter || closest < tr.encounter.closestKm) {
     tr.encounter = { closestKm: closest, atSec: s.t };
     recordTrajectoryEvent(s, { kind: 'ENCOUNTER_CLOSEST', t: s.t, body: 'MOON', values: { closestKm: closest, altitudeKm: Number(due.values.altitudeKm) } });
     events.push({ kind: 'ENCOUNTER_CLOSEST', t: s.t, autoPause: true, values: { closestKm: closest, altitudeKm: Number(due.values.altitudeKm) } });
    }
   } else recordTrajectoryEvent(s, { kind: 'PERIAPSIS', t: s.t, body: due.body, values: due.values });
  }
 }
 for (let guard = 0; guard < 8 && !s.ended; guard++) {
  const burn = s.traj.burns.filter(b => b.fireAt !== null && b.fireAt <= s.t + 1e-6).sort((a, b) => a.fireAt! - b.fireAt!)[0];
  if (!burn) break;
  executeBurn(s, burn.spec, events);
  armBurns(s);
 }
}

// ---- ascent glue -----------------------------------------------------------------------------------------------------
const ASCENT_SIM_EVENTS: Partial<Record<TrajectoryEvent['kind'], { kind: SimEventKind; pause: boolean }>> = {
 LIFTOFF: { kind: 'LIFTOFF', pause: false }, STAGE_SEPARATION: { kind: 'STAGE_SEPARATION', pause: false }, ORBIT_INSERTION: { kind: 'ORBIT_INSERTION', pause: true }, SURFACE_IMPACT: { kind: 'SURFACE_IMPACT', pause: true }, ENTRY_INTERFACE: { kind: 'ENTRY_INTERFACE', pause: true },
};
/** The next instant at which ascent state can change (one substep ahead); the step engine uses it as its boundary. */
export const nextAscentTime = (s: Pick<FlightState, 'traj'>): number => s.traj.ascent!.t + nextSubstep(s.traj.ascent!).h;
/** Integrate whole ascent substeps up to tTarget. The result is partition independent because substeps never split at tTarget. */
export function advanceAscentTo(s: FlightState, tTarget: number, events: SimEvent[]): void {
 const a = s.traj.ascent!, out: TrajectoryEvent[] = [];
 advanceAscent(a, tTarget, e => out.push(e), watchAltitudes(s));
 s.t = a.t;
 s.traj.maxAltKm = Math.max(s.traj.maxAltKm, a.maxAltKm);
 if (dotv(a.r, a.v) < 0) s.traj.peakPassed = true;
 for (const e of out) {
  recordTrajectoryEvent(s, e);
  if (e.kind === 'ENTRY_INTERFACE') s.traj.crossings[String(e.values.altitudeKm)] = e.t;
  const mapped = ASCENT_SIM_EVENTS[e.kind];
  if (mapped) events.push({ kind: mapped.kind, t: e.t, autoPause: mapped.pause, values: { ...e.values } });
 }
}
/** Hand a finished ascent to the conic engine: payload (and an optionally held upper stage) continue as one Earth-centred segment. */
export function handoffAscent(s: FlightState): void {
 const a = s.traj.ascent!;
 s.traj.conic = conicFromState('EARTH', a.t, a.r, a.v); s.traj.version++; s.traj.pred = null;
 if (a.residualStage) { const stage = LAUNCHER_BY_ID[a.launcherId].stages[1]; s.traj.stage = { dryKg: a.residualStage.dryKg, propKg: a.residualStage.propKg, ispSec: stage.ispVacSec, restartsLeft: stage.restarts, attached: true }; }
 s.traj.ascent = null;
}
export const ascentProgramOf = (s: Pick<FlightState, 'design'>): AscentProgram | null => s.design.launch?.program ?? null;
export function unitTowardsMoon(s: FlightState): Vec3 { const m = moonState(s.t, s.epochUTC); return unit(m.r); }

const finiteIn = (v: unknown, lo: number, hi: number): boolean => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
export const MAX_BURN_DV_KMS = 12;
/** Structural bounds for a burn; the wire parser, design quote and command path all use this single rule. */
export function burnSpecValid(b: BurnSpec): boolean {
 if (typeof b !== 'object' || b === null || typeof b.id !== 'string' || !/^[A-Za-z0-9._-]{1,24}$/.test(b.id)) return false;
 if (b.source !== 'SPACECRAFT' && b.source !== 'UPPER_STAGE') return false;
 if (b.frame !== 'VNR' && b.frame !== 'INERTIAL' || b.model !== 'IMPULSIVE') return false;
 if (!Array.isArray(b.dv) || b.dv.length !== 3 || !b.dv.every(x => finiteIn(x, -MAX_BURN_DV_KMS, MAX_BURN_DV_KMS))) return false;
 const mag = Math.hypot(b.dv[0], b.dv[1], b.dv[2]);
 if (!(mag > 0 && mag <= MAX_BURN_DV_KMS)) return false;
 const g = b.trigger;
 if (typeof g !== 'object' || g === null) return false;
 if (g.kind === 'AT_TIME') return finiteIn(g.tSec, 0, 1e8);
 if (g.kind === 'AT_APSIS') return (g.apsis === 'PERIAPSIS' || g.apsis === 'APOAPSIS') && finiteIn(g.notBeforeSec, 0, 1e8) && (g.body === undefined || g.body === 'EARTH' || g.body === 'MOON');
 if (g.kind === 'AT_SOI_ENTRY') return g.body === 'MOON' && finiteIn(g.delaySec, 0, 1e7);
 return false;
}
