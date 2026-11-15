import type { BodyId, OrbitChoice, Q } from './contracts';

export const assumed = (v: number, note: string): Q => ({ v, p: { kind: 'assumption', note } });
export const sourced = (v: number, src: string, note?: string): Q => ({ v, p: { kind: 'source', src, ...(note ? { note } : {}) } });
export const DAY = 86400;
export const TAU = Math.PI * 2;
export const CONSTANTS = {
 EARTH: { mu: sourced(398600, 'nssdc-earth'), radius: sourced(6378.137, 'nssdc-earth'), rotationSec: sourced(23.9345 * 3600, 'nssdc-earth'), distanceKm: sourced(149598000, 'nssdc-earth'), yearSec: sourced(365.256 * DAY, 'nssdc-earth'), irradiance: sourced(1361, 'nssdc-earth') },
 MARS: { mu: sourced(42828, 'nssdc-mars'), radius: sourced(3396.2, 'nssdc-mars'), rotationSec: sourced(24.6229 * 3600, 'nssdc-mars'), distanceKm: sourced(227956000, 'nssdc-mars'), yearSec: sourced(686.980 * DAY, 'nssdc-mars'), irradiance: sourced(586.2, 'nssdc-mars') },
 sunMu: sourced(132712e6, 'nssdc-sun'), c: sourced(299792.458, 'si-c'), g0: sourced(9.80665, 'si-gn'),
} as const;
export type Vec3 = [number, number, number];
export interface Elements { a: number; e: number; i: number; raan: number; argPeriapsis: number; meanAnomaly: number; epoch: number }
export const radians = (deg: number): number => deg * Math.PI / 180;
export const degrees = (rad: number): number => rad * 180 / Math.PI;
export const norm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const orbitalPeriod = (aKm: number, mu: number): number => TAU * Math.sqrt(aKm ** 3 / mu);
export const circularSpeed = (rKm: number, mu: number): number => Math.sqrt(mu / rKm);

