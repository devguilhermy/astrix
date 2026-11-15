import { describe, expect, test } from 'bun:test';
import { BUILTIN_DEFINITIONS } from './builtins';
import { digestOf } from './digest';
import { createStarterDesign, editAsCopy, exportMissionDefinition, importMissionDefinition, listMissions, missionById, reviseDefinition } from './library';
import { validateMissionDefinition } from './validate';
import { launchReadiness } from '../design';

const copy = (id = 'FIRST_LIGHT', unique = 'a') => editAsCopy(missionById(id as 'FIRST_LIGHT'), { name: `Mine ${unique}`, description: 'A copy', objectiveSummary: 'Do it', objectiveLabels: {} }, { id: `user.copy-${unique}` });
const clone = (value: unknown): Record<string, any> => structuredClone(value) as Record<string, any>;

describe('built-in definitions', () => {
 test('twelve missions: the four legacy presets keep their identity and the learning ladder follows', () => {
  expect(listMissions().map(d => d.id)).toEqual(['FIRST_LIGHT', 'STORM_WATCH', 'RED_RELAY', 'CREW_PATHFINDER', 'FIRST_SIGNAL', 'UP_AND_BACK', 'STAY_IN_ORBIT', 'RAISE_YOUR_ORBIT', 'LEAVE_ORBIT_SAFELY', 'PAST_EARTH', 'MEET_THE_MOON', 'EARTH_TO_MOON']);
  expect(listMissions({ origin: 'BUILTIN' }).length + listMissions({ origin: 'LEARNING' }).length).toBe(12);
 });
 test('each is frozen, self-consistent and validates to itself', () => {
  for (const d of BUILTIN_DEFINITIONS) {
   expect(Object.isFrozen(d)).toBe(true);
   expect(d.digest).toBe(digestOf(d));
   const result = validateMissionDefinition(d);
   expect(result.ok).toBe(true);
   if (result.ok) expect(result.definition).toBe(d);
  }
 });
 test('no built-in is visual-only: every definition names at least one required physical objective', () => {
  for (const d of BUILTIN_DEFINITIONS) expect(d.objectives.some(o => o.required)).toBe(true);
 });
 test('starter designs embed the definition by reference and carry its digest', () => {
  for (const d of BUILTIN_DEFINITIONS) { const design = createStarterDesign(d, 'ASPIRING'); expect(design.definition).toBe(d); expect(design.definitionDigest).toBe(d.digest); expect(design.missionId).toBe(d.id); }
 });
 test('surface-launch learning missions start from a launcher and program, never a pre-chosen orbit', () => {
  for (const id of ['UP_AND_BACK', 'STAY_IN_ORBIT', 'EARTH_TO_MOON'] as const) { const design = createStarterDesign(missionById(id), 'ASPIRING'); expect(design.orbit).toBeNull(); expect(design.rideId).toBeNull(); expect(design.launch).not.toBeNull(); }
 });
 test('a surface-launch design is judged by its ascent, not by whether an orbit was selected', () => {
  const design = createStarterDesign(missionById('STAY_IN_ORBIT'), 'ASPIRING'), refusals = launchReadiness(design, { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true });
  expect(refusals.some(r => r.code === 'NOT_READY' && (r.values.missing === 'orbit' || r.values.missing === 'ride'))).toBe(false);
  expect(refusals.some(r => r.code === 'RIDE_MISMATCH' || r.code === 'ORBIT_NOT_OFFERED')).toBe(false);
 });
});

