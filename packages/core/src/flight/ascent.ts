// Bounded finite-thrust ascent: point-mass gravity, rotating exponential atmosphere with constant Cd, constant mass flow, two stages.
// Stage 1 flies the authored vertical rise, pitch-over and zero-angle-of-attack gravity turn. Stage 2 uses closed-loop altitude-hold
// pitch guidance and cuts off at osculating periapsis >= target - 5 km. No lift, winds, structural loads or Mach-dependent Cd.
import { CONSTANTS, TAU, stationPosition, type Vec3 } from '../physics';
import type { AscentProgram } from '../mission/types';
import { add, cross, dotv, len, orbitInfo, scale, sub, unit } from './conic';
import { LAUNCHER_BY_ID } from './launchers';
import type { AscentSample, LauncherDef, TrajectoryEvent } from './types';

export const ASCENT_STEP_SEC = 0.5;
export const ATMOSPHERE_TOP_KM = 150;
export const SECO_TOLERANCE_KM = 5;
export const ASCENT_MAX_SEC = 3600;
const RHO0 = 1.225, SCALE_KM = 7.2, G0 = CONSTANTS.g0.v, MU = CONSTANTS.EARTH.mu.v, RE = CONSTANTS.EARTH.radius.v;
const OMEGA = TAU / CONSTANTS.EARTH.rotationSec.v;

export type AscentPhase = 'S1' | 'COAST12' | 'S2' | 'ATM_COAST' | 'HANDOFF' | 'FAILED';
export interface AscentState {
 launcherId: string; program: AscentProgram; phase: AscentPhase; t: number; r: Vec3; v: Vec3; payloadKg: number;
 prop1: number; prop2: number; stageDropped: boolean; coastEndT: number; separatedAtSec: number | null; cutoff: 'NONE' | 'SECO' | 'FUEL_OUT';
 padR: Vec3; heading: Vec3; hold: boolean; residualStage: { dryKg: number; propKg: number } | null; failure: 'NONE' | 'NO_LIFTOFF' | 'IMPACT';
 thrustKN: number; qPa: number; maxQPa: number; maxQAt: number; maxQEmitted: boolean; maxAltKm: number; lossGravity: number; lossDrag: number; lossSteering: number; nextSampleAt: number;
}
const launcherOf = (a: AscentState): LauncherDef => LAUNCHER_BY_ID[a.launcherId];
const omegaCross = (r: Vec3): Vec3 => [-OMEGA * r[1], OMEGA * r[0], 0];
export const altitudeKm = (r: Vec3): number => len(r) - RE;

export function massOf(a: AscentState): number {
 const l = launcherOf(a);
 let m = a.payloadKg;
 if (a.phase === 'S1') m += l.stages[0].dryKg + a.prop1 + (l.stages[1] ? l.stages[1].dryKg + a.prop2 : 0);
 else if (!a.stageDropped) m += (l.stages.length > 1 ? l.stages[1] : l.stages[0]).dryKg + (l.stages.length > 1 ? a.prop2 : a.prop1);
 return m;
}
export function startAscent(launcherId: string, program: AscentProgram, payloadKg: number, site: { latDeg: number; lonDeg: number }, epochUTC: string): AscentState | null {
 const l = LAUNCHER_BY_ID[launcherId];
 if (!l || !(payloadKg > 0)) return null;
 const padR = stationPosition(0, 'EARTH', site.latDeg, site.lonDeg, undefined, epochUTC), up = unit(padR), east = unit(cross([0, 0, 1], up)), north = cross(up, east), az = program.azimuthDeg * Math.PI / 180;
 const a: AscentState = {
  launcherId, program, phase: 'S1', t: 0, r: [padR[0], padR[1], padR[2]], v: omegaCross(padR), payloadKg, prop1: l.stages[0].propellantKg * program.stage1LoadFraction, prop2: l.stages[1]?.propellantKg ?? 0,
  stageDropped: false, coastEndT: 0, separatedAtSec: null, cutoff: 'NONE', padR, heading: add(scale(north, Math.cos(az)), scale(east, Math.sin(az))), hold: program.holdUpperStage && l.stages.length > 1, residualStage: null, failure: 'NONE',
  thrustKN: 0, qPa: 0, maxQPa: 0, maxQAt: 0, maxQEmitted: false, maxAltKm: 0, lossGravity: 0, lossDrag: 0, lossSteering: 0, nextSampleAt: 0,
 };
 // Sea-level thrust must exceed weight, otherwise the vehicle never leaves the pad.
 const s1 = l.stages[0], sl = s1.thrustKN * (s1.ispSeaSec / s1.ispVacSec);
 if (sl / (massOf(a) * G0 / 1000) <= 1) { a.phase = 'FAILED'; a.failure = 'NO_LIFTOFF'; }
 return a;
}

