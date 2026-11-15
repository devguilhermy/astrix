import { describe, expect, test } from 'bun:test';
import { digestOf, editAsCopy, missionById, validateMissionDefinition } from '@astrix/core';
import { createSession, reduceSession } from './reducer';
import { MAX_CLIENT_FRAME_BYTES, MAX_DEFINITION_FRAME_BYTES } from './contracts';
import { PROTOCOL_VERSION, messageByteLimit, parseClientMessage } from './protocol';
import type { SessionActor, SessionIntent, SessionState } from './contracts';

const host: SessionActor = { playerId: 'player-1', isHost: true, role: 'ALL' };
const draft = (unique: string) => editAsCopy(missionById('FIRST_LIGHT'), { name: `Copy ${unique}`, description: 'd', objectiveSummary: 's' }, { id: `user.copy-${unique}` });
const apply = (s: SessionState, intent: SessionIntent, actor: SessionActor = host) => reduceSession(s, intent, actor);
const started = (): SessionState => { const t = apply(createSession(), { kind: 'START_DEFINITION', definition: draft('a'), levelId: 'ASPIRING' }); if (!t.result.ok) throw new Error(JSON.stringify(t.result)); return t.state; };
const intentFrame = (intent: unknown) => JSON.stringify({ type: 'INTENT', id: 'm1', epoch: 'e', attemptId: 0, rosterRevision: 0, actor: { role: 'ALL' }, intent });

describe('starting missions', () => {
 test('PROTOCOL_VERSION is 2 and the old intent name is gone from the wire', () => {
  expect(PROTOCOL_VERSION).toBe(2);
  expect(parseClientMessage(intentFrame({ kind: 'START_SCENARIO', scenarioId: 'FIRST_LIGHT', levelId: 'ASPIRING' })).ok).toBe(false);
  expect(parseClientMessage(JSON.stringify({ type: 'HELLO', protocol: 1, buildId: 'b', lastSeq: 0 })).ok).toBe(false);
  expect(parseClientMessage(JSON.stringify({ type: 'HELLO', protocol: 2, buildId: 'b', lastSeq: 0 })).ok).toBe(true);
 });
 test('every built-in starts by id and the session carries its definition by reference', () => {
  for (const id of ['FIRST_LIGHT', 'UP_AND_BACK', 'EARTH_TO_MOON'] as const) {
   const t = apply(createSession(), { kind: 'START_MISSION', missionId: id, levelId: 'ASPIRING' });
   expect(t.result.ok).toBe(true);
   expect(t.state.definition).toBe(missionById(id));
   expect(t.state.design!.definition).toBe(t.state.definition);
  }
 });
 test('a custom definition is validated again by the reducer and rebuilt, never stored as sent', () => {
  const sent = JSON.parse(JSON.stringify(draft('b'))); sent.surprise = 1;
  const bad = apply(createSession(), { kind: 'START_DEFINITION', definition: sent, levelId: 'ASPIRING' });
  expect(bad.result.ok).toBe(false);
  if (!bad.result.ok) expect(bad.result.refusal.code).toBe('DEFINITION_INVALID');
  const s = started();
  expect(s.definition.origin).toBe('CUSTOM');
  expect(s.definition.digest).toBe(digestOf(s.definition));
  expect(s.design!.definitionDigest).toBe(s.definition.digest);
 });
 test('only the host may start missions in a shared room', () => {
  const lan = createSession({ mode: 'LAN', participantMode: 'TEAM' });
  const other: SessionActor = { playerId: 'player-2', role: 'SCIENCE' };
  const added = apply(lan, { kind: 'ADD_PLAYER', playerId: 'player-2', name: 'Two' }).state;
  const t = apply(added, { kind: 'START_DEFINITION', definition: draft('c'), levelId: 'ASPIRING' }, other);
  expect(t.result.ok).toBe(false);
 });
});

