import { describe, expect, test } from 'bun:test';
import { CONSTANTS } from '../physics';
import { conicFromState, conicAtDt, len, orbitInfo, universalPropagate, timeToApsis, burnVector, dotv, cross } from './conic';

const MU_E = 398600, MU_M = CONSTANTS.MOON.mu.v;
const energy = (r: readonly [number, number, number], v: readonly [number, number, number], mu: number): number => dotv(v as [number, number, number], v as [number, number, number]) / 2 - mu / len(r as [number, number, number]);
const near = (a: readonly number[], b: readonly number[], tol: number): void => { for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThan(tol); };

describe('reference vectors observed from GMAT R2025a (point-mass Earth/Moon, observed times)', () => {
 test('hyperbolic Earth departure after one day', () => {
  const s = universalPropagate([6578.137, 0, 0], [0, 11.3, 0], 86400, MU_E);
  near(s.r, [-268932.0309020925, 157475.1054304831, 0], 5e-5);
  near(s.v, [-2.709612233076099, 1.310232636839253, 0], 1e-8);
 });
 test('100 km circular lunar orbit over the observed period returns to the start', () => {
  const s = universalPropagate([1837.4, 0, 0], [0, 1.633504114392833, 0], 7067.459813109599, MU_M);
  near(s.r, [1837.399999999994, -5.701440386474133e-7, 0], 5e-6);
  near(s.v, [5.068897523941018e-10, 1.633504114392833, 0], 1e-8);
 });
 test('200 km to GEO Hohmann burn lands the apoapsis on the GEO radius', () => {
  const r: [number, number, number] = [6578.137, 0, 0], vc = Math.sqrt(MU_E / 6578.137), info = orbitInfo(r, [0, vc + 2.454586009, 0], MU_E);
  expect(info.kind).toBe('ELLIPSE');
  expect(Math.abs(info.raKm! - 42164.17)).toBeLessThan(2);
  const circ = orbitInfo([42164.17, 0, 0], [0, Math.sqrt(MU_E / 42164.17), 0], MU_E);
  expect(Math.abs(Math.sqrt(MU_E / 42164.17) - Math.sqrt(MU_E * (2 / 42164.17 - 1 / info.aKm)) - 1.477270911)).toBeLessThan(2e-4);
  expect(circ.e).toBeLessThan(1e-9);
 });
});

describe('universal-variable propagation invariants', () => {
 test('ellipse conserves energy and angular momentum and is reversible', () => {
  const r: [number, number, number] = [7000, 1000, 500], v: [number, number, number] = [-1.2, 7.0, 1.5], h0 = cross(r, v);
  for (const dt of [10, 3600, 40000, 1e6]) {
   const s = universalPropagate(r, v, dt, MU_E);
   expect(Math.abs(energy(s.r, s.v, MU_E) - energy(r, v, MU_E))).toBeLessThan(1e-8);
   near(cross(s.r, s.v), h0, 1e-4);
   const back = universalPropagate(s.r, s.v, -dt, MU_E);
   near(back.r, r, 1e-5); near(back.v, v, 1e-8);
  }
 });
 test('an exactly parabolic state stays parabolic and finite through periapsis', () => {
  const r: [number, number, number] = [7000, 0, 0], v: [number, number, number] = [0, Math.sqrt(2 * MU_E / 7000), 0];
  expect(orbitInfo(r, v, MU_E).kind).toBe('PARABOLA');
  for (const dt of [1, 100, 86400, 5e6]) { const s = universalPropagate(r, v, dt, MU_E); expect(Number.isFinite(len(s.r))).toBe(true); expect(Math.abs(energy(s.r, s.v, MU_E))).toBeLessThan(1e-9); }
 });
 test('radial flight is classified by energy, not as a parabola, and stays on its line', () => {
  const r: [number, number, number] = [7000, 0, 0], v: [number, number, number] = [3, 0, 0], info = orbitInfo(r, v, MU_E);
  expect(info.rectilinear).toBe(true);
  expect(info.kind).toBe('ELLIPSE');
  expect(timeToApsis(conicFromState('EARTH', 0, r, v), 0, 'APOAPSIS')).toBeNull();
  const s = universalPropagate(r, v, 600, MU_E);
  expect(Math.abs(s.r[1]) + Math.abs(s.r[2])).toBeLessThan(1e-9);
  expect(Math.abs(energy(s.r, s.v, MU_E) - energy(r, v, MU_E))).toBeLessThan(1e-9);
 });
 test('a non-finite state is rejected rather than propagated', () => {
  expect(() => universalPropagate([Number.NaN, 0, 0], [0, 7, 0], 100, MU_E)).toThrow(RangeError);
 });
});

describe('conic helpers', () => {
 test('periapsis of an elliptical state is reached in the predicted time', () => {
  const c = conicFromState('EARTH', 0, [6578.137, 0, 0], [0, 9.5, 0]), dt = timeToApsis(c, 0, 'APOAPSIS')!;
  const at = conicAtDt(c, dt), info = orbitInfo(at.r, at.v, MU_E);
  expect(Math.abs(len(at.r) - info.raKm!)).toBeLessThan(1e-3);
  expect(Math.abs(dotv(at.r, at.v))).toBeLessThan(1e-3);
 });
 test('VNR burns put prograde along velocity, normal along +h and radial out along v x h', () => {
  const r: [number, number, number] = [7000, 0, 0], v: [number, number, number] = [0, 7.5, 0];
  near(burnVector(r, v, 'VNR', [0.1, 0, 0]), [0, 0.1, 0], 1e-12);
  near(burnVector(r, v, 'VNR', [0, 0.1, 0]), [0, 0, 0.1], 1e-12);
  near(burnVector(r, v, 'VNR', [0, 0, 0.1]), [0.1, 0, 0], 1e-12);
 });
});
