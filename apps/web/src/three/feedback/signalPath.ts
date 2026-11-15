import type { BodyId } from '@astrix/core';
import { renderPoint, type ScenePoint } from '../committedScene';

/** Four wave fronts, launched 0.4 s apart, each crossing the path in 1.6 s, five times. */
export const PULSE_COUNT = 4;
export const PULSE_TRAVEL_SEC = 1.6;
export const PULSE_GAP_SEC = .4;
export const PULSE_CYCLES = 5;
export const PULSE_TOTAL_SEC = (PULSE_COUNT - 1) * PULSE_GAP_SEC + PULSE_CYCLES * PULSE_TRAVEL_SEC;
/** Static rings drawn after the animation, and always under reduced motion. */
export const STATIC_RING_PHASES: readonly number[] = [.25, .5, .75];
/** Wave front radius in render units, growing as it travels. */
export const pulseRadius = (phase: number) => .02 + .07 * phase;
/** Antenna boresight length used when no receiver is in the frame. */
export const BORESIGHT_LENGTH = 1.6;
/** Observation footprint height above the unit surface. */
export const FOOTPRINT_LIFT = 1.003;

export interface PulseState { phase: number; opacity: number }

/** Position (0 at the source, 1 at the target) and opacity of one wave front, or null when it is not travelling. */
export function pulseState(elapsedSec: number, index: number): PulseState | null {
  const local = elapsedSec - index * PULSE_GAP_SEC;
  if (!Number.isFinite(local) || local < 0 || local >= PULSE_CYCLES * PULSE_TRAVEL_SEC || index < 0 || index >= PULSE_COUNT) return null;
  const phase = (local % PULSE_TRAVEL_SEC) / PULSE_TRAVEL_SEC;
  return { phase, opacity: Math.sin(Math.PI * phase) };
}

export type SignalTargetKind = 'station' | 'earth' | 'boresight';
export interface SignalTarget { point: ScenePoint; kind: SignalTargetKind }
export interface SignalTargetInput {
  /** Central body of the turn's end sample. */
  momentBody: BodyId;
  sceneBody: BodyId;
  stationKm: readonly number[] | null;
  radiusKm: number;
  /** Displayed hardware position. */
  source: readonly number[];
  /** Render-frame attitude quaternion, [x, y, z, w]. */
  attitude: readonly number[];
  /** Earth marker in a Sun-centred scene. */
  earth: ScenePoint | null;
}

/**
 * Where the transmission goes: the ground station when it is in this scene, Earth's marker
 * in a Sun-centred scene, otherwise 1.6 units along the antenna boresight (body +Z).
 */
export function signalTarget({ momentBody, sceneBody, stationKm, radiusKm, source, attitude, earth }: SignalTargetInput): SignalTarget {
  if (sceneBody === 'SUN' && earth) return { point: [...earth], kind: 'earth' };
  if (stationKm && momentBody === sceneBody) return { point: renderPoint(stationKm, radiusKm), kind: 'station' };
  const [x, y, z, w] = attitude as [number, number, number, number];
  // v' = v + 2w (q × v) + 2 q × (q × v), with v = +Z.
  const cx = y, cy = -x, ccx = -z * cy, ccy = z * cx, ccz = x * cy - y * cx;
  const axis: ScenePoint = [2 * w * cx + 2 * ccx, 2 * w * cy + 2 * ccy, 1 + 2 * ccz];
  const length = Math.hypot(...axis) || 1;
  return { point: [source[0]! + axis[0] / length * BORESIGHT_LENGTH, source[1]! + axis[1] / length * BORESIGHT_LENGTH, source[2]! + axis[2] / length * BORESIGHT_LENGTH], kind: 'boresight' };
}

/** Surface point beneath a true marker, just above the unit sphere; a zero marker falls back to +X. */
export function nadirPoint(marker: readonly number[]): ScenePoint {
  const length = Math.hypot(marker[0]!, marker[1]!, marker[2]!);
  if (!(length > 1e-9) || !Number.isFinite(length)) return [FOOTPRINT_LIFT, 0, 0];
  return [marker[0]! / length * FOOTPRINT_LIFT, marker[1]! / length * FOOTPRINT_LIFT, marker[2]! / length * FOOTPRINT_LIFT];
}
