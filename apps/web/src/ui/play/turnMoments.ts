import { bodyRotationAngle, history, scoreMission, telemetry, type BodyId, type HistorySample, type ScoreBreakdown, type TeamStats, type TurnGameState, type TurnPlanKind, type TurnReceipt } from '@astrix/core';

/**
 * Presentation data derived from committed engine state. Nothing here is stored in a
 * save or used to judge an objective: it only locates each committed turn in the
 * recorded history so the scene, the turn card and the mission report agree.
 */
export type Km3 = readonly [number, number, number];
export interface Subpoint { latDeg: number; lonDeg: number; sunElevationDeg: number }
export interface TurnMoment {
  /** 1-based, equals receipt.revision. */
  index: number;
  receiptId: string;
  kind: TurnPlanKind;
  startSec: number;
  endSec: number;
  interrupted: boolean;
  delta: TurnReceipt['delta'];
  /** Data produced during the turn, whether still on board or already returned. */
  capturedMB: number;
  deliveredMB: number;
  /** Mean progress of the required evidence after the turn, 0..1. */
  progress: number;
  /** Central body of the end-of-turn sample. */
  body: BodyId;
  /** Central-body-relative position at the end of the turn. */
  positionKm: Km3 | null;
  /** Ground point beneath the spacecraft at the middle of the turn. */
  frame: Subpoint | null;
  /** Ground station at the end of the turn, in the same frame as positionKm. */
  stationKm: Km3 | null;
  inContact: boolean;
  /** Recorded dose-rate samples inside the turn. */
  doseUGyH: readonly { t: number; value: number }[];
  /** Battery state of charge at the end of the turn. */
  socPct: number | null;
}

const DEG = 180 / Math.PI;
const kinds: readonly TurnPlanKind[] = ['LAUNCH', 'MANEUVER', 'COAST', 'OBSERVE', 'TRANSMIT', 'RECHARGE', 'RECOVER', 'CAPTURE', 'RETURN', 'FINISH', 'ABORT'];
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const wrap180 = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;

/**
 * Ground point beneath a central-body-relative position. Longitude 0 lies on core +X
 * at rotation 0, the same convention the planet texture uses in the scene.
 */
export function subpoint(body: BodyId, rKm: Km3, sunDir: Km3, tSec: number, epochUTC?: string): Subpoint {
  const length = Math.hypot(rKm[0], rKm[1], rKm[2]);
  if (!(length > 0)) return { latDeg: 0, lonDeg: 0, sunElevationDeg: 0 };
  const x = rKm[0] / length, y = rKm[1] / length, z = rKm[2] / length;
  const sun = Math.hypot(sunDir[0], sunDir[1], sunDir[2]) || 1;
  const lit = (x * sunDir[0] + y * sunDir[1] + z * sunDir[2]) / sun;
  return {
    latDeg: Math.asin(Math.min(1, Math.max(-1, z))) * DEG,
    lonDeg: wrap180((Math.atan2(y, x) - bodyRotationAngle(body, tSec, epochUTC)) * DEG),
    sunElevationDeg: Math.asin(Math.min(1, Math.max(-1, lit))) * DEG,
  };
}

function nearest(samples: readonly HistorySample[], t: number): HistorySample | null {
  let low = 0, high = samples.length - 1;
  if (high < 0) return null;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (samples[middle]!.t < t) low = middle + 1; else high = middle;
  }
  const after = samples[low]!, before = samples[low - 1];
  return before && t - before.t <= after.t - t ? before : after;
}

function bodyOf(sample: HistorySample, fallback: BodyId): BodyId {
  return sample.flight?.centralBody ?? fallback;
}

/** Mirrors the trail construction in three/committedScene.ts. */
function relative(sample: HistorySample, body: BodyId, earthFrame: Km3): Km3 {
  const moon = body === 'MOON' ? sample.flight?.moonRKm : null;
  return moon ? [earthFrame[0] - moon[0], earthFrame[1] - moon[1], earthFrame[2] - moon[2]] : earthFrame;
}

function positionOf(sample: HistorySample, body: BodyId): Km3 | null {
  const position = relative(sample, body, sample.flight?.earthRKm ?? sample.positionKm);
  return Math.hypot(position[0], position[1], position[2]) >= 1 ? position : null;
}

function progressOf(receipt: TurnReceipt): number {
  const required = receipt.evidence.filter(item => item.required), items = required.length ? required : receipt.evidence;
  return items.length ? clamp01(items.reduce((sum, item) => sum + clamp01(item.progress), 0) / items.length) : 0;
}

export function turnMoments(game: TurnGameState): readonly TurnMoment[] {
  if (!game.receipts.length) return [];
  const samples = history(game.sim), fallback = game.design.orbit?.body ?? 'EARTH', epoch = game.design.definition.environment.epochUTC;
  let cursor = telemetry(game.sim).t - game.receipts.reduce((sum, receipt) => sum + receipt.elapsedSec, 0);
  return game.receipts.map(receipt => {
    const startSec = cursor, endSec = cursor + receipt.elapsedSec;
    cursor = endSec;
    const upper = receipt.planId.toUpperCase() as TurnPlanKind, kind = kinds.includes(upper) ? upper : 'COAST';
    const end = nearest(samples, endSec), middle = nearest(samples, (startSec + endSec) / 2);
    const body = end ? bodyOf(end, fallback) : fallback;
    const positionKm = end ? positionOf(end, body) : null;
    const frameBody = middle ? bodyOf(middle, fallback) : body, framePosition = middle ? positionOf(middle, frameBody) : null;
    const dose: { t: number; value: number }[] = [];
    for (const sample of samples) if (sample.t >= startSec && sample.t <= endSec) dose.push({ t: sample.t, value: sample.doseUGyH });
    return {
      index: receipt.revision, receiptId: receipt.id, kind, startSec, endSec, interrupted: receipt.interrupted, delta: receipt.delta,
      capturedMB: Math.max(0, receipt.delta.storedMB + receipt.delta.deliveredMB), deliveredMB: Math.max(0, receipt.delta.deliveredMB),
      progress: progressOf(receipt), body, positionKm,
      frame: middle && framePosition ? subpoint(frameBody, framePosition, middle.sunDir, middle.t, epoch) : null,
      stationKm: end?.stationPosKm && body !== 'MARS' ? relative(end, body, end.stationPosKm) : null,
      inContact: end?.inContact === 1, doseUGyH: dose, socPct: end ? end.socPct : null,
    };
  });
}

/** Solo play has no review board, so the team component receives full credit. */
export const SOLO_TEAM: TeamStats = { roles: 1, signoffs: 0, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 };

/** The unchanged core score, plus the total before the failure cap for explanation. */
export function missionScore(game: TurnGameState): ScoreBreakdown & { rawTotal: number } {
  const score = scoreMission(game.sim, game.design, SOLO_TEAM);
  return { ...score, rawTotal: Math.max(0, Math.round(score.components.reduce((sum, component) => sum + component.weight * component.value, 0) * 100)) };
}
