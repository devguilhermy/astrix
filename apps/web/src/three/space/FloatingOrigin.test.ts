import { describe, expect, it } from 'bun:test';
import { Quaternion, Vector3 } from 'three';
import { relativePosition, renderAttitude, renderDirection } from './FloatingOrigin';

describe('kilometre floating origin and inertial basis', () => {
 it('subtracts double precision positions before GPU upload', () => {
  const out = relativePosition(new Vector3(), [227900000.00034, 170000000, 90000000], [227900000, 170000000, 90000000]);
  expect(out.x).toBeCloseTo(.00034, 7);
  expect(out.y).toBe(0);
  expect(Math.abs(out.z)).toBe(0);
 });
 it('keeps a right-handed basis and the +X panel/+Z boresight conventions', () => {
  const x = renderDirection(new Vector3(), [1, 0, 0]), y = renderDirection(new Vector3(), [0, 1, 0]), z = renderDirection(new Vector3(), [0, 0, 1]);
  expect(new Vector3().crossVectors(x, y).dot(z)).toBeCloseTo(1, 12);
  const q = renderAttitude(new Quaternion(), [0, 0, 0, 1]);
  expect(new Vector3(1, 0, 0).applyQuaternion(q).distanceTo(x)).toBeLessThan(1e-12);
  expect(new Vector3(0, 0, 1).applyQuaternion(q).distanceTo(z)).toBeLessThan(1e-12);
 });
 it('does not rotate the orbit when rebasing', () => {
  const a = relativePosition(new Vector3(), [7000, 20, 40], [6999, 10, 30]);
  const b = relativePosition(new Vector3(), [7001, 20, 40], [6999, 10, 30]);
  expect(a.distanceTo(b)).toBeCloseTo(1, 12);
 });
});
