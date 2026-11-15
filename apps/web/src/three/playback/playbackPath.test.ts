import { describe, expect, test } from 'bun:test';
import { CONSTANTS, commitTurn, createTurnGame, defaultQuickDesign, telemetry, turnDecision, type TurnGameState } from '@astrix/core';
import { turnMoments } from '../../ui/play/turnMoments';
import { committedScene } from '../committedScene';
import { playbackPath, sampleAt, type PlaybackKeyframe, type PlaybackPath } from './playbackPath';

function commit(game: TurnGameState, planId: string): TurnGameState {
  const result = commitTurn(game, { decisionId: turnDecision(game).id, baseRevision: game.revision, planId, idempotencyKey: `turn-${game.revision}` });
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value.state;
}
function pathOf(game: TurnGameState, index = -1) {
  const scene = committedScene(game.design, game, game.design.orbit?.body ?? 'EARTH', 'play'), moments = turnMoments(game);
  const moment = moments.at(index)!;
  return { scene, moment, path: playbackPath(game, moment, { body: scene.body, radiusKm: scene.radiusKm, epochUTC: scene.epochUTC, latest: moment === moments.at(-1) }) };
}
const frame = (t: number, position: [number, number, number], altitudeKm = 0): PlaybackKeyframe => ({ t, position, altitudeKm, sunDir: [1, 0, 0], attitude: [0, 0, 0, 1], secondary: null, phase: null });
const synthetic = (keyframes: PlaybackKeyframe[]): PlaybackPath => ({ body: 'EARTH', startSec: keyframes[0]!.t, endSec: keyframes.at(-1)!.t, periodSec: 5400, launch: false, keyframes });

describe('playback path', () => {
  test('the latest turn ends on current telemetry, in time order', () => {
    const game = commit(createTurnGame(defaultQuickDesign()), 'observe');
    const { scene, moment, path } = pathOf(game);
    expect(path.keyframes.length).toBeGreaterThanOrEqual(2);
    path.keyframes.forEach((keyframe, i) => { if (i > 0) expect(keyframe.t).toBeGreaterThan(path.keyframes[i - 1]!.t); });
    expect(path.keyframes[0]!.t).toBeLessThanOrEqual(moment.startSec);
    expect(path.keyframes.at(-1)!.t).toBe(telemetry(game.sim).t);
    expect(path.keyframes.at(-1)!.position).toEqual(scene.marker!);
    expect(path.periodSec).toBeGreaterThan(80 * 60);
    expect(path.periodSec).toBeLessThan(200 * 60);
    expect(path.launch).toBe(false);
  });

  test('samples stay on recorded keyframes and between their radii', () => {
    const game = commit(createTurnGame(defaultQuickDesign()), 'observe');
    const { path } = pathOf(game), frames = path.keyframes;
    const at = sampleAt(path, frames[1]!.t)!;
    for (let i = 0; i < 3; i++) expect(at.position[i]).toBeCloseTo(frames[1]!.position[i]!, 9);
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!, b = frames[i]!, middle = sampleAt(path, (a.t + b.t) / 2)!;
      const r = Math.hypot(...middle.position), ra = Math.hypot(...a.position), rb = Math.hypot(...b.position);
      expect(r).toBeGreaterThanOrEqual(Math.min(ra, rb) - 1e-9);
      expect(r).toBeLessThanOrEqual(Math.max(ra, rb) + 1e-9);
      expect(Math.hypot(...middle.sunDir)).toBeCloseTo(1, 9);
      expect(Math.hypot(...middle.attitude)).toBeCloseTo(1, 9);
    }
    expect(sampleAt(path, -1e9)!.t).toBe(frames[0]!.t);
    expect(sampleAt(path, 1e12)!.t).toBe(frames.at(-1)!.t);
  });

  test('direction is interpolated spherically and radius linearly', () => {
    const path = synthetic([frame(0, [2, 0, 0]), frame(10, [0, 0, 4])]);
    const middle = sampleAt(path, 5)!;
    expect(Math.hypot(...middle.position)).toBeCloseTo(3, 9);
    expect(middle.position[0]).toBeCloseTo(3 * Math.SQRT1_2, 9);
    expect(middle.position[2]).toBeCloseTo(3 * Math.SQRT1_2, 9);
  });

  test('a path without keyframes cannot be sampled', () => {
    expect(sampleAt({ ...synthetic([frame(0, [1, 0, 0])]), keyframes: [] }, 0)).toBeNull();
    expect(sampleAt(synthetic([frame(4, [1.5, 0, 0])]), 0)!.position).toEqual([1.5, 0, 0]);
  });

  test('a launch turn starts in ascent near the surface and climbs', () => {
    let game = createTurnGame(defaultQuickDesign('STAY_IN_ORBIT'));
    const plan = turnDecision(game).plans.find(item => item.kind === 'LAUNCH') ?? turnDecision(game).plans[0]!;
    game = commit(game, plan.id);
    const { path } = pathOf(game);
    expect(path.launch).toBe(true);
    const first = path.keyframes[0]!;
    expect(first.phase === 'PRELAUNCH' || first.phase === 'ASCENT').toBe(true);
    expect(Math.hypot(...first.position)).toBeLessThan(1 + 10 / CONSTANTS.EARTH.radius.v);
    expect(path.keyframes.at(-1)!.altitudeKm).toBeGreaterThan(first.altitudeKm);
  });
});
