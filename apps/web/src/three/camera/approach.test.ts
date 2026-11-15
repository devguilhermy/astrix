import { describe, expect, it } from 'bun:test';
import { approach, approachFactor, cameraClearance } from './approach';
import { resolveCameraMode } from './modes';

describe('wall-clock camera response', () => {
 it('is independent of frame rate and never overshoots', () => {
  let thirty = 0, sixty = 0;
  for (let i = 0; i < 30; i++) thirty = approach(thirty, 12, 3.5, 1 / 30);
  for (let i = 0; i < 60; i++) sixty = approach(sixty, 12, 3.5, 1 / 60);
  expect(thirty).toBeCloseTo(sixty, 12);
  expect(thirty).toBeLessThan(12);
  expect(approach(20, 12, 5, .1)).toBeGreaterThan(12);
 });
 it('handles stationary and very large wall deltas without instability', () => {
  expect(approachFactor(5, 0)).toBe(0);
  expect(approachFactor(5, -1)).toBe(0);
  expect(approach(1, 9, 5, 100000)).toBe(9);
  expect(cameraClearance(6378.137, .000001)).toBeGreaterThan(6378.137);
 });
 it('uses map for discontinuous fast-forward and disables authored motion when requested', () => {
  expect(resolveCameraMode('CHASE', 'orbit', 1000, false, false)).toBe('MAP');
  expect(resolveCameraMode('CHASE', 'orbit', 1, true, false)).toBe('MAP');
  expect(resolveCameraMode('CINEMATIC', 'orbit', 1, false, true)).toBe('INSPECT');
  expect(resolveCameraMode(null, 'assembly', 10000, false, false)).toBe('WORKBENCH');
 });
});

it('does not carry automatic Workbench into flight or override explicit pilot views', () => {
 expect(resolveCameraMode('WORKBENCH', 'orbit', 100, false, false, 'AUTO')).toBe('CHASE');
 expect(resolveCameraMode('MAP', 'orbit', 1, false, false, 'USER')).toBe('MAP');
 expect(resolveCameraMode('INSPECT', 'orbit', 1, false, false, 'USER')).toBe('INSPECT');
 expect(resolveCameraMode('WORKBENCH', 'orbit', 1, false, false, 'USER')).toBe('WORKBENCH');
});
