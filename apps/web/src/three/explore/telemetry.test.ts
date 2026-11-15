import { describe, expect, it } from 'bun:test';
import { FIXED_STEP, createFlightState, idleInput, stepFlight, type FlightBody } from './flightMath';
import { FALLBACK_SOLAR_RADIUS_UNITS, buildTelemetry, isHoldingClear, solarRadiusUnits, surfaceDistance, telemetryDiffers } from './telemetry';

const SUN: FlightBody = { id: 'SUN', position: [0, 0, 0], radius: 6 };
const EARTH: FlightBody = { id: 'EARTH', position: [0, 0, -12.5], radius: .055 };

describe('Explore telemetry', () => {
  it('reports the nearest body by distance to its surface, not its centre', () => {
    const telemetry = buildTelemetry([0, 0, -11], .2, [SUN, EARTH], 'chase');
    expect(telemetry.nearest?.id).toBe('EARTH');
    expect(telemetry.nearest?.distance).toBeCloseTo(1.5 - .055, 12);
    const nearSun = buildTelemetry([0, 0, -7], .2, [SUN, EARTH], 'cockpit');
    expect(nearSun.nearest).toEqual({ id: 'SUN', distance: 1 });
    expect(nearSun.mode).toBe('cockpit');
    expect(buildTelemetry([0, 0, 0], 0, [], 'chase').nearest).toBeNull();
  });

  it('only reports changes a reader could see', () => {
    const first = buildTelemetry([0, 0, -11], .2, [SUN, EARTH], 'chase');
    expect(telemetryDiffers(null, first)).toBe(true);
    expect(telemetryDiffers(first, buildTelemetry([0, 0, -11], .2, [SUN, EARTH], 'chase'))).toBe(false);
    expect(telemetryDiffers(first, buildTelemetry([0, 0, -11], .2, [SUN, EARTH], 'cockpit'))).toBe(true);
    expect(telemetryDiffers(first, buildTelemetry([0, 0, -11], .25, [SUN, EARTH], 'chase'))).toBe(true);
    expect(telemetryDiffers(first, buildTelemetry([0, 0, -11.2], .2, [SUN, EARTH], 'chase'))).toBe(true);
  });

  it('uses the drawn Sun as the solar radius', () => {
    expect(solarRadiusUnits([SUN, EARTH])).toBe(6);
    expect(solarRadiusUnits([EARTH])).toBe(FALLBACK_SOLAR_RADIUS_UNITS);
    expect(surfaceDistance([0, 0, -9], SUN)).toBe(3);
  });

  it('says the ship is holding clear once flight leaves it on the avoidance sphere', () => {
    const state = createFlightState([0, 0, -11], [0, 0, 0, 1]);
    for (let step = 0; step < 60 * 30; step++) stepFlight(state, { ...idleInput(), thrust: 1 }, [SUN, EARTH], { speedLimit: 1, target: null }, FIXED_STEP);
    const telemetry = buildTelemetry(state.position, 0, [SUN, EARTH], 'chase');
    expect(telemetry.nearest?.id).toBe('EARTH');
    expect(isHoldingClear(telemetry.nearest!.distance, EARTH.radius)).toBe(true);
    expect(isHoldingClear(1, EARTH.radius)).toBe(false);
  });
});
