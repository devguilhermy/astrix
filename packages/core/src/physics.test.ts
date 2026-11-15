import { describe, expect, it } from 'bun:test';
import { CAPTURE_ORBITS } from './catalog';
import { CONSTANTS as C, DAY, TAU, analyticEclipseFraction, captureDeltaV, circularSpeed, cylinderEclipse, degrees, departureDeltaV, elementsForOrbit, elevationRad, hohmann, inStationContact, lightTime, makeOrbit, norm, orbitalPeriod, orbitPosition, planetPosition, propagate, propellantNeeded, rocketDeltaV, rotatePerifocal, solarFactor, solveKepler, stationPosition, sunDirection, type Elements } from './physics';
import { earthMarsDistance, transferPosition } from './physics';

const close = (actual: number, expected: number, tolerance: number): void => { expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance); };
describe('NASA fact-sheet physics reference table', () => {
 it('reproduces every Earth period, speed and beta-zero eclipse reference', () => {
  for (const [altitude, minutes, fraction] of [[400, 92.56, .3901], [420, 92.97, .3875], [500, 94.62, .3779], [600, 96.69, .3670]]) {
   const r = C.EARTH.radius.v + altitude;
   close(orbitalPeriod(r, C.EARTH.mu.v) / 60, minutes, .05);
   close(analyticEclipseFraction(C.EARTH.radius.v, altitude), fraction, .002);
  }
  close(circularSpeed(C.EARTH.radius.v + 420, C.EARTH.mu.v), 7.657, .002);
 });
 it('agrees with independently executed GMAT R2025a within rounded-mu tolerance', () => {
  // Observed external references: docs/research/gmat-validation.md, not engine-generated expectations.
  for (const [altitude, seconds] of [[400, 5553.62427334215], [420, 5578.22270937129], [500, 5676.9780306622], [600, 5801.231788109618]]) close(orbitalPeriod(C.EARTH.radius.v + altitude, C.EARTH.mu.v), seconds, .02);
  close(circularSpeed(C.EARTH.radius.v + 420, C.EARTH.mu.v), 7.657269481699864, .00001);
  close(hohmann().transferSec / DAY, 258.883238831746, .01);
  close(orbitalPeriod(elementsForOrbit(CAPTURE_ORBITS[3]).a, C.MARS.mu.v), 86493.86305538189, 2);
 });
 it('reproduces Hohmann, departure, capture and propellant references', () => {
  const transfer = hohmann();
  close(transfer.vInfDepartureKms, 2.945, .002); close(transfer.vInfArrivalKms, 2.649, .002);
  close(transfer.transferSec / DAY, 258.9, .1); close(degrees(transfer.leadAngleRad), 44.34, .05);
  close(departureDeltaV(400), 3.569, .003);
  [2.080, 1.497, 1.246, .919].forEach((value, i) => close(captureDeltaV(CAPTURE_ORBITS[i]), value, .003));
  close(orbitalPeriod(elementsForOrbit(CAPTURE_ORBITS[3]).a, C.MARS.mu.v) / 3600, 24.03, .05);
  close(propellantNeeded(1, 2.08, 220), 1.623, .003); close(propellantNeeded(1, 2.08, 320), .940, .003);
  for (const isp of [220, 320]) close(rocketDeltaV(70, propellantNeeded(70, 1.246, isp), isp), 1.246, 1e-12);
  close(solarFactor('MARS'), .4307, .0005);
 });
 it('keeps ephemeris light time physical and transfer endpoints on the ideal planets', () => {
  const transfer = hohmann(), epoch = '2026-11-14T00:00:00Z';
  for (let t = 0; t <= 800*DAY; t += 10*DAY) {
   const e = planetPosition('EARTH',t,epoch), m = planetPosition('MARS',t,epoch);
   close(earthMarsDistance(t,epoch),Math.hypot(e[0]-m[0],e[1]-m[1],e[2]-m[2]),1e-7);
   expect(lightTime(t,epoch)).toBeGreaterThanOrEqual((C.MARS.distanceKm.v-C.EARTH.distanceKm.v)/C.c.v-1e-8);
   expect(lightTime(t,epoch)).toBeLessThanOrEqual((C.MARS.distanceKm.v+C.EARTH.distanceKm.v)/C.c.v+1e-8);
  }
  for (const [t,body] of [[0,'EARTH'],[transfer.transferSec,'MARS']] as const) {
   const craft = transferPosition(t,epoch), planet = planetPosition(body,t,epoch);
   close(Math.hypot(craft[0]-planet[0],craft[1]-planet[1],craft[2]-planet[2]),0,1e-5);
   close(norm([...craft]),C[body].distanceKm.v,1e-5);
  }
 });
});
describe('elliptic elements, frames and line-of-sight', () => {
 it('solves Kepler across eccentricities and positive/negative revolutions', () => {
  for (const e of [0, .1, .6, .9, .9999]) for (const m of [-25, -Math.PI, -.01, 0, .01, 1, 3, 26]) {
   const E = solveKepler(m, e), normalized = ((m + Math.PI) % TAU + TAU) % TAU - Math.PI;
   close(E - e * Math.sin(E), normalized, 1e-11);
  }
 });
 it('conserves two-body energy and returns after an elliptic period', () => {
  const elements: Elements = { a: 20000, e: .6, i: .7, raan: .2, argPeriapsis: 1, meanAnomaly: .4, epoch: 0 };
  const period = orbitalPeriod(elements.a, C.MARS.mu.v), start = propagate(elements, C.MARS.mu.v, 0);
  for (const t of [0, period / 4, period / 2, period]) {
   const p = propagate(elements, C.MARS.mu.v, t);
   close(norm(p.velocity) ** 2 / 2 - C.MARS.mu.v / norm(p.position), -C.MARS.mu.v / (2 * elements.a), 1e-10);
  }
  const end = propagate(elements, C.MARS.mu.v, period);
  start.position.forEach((x, i) => close(end.position[i], x, 1e-7));
  const rotated = rotatePerifocal([1, 0, 0], Math.PI / 2, Math.PI / 2, 0);
  close(rotated[0], 0, 1e-12); close(rotated[1], 1, 1e-12); close(rotated[2], 0, 1e-12);
 });
 it('cylinder eclipse agrees with independently analytic beta-zero fraction', () => {
  const orbit = makeOrbit('EARTH', 420, 420, 0, '2000-01-01T12:00:00.000Z');
  const period = orbitalPeriod(C.EARTH.radius.v + 420, C.EARTH.mu.v);
  let shadow = 0;
  for (let n = 0; n < 10000; n++) if (cylinderEclipse(orbitPosition(orbit, n * period / 10000), [-1, 0, 0], C.EARTH.radius.v)) shadow++;
  close(shadow / 10000, analyticEclipseFraction(C.EARTH.radius.v, 420), .0003);
  expect(cylinderEclipse([-10000, 0, 0], [1, 0, 0], C.EARTH.radius.v)).toBe(true);
  expect(cylinderEclipse([10000, 0, 0], [1, 0, 0], C.EARTH.radius.v)).toBe(false);
 });
 it('rotates stations and tests actual elevation rather than distance alone', () => {
  const station = stationPosition(0, 'EARTH', 0, 0), quarter = stationPosition(C.EARTH.rotationSec.v / 4, 'EARTH', 0, 0);
  close(quarter[0], 0, 1e-8); close(quarter[1], C.EARTH.radius.v, 1e-8);
  close(degrees(elevationRad([C.EARTH.radius.v + 420, 0, 0], station)), 90, 1e-8);
  expect(inStationContact([C.EARTH.radius.v + 420, 0, 0], station)).toBe(true);
  expect(inStationContact([-(C.EARTH.radius.v + 420), 0, 0], station)).toBe(false);
  close(norm(sunDirection('MARS', 100)), 1, 1e-12);
  close(norm(planetPosition('MARS', 100)), C.MARS.distanceKm.v, 1e-6);
 });
});
