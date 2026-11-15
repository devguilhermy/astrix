// Reduced lunar ephemeris: the Moon is "on rails" on a circular orbit about Earth's centre (not dynamically consistent with Earth's mu).
// Plane: 5.145 deg to the ecliptic with a fixed node at 125.0446 deg (no nodal regression), obliquity 23.439 deg, sidereal rate 13.17639648 deg/day.
import { CONSTANTS, DAY, epochSecondsUTC, radians, rotatePerifocal, type Vec3 } from '../physics';
import { add, dotv, len, scale, sub } from './conic';

export const MOON_SOI_RADIUS_KM = 66170;
export const MOON_RATE_RAD_PER_SEC = radians(13.17639648) / DAY;
const INC = radians(5.145), NODE = radians(125.0446), L0 = radians(218.3165), OBLIQUITY = radians(23.439);
const toEquatorial = (v: Vec3): Vec3 => [v[0], v[1] * Math.cos(OBLIQUITY) - v[2] * Math.sin(OBLIQUITY), v[1] * Math.sin(OBLIQUITY) + v[2] * Math.cos(OBLIQUITY)];

/** Moon position (km) and velocity (km/s) relative to Earth, MJ2000Eq axes. t = seconds after epochUTC. */
export function moonState(t: number, epochUTC: string): { r: Vec3; v: Vec3 } {
 const a = CONSTANTS.MOON.distanceKm.v, u = L0 + MOON_RATE_RAD_PER_SEC * (t + epochSecondsUTC(epochUTC)) - NODE;
 const r = rotatePerifocal([a * Math.cos(u), a * Math.sin(u), 0], INC, NODE, 0);
 const v = rotatePerifocal([-a * MOON_RATE_RAD_PER_SEC * Math.sin(u), a * MOON_RATE_RAD_PER_SEC * Math.cos(u), 0], INC, NODE, 0);
 return { r: toEquatorial(r), v: toEquatorial(v) };
}
/** Finite segment/sphere test: blockers behind either endpoint never occult. */
export function segmentHitsSphere(a: Vec3, b: Vec3, centre: Vec3, radiusKm: number): boolean {
 const d = sub(b, a), dd = dotv(d, d);
 if (dd === 0) return len(sub(a, centre)) < radiusKm;
 const s = Math.max(0, Math.min(1, dotv(sub(centre, a), d) / dd)), p = add(a, scale(d, s));
 return len(sub(p, centre)) < radiusKm;
}
