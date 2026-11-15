// Two-body conic kinematics for ellipses, parabolas and hyperbolas. Angles are radians, km and km/s.
// Ellipses reuse the legacy element solver so preset coasts keep their rules-4 numerics.
import type { BodyId, OrbitChoice } from '../contracts';
import { CONSTANTS, TAU, propagate, propagatePosition, rotatePerifocal, type Elements, type Vec3 } from '../physics';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dotv = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: readonly [number, number, number]): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => { const n = len(a); return n > 0 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0]; };
export const muOf = (body: BodyId): number => CONSTANTS[body].mu.v;
export const radiusOf = (body: BodyId): number => CONSTANTS[body].radius.v;

/** Elliptic orbits keep exact elements; open conics use universal variables. */
export interface ConicState { readonly body: BodyId; readonly t0: number; readonly r0: Vec3; readonly v0: Vec3; readonly mu: number; readonly elements: Elements | null }
export interface OrbitInfo {
 readonly kind: 'ELLIPSE' | 'PARABOLA' | 'HYPERBOLA'; readonly rectilinear: boolean; readonly aKm: number; readonly e: number; readonly pKm: number; readonly incRad: number;
 readonly rpKm: number; readonly raKm: number | null; readonly energy: number; readonly hKm2s: number; readonly periodSec: number | null; readonly vInfKms: number | null;
}
const OPEN_EPS = 1e-9;

function stumpffC(z: number): number {
 if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z;
 if (z < -1e-6) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
 return 0.5 - z / 24 + z * z / 720;
}
function stumpffS(z: number): number {
 if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
 if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); }
 return 1 / 6 - z / 120 + z * z / 5040;
}

/** Universal-variable Kepler step. F(chi) is strictly increasing, so a bracketed Newton solve cannot diverge. */
export function universalPropagate(r0: Vec3, v0: Vec3, dt: number, mu: number): { r: Vec3; v: Vec3 } {
 if (![...r0, ...v0, dt, mu].every(Number.isFinite) || !(mu > 0) || !(len(r0) > 0)) throw new RangeError('Conic state must be finite with positive radius and gravity');
 if (dt === 0) return { r: [...r0], v: [...v0] };
 const sq = Math.sqrt(mu), r0n = len(r0), rv = dotv(r0, v0), alpha = 2 / r0n - dotv(v0, v0) / mu;
 // A finite bracket is established before Newton. In particular the near-parabolic
 // initial estimate must not evaluate cosh at an unbounded anomaly.
 const residual = (x: number): readonly [number, number] => {
  const z = alpha*x*x, C = stumpffC(z), S = stumpffS(z);
  return [rv/sq*x*x*C + (1-alpha*r0n)*x*x*x*S + r0n*x-sq*dt,
   rv/sq*x*(1-z*S) + (1-alpha*r0n)*x*x*C+r0n];
 };
 let edge = Math.sign(dt)*Math.max(1, Math.min(Math.abs(sq*dt/r0n), alpha < 0 ? 1/Math.sqrt(-alpha) : Number.MAX_VALUE));
 for (let n = 0; n < 256; n++) {
  const [f] = residual(edge);
  if (!Number.isFinite(f) || Math.sign(f) === Math.sign(dt)) break;
  edge *= 2;
  if (n === 255) throw new RangeError('Universal Kepler root could not be bracketed');
 }
 let lo = Math.min(0,edge), hi = Math.max(0,edge), chi = (lo+hi)/2, converged = false;
 const scaleF = Math.abs(sq*dt)+1;
 for (let n = 0; n < 256; n++) {
  const [F,dF] = residual(chi);
  if (!Number.isFinite(F)) {
   if (chi > 0) hi = chi; else lo = chi;
   chi = (lo+hi)/2; continue;
  }
  if (Math.abs(F) <= 2e-14*scaleF) { converged = true; break; }
  if (F > 0) hi = chi; else lo = chi;
  const candidate = chi-F/dF;
  const next = Number.isFinite(candidate) && dF > 0 && candidate > lo && candidate < hi ? candidate : (lo+hi)/2;
  if (Math.abs(next-chi) <= 2e-15*Math.max(1,Math.abs(chi))) { chi = next; converged = true; break; }
  chi = next;
 }
 if (!converged) throw new RangeError('Universal Kepler solve did not converge');
 const z = alpha * chi * chi, C = stumpffC(z), S = stumpffS(z);
 const f = 1 - chi * chi / r0n * C, g = dt - chi ** 3 / sq * S;
 const r: Vec3 = [f * r0[0] + g * v0[0], f * r0[1] + g * v0[1], f * r0[2] + g * v0[2]], rn = len(r);
 const fd = sq / (rn * r0n) * (alpha * chi ** 3 * S - chi), gd = 1 - chi * chi / rn * C;
 return { r, v: [fd * r0[0] + gd * v0[0], fd * r0[1] + gd * v0[1], fd * r0[2] + gd * v0[2]] };
}