describe('submitting a revised definition', () => {
 const revised = (s: SessionState) => { const v = JSON.parse(JSON.stringify(s.definition)); v.revision = s.definition.revision + 1; v.name = { text: 'Renamed' }; return v; };
 test('a stale base digest is refused with DEFINITION_STALE and changes nothing', () => {
  const s = started(), t = apply(s, { kind: 'SUBMIT_DEFINITION', definition: revised(s), baseDigest: digestOf(missionById('FIRST_LIGHT')) });
  expect(t.result.ok).toBe(false);
  if (!t.result.ok) expect(t.result.refusal.code).toBe('DEFINITION_STALE');
  expect(t.state).toBe(s);
 });
 test('an accepted revision replaces the definition and discards everything earned against the old one', () => {
  let s = started();
  s = apply(s, { kind: 'CONFIRM_OBJECTIVE' }).state;
  expect(s.artifacts!.objectiveConfirmed).toBe(true);
  const before = s.design!.revision, t = apply(s, { kind: 'SUBMIT_DEFINITION', definition: revised(s), baseDigest: s.definition.digest });
  expect(t.result.ok).toBe(true);
  const n = t.state;
  expect(n.definition.revision).toBe(s.definition.revision + 1);
  expect(n.definition.digest).not.toBe(s.definition.digest);
  expect(n.design!.definition).toBe(n.definition);
  expect(n.design!.definitionDigest).toBe(n.definition.digest);
  expect(n.design!.revision).toBe(before + 1);
  expect(n.artifacts!.objectiveConfirmed).toBe(false);
  expect(n.approvals).toEqual([]);
  expect(n.quotes).toEqual({});
  expect(Object.values(n.signoffs).some(Boolean)).toBe(false);
  expect(n.activeStage).toBe('NEED_GOALS');
 });
 test('a revision cannot rename the mission or skip a revision number', () => {
  const s = started(), skip = revised(s); skip.revision += 1;
  expect(apply(s, { kind: 'SUBMIT_DEFINITION', definition: skip, baseDigest: s.definition.digest }).result.ok).toBe(false);
  const renamed = revised(s); renamed.id = 'user.someone-else';
  expect(apply(s, { kind: 'SUBMIT_DEFINITION', definition: renamed, baseDigest: s.definition.digest }).result.ok).toBe(false);
 });
 test('a built-in is never revised in place; it must be copied first', () => {
  const s = apply(createSession(), { kind: 'START_MISSION', missionId: 'FIRST_LIGHT', levelId: 'ASPIRING' }).state;
  const t = apply(s, { kind: 'SUBMIT_DEFINITION', definition: JSON.parse(JSON.stringify(s.definition)), baseDigest: s.definition.digest });
  expect(t.result.ok).toBe(false);
 });
 test('only the host or the granted author may submit', () => {
  let s = apply(createSession({ mode: 'LAN', participantMode: 'TEAM' }), { kind: 'START_DEFINITION', definition: draft('d'), levelId: 'ASPIRING' }).state;
  s = apply(s, { kind: 'ADD_PLAYER', playerId: 'player-2', name: 'Two' }).state;
  const other: SessionActor = { playerId: 'player-2', role: 'SCIENCE' }, intent = (): SessionIntent => ({ kind: 'SUBMIT_DEFINITION', definition: revised(s), baseDigest: s.definition.digest });
  const denied = apply(s, intent(), other);
  expect(denied.result.ok).toBe(false);
  if (!denied.result.ok) expect(denied.result.refusal.code).toBe('HOST_ONLY');
  expect(apply(s, { kind: 'GRANT_AUTHORING', playerId: 'ghost' }).result.ok).toBe(false);
  expect(apply(s, { kind: 'GRANT_AUTHORING', playerId: 'player-2' }, other).result.ok).toBe(false);
  const granted = apply(s, { kind: 'GRANT_AUTHORING', playerId: 'player-2' }).state;
  expect(apply(granted, intent(), other).result.ok).toBe(true);
  expect(apply(apply(granted, { kind: 'GRANT_AUTHORING', playerId: null }).state, intent(), other).result.ok).toBe(false);
 });
 test('approvals are fingerprinted over the definition and the design, so a revision invalidates them by content', () => {
  const s = started(), t = apply(s, { kind: 'SIGN_OFF', role: 'SCIENCE', designRevision: s.design!.revision, rosterRevision: s.rosterRevision });
  if (!t.result.ok) { expect(t.result.refusal.code).toBe('SIGNOFF_BLOCKED'); return; }
  const a = t.state.approvals[0];
  expect(a.dependencyFingerprint).toBe(digestOf({ role: 'SCIENCE', definition: s.definition.digest, design: s.design }));
  expect(a.dependencyFingerprint.length).toBeLessThan(100);
 });
});

