import { afterEach, describe, expect, test } from 'bun:test';
import { missionById } from '@astrix/core';
import { emptyDraft, type SetupDraft } from '../screens/Wizard';
import { LIBRARY_KEY, saveDraft, toDraft, type DraftDefinition } from './library';
import { resolveSetupDefinition } from './resolveSetup';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
function install(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[LIBRARY_KEY, initial]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } });
}
afterEach(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
const create = (mission: string | null): SetupDraft => ({ ...emptyDraft, track: 'CREATE', level: 'EXPERT', mission });
const custom = (id: string): DraftDefinition => ({ ...toDraft(missionById('FIRST_SIGNAL')), id, origin: 'CUSTOM', revision: 1 });

describe('setup resolution', () => {
  test('a shipped mission resolves to the shipped definition on the Challenge and Learn tracks', () => {
    for (const [track, id] of [['CHALLENGE', 'FIRST_LIGHT'], ['LEARN', 'FIRST_SIGNAL']] as const) {
      const result = resolveSetupDefinition({ ...emptyDraft, track, mission: id });
      expect(result.ok && result.definition.digest).toBe(missionById(id).digest);
    }
  });
  test('no choice resolves to NOT_FOUND rather than a default mission', () => {
    const result = resolveSetupDefinition({ ...emptyDraft, track: 'CHALLENGE', mission: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });
  test('a saved mission resolves to its current valid draft', () => {
    install();
    saveDraft(custom('user.mine'));
    const result = resolveSetupDefinition(create('user.mine'));
    expect(result.ok && result.definition.id).toBe('user.mine');
  });
  test('a missing saved mission and unavailable storage are visible errors', () => {
    install();
    const missing = resolveSetupDefinition(create('user.gone'));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
    Reflect.deleteProperty(globalThis, 'localStorage');
    const unavailable = resolveSetupDefinition(create('user.mine'));
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) expect(unavailable.error.code).toBe('UNAVAILABLE');
  });
  test('corrupt storage is reported and never resolves a mission', () => {
    install('{broken');
    const result = resolveSetupDefinition(create('user.mine'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CORRUPT');
  });
  test('an invalid saved draft reports its issues instead of flying', () => {
    install();
    saveDraft({ ...custom('user.bad'), objectives: [] });
    const result = resolveSetupDefinition(create('user.bad'));
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.error.code).toBe('INVALID'); expect(result.error.issues?.length).toBeGreaterThan(0); }
  });
});