/** Elliptic Kepler solver. Angles are radians; supports every bound eccentricity. */
export function solveKepler(meanAnomaly: number, e: number): number {
 if (!Number.isFinite(meanAnomaly) || e < 0 || e >= 1 || !Number.isFinite(e)) throw new RangeError('Elliptic elements require finite M and 0 <= e < 1');
 const m = ((meanAnomaly + Math.PI) % TAU + TAU) % TAU - Math.PI;
 let E = e < 0.8 ? m : (m >= 0 ? Math.PI : -Math.PI);
 for (let n = 0; n < 10; n++) {
  const delta = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  E -= delta;
  if (Math.abs(delta) < 1e-12) return E;
 }
 // A bracketed solve avoids Newton's near-parabolic, near-periapsis singularity.
 let lo = -Math.PI, hi = Math.PI;
 for (let n = 0; n < 48; n++) {
  E = (lo + hi) / 2;
  if (E - e * Math.sin(E) < m) lo = E; else hi = E;
 }
 return (lo + hi) / 2;
}
export function makeOrbit(body: BodyId, periapsisAltitudeKm: number, apoapsisAltitudeKm: number, inclinationDeg: number, epochUTC: string): OrbitChoice {
 const rp = CONSTANTS[body].radius.v + periapsisAltitudeKm, ra = CONSTANTS[body].radius.v + apoapsisAltitudeKm;
 return { body, epochUTC, frame: 'MJ2000Eq', smaKm: (rp + ra) / 2, ecc: (ra - rp) / (ra + rp), inclinationDeg, raanDeg: 0, argPeriapsisDeg: 0, trueAnomalyDeg: 0 };
}
export function orbitAltitudes(orbit: OrbitChoice): { altitudeKm: number; apoapsisAltitudeKm: number } {
 const radius = CONSTANTS[orbit.body].radius.v;
 return { altitudeKm: orbit.smaKm * (1 - orbit.ecc) - radius, apoapsisAltitudeKm: orbit.smaKm * (1 + orbit.ecc) - radius };
}
export function withOrbitAltitudes(orbit: OrbitChoice, hp: number, ha: number, inclinationDeg: number): OrbitChoice {
 return { ...orbit, ...makeOrbit(orbit.body, hp, ha, inclinationDeg, orbit.epochUTC), raanDeg: orbit.raanDeg, argPeriapsisDeg: orbit.argPeriapsisDeg, trueAnomalyDeg: orbit.trueAnomalyDeg };
}
/** Seconds from the reduced astronomical model's J2000 reference epoch. */
export function orbitEpochSeconds(orbit: OrbitChoice): number { return epochSeconds(orbit.epochUTC); }
const J2000 = Date.parse('2000-01-01T12:00:00Z');
function epochSeconds(epochUTC?: string): number { return epochUTC === undefined ? 0 : (Date.parse(epochUTC) - J2000) / 1000; }
export function elementsForOrbit(orbit: OrbitChoice): Elements {
 const nu = radians(orbit.trueAnomalyDeg), e = orbit.ecc;
 const E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu));
 return { a: orbit.smaKm, e, i: radians(orbit.inclinationDeg), raan: radians(orbit.raanDeg), argPeriapsis: radians(orbit.argPeriapsisDeg), meanAnomaly: E - e * Math.sin(E), epoch: 0 };
}
export function rotatePerifocal(v: Vec3, i: number, raan: number, argPeriapsis: number): Vec3 {
 const cw = Math.cos(argPeriapsis), sw = Math.sin(argPeriapsis), ci = Math.cos(i), si = Math.sin(i), co = Math.cos(raan), so = Math.sin(raan);
 const x = cw * v[0] - sw * v[1], y = sw * v[0] + cw * v[1];
 return [co * x - so * ci * y + so * si * v[2], so * x + co * ci * y - co * si * v[2], si * y + ci * v[2]];
}
export function propagate(elements: Elements, mu: number, t: number): { position: Vec3; velocity: Vec3 } {
 const { a, e, i, raan, argPeriapsis } = elements;
 const n = Math.sqrt(mu / a ** 3);
 const E = solveKepler(elements.meanAnomaly + n * (t - elements.epoch), e);
 const ce = Math.cos(E), se = Math.sin(E), b = Math.sqrt(1 - e * e), d = 1 - e * ce;
 return { position: rotatePerifocal([a * (ce - e), a * b * se, 0], i, raan, argPeriapsis), velocity: rotatePerifocal([-a * n * se / d, a * n * b * ce / d, 0], i, raan, argPeriapsis) };
}
/** Position-only hot path; the caller can reuse its own output tuple. */
export function propagatePosition(elements: Elements, mu: number, t: number, out: Vec3 = [0, 0, 0]): Vec3 {
 const { a, e, i, raan, argPeriapsis } = elements;
 const E = solveKepler(elements.meanAnomaly + Math.sqrt(mu / a ** 3) * (t - elements.epoch), e);
 const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
 const px = Math.cos(argPeriapsis) * x - Math.sin(argPeriapsis) * y, py = Math.sin(argPeriapsis) * x + Math.cos(argPeriapsis) * y;
 out[0] = Math.cos(raan) * px - Math.sin(raan) * Math.cos(i) * py;
 out[1] = Math.sin(raan) * px + Math.cos(raan) * Math.cos(i) * py;
 out[2] = Math.sin(i) * py;
 return out;
}
export function orbitPosition(orbit: OrbitChoice, t: number): Vec3 { return propagatePosition(elementsForOrbit(orbit), CONSTANTS[orbit.body].mu.v, t); }
export function cylinderEclipse(position: Vec3, sunDir: Vec3, radiusKm: number): boolean {
 const along = dot(position, sunDir);
 return along < 0 && dot(position, position) - along * along < radiusKm * radiusKm;
}
export function analyticEclipseFraction(radiusKm: number, altitudeKm: number): number { return Math.asin(radiusKm / (radiusKm + altitudeKm)) / Math.PI; }
/** Reduced uniform body rotation, zero longitude aligned at J2000; not IAU geolocation. */
export function bodyRotationAngle(body: BodyId, t: number, epochUTC?: string): number {
 return TAU * (t + epochSeconds(epochUTC)) / CONSTANTS[body].rotationSec.v;
}
export function stationPosition(t: number, body: BodyId = 'EARTH', latDeg = 38, lonDeg = -75, out: Vec3 = [0, 0, 0], epochUTC?: string): Vec3 {
 const r = CONSTANTS[body].radius.v, lat = radians(latDeg), lon = radians(lonDeg) + bodyRotationAngle(body, t, epochUTC);
 out[0] = r * Math.cos(lat) * Math.cos(lon); out[1] = r * Math.cos(lat) * Math.sin(lon); out[2] = r * Math.sin(lat);
 return out;
}
export function elevationRad(satellite: Vec3, station: Vec3): number {
 const dx = satellite[0] - station[0], dy = satellite[1] - station[1], dz = satellite[2] - station[2];
 return Math.asin(clamp((dx * station[0] + dy * station[1] + dz * station[2]) / (Math.hypot(dx, dy, dz) * norm(station)), -1, 1));
}
export const inStationContact = (position: Vec3, station: Vec3, minElevationDeg = 10): boolean => elevationRad(position, station) >= radians(minElevationDeg);
export function hohmann() {
 const r1 = CONSTANTS.EARTH.distanceKm.v, r2 = CONSTANTS.MARS.distanceKm.v, mu = CONSTANTS.sunMu.v, a = (r1 + r2) / 2;
 const transferSec = Math.PI * Math.sqrt(a ** 3 / mu);
 return { a, e: (r2 - r1) / (r1 + r2), vInfDepartureKms: Math.sqrt(mu / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1), vInfArrivalKms: Math.sqrt(mu / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2))), transferSec, leadAngleRad: Math.PI - TAU * transferSec / CONSTANTS.MARS.yearSec.v };
}
const TRANSFER = hohmann();
export function departureDeltaV(altitudeKm = 400): number {
 const r = CONSTANTS.EARTH.radius.v + altitudeKm, mu = CONSTANTS.EARTH.mu.v;
 return Math.sqrt(TRANSFER.vInfDepartureKms ** 2 + 2 * mu / r) - Math.sqrt(mu / r);
}
export function captureDeltaV(orbit: OrbitChoice): number {
 const mu = CONSTANTS.MARS.mu.v, rp = orbit.smaKm * (1 - orbit.ecc), a = orbit.smaKm;
 return Math.sqrt(TRANSFER.vInfArrivalKms ** 2 + 2 * mu / rp) - Math.sqrt(mu * (2 / rp - 1 / a));
}
/** Delta-v is km/s throughout the public physics API. */
export function rocketDeltaV(dryKg: number, propellantKg: number, ispSec: number): number { return dryKg > 0 && ispSec > 0 ? ispSec * CONSTANTS.g0.v / 1000 * Math.log1p(propellantKg / dryKg) : 0; }
export function propellantNeeded(dryKg: number, deltaVKms: number, ispSec: number): number { return dryKg * Math.expm1(deltaVKms * 1000 / (ispSec * CONSTANTS.g0.v)); }
/** Low-precision geometric solar longitude, referred to fixed J2000 obliquity. */
function solarLongitude(t: number, epochUTC?: string): number {
 const days = (t + epochSeconds(epochUTC)) / DAY;
 const mean = radians((357.528 + .9856003 * days) % 360);
 return radians((280.460 + .9856474 * days) % 360) + radians(1.915)*Math.sin(mean) + radians(.020)*Math.sin(2*mean);
}
function equatorialPosition(longitude: number, radius: number): Vec3 {
 const obliquity = radians(23.439);
 return [radius*Math.cos(longitude), radius*Math.sin(longitude)*Math.cos(obliquity), radius*Math.sin(longitude)*Math.sin(obliquity)];
}
/** Circular Mars path is phased for an ideal transfer at the supplied departure epoch. */
export function planetPosition(body: BodyId, t: number, epochUTC?: string): Vec3 {
 const longitude = body === 'EARTH' ? solarLongitude(t, epochUTC) + Math.PI : solarLongitude(0, epochUTC) + Math.PI + TRANSFER.leadAngleRad + TAU*t/CONSTANTS.MARS.yearSec.v;
 return equatorialPosition(longitude, CONSTANTS[body].distanceKm.v);
}
/** Ideal two-body Earth→Mars transfer; t is clamped to departure/arrival. */
export function transferPosition(t: number, epochUTC: string): readonly [number, number, number] {
 if (!Number.isFinite(t) || !Number.isFinite(Date.parse(epochUTC))) throw new RangeError('Transfer requires finite time and UTC epoch');
 const E = solveKepler(Math.PI * clamp(t, 0, TRANSFER.transferSec) / TRANSFER.transferSec, TRANSFER.e);
 const x = TRANSFER.a*(Math.cos(E)-TRANSFER.e), y = TRANSFER.a*Math.sqrt(1-TRANSFER.e**2)*Math.sin(E);
 const phase = solarLongitude(0, epochUTC)+Math.PI, c = Math.cos(phase), s = Math.sin(phase), obliquity = radians(23.439);
 const ey = x*s+y*c;
 return [x*c-y*s, ey*Math.cos(obliquity), ey*Math.sin(obliquity)];
}
export function sunDirection(body: BodyId, t: number, out: Vec3 = [0, 0, 0], epochUTC?: string): Vec3 {
 const p = planetPosition(body,t,epochUTC), r = CONSTANTS[body].distanceKm.v;
 out[0] = -p[0]/r; out[1] = -p[1]/r; out[2] = -p[2]/r;
 return out;
}
export function earthMarsDistance(t: number, epochUTC?: string): number {
 const e = planetPosition('EARTH',t,epochUTC), m = planetPosition('MARS',t,epochUTC);
 return Math.hypot(e[0]-m[0],e[1]-m[1],e[2]-m[2]);
}
export const lightTime = (t: number, epochUTC?: string): number => earthMarsDistance(t, epochUTC) / CONSTANTS.c.v;
export const solarFactor = (body: BodyId): number => CONSTANTS[body].irradiance.v / CONSTANTS.EARTH.irradiance.v;
/** Geometric visibility only; station allocation is a separate authored condition. */
export function marsLineOfSight(position: Vec3, t: number, epochUTC?: string): boolean {
 const e = planetPosition('EARTH',t,epochUTC), m = planetPosition('MARS',t,epochUTC);
 const dx = e[0]-m[0], dy = e[1]-m[1], dz = e[2]-m[2], distance = Math.hypot(dx,dy,dz);
 const along = (position[0]*dx+position[1]*dy+position[2]*dz)/distance;
 return !(along < 0 && dot(position,position)-along*along < CONSTANTS.MARS.radius.v**2);
}
export function marsContact(position: Vec3, t: number, epochUTC?: string): boolean { return (((t % DAY) + DAY) % DAY < DAY / 3) && marsLineOfSight(position, t, epochUTC); }
export function linkRateKbps(referenceKbps: number, body: BodyId, t: number, epochUTC?: string): number { return body === 'EARTH' ? referenceKbps : Math.min(6000, referenceKbps * (CONSTANTS.EARTH.distanceKm.v / earthMarsDistance(t, epochUTC)) ** 2); }