export function orbitInfo(r: Vec3, v: Vec3, mu: number): OrbitInfo {
 if (![...r,...v,mu].every(Number.isFinite) || !(mu>0) || !(len(r)>0)) throw new RangeError('Conic state must be finite with positive radius and gravity');
 const rn = len(r), vn2 = dotv(v, v), h = cross(r, v), hn = len(h), rv = dotv(r, v);
 const evec: Vec3 = [((vn2 - mu / rn) * r[0] - rv * v[0]) / mu, ((vn2 - mu / rn) * r[1] - rv * v[1]) / mu, ((vn2 - mu / rn) * r[2] - rv * v[2]) / mu];
 const e = len(evec), energy = vn2 / 2 - mu / rn, p = hn * hn / mu, inc = Math.acos(Math.max(-1, Math.min(1, hn > 0 ? h[2] / hn : 1)));
 // Radial (h = 0) flight has e = 1 whatever its energy, so classify it by energy instead of letting it read as a parabola.
 const rectilinear = hn <= 1e-9 * Math.sqrt(mu * rn);
 if (rectilinear) {
  const eps = 1e-9 * mu / rn;
  if (energy < -eps) { const a = -mu / (2 * energy); return { kind: 'ELLIPSE', rectilinear, aKm: a, e: 1, pKm: 0, incRad: inc, rpKm: 0, raKm: 2 * a, energy, hKm2s: hn, periodSec: TAU * Math.sqrt(a ** 3 / mu), vInfKms: null }; }
  if (energy > eps) return { kind: 'HYPERBOLA', rectilinear, aKm: -mu / (2 * energy), e: 1, pKm: 0, incRad: inc, rpKm: 0, raKm: null, energy, hKm2s: hn, periodSec: null, vInfKms: Math.sqrt(2 * energy) };
  return { kind: 'PARABOLA', rectilinear, aKm: Infinity, e: 1, pKm: 0, incRad: inc, rpKm: 0, raKm: null, energy, hKm2s: hn, periodSec: null, vInfKms: 0 };
 }
 if (e < 1 - OPEN_EPS) { const a = p / (1 - e * e); return { kind: 'ELLIPSE', rectilinear, aKm: a, e, pKm: p, incRad: inc, rpKm: a * (1 - e), raKm: a * (1 + e), energy, hKm2s: hn, periodSec: TAU * Math.sqrt(a ** 3 / mu), vInfKms: null }; }
 if (e <= 1 + OPEN_EPS) return { kind: 'PARABOLA', rectilinear, aKm: Infinity, e, pKm: p, incRad: inc, rpKm: p / 2, raKm: null, energy, hKm2s: hn, periodSec: null, vInfKms: 0 };
 const a = p / (1 - e * e);
 return { kind: 'HYPERBOLA', rectilinear, aKm: a, e, pKm: p, incRad: inc, rpKm: a * (1 - e), raKm: null, energy, hKm2s: hn, periodSec: null, vInfKms: Math.sqrt(Math.max(0, 2 * energy)) };
}