interface Deriv { dv: Vec3; mdot: number; thrust: number; q: number; drag: number; phi: number }
function derivative(a: AscentState, r: Vec3, v: Vec3, t: number, m: number, thrusting: boolean): Deriv {
 const l = launcherOf(a), rn = len(r), h = rn - RE, up = scale(r, 1 / rn), stage = a.phase === 'S1' ? l.stages[0] : l.stages[1] ?? l.stages[0];
 let acc = scale(r, -MU / (rn * rn * rn));
 const vrel = sub(v, omegaCross(r)), vr = len(vrel), rho = h < ATMOSPHERE_TOP_KM ? RHO0 * Math.exp(-h / SCALE_KM) : 0;
 const q = 0.5 * rho * (vr * 1000) ** 2;
 let drag = 0;
 if (q > 0 && vr > 0) { drag = q * l.cdAreaM2 / (m * 1000); acc = add(acc, scale(vrel, -drag / vr)); }
 let thrust = 0, mdot = 0, phi = 0;
 if (thrusting) {
  const frac = h < ATMOSPHERE_TOP_KM ? Math.exp(-h / SCALE_KM) : 0, isp = stage.ispVacSec + (stage.ispSeaSec - stage.ispVacSec) * frac;
  mdot = stage.thrustKN * 1000 / (G0 * stage.ispVacSec); thrust = mdot * G0 * isp / 1000;
  let d: Vec3;
  if (a.phase === 'S1') {
   const p = a.program;
   if (t < p.verticalSec) d = up;
   else if (t < p.verticalSec + p.kickSec) { const k = p.kickDeg * Math.PI / 180 * (t - p.verticalSec) / p.kickSec; d = unit(add(scale(up, Math.cos(k)), scale(a.heading, Math.sin(k)))); }
   else d = vr > 1e-3 ? unit(vrel) : up;
  } else {
   const vh = sub(v, scale(up, dotv(v, up))), vhn = len(vh), hh = vhn > 1e-6 ? scale(vh, 1 / vhn) : a.heading, vrad = dotv(v, up);
   const vcmd = Math.max(-0.15, Math.min(0.6, (a.program.insertionAltKm - h) / 90)), need = (vcmd - vrad) / 20 + MU / (rn * rn) - vhn * vhn / rn;
   const sn = Math.max(-0.34, Math.min(0.985, need / (thrust / m)));
   d = add(scale(up, sn), scale(hh, Math.sqrt(1 - sn * sn)));
  }
  acc = add(acc, scale(d, thrust / m));
  const vn = len(v); phi = vn > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, dotv(d, v) / vn))) : 0;
 }
 return { dv: acc, mdot, thrust, q, drag, phi };
}

/** One RK4 step of length h from the current state; mutates a. */
function step(a: AscentState, h: number, thrusting: boolean): void {
 const m0 = massOf(a), t0 = a.t;
 const k1 = derivative(a, a.r, a.v, t0, m0, thrusting), mdot = k1.mdot;
 const r2 = add(a.r, scale(a.v, h / 2)), v2 = add(a.v, scale(k1.dv, h / 2));
 const k2 = derivative(a, r2, v2, t0 + h / 2, m0 - mdot * h / 2, thrusting);
 const r3 = add(a.r, scale(v2, h / 2)), v3 = add(a.v, scale(k2.dv, h / 2));
 const k3 = derivative(a, r3, v3, t0 + h / 2, m0 - mdot * h / 2, thrusting);
 const r4 = add(a.r, scale(v3, h)), v4 = add(a.v, scale(k3.dv, h));
 const k4 = derivative(a, r4, v4, t0 + h, m0 - mdot * h, thrusting);
 const vSum = (i: number): number => a.v[i] + h / 6 * (k1.dv[i] + 2 * k2.dv[i] + 2 * k3.dv[i] + k4.dv[i]);
 const rSum = (i: number): number => a.r[i] + h / 6 * (a.v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]);
 const g = MU / (len(a.r) ** 2), vn = len(a.v), gamma = vn > 0 ? dotv(a.v, unit(a.r)) / vn : 1;
 a.lossGravity += g * Math.max(0, gamma) * h; a.lossDrag += k1.drag * h; a.lossSteering += thrusting && k1.thrust > 0 ? k1.thrust / m0 * (1 - Math.cos(k1.phi)) * h : 0;
 a.r = [rSum(0), rSum(1), rSum(2)]; a.v = [vSum(0), vSum(1), vSum(2)]; a.t = t0 + h;
 if (thrusting) { if (a.phase === 'S1') a.prop1 = Math.max(0, a.prop1 - mdot * h); else a.prop2 = Math.max(0, a.prop2 - mdot * h); }
 a.thrustKN = thrusting ? k1.thrust : 0; a.qPa = k1.q;
 if (k1.q > a.maxQPa) { a.maxQPa = k1.q; a.maxQAt = t0; }
 a.maxAltKm = Math.max(a.maxAltKm, altitudeKm(a.r));
}
const copy = (a: AscentState): AscentState => ({ ...a, r: [...a.r] as Vec3, v: [...a.v] as Vec3, program: a.program });