describe('wire bounds', () => {
 test('only the two definition intents may exceed the ordinary frame size', () => {
  expect(messageByteLimit({ type: 'PING', nonce: 'x' })).toBe(MAX_CLIENT_FRAME_BYTES);
  expect(messageByteLimit({ type: 'INTENT', intent: { kind: 'LAUNCH' } })).toBe(MAX_CLIENT_FRAME_BYTES);
  expect(messageByteLimit({ type: 'INTENT', intent: { kind: 'START_DEFINITION' } })).toBe(MAX_DEFINITION_FRAME_BYTES);
  expect(messageByteLimit({ type: 'INTENT', intent: { kind: 'SUBMIT_DEFINITION' } })).toBe(MAX_DEFINITION_FRAME_BYTES);
  expect(MAX_CLIENT_FRAME_BYTES).toBe(8192);
  expect(MAX_DEFINITION_FRAME_BYTES).toBe(40960);
 });
 test('a definition frame above the ordinary limit parses; above the definition limit it does not', () => {
  const big = JSON.parse(JSON.stringify(draft('big'))); big.notes = 'n'.repeat(20000);
  const frame = intentFrame({ kind: 'START_DEFINITION', definition: big, levelId: 'ASPIRING' });
  expect(new TextEncoder().encode(frame).length).toBeGreaterThan(MAX_CLIENT_FRAME_BYTES);
  expect(parseClientMessage(frame).ok).toBe(true);
  big.notes = 'n'.repeat(45000);
  expect(parseClientMessage(intentFrame({ kind: 'START_DEFINITION', definition: big, levelId: 'ASPIRING' })).ok).toBe(false);
  // The reducer, not the parser, enforces the definition's own size and field rules.
  expect(validateMissionDefinition(big).ok).toBe(false);
 });
 test('multi-byte text is measured in UTF-8 bytes, not characters', () => {
  const big = JSON.parse(JSON.stringify(draft('utf'))); big.notes = 'é'.repeat(22000);
  const frame = intentFrame({ kind: 'START_DEFINITION', definition: big, levelId: 'ASPIRING' });
  expect(frame.length).toBeLessThan(MAX_DEFINITION_FRAME_BYTES);
  expect(new TextEncoder().encode(frame).length).toBeGreaterThan(MAX_DEFINITION_FRAME_BYTES);
  expect(parseClientMessage(frame).ok).toBe(false);
 });
 test('burn and ascent edits are rebuilt from checked fields and bounded', () => {
  const burn = { id: 'B1', source: 'SPACECRAFT', trigger: { kind: 'AT_TIME', tSec: 100 }, frame: 'VNR', dv: [0.1, 0, 0], model: 'IMPULSIVE' };
  expect(parseClientMessage(intentFrame({ kind: 'COMMANDS', commands: [{ kind: 'BURN_SCHEDULE', burn }] })).ok).toBe(true);
  expect(parseClientMessage(intentFrame({ kind: 'COMMANDS', commands: [{ kind: 'BURN_SCHEDULE', burn: { ...burn, dv: [50, 0, 0] } }] })).ok).toBe(false);
  expect(parseClientMessage(intentFrame({ kind: 'COMMANDS', commands: [{ kind: 'BURN_SCHEDULE', burn: { ...burn, extra: 1 } }] })).ok).toBe(false);
  expect(parseClientMessage(intentFrame({ kind: 'QUOTE_DESIGN', baseRevision: 0, edit: { kind: 'SET_BURNS', burns: Array.from({ length: 17 }, (_, i) => ({ ...burn, id: `B${i}` })) } })).ok).toBe(false);
  const program = { azimuthDeg: 90, verticalSec: 8, kickDeg: 10, kickSec: 10, stage1LoadFraction: 1, stage2CoastSec: 0, insertionAltKm: 200, holdUpperStage: false };
  expect(parseClientMessage(intentFrame({ kind: 'QUOTE_DESIGN', baseRevision: 0, edit: { kind: 'SET_ASCENT', program } })).ok).toBe(true);
  expect(parseClientMessage(intentFrame({ kind: 'QUOTE_DESIGN', baseRevision: 0, edit: { kind: 'SET_ASCENT', program: { ...program, kickDeg: 80 } } })).ok).toBe(false);
  expect(parseClientMessage(intentFrame({ kind: 'QUOTE_DESIGN', baseRevision: 0, edit: { kind: 'SET_LAUNCHER', launcherId: 'LV_NOPE' } })).ok).toBe(false);
 });
});

describe('hostile definition payloads are refused, never thrown', () => {
 const frame = (definition: string, kind: 'SUBMIT_DEFINITION' | 'START_DEFINITION' = 'SUBMIT_DEFINITION') => `{"type":"INTENT","id":"m","epoch":"e","attemptId":0,"rosterRevision":0,"actor":{"role":"ALL"},"intent":{"kind":"${kind}","definition":${definition},${kind === 'SUBMIT_DEFINITION' ? `"baseDigest":"sha256:${'0'.repeat(64)}"` : '"levelId":"ASPIRING"'}}}`;
 test('non-finite numbers (1e999 parses to Infinity) are rejected by the parser', () => {
  expect(parseClientMessage(frame('{"x":1}')).ok).toBe(true);
  expect(parseClientMessage(frame('{"x":1e999}')).ok).toBe(false);
  expect(parseClientMessage(frame('{"x":1e999}', 'START_DEFINITION')).ok).toBe(false);
 });
 test('deep nesting that would overflow a recursive canonicaliser is rejected by an iterative bound', () => {
  const deep = '['.repeat(15000) + ']'.repeat(15000);
  expect(new TextEncoder().encode(frame(deep)).length).toBeLessThan(MAX_DEFINITION_FRAME_BYTES);
  expect(parseClientMessage(frame(`{"x":${deep}}`)).ok).toBe(false);
 });
 test('the reducer itself refuses an unfingerprintable payload instead of throwing', () => {
  const s = createSession();
  const hostile = { id: 'h', epoch: s.epoch, attemptId: s.attemptId, rosterRevision: s.rosterRevision, intent: { kind: 'START_DEFINITION', definition: { x: Number.POSITIVE_INFINITY }, levelId: 'ASPIRING' } } as const;
  const t = reduceSession(s, hostile as never, host);
  expect(t.result.ok).toBe(false);
  if (!t.result.ok) expect(t.result.refusal.code).toBe('BAD_MESSAGE');
  expect(t.state).toBe(s);
 });
});