/** Classical elements of a bound state; mean anomaly is at the state epoch (elements.epoch = 0). */
export function elementsFromState(r: Vec3, v: Vec3, mu: number): Elements {
 const rn = len(r), h = cross(r, v), hn = len(h), hhat = unit(h), vn2 = dotv(v, v), rv = dotv(r, v);
 const evec: Vec3 = [((vn2 - mu / rn) * r[0] - rv * v[0]) / mu, ((vn2 - mu / rn) * r[1] - rv * v[1]) / mu, ((vn2 - mu / rn) * r[2] - rv * v[2]) / mu];
 const e = len(evec), a = -mu / (2 * (vn2 / 2 - mu / rn)), inc = Math.acos(Math.max(-1, Math.min(1, h[2] / hn)));
 const nvec: Vec3 = [-h[1], h[0], 0], nn = len(nvec), equatorial = nn < 1e-11 * hn;
 const nhat: Vec3 = equatorial ? [1, 0, 0] : [nvec[0] / nn, nvec[1] / nn, 0], phat = cross(hhat, nhat);
 const raan = equatorial ? 0 : Math.atan2(nvec[1], nvec[0]);
 let argp: number, nu: number;
 if (e < 1e-11) { argp = 0; nu = Math.atan2(dotv(r, phat), dotv(r, nhat)); }
 else {
  const eh = unit(evec), qh = cross(hhat, eh);
  argp = Math.atan2(dotv(evec, phat), dotv(evec, nhat)); nu = Math.atan2(dotv(r, qh), dotv(r, eh));
 }
 const E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu));
 return { a, e, i: inc, raan, argPeriapsis: argp, meanAnomaly: E - e * Math.sin(E), epoch: 0 };
}

export function conicFromState(body: BodyId, t0: number, r: Vec3, v: Vec3): ConicState {
 const mu = muOf(body), info = orbitInfo(r, v, mu);
 return { body, t0, r0: [r[0], r[1], r[2]], v0: [v[0], v[1], v[2]], mu, elements: info.kind === 'ELLIPSE' && !info.rectilinear ? elementsFromState(r, v, mu) : null };
}
/** Legacy-exact: elements are used untouched; r0/v0 are their epoch state. */
export function conicFromElements(body: BodyId, t0: number, elements: Elements): ConicState {
 const mu = muOf(body), p = propagate(elements, mu, 0);
 return { body, t0, r0: p.position, v0: p.velocity, mu, elements };
}
/** dt is seconds since conic.t0. */
export function conicAtDt(c: ConicState, dt: number): { r: Vec3; v: Vec3 } {
 if (c.elements) { const p = propagate(c.elements, c.mu, dt); return { r: p.position, v: p.velocity }; }
 return universalPropagate(c.r0, c.v0, dt, c.mu);
}
export function conicAt(c: ConicState, t: number): { r: Vec3; v: Vec3 } { return conicAtDt(c, t - c.t0); }
export function conicPositionDt(c: ConicState, dt: number, out: Vec3 = [0, 0, 0]): Vec3 {
 if (c.elements) return propagatePosition(c.elements, c.mu, dt, out);
 const r = universalPropagate(c.r0, c.v0, dt, c.mu).r; out[0] = r[0]; out[1] = r[1]; out[2] = r[2]; return out;
}
export function conicInfoAt(c: ConicState, t: number): OrbitInfo { const s = conicAt(c, t); return orbitInfo(s.r, s.v, c.mu); }