type Emit = (e: TrajectoryEvent) => void;
const ev = (kind: TrajectoryEvent['kind'], a: AscentState, values: Record<string, number | string> = {}): TrajectoryEvent => ({ kind, t: a.t, body: 'EARTH', values });

function finishPowered(a: AscentState, cause: 'SECO' | 'FUEL_OUT', emit: Emit): void {
 const l = launcherOf(a), two = l.stages.length > 1;
 a.cutoff = cause; emit(ev('SECO', a, { cause, altKm: altitudeKm(a.r), speedKms: len(a.v) }));
 if (two) {
  if (a.hold) a.residualStage = { dryKg: l.stages[1].dryKg, propKg: a.prop2 };
  else { a.stageDropped = true; emit(ev('PAYLOAD_SEPARATION', a, { stageDryKg: l.stages[1].dryKg, residualPropKg: a.prop2 })); }
 }
 a.phase = 'ATM_COAST';
 if (altitudeKm(a.r) >= ATMOSPHERE_TOP_KM) handoff(a, emit);
}
function handoff(a: AscentState, emit: Emit): void {
 const info = orbitInfo(a.r, a.v, MU);
 a.phase = 'HANDOFF';
 if (info.kind === 'ELLIPSE' && info.rpKm - RE >= ATMOSPHERE_TOP_KM) emit(ev('ORBIT_INSERTION', a, { periapsisAltKm: info.rpKm - RE, apoapsisAltKm: (info.raKm ?? 0) - RE, speedKms: len(a.v), altKm: altitudeKm(a.r) }));
}

