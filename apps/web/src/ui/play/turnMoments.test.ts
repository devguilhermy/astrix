import { describe, expect, test } from 'bun:test';
import { commitTurn, createTurnGame, defaultQuickDesign, history, scoreMission, telemetry, turnDecision, type TurnGameState } from '@astrix/core';
import { SOLO_TEAM, missionScore, subpoint, turnMoments } from './turnMoments';

function commit(game: TurnGameState, planId: string): TurnGameState {
  const result = commitTurn(game, { decisionId: turnDecision(game).id, baseRevision: game.revision, planId, idempotencyKey: `turn-${game.revision}` });
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value.state;
}
function firstSignal(): TurnGameState {
  let game = commit(createTurnGame(defaultQuickDesign()), 'observe');
  // The first pass may not be in view yet; keep transmitting until data reaches the ground.
  for (let turn = 0; turn < 4 && telemetry(game.sim).downlinkedMB <= 0; turn++) game = commit(game, 'transmit');
  return game;
}

describe('turn moments', () => {
  test('a new game has no moments', () => {
    expect(turnMoments(createTurnGame(defaultQuickDesign()))).toEqual([]);
  });

  test('one contiguous moment per receipt, ending at the committed time', () => {
    const game = firstSignal(), moments = turnMoments(game);
    expect(moments).toHaveLength(game.receipts.length);
    moments.forEach((moment, index) => {
      const receipt = game.receipts[index]!;
      expect(moment.index).toBe(receipt.revision);
      expect(moment.receiptId).toBe(receipt.id);
      expect(moment.endSec - moment.startSec).toBeCloseTo(receipt.elapsedSec, 6);
      if (index > 0) expect(moment.startSec).toBeCloseTo(moments[index - 1]!.endSec, 6);
    });
    expect(moments.at(-1)!.endSec).toBeCloseTo(telemetry(game.sim).t, 6);
  });

  test('observation captures data and transmission returns it', () => {
    const game = firstSignal(), moments = turnMoments(game), observe = moments[0]!, transmit = moments.at(-1)!;
    expect(observe.kind).toBe('OBSERVE');
    expect(observe.capturedMB).toBeGreaterThan(0);
    expect(observe.deliveredMB).toBe(0);
    expect(transmit.kind).toBe('TRANSMIT');
    expect(transmit.deliveredMB).toBeGreaterThan(0);
    expect(transmit.progress).toBeGreaterThan(observe.progress);
  });

  test('positions, frames and stations come from recorded history', () => {
    const game = firstSignal(), samples = history(game.sim);
    for (const moment of turnMoments(game)) {
      expect(moment.body).toBe('EARTH');
      expect(moment.positionKm).not.toBeNull();
      const radius = Math.hypot(...moment.positionKm!);
      expect(radius).toBeGreaterThan(6378);
      expect(radius).toBeLessThan(8000);
      expect(samples.some(sample => sample.positionKm[0] === moment.positionKm![0] && sample.positionKm[1] === moment.positionKm![1])).toBe(true);
      expect(moment.frame).not.toBeNull();
      expect(Math.abs(moment.frame!.latDeg)).toBeLessThanOrEqual(90);
      expect(Math.abs(moment.frame!.lonDeg)).toBeLessThanOrEqual(180);
      expect(moment.stationKm).not.toBeNull();
      expect(Math.hypot(...moment.stationKm!)).toBeCloseTo(6378.137, 0);
      expect(moment.socPct).not.toBeNull();
      expect(moment.doseUGyH.every(sample => sample.t >= moment.startSec && sample.t <= moment.endSec)).toBe(true);
    }
  });

  test('subpoint follows the scene longitude convention', () => {
    const epoch = '2000-01-01T12:00:00Z';
    const equator = subpoint('EARTH', [7000, 0, 0], [1, 0, 0], 0, epoch);
    expect(equator.latDeg).toBeCloseTo(0, 9);
    expect(equator.lonDeg).toBeCloseTo(0, 6);
    expect(equator.sunElevationDeg).toBeCloseTo(90, 6);
    const pole = subpoint('EARTH', [0, 0, 7000], [1, 0, 0], 0, epoch);
    expect(pole.latDeg).toBeCloseTo(90, 9);
    expect(pole.sunElevationDeg).toBeCloseTo(0, 9);
    const east = subpoint('EARTH', [0, 7000, 0], [-1, 0, 0], 0, epoch);
    expect(east.lonDeg).toBeCloseTo(90, 6);
    expect(subpoint('EARTH', [-7000, 0, 0], [1, 0, 0], 0, epoch).sunElevationDeg).toBeCloseTo(-90, 6);
    expect(subpoint('EARTH', [0, 0, 0], [1, 0, 0], 0, epoch)).toEqual({ latDeg: 0, lonDeg: 0, sunElevationDeg: 0 });
  });

  test('mission score is the unchanged core score with solo team credit', () => {
    const game = firstSignal(), score = missionScore(game), core = scoreMission(game.sim, game.design, SOLO_TEAM);
    expect(score.total).toBe(core.total);
    expect(score.stars).toBe(core.stars);
    expect(score.components).toEqual(core.components);
    expect(score.components.find(component => component.key === 'score.team')!.value).toBe(1);
    expect(score.rawTotal).toBeGreaterThanOrEqual(score.total);
  });
});
