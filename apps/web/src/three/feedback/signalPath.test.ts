import { describe, expect, test } from 'bun:test';
import { CONSTANTS } from '@astrix/core';
import { BORESIGHT_LENGTH, FOOTPRINT_LIFT, PULSE_COUNT, PULSE_TOTAL_SEC, nadirPoint, pulseRadius, pulseState, signalTarget } from './signalPath';

const identity = [0, 0, 0, 1];

describe('transmission pulses', () => {
  test('each wave starts 0.4 s after the previous one and crosses in 1.6 s', () => {
    expect(pulseState(0, 0)).toEqual({ phase: 0, opacity: 0 });
    expect(pulseState(.39, 1)).toBeNull();
    expect(pulseState(.4, 1)!.phase).toBeCloseTo(0, 9);
    const middle = pulseState(.8, 0)!;
    expect(middle.phase).toBeCloseTo(.5, 9);
    expect(middle.opacity).toBeCloseTo(1, 9);
    expect(pulseState(1.6 + .8, 0)!.phase).toBeCloseTo(.5, 9);
  });

  test('five cycles, then every wave stops', () => {
    expect(PULSE_TOTAL_SEC).toBeCloseTo(9.2, 9);
    expect(pulseState(7.99, 0)).not.toBeNull();
    expect(pulseState(8, 0)).toBeNull();
    for (let index = 0; index < PULSE_COUNT; index++) expect(pulseState(PULSE_TOTAL_SEC + 1e-9, index)).toBeNull();
    expect(pulseState(1, PULSE_COUNT)).toBeNull();
    expect(pulseState(Number.NaN, 0)).toBeNull();
  });

  test('opacity follows a sine envelope and the radius grows from 0.02 to 0.09', () => {
    for (let t = 0; t < 1.6; t += .1) {
      const state = pulseState(t, 0)!;
      expect(state.opacity).toBeGreaterThanOrEqual(0);
      expect(state.opacity).toBeLessThanOrEqual(1);
    }
    expect(pulseRadius(0)).toBeCloseTo(.02, 9);
    expect(pulseRadius(1)).toBeCloseTo(.09, 9);
  });
});

describe('signal target', () => {
  const radiusKm = CONSTANTS.EARTH.radius.v;
  test('the ground station when it belongs to the scene body', () => {
    const target = signalTarget({ momentBody: 'EARTH', sceneBody: 'EARTH', stationKm: [radiusKm, 0, 0], radiusKm, source: [1.3, 0, 0], attitude: identity, earth: null });
    expect(target.kind).toBe('station');
    expect(target.point[0]).toBeCloseTo(1, 9);
    expect(Math.hypot(target.point[1], target.point[2])).toBeCloseTo(0, 9);
  });

  test('the antenna boresight when no station is in the frame', () => {
    const target = signalTarget({ momentBody: 'MARS', sceneBody: 'MARS', stationKm: null, radiusKm: CONSTANTS.MARS.radius.v, source: [1, 2, 3], attitude: identity, earth: null });
    expect(target.kind).toBe('boresight');
    expect(target.point[0]).toBeCloseTo(1, 9);
    expect(target.point[1]).toBeCloseTo(2, 9);
    expect(target.point[2]).toBeCloseTo(3 + BORESIGHT_LENGTH, 9);
    // A quarter turn about +X carries the +Z boresight to -Y.
    const s = Math.SQRT1_2;
    const turned = signalTarget({ momentBody: 'MARS', sceneBody: 'MARS', stationKm: null, radiusKm, source: [0, 0, 0], attitude: [s, 0, 0, s], earth: null });
    expect(turned.point[0]).toBeCloseTo(0, 9);
    expect(turned.point[1]).toBeCloseTo(-BORESIGHT_LENGTH, 9);
    expect(turned.point[2]).toBeCloseTo(0, 9);
  });

  test('a station on another body falls back to the boresight', () => {
    const target = signalTarget({ momentBody: 'EARTH', sceneBody: 'MOON', stationKm: [radiusKm, 0, 0], radiusKm, source: [0, 0, 0], attitude: identity, earth: null });
    expect(target.kind).toBe('boresight');
  });

  test("Earth's marker in a Sun-centred scene", () => {
    const target = signalTarget({ momentBody: 'SUN', sceneBody: 'SUN', stationKm: null, radiusKm: 695700, source: [0, 0, 200], attitude: identity, earth: [215, 0, 0] });
    expect(target).toEqual({ point: [215, 0, 0], kind: 'earth' });
  });
});

describe('observation footprint', () => {
  test('sits on the surface beneath the true marker', () => {
    const point = nadirPoint([0, 3, 4]);
    expect(Math.hypot(...point)).toBeCloseTo(FOOTPRINT_LIFT, 9);
    expect(point[1] / point[2]).toBeCloseTo(.75, 9);
    expect(nadirPoint([0, 0, 0])).toEqual([FOOTPRINT_LIFT, 0, 0]);
  });
});