/** Seconds from time t until the next periapsis/apoapsis (null when none will occur). A coincident apsis is reported as the next one. */
export function timeToApsis(c: ConicState, t: number, apsis: 'PERIAPSIS' | 'APOAPSIS'): number | null {
 const s = conicAt(c, t), info = orbitInfo(s.r, s.v, c.mu), rv = dotv(s.r, s.v), rn = len(s.r);
 if (info.rectilinear) return null;
 if (info.kind === 'ELLIPSE') {
  const a = info.aKm, e = info.e, n = Math.sqrt(c.mu / a ** 3), E = Math.atan2(rv / Math.sqrt(c.mu * a), 1 - rn / a), M = E - e * Math.sin(E);
  const target = apsis === 'PERIAPSIS' ? 0 : Math.PI;
  let d = ((target - M) % TAU + TAU) % TAU;
  if (d < 1e-9) d = TAU;
  return d / n;
 }
 if (apsis === 'APOAPSIS') return null;
 if (info.kind === 'HYPERBOLA') {
  const a = -info.aKm, n = Math.sqrt(c.mu / a ** 3), H = Math.asinh(rv / (info.e * Math.sqrt(c.mu * a))), Mh = info.e * Math.sinh(H) - H, tt = -Mh / n;
  return tt > 1e-9 ? tt : null;
 }
 const D = rv / Math.sqrt(c.mu * info.pKm), tt = -0.5 * Math.sqrt(info.pKm ** 3 / c.mu) * (D + D ** 3 / 3);
 return tt > 1e-9 ? tt : null;
}

export type BurnFrame = 'VNR' | 'INERTIAL';
/** Velocity change in the requested frame. VNR = prograde, orbit-normal (+h), radial-out. */
export function burnVector(r: Vec3, v: Vec3, frame: BurnFrame, dv: readonly [number, number, number]): Vec3 {
 if (frame === 'INERTIAL') return [dv[0], dv[1], dv[2]];
 const vh = unit(v), hh = unit(cross(r, v)), rh = cross(vh, hh);
 return [dv[0] * vh[0] + dv[1] * hh[0] + dv[2] * rh[0], dv[0] * vh[1] + dv[1] * hh[1] + dv[2] * rh[1], dv[0] * vh[2] + dv[1] * hh[2] + dv[2] * rh[2]];
}
export { rotatePerifocal };

const deg = (rad: number): number => ((rad * 180 / Math.PI) % 360 + 360) % 360;
/** Classical elements of a bound state as a catalogue-style OrbitChoice (angles in degrees, true anomaly at the state epoch). */
export function orbitChoiceFromState(body: BodyId, r: Vec3, v: Vec3, epochUTC: string): OrbitChoice | null {
 const mu = muOf(body), info = orbitInfo(r, v, mu);
 if (info.kind !== 'ELLIPSE' || info.rectilinear) return null;
 const el = elementsFromState(r, v, mu), h = cross(r, v), hhat = unit(h), rn = len(r), vn2 = dotv(v, v), rv = dotv(r, v);
 const evec: Vec3 = [((vn2 - mu / rn) * r[0] - rv * v[0]) / mu, ((vn2 - mu / rn) * r[1] - rv * v[1]) / mu, ((vn2 - mu / rn) * r[2] - rv * v[2]) / mu];
 let nu: number;
 if (el.e < 1e-11) { const nvec: Vec3 = [-h[1], h[0], 0], nn = len(nvec), nhat: Vec3 = nn < 1e-11 * len(h) ? [1, 0, 0] : [nvec[0] / nn, nvec[1] / nn, 0]; nu = Math.atan2(dotv(r, cross(hhat, nhat)), dotv(r, nhat)); }
 else { const eh = unit(evec); nu = Math.atan2(dotv(r, cross(hhat, eh)), dotv(r, eh)); }
 return { body, epochUTC, frame: 'MJ2000Eq', smaKm: el.a, ecc: el.e, inclinationDeg: deg(el.i), raanDeg: deg(el.raan), argPeriapsisDeg: deg(el.argPeriapsis), trueAnomalyDeg: deg(nu) };
}
