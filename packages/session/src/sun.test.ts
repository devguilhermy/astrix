import { describe, expect, test } from 'bun:test';
import { defaultQuickDesign, history, missionById, telemetry, turnDecision } from '@astrix/core';
import { createSession, reduceSession } from './reducer';
import { toPublicSnapshot } from './snapshot';
import { parseClientMessage } from './protocol';
import type { SessionActor } from './contracts';

const host: SessionActor = { playerId: 'host', deviceId: 'display', isHost: true, role: 'ALL' };
const frame = (intent: unknown) => JSON.stringify({ type: 'INTENT', id: 'a', epoch: 'local', attemptId: 0, rosterRevision: 0, actor: { role: 'ALL' }, intent });

describe('Sun missions through the session', () => {
 test('the wire accepts the Sun mission, Sun quick-design configs and Sun-centred orbits', () => {
  expect(parseClientMessage(frame({ kind: 'START_MISSION', missionId: 'SUN_SENTINEL', levelId: 'EXPERT' })).ok).toBe(true);
  expect(parseClientMessage(frame({ kind: 'START_GAME', config: defaultQuickDesign('SUN_SENTINEL', 'ASPIRING') })).ok).toBe(true);
  const start = missionById('SUN_SENTINEL').start, orbit = start.kind === 'PROVIDED_ORBIT' ? start.orbit : null;
  expect(parseClientMessage(frame({ kind: 'START_GAME', config: { ...defaultQuickDesign('SUN_SENTINEL', 'ASPIRING'), initialOrbit: orbit } })).ok).toBe(true);
 });
 test('START_MISSION carries the Sun definition by reference', () => {
  const t = reduceSession(createSession({ hostPlayerId: 'host' }), { kind: 'START_MISSION', missionId: 'SUN_SENTINEL', levelId: 'ASPIRING' }, host);
  expect(t.result.ok).toBe(true);
  expect(t.state.definition).toBe(missionById('SUN_SENTINEL'));
  expect(t.state.design!.orbit!.body).toBe('SUN');
 });
 test('a committed Sun turn publishes a Sun-centred snapshot', () => {
  const started = reduceSession(createSession({ hostPlayerId: 'host' }), { kind: 'START_GAME', config: defaultQuickDesign('SUN_SENTINEL', 'ASPIRING') }, host);
  if (!started.result.ok) throw new Error(JSON.stringify(started.result));
  const s = started.state, d = turnDecision(s.game!), plan = d.plans.find(p => p.recommended) ?? d.plans[0];
  const resolved = reduceSession(s, { id: 'turn-1', epoch: s.epoch, attemptId: s.attemptId, rosterRevision: s.rosterRevision, intent: { kind: 'COMMIT_TURN', decisionId: d.id, turnRevision: d.revision, planId: plan.id } }, host);
  expect(resolved.result.ok).toBe(true);
  const snapshot = toPublicSnapshot(resolved.state), sim = snapshot.sim as Record<string, unknown>;
  expect(sim.centralBody).toBe('SUN'); expect(sim.stationPosKm).toBeNull();
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  expect(telemetry(resolved.state.sim!).flight).toBeNull();
  const last = history(resolved.state.sim!).at(-1)!;
  expect(Math.hypot(...last.positionKm) / 149598000).toBeGreaterThan(0.95);
 });
});