interface Sub { h: number; thrusting: boolean; burnout: boolean }
/** Length of the next substep from the state alone: next absolute 0.5 s grid point, shortened only by deterministic state events (coast end, burnout). */
export function nextSubstep(a: AscentState): Sub {
 const l = launcherOf(a), phase = a.phase === 'COAST12' && a.t >= a.coastEndT - 1e-9 ? 'S2' : a.phase;
 let h = (Math.floor(a.t / ASCENT_STEP_SEC + 1e-9) + 1) * ASCENT_STEP_SEC - a.t;
 if (phase === 'COAST12') h = Math.min(h, a.coastEndT - a.t);
 const stage = phase === 'S1' ? l.stages[0] : l.stages[1] ?? l.stages[0], remaining = phase === 'S1' ? a.prop1 : a.prop2, thrusting = (phase === 'S1' || phase === 'S2') && remaining > 1e-9;
 if (thrusting) { const burn = remaining / (stage.thrustKN * 1000 / (G0 * stage.ispVacSec)); if (burn <= h + 1e-9) return { h: burn, thrusting, burnout: true }; }
 return { h, thrusting, burnout: false };
}
/** Smallest sub-interval of one step at which `reached` first holds (post-crossing edge within 0.1 ms). */
function stepRoot(before: AscentState, h: number, thrusting: boolean, reached: (x: AscentState) => boolean): AscentState {
 let lo = 0, hi = h, best: AscentState | null = null;
 for (let n = 0; n < 48 && hi - lo > 1e-4; n++) { const mid = (lo + hi) / 2, trial = copy(before); step(trial, mid, thrusting); if (reached(trial)) { hi = mid; best = trial; } else lo = mid; }
 if (best) return best;
 const end = copy(before); step(end, h, thrusting); return end;
}
const seco = (a: AscentState, x: AscentState): boolean => { const info = orbitInfo(x.r, x.v, MU); return info.kind === 'ELLIPSE' && info.rpKm - RE >= a.program.insertionAltKm - SECO_TOLERANCE_KM; };
function runSubstep(a: AscentState, sub: Sub, emit: Emit, levels: readonly number[]): void {
 const l = launcherOf(a), twoStage = l.stages.length > 1, before = copy(a), prevAlt = altitudeKm(a.r);
 if (a.phase === 'COAST12' && a.t >= a.coastEndT - 1e-9) a.phase = 'S2';
 if (a.t === 0) emit(ev('LIFTOFF', a, { massKg: massOf(a) }));
 const phase = a.phase;
 step(a, sub.h, sub.thrusting);
 if (sub.burnout) { if (phase === 'S1') a.prop1 = 0; else a.prop2 = 0; }
 // Surface impact: root-find the crossing instead of publishing the overshoot.
 if (altitudeKm(a.r) < 0) {
  Object.assign(a, stepRoot(before, sub.h, sub.thrusting, x => altitudeKm(x.r) <= 0));
  a.phase = 'FAILED'; a.failure = 'IMPACT'; emit(ev('SURFACE_IMPACT', a, { speedKms: len(a.v), phase: 'ASCENT' })); return;
 }
 const alt = altitudeKm(a.r), descending = dotv(a.r, a.v) < 0;
 for (const level of levels) if (prevAlt > level && alt <= level && descending) { const x = stepRoot(before, sub.h, sub.thrusting, y => altitudeKm(y.r) <= level); emit({ kind: 'ENTRY_INTERFACE', t: x.t, body: 'EARTH', values: { altitudeKm: level } }); }
 if (!a.maxQEmitted && a.maxQPa > 1000 && a.qPa < a.maxQPa * 0.98) { a.maxQEmitted = true; emit({ kind: 'MAX_Q', t: a.maxQAt, body: 'EARTH', values: { qPa: a.maxQPa } }); }
 if (phase === 'S2' && sub.thrusting && !sub.burnout && seco(a, a)) { Object.assign(a, stepRoot(before, sub.h, true, x => seco(a, x))); finishPowered(a, 'SECO', emit); return; }
 if (sub.burnout) {
  if (phase === 'S1' && twoStage) {
   emit(ev('STAGE_SEPARATION', a, { altKm: alt, speedKms: len(a.v) })); a.separatedAtSec = a.t;
   a.stageDropped = false; a.phase = a.program.stage2CoastSec > 0 ? 'COAST12' : 'S2'; a.coastEndT = a.t + a.program.stage2CoastSec; a.hold = a.program.holdUpperStage;
  } else finishPowered(a, 'FUEL_OUT', emit);
  return;
 }
 if (phase === 'ATM_COAST' && prevAlt < ATMOSPHERE_TOP_KM && alt >= ATMOSPHERE_TOP_KM && !descending) { Object.assign(a, stepRoot(before, sub.h, false, x => altitudeKm(x.r) >= ATMOSPHERE_TOP_KM)); handoff(a, emit); }
}
/**
 * Advance whole substeps while they end at or before tTarget; never subdivide at tTarget. The substep schedule depends only on the state,
 * so any caller partition reproduces the same states bit-for-bit. Cutoff/burnout ties resolve deterministically: burnout in the same
 * substep as the periapsis criterion is FUEL_OUT. Callers carry any sub-step remainder.
 */
export function advanceAscent(a: AscentState, tTarget: number, emit: Emit, levels: readonly number[] = []): void {
 for (let guard = 0; guard < 8000 && a.phase !== 'HANDOFF' && a.phase !== 'FAILED'; guard++) {
  if (a.phase === 'COAST12' && a.t >= a.coastEndT - 1e-9) a.phase = 'S2';
  const sub = nextSubstep(a);
  if (sub.h <= 1e-12 || a.t + sub.h > tTarget + 1e-9) break;
  runSubstep(a, sub, emit, levels);
 }
}
export function isAscentActive(a: AscentState | null): a is AscentState & { phase: Exclude<AscentState['phase'], 'HANDOFF' | 'FAILED'> } { return a !== null && a.phase !== 'HANDOFF' && a.phase !== 'FAILED'; }
export function ascentSample(a: AscentState): AscentSample {
 const rn = len(a.r), rot = a.t * OMEGA, c = Math.cos(rot), s = Math.sin(rot), pad = a.padR, padNow: Vec3 = [pad[0] * c - pad[1] * s, pad[0] * s + pad[1] * c, pad[2]];
 const downrange = RE * Math.acos(Math.max(-1, Math.min(1, dotv(a.r, padNow) / (rn * len(padNow)))));
 return { t: a.t, altKm: rn - RE, speedKms: len(a.v), downrangeKm: downrange, massKg: massOf(a), stage: a.phase === 'S1' ? 1 : 2, thrustKN: a.thrustKN, qPa: a.qPa };
}
/** Flight-path angle of the inertial velocity above the local horizon, degrees. */
export function flightPathDeg(a: AscentState): number { const vn = len(a.v); return vn > 0 ? Math.asin(Math.max(-1, Math.min(1, dotv(a.v, unit(a.r)) / vn))) * 180 / Math.PI : 90; }
