import { describe, expect, test } from 'bun:test';
import { CONSTANTS, commitTurn, createTurnGame, missionOffers, telemetry, turnDecision, type LevelId, type TurnGameState } from '@astrix/core';
import { HULL_RADIUS, bodyShell, clearedCraft, committedScene, displayedRadius, renderPoint } from './committedScene';

const LEVELS: readonly LevelId[] = ['ASPIRING', 'EXPERT'];
const length = (point: readonly number[]) => Math.hypot(point[0]!, point[1]!, point[2]!);

function check(game: TurnGameState) {
  const scene = committedScene(game.design, game, game.design.orbit?.body ?? 'EARTH', 'play');
  if (!scene.physical) return;
  const current = telemetry(game.sim), position = current.flight?.view.central.rKm ?? current.positionKm;
  expect(scene.marker).toEqual(renderPoint(position, CONSTANTS[scene.body].radius.v));
  expect(scene.hullRadius).toBe(HULL_RADIUS);
  expect(scene.craftScale).toBeGreaterThan(0);
  const shell = bodyShell(scene.body, scene.radiusKm), clearance = length(scene.craft) - scene.hullRadius;
  // The hull never intersects the surface, whatever the phase.
  expect(clearance).toBeGreaterThan(1);
  const onPad = scene.altitudeKm < 1 && (scene.phase === 'PRELAUNCH' || scene.phase === 'ASCENT');
  if (onPad) expect(length(scene.craft)).toBeCloseTo(1 + scene.hullRadius + .004, 6);
  else if (scene.altitudeKm >= 100) expect(clearance).toBeGreaterThanOrEqual(shell + .05);
}

describe('committed scene clearance', () => {
  for (const levelId of LEVELS) for (const offer of missionOffers(undefined, levelId)) {
    test(`${offer.missionId} ${levelId}: hull clears the body and the marker stays true`, () => {
      const game = createTurnGame(offer.config);
      check(game);
      const decision = turnDecision(game);
      if (decision.terminal || !decision.plans.length) return;
      const plan = decision.plans.find(item => item.recommended) ?? decision.plans[0]!;
      const result = commitTurn(game, { decisionId: decision.id, baseRevision: game.revision, planId: plan.id, idempotencyKey: 'clearance-1' });
      if (result.ok) check(result.value.state);
    });
  }

  test('a surface launch at revision 0 stands on the pad', () => {
    const offer = missionOffers('EARTH', 'ASPIRING').find(item => item.config.missionId === 'STAY_IN_ORBIT')!;
    const game = createTurnGame(offer.config), scene = committedScene(game.design, game, 'EARTH', 'play');
    expect(scene.phase === 'PRELAUNCH' || scene.phase === 'ASCENT').toBe(true);
    expect(length(scene.craft)).toBeCloseTo(1 + scene.hullRadius + .004, 6);
  });
});

describe('altitude-aware clearance', () => {
  const shell = bodyShell('EARTH', CONSTANTS.EARTH.radius.v);
  test('ground at 0 km, the orbit floor from 100 km, continuous between', () => {
    expect(displayedRadius(1, 0, .2, shell)).toBeCloseTo(1.204, 9);
    expect(displayedRadius(1.03, 120, .2, shell)).toBeCloseTo(shell + .26, 9);
    let previous = 0;
    for (let km = 0; km <= 100; km += 5) {
      const radius = displayedRadius(1, km, .2, shell);
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
    expect(displayedRadius(3, 30000, .2, shell)).toBe(3);
  });
  test('the Sun has no atmosphere shell', () => {
    expect(bodyShell('SUN', 695700)).toBe(1);
  });
  test('a zero-length marker falls back to +X', () => {
    const craft = clearedCraft([0, 0, 0], 400, .2, shell);
    expect(craft[1]).toBe(0);
    expect(craft[2]).toBe(0);
    expect(craft[0]).toBeCloseTo(shell + .26, 9);
  });
  test('a shown secondary body pushes the hull along the separation', () => {
    const craft = clearedCraft([3, 0, 0], 10000, .2, shell, { centre: [3.1, 0, 0], radius: .3 });
    expect(Math.abs(craft[0] - 3.1)).toBeCloseTo(.56, 9);
    expect(craft[0]).toBeLessThan(3.1);
  });
});