describe('custom definitions: validation, identity and import', () => {
 test('a copy of a built-in is a valid CUSTOM mission with a content digest and provenance', () => {
  const result = validateMissionDefinition(copy());
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const d = result.definition;
  expect(d.origin).toBe('CUSTOM');
  expect(d.derivedFrom?.id).toBe('FIRST_LIGHT');
  expect(d.digest).toBe(digestOf(d));
  expect(Object.isFrozen(d)).toBe(true);
 });
 test('a supplied digest is ignored, never trusted', () => {
  const draft = clone(copy()); draft.digest = 'sha256:' + '0'.repeat(64);
  const result = validateMissionDefinition(draft);
  expect(result.ok && result.definition.digest !== draft.digest).toBe(true);
 });
 test('changing any goal changes the digest', () => {
  const a = validateMissionDefinition(copy()), draft = clone(copy());
  draft.objectives[0].spec.targetMB = draft.objectives[0].spec.targetMB + 1;
  const b = validateMissionDefinition(draft);
  expect(a.ok && b.ok && a.definition.digest !== b.definition.digest).toBe(true);
 });
 test('a forged built-in identity or origin is refused instead of inheriting preset standing', () => {
  const edited = clone(missionById('FIRST_LIGHT')); edited.objectives[0].spec.targetMB = 1;
  const result = validateMissionDefinition(edited);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.some(i => i.code === 'CONTRADICTION')).toBe(true);
  const relabelled = clone(copy('FIRST_LIGHT', 'z')); relabelled.origin = 'LEARNING';
  expect(validateMissionDefinition(relabelled).ok).toBe(false);
  const squatter = clone(copy('FIRST_LIGHT', 'y')); squatter.id = 'FIRST_LIGHT';
  expect(validateMissionDefinition(squatter).ok).toBe(false);
 });
 test('every problem is reported with a path and the validator never throws on hostile input', () => {
  for (const hostile of [null, 1, 'x', [], {}, { schema: 1 }, clone(copy()).vehicle, JSON.parse('{"__proto__":{"x":1}}')]) { const r = validateMissionDefinition(hostile); expect(r.ok).toBe(false); if (!r.ok) expect(r.issues.length).toBeGreaterThan(0); }
  const draft = clone(copy()); draft.vehicle.budget = -5; draft.environment.durationSec = 0; draft.objectives = [];
  const r = validateMissionDefinition(draft);
  expect(r.ok).toBe(false);
  if (!r.ok) { const paths = r.issues.map(i => i.path); expect(paths.some(p => p.startsWith('vehicle'))).toBe(true); expect(paths.some(p => p.startsWith('environment'))).toBe(true); expect(paths.some(p => p.startsWith('objectives'))).toBe(true); }
 });
 test('unknown fields are rejected, not silently dropped', () => {
  const draft = clone(copy()); draft.surprise = true;
  expect(validateMissionDefinition(draft).ok).toBe(false);
 });
 test('oversized definitions are refused by size before any structure is trusted', () => {
  const draft = clone(copy()); draft.notes = 'x'.repeat(40000);
  const r = validateMissionDefinition(draft);
  expect(r.ok).toBe(false);
 });
 test('a second delivered-product goal is refused: it would double count one pool of observations', () => {
  const draft = clone(copy()); draft.objectives.push({ ...structuredClone(draft.objectives[0]), id: 'second' });
  expect(validateMissionDefinition(draft).ok).toBe(false);
 });
});

describe('export, import and revision', () => {
 test('export then import reproduces the identical definition and digest', () => {
  const made = validateMissionDefinition(copy('STORM_WATCH', 'rt'));
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const back = importMissionDefinition(exportMissionDefinition(made.definition));
  expect(back.ok).toBe(true);
  if (back.ok) { expect(back.definition.digest).toBe(made.definition.digest); expect(exportMissionDefinition(back.definition)).toBe(exportMissionDefinition(made.definition)); }
 });
 test('an unsupported envelope schema is refused with a typed issue', () => {
  const made = validateMissionDefinition(copy());
  if (!made.ok) throw new Error('fixture');
  const file = JSON.parse(exportMissionDefinition(made.definition));
  const wrong = importMissionDefinition(JSON.stringify({ ...file, schema: 2 }));
  expect(wrong.ok).toBe(false);
  if (!wrong.ok) expect(wrong.issues[0]).toMatchObject({ path: '$.schema', code: 'SCHEMA_VERSION' });
  expect(importMissionDefinition(JSON.stringify({ ...file, format: 'other' })).ok).toBe(false);
  expect(importMissionDefinition(JSON.stringify({ ...file, extra: 1 })).ok).toBe(false);
  expect(importMissionDefinition('{').ok).toBe(false);
  expect(importMissionDefinition('x'.repeat(40000)).ok).toBe(false);
 });
 test('importing an exact built-in yields the shared built-in, never an editable preset', () => {
  const back = importMissionDefinition(exportMissionDefinition(missionById('UP_AND_BACK')));
  expect(back.ok && back.definition === missionById('UP_AND_BACK')).toBe(true);
 });
 test('a revision keeps identity, advances the revision by exactly one and must be CUSTOM', () => {
  const made = validateMissionDefinition(copy('FIRST_LIGHT', 'rev'));
  if (!made.ok) throw new Error('fixture');
  const next = clone(made.definition); next.revision = 2; next.name = { text: 'Renamed' };
  const ok = reviseDefinition(made.definition, next);
  expect(ok.ok).toBe(true);
  expect(reviseDefinition(made.definition, { ...next, revision: 5 }).ok).toBe(false);
  expect(reviseDefinition(made.definition, { ...next, id: 'user.other' }).ok).toBe(false);
  expect(reviseDefinition(missionById('FIRST_LIGHT'), clone(missionById('FIRST_LIGHT'))).ok).toBe(false);
  expect(reviseDefinition(made.definition, clone(missionById('FIRST_LIGHT'))).ok).toBe(false);
 });
 test('copies of the same source get distinct identities when the caller supplies them', () => {
  expect(copy('FIRST_LIGHT', 'one').id).not.toBe(copy('FIRST_LIGHT', 'two').id);
  expect(editAsCopy(missionById('FIRST_LIGHT'), { name: 'n', description: 'd', objectiveSummary: 's' }).id).toBe(editAsCopy(missionById('FIRST_LIGHT'), { name: 'n', description: 'd', objectiveSummary: 's' }).id);
 });
});
