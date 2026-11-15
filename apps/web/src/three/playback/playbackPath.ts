import { CONSTANTS, history, telemetry, type BodyId, type HistorySample, type TurnGameState } from '@astrix/core';
import { Quaternion } from 'three';
import { renderPoint, samplePositionKm, secondaryPoint, type ScenePoint } from '../committedScene';
import { renderAttitude } from '../space/FloatingOrigin';

export type Km3 = readonly [number, number, number];
/** One recorded instant of a turn, already in the scene's render frame. */
export interface PlaybackKeyframe {
  t: number;
  /** True telemetry position, render units of the central body. */
  position: ScenePoint;
  altitudeKm: number;
  /** Core-frame unit vector from the spacecraft to the Sun. */
  sunDir: Km3;
  /** Render-frame attitude, [x, y, z, w]. */
  attitude: readonly [number, number, number, number];
  /** Moon (Earth-centred), Earth (Moon- or Sun-centred), or nothing. */
  secondary: ScenePoint | null;
  phase: string | null;
}
export interface PlaybackPath {
  body: BodyId;
  startSec: number;
  endSec: number;
  periodSec: number;
  launch: boolean;
  keyframes: readonly PlaybackKeyframe[];
}
/** Interpolated replay state; mutable so one instance can be refilled every frame. */
export interface PlaybackSample {
  t: number;
  position: [number, number, number];
  altitudeKm: number;
  sunDir: [number, number, number];
  attitude: [number, number, number, number];
  secondary: [number, number, number] | null;
  phase: string | null;
  climbing: boolean;
}
export interface PlaybackTurn { startSec: number; endSec: number; kind?: string }
export interface PlaybackPathOptions { body: BodyId; radiusKm: number; epochUTC: string | undefined; latest: boolean }

const quaternion = new Quaternion();
const attitudeOf = (q: readonly number[]): readonly [number, number, number, number] => renderAttitude(quaternion, q as [number, number, number, number]).toArray() as [number, number, number, number];
const unit = (v: readonly number[]): Km3 => {
  const length = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  return [v[0]! / length, v[1]! / length, v[2]! / length];
};

function keyframeOf(sample: HistorySample, { body, radiusKm, epochUTC }: PlaybackPathOptions): PlaybackKeyframe {
  const positionKm = samplePositionKm(sample, body);
  return {
    t: sample.t, position: renderPoint(positionKm, radiusKm),
    altitudeKm: sample.flight?.altitudeKm ?? Math.hypot(positionKm[0]!, positionKm[1]!, positionKm[2]!) - radiusKm,
    sunDir: unit(sample.sunDir), attitude: attitudeOf(sample.attitude.q),
    secondary: secondaryPoint(body, sample.flight?.moonRKm, sample.t, epochUTC, radiusKm), phase: sample.flight?.phase ?? null,
  };
}

/**
 * Keyframes of one committed turn: recorded samples inside the turn whose central body is
 * the scene body, the nearest sample before it, and current telemetry for the latest turn.
 */
export function playbackPath(game: TurnGameState, turn: PlaybackTurn, options: PlaybackPathOptions): PlaybackPath {
  const { body, radiusKm, epochUTC, latest } = options;
  const fallback = game.design.orbit?.body ?? 'EARTH';
  const samples = history(game.sim), keyframes: PlaybackKeyframe[] = [];
  const inScene = (sample: HistorySample) => (sample.flight?.centralBody ?? fallback) === body;
  let before: HistorySample | null = null;
  for (const sample of samples) {
    if (sample.t < turn.startSec) { if (inScene(sample)) before = sample; continue; }
    if (sample.t > turn.endSec) break;
    if (!inScene(sample)) continue;
    if (!keyframes.length && before) keyframes.push(keyframeOf(before, options));
    const frame = keyframeOf(sample, options);
    if (keyframes.at(-1)?.t === frame.t) keyframes[keyframes.length - 1] = frame; else keyframes.push(frame);
  }
  if (!keyframes.length && before) keyframes.push(keyframeOf(before, options));
  const current = latest ? telemetry(game.sim) : null;
  if (current && (current.flight?.view.central.body ?? fallback) === body) {
    const positionKm = current.flight?.view.central.rKm ?? current.positionKm;
    const frame: PlaybackKeyframe = {
      t: current.t, position: renderPoint(positionKm, radiusKm),
      altitudeKm: current.flight?.view.altitudeKm ?? Math.hypot(...positionKm) - radiusKm,
      sunDir: unit(current.sunDir), attitude: attitudeOf(current.attitude.q),
      secondary: secondaryPoint(body, current.flight?.view.moonEphemeris?.rKm, current.t, epochUTC, radiusKm), phase: current.flight?.phase ?? null,
    };
    while (keyframes.length && keyframes.at(-1)!.t >= frame.t) keyframes.pop();
    keyframes.push(frame);
  }
  const launch = turn.kind === 'LAUNCH' || keyframes.some(frame => frame.phase === 'PRELAUNCH' || frame.phase === 'ASCENT');
  // Period of the osculating orbit when telemetry gives one, else the circular period at the mean radius.
  const meanRadiusKm = keyframes.length ? keyframes.reduce((sum, frame) => sum + Math.hypot(...frame.position), 0) / keyframes.length * radiusKm : radiusKm;
  const osculating = current?.flight?.orbit.periodSec;
  const periodSec = osculating && osculating > 0 ? osculating : 2 * Math.PI * Math.sqrt(meanRadiusKm ** 3 / CONSTANTS[body].mu.v);
  return { body, startSec: turn.startSec, endSec: turn.endSec, periodSec, launch, keyframes };
}

