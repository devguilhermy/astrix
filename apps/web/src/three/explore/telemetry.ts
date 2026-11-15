import type { CameraMode } from './cameraMath';
import { avoidRadius, nearestSurface, type FlightBody } from './flightMath';
import { distance3, type ReadonlyVec3 } from './vecMath';
import type { ExploreTelemetry } from './index';

/** Telemetry reaches React at most this often (seconds) while the ship moves, plus once when it comes to rest. */
export const TELEMETRY_INTERVAL = .1;
/** Scene units per solar radius when no Sun is in the body list (`SUN_DISPLAY_RADIUS`, plan §11.3). */
export const FALLBACK_SOLAR_RADIUS_UNITS = 6;

export function buildTelemetry(position: ReadonlyVec3, speed: number, bodies: readonly FlightBody[], mode: CameraMode): ExploreTelemetry {
  const nearest = nearestSurface(position, bodies);
  return {
    speed,
    position: [position[0], position[1], position[2]],
    nearest: nearest ? { id: nearest.body.id, distance: nearest.distance } : null,
    mode,
  };
}

/** Whether a new telemetry value is worth a React update: visible digits or the nearest body changed. */
export function telemetryDiffers(previous: ExploreTelemetry | null, next: ExploreTelemetry): boolean {
  if (!previous || previous.mode !== next.mode || previous.nearest?.id !== next.nearest?.id) return true;
  if (Math.abs(previous.speed - next.speed) > Math.max(1e-6, next.speed * .002)) return true;
  if (previous.nearest && next.nearest && Math.abs(previous.nearest.distance - next.nearest.distance) > Math.max(1e-6, Math.abs(next.nearest.distance) * .002)) return true;
  return distance3(previous.position, next.position) > 1e-6;
}

/**
 * The scene states its scale as "sizes to scale with the Sun; distances compressed". The HUD therefore reports
 * lengths in solar radii (R☉) of the drawn Sun, and says that distances between bodies are compressed.
 */
export const solarRadiusUnits = (bodies: readonly FlightBody[]): number =>
  bodies.find(body => body.id === 'SUN')?.radius ?? FALLBACK_SOLAR_RADIUS_UNITS;

export const surfaceDistance = (position: ReadonlyVec3, body: FlightBody): number => distance3(position, body.position) - body.radius;

/** The ship sits on the avoidance sphere: the HUD says it is holding clear of the surface. */
export const isHoldingClear = (distance: number, radius: number): boolean => distance <= avoidRadius(radius) - radius + 1e-6;
