import { describe, expect, test } from 'bun:test';
import { editAsCopy, missionById } from '@astrix/core';
import { LIBRARY_KEY, deleteEntry, exportDraftText, freshId, importMissionText, publishDraft, readLibrary, saveDraft, toDraft, type DraftDefinition } from './library';

function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const sample = (id = 'user.sample'): DraftDefinition => toDraft(editAsCopy(missionById('FIRST_SIGNAL'), {name:'Sample mission',description:'Return a camera observation.',objectiveSummary:'Deliver the required data.'}, {id}));

describe('mission library persistence', () => {
  test('a saved draft is read back unchanged and the first read of empty storage is empty', () => {
    const storage = memory();
    const empty = readLibrary(storage);
    expect(empty.ok && empty.value).toEqual([]);
    const saved = saveDraft(sample(), storage, 10);
    expect(saved.ok).toBe(true);
    const read = readLibrary(storage);
    if (!read.ok) throw new Error(read.error.code);
    expect(read.value).toHaveLength(1);
    expect(read.value[0]?.draft).toEqual(sample());
    expect(read.value[0]?.updatedAt).toBe(10);
  });
  test('saving replaces a draft with the same id and keeps its published revisions', () => {
    const storage = memory();
    saveDraft(sample(), storage, 1);
    const published = publishDraft('user.sample', storage, 2);
    if (!published.ok) throw new Error(JSON.stringify(published.error));
    saveDraft({ ...sample(), notes: 'edited' }, storage, 3);
    const read = readLibrary(storage);
    if (!read.ok) throw new Error(read.error.code);
    expect(read.value).toHaveLength(1);
    expect(read.value[0]?.published).toHaveLength(1);
    expect(read.value[0]?.draft.notes).toBe('edited');
  });
  test('publishing changed content under a published revision number creates the next revision', () => {
    const storage = memory();
    saveDraft(sample(), storage, 1);
    publishDraft('user.sample', storage, 2);
    saveDraft({ ...sample(), name: { text: 'Renamed' } }, storage, 3);
    const second = publishDraft('user.sample', storage, 4);
    if (!second.ok) throw new Error(JSON.stringify(second.error));
    expect(second.value.definition.revision).toBe(2);
    const read = readLibrary(storage);
    if (!read.ok) throw new Error(read.error.code);
    expect(read.value[0]?.published.map(item => item.revision)).toEqual([1, 2]);
  });
  test('a quota failure is reported and nothing is claimed saved', () => {
    const storage = { ...memory(), setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    const result = saveDraft(sample(), storage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('QUOTA');
  });
  test('other write failures are distinct from quota', () => {
    const storage = { ...memory(), setItem: () => { throw new Error('denied'); } };
    const result = saveDraft(sample(), storage);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('WRITE_FAILED');
  });
  test('unavailable storage is reported on every operation', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    for (const result of [readLibrary(storage), saveDraft(sample(), storage), deleteEntry('x', storage)]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('UNAVAILABLE');
    }
  });
  test('corrupt storage is reported, preserved under a backup key and never overwritten silently', () => {
    const storage = memory({ [LIBRARY_KEY]: '{not json' });
    const read = readLibrary(storage);
    if (read.ok) throw new Error('expected corruption');
    expect(read.error.code).toBe('CORRUPT');
    expect(storage.values.get(`${LIBRARY_KEY}.corrupt`)).toBe('{not json');
    expect(storage.values.get(LIBRARY_KEY)).toBe('{not json');
    const saved = saveDraft(sample(), storage);
    expect(saved.ok).toBe(false);
    expect(storage.values.get(LIBRARY_KEY)).toBe('{not json');
  });
  test('an unknown library version is treated as corrupt rather than migrated blindly', () => {
    const storage = memory({ [LIBRARY_KEY]: JSON.stringify({ format: 'astrix.mission-library', version: 99, entries: [] }) });
    const read = readLibrary(storage);
    if (read.ok) throw new Error('expected corruption');
    expect(read.error.code).toBe('CORRUPT');
  });
  test('a malformed saved entry is reported instead of disappearing on the next save', () => {
    const raw = JSON.stringify({ format: 'astrix.mission-library', version: 1, entries: [{ id: 'user.lost', draft: {}, published: [], updatedAt: 1 }] });
    const storage = memory({ [LIBRARY_KEY]: raw });
    const read = readLibrary(storage);
    expect(read.ok).toBe(false);
    expect(saveDraft(sample(), storage).ok).toBe(false);
    expect(storage.values.get(LIBRARY_KEY)).toBe(raw);
  });
  test('publishing an older draft follows the latest revision even without a revision-number clash', () => {
    const storage = memory();
    saveDraft({ ...sample(), revision: 4 }, storage);
    expect(publishDraft('user.sample', storage).ok).toBe(true);
    saveDraft({ ...sample(), revision: 2, notes: 'new content from an older draft' }, storage);
    const published = publishDraft('user.sample', storage);
    if (!published.ok) throw new Error(JSON.stringify(published.error));
    expect(published.value.definition.revision).toBe(5);
    expect(published.value.entries[0]?.published.map(item => item.revision)).toEqual([4, 5]);
  });
  test('deleting an unknown id reports NOT_FOUND', () => {
    const storage = memory();
    saveDraft(sample(), storage);
    const gone = deleteEntry('user.other', storage);
    if (gone.ok) throw new Error('expected failure');
    expect(gone.error.code).toBe('NOT_FOUND');
    const removed = deleteEntry('user.sample', storage);
    expect(removed.ok && removed.value).toEqual([]);
  });
});

describe('mission file import and export', () => {
  test('export then import round-trips the same content', () => {
    const exported = exportDraftText(sample());
    if (!exported.ok) throw new Error(JSON.stringify(exported.error));
    const imported = importMissionText(exported.value.text, []);
    if (!imported.ok) throw new Error(JSON.stringify(imported.error));
    expect(imported.value.renamed).toBe(false);
    expect(imported.value.draft.id).toBe('user.sample');
    const again = exportDraftText(imported.value.draft);
    expect(again.ok && again.value.definition.digest).toBe(exported.value.definition.digest);
  });
  test('importing an id that already exists becomes a renamed copy with its origin recorded', () => {
    const storage = memory();
    saveDraft(sample(), storage);
    const existing = readLibrary(storage);
    if (!existing.ok) throw new Error(existing.error.code);
    const exported = exportDraftText(sample());
    if (!exported.ok) throw new Error(exported.error.code);
    const imported = importMissionText(exported.value.text, existing.value);
    if (!imported.ok) throw new Error(imported.error.code);
    expect(imported.value.renamed).toBe(true);
    expect(imported.value.draft.id).not.toBe('user.sample');
    expect(imported.value.draft.derivedFrom?.id).toBe('user.sample');
  });
  test('malformed, unknown-field and oversized files are rejected with issues and no draft', () => {
    for (const text of ['not json', '{"schema":"astrix.mission","version":999}', JSON.stringify({ ...sample(), surprise: 1 }), 'x'.repeat(2_000_000)]) {
      const result = importMissionText(text, []);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID');
    }
  });
  test('an invalid draft is never exported or published', () => {
    const invalid: DraftDefinition = { ...sample(), objectives: [] };
    expect(exportDraftText(invalid).ok).toBe(false);
    const storage = memory();
    saveDraft(invalid, storage);
    const published = publishDraft('user.sample', storage);
    expect(published.ok).toBe(false);
  });
  test('fresh ids never collide and stay within the id length limit', () => {
    expect(freshId('user.sample', new Set(['user.sample']))).toBe('user.sample-2');
    expect(freshId('user.sample-2', new Set(['user.sample', 'user.sample-2']))).toBe('user.sample-3');
    expect(freshId('user.' + 'a'.repeat(60), new Set()).length).toBeLessThanOrEqual(48);
    const long = 'user.' + 'a'.repeat(43), first = freshId(long, new Set([long]));
    const second = freshId(long, new Set([long, first]));
    expect(second).not.toBe(first);
    expect(second).not.toBe(long);
    expect(second.length).toBeLessThanOrEqual(48);
  });
});