export function createPlaybackSample(): PlaybackSample {
  return { t: 0, position: [0, 0, 0], altitudeKm: 0, sunDir: [1, 0, 0], attitude: [0, 0, 0, 1], secondary: null, phase: null, climbing: false };
}

/** Direction by spherical interpolation, radius linearly. */
function interpolatePosition(out: [number, number, number], a: ScenePoint, b: ScenePoint, u: number) {
  const ra = Math.hypot(...a), rb = Math.hypot(...b);
  const cos = ra > 0 && rb > 0 ? (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (ra * rb) : 1;
  const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
  if (angle < 1e-6 || Math.PI - angle < 1e-6 || !(ra > 0 && rb > 0)) {
    for (let i = 0; i < 3; i++) out[i] = a[i]! + (b[i]! - a[i]!) * u;
    return;
  }
  const sin = Math.sin(angle), wa = Math.sin((1 - u) * angle) / sin / ra, wb = Math.sin(u * angle) / sin / rb, radius = ra + (rb - ra) * u;
  for (let i = 0; i < 3; i++) out[i] = (a[i]! * wa + b[i]! * wb) * radius;
}

function slerp(out: [number, number, number, number], a: readonly number[], b: readonly number[], u: number) {
  let dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!, sign = 1;
  if (dot < 0) { dot = -dot; sign = -1; }
  let wa = 1 - u, wb = u;
  if (dot < .9995) {
    const angle = Math.acos(dot), sin = Math.sin(angle);
    wa = Math.sin((1 - u) * angle) / sin; wb = Math.sin(u * angle) / sin;
  }
  for (let i = 0; i < 4; i++) out[i] = a[i]! * wa + b[i]! * wb * sign;
  const length = Math.hypot(...out) || 1;
  for (let i = 0; i < 4; i++) out[i] /= length;
}

/** Replay state at mission time t, clamped to the path, written into `out`. */
export function sampleAt(path: PlaybackPath, t: number, out: PlaybackSample = createPlaybackSample()): PlaybackSample | null {
  const frames = path.keyframes;
  if (!frames.length) return null;
  const time = Math.min(frames.at(-1)!.t, Math.max(frames[0]!.t, t));
  let high = 0;
  while (high < frames.length - 1 && frames[high]!.t < time) high++;
  if (high === 0) high = Math.min(1, frames.length - 1);
  const a = frames[Math.max(0, high - 1)]!, b = frames[high]!;
  const u = b.t > a.t ? (time - a.t) / (b.t - a.t) : 1;
  out.t = time;
  interpolatePosition(out.position, a.position, b.position, u);
  out.altitudeKm = a.altitudeKm + (b.altitudeKm - a.altitudeKm) * u;
  for (let i = 0; i < 3; i++) out.sunDir[i] = a.sunDir[i]! + (b.sunDir[i]! - a.sunDir[i]!) * u;
  const sun = Math.hypot(...out.sunDir) || 1;
  for (let i = 0; i < 3; i++) out.sunDir[i] /= sun;
  slerp(out.attitude, a.attitude, b.attitude, u);
  const from = a.secondary ?? b.secondary, to = b.secondary ?? a.secondary;
  if (from && to) {
    out.secondary ??= [0, 0, 0];
    for (let i = 0; i < 3; i++) out.secondary[i] = from[i]! + (to[i]! - from[i]!) * u;
  } else out.secondary = null;
  out.phase = u < 1 ? a.phase : b.phase;
  out.climbing = b.altitudeKm > a.altitudeKm;
  return out;
}
