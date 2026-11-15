import { exportMissionDefinition, importMissionDefinition, validateMissionDefinition, MAX_DEFINITION_BYTES, type DefinitionIssue, type MissionDefinition, type ResolvedMissionDefinition } from '@astrix/core';

/**
 * Device-local mission library. Drafts are mutable working copies; published revisions are immutable, validated,
 * append-only snapshots. Every operation reports storage failure instead of pretending to have saved.
 */
export const LIBRARY_KEY = 'astrix.missions.v1';
export const LIBRARY_FORMAT = 'astrix.mission-library';
export const LIBRARY_VERSION = 1;
export const MAX_LIBRARY_ENTRIES = 40;
export const MAX_PUBLISHED_REVISIONS = 12;

/** A draft is a raw definition the studio may hold in an invalid state; it is never executable until validated. */
export type DraftDefinition = MissionDefinition;
export interface PublishedRevision { readonly revision: number; readonly digest: string; readonly savedAt: number; readonly definition: DraftDefinition }
export interface LibraryEntry { readonly id: string; readonly updatedAt: number; readonly draft: DraftDefinition; readonly published: readonly PublishedRevision[] }
export type LibraryErrorCode = 'UNAVAILABLE' | 'QUOTA' | 'CORRUPT' | 'INVALID' | 'FULL' | 'REVISION_FULL' | 'NOT_FOUND' | 'TOO_LARGE' | 'WRITE_FAILED';
export interface LibraryError { readonly code: LibraryErrorCode; readonly detail?: string; readonly issues?: readonly DefinitionIssue[] }
export type LibraryResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: LibraryError };
type LibraryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const ok = <T,>(value: T): LibraryResult<T> => ({ ok: true, value });
const fail = (code: LibraryErrorCode, detail?: string, issues?: readonly DefinitionIssue[]): LibraryResult<never> => ({ ok: false, error: { code, ...(detail ? { detail } : {}), ...(issues ? { issues } : {}) } });

function storageOf(storage?: LibraryStorage): LibraryStorage | null {
  if (storage) return storage;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
const isQuota = (error: unknown) => error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

/** The raw form of a resolved definition: the content digest is recomputed by the engine and never stored in drafts. */
export function toDraft(definition: DraftDefinition | ResolvedMissionDefinition): DraftDefinition {
  const copy = structuredClone(definition);
  if ('digest' in copy) { const { digest: _recomputedByEngine, ...raw } = copy; return raw; }
  return copy;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function parseEntry(raw: unknown): LibraryEntry | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.draft) || raw.draft.id !== raw.id || typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt) || !Array.isArray(raw.published)) return null;
  const draft = raw.draft;
  const requiredObjects = ['name', 'description', 'objectiveSummary', 'vehicle', 'environment', 'start', 'trajectory', 'support', 'termination'];
  if (requiredObjects.some(key => !isRecord(draft[key])) || !Array.isArray(draft.objectives)) return null;
  const published: PublishedRevision[] = [];
  for (const item of raw.published) {
    if (!isRecord(item) || !Number.isSafeInteger(item.revision) || typeof item.digest !== 'string' || typeof item.savedAt !== 'number' || !Number.isFinite(item.savedAt)) return null;
    const checked = validateMissionDefinition(item.definition);
    if (!checked.ok || checked.definition.id !== raw.id || checked.definition.revision !== item.revision || checked.definition.digest !== item.digest) return null;
    published.push({ revision: checked.definition.revision, digest: checked.definition.digest, savedAt: item.savedAt, definition: toDraft(checked.definition) });
  }
  return { id: raw.id, updatedAt: raw.updatedAt, draft: raw.draft as unknown as DraftDefinition, published };
}
/** Reads the library. Corrupt storage is preserved under a `.corrupt` key (never overwritten silently) and reported. */
export function readLibrary(storage?: LibraryStorage): LibraryResult<readonly LibraryEntry[]> {
  const store = storageOf(storage);
  if (!store) return fail('UNAVAILABLE');
  let text: string | null;
  try { text = store.getItem(LIBRARY_KEY); } catch (error) { return fail('UNAVAILABLE', String(error)); }
  if (text === null) return ok([]);
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.format !== LIBRARY_FORMAT || raw.version !== LIBRARY_VERSION || !Array.isArray(raw.entries)) throw new Error('Unrecognised library format or version');
    const entries = raw.entries.map(parseEntry);
    if (entries.some(entry => !entry) || new Set(entries.map(entry => entry!.id)).size !== entries.length) throw new Error('A saved mission or revision is malformed');
    return ok(entries as LibraryEntry[]);
  } catch (error) {
    try { store.setItem(`${LIBRARY_KEY}.corrupt`, text); } catch { /* The report below still names the problem. */ }
    return fail('CORRUPT', error instanceof Error ? error.message : String(error));
  }
}
function writeLibrary(entries: readonly LibraryEntry[], storage?: LibraryStorage): LibraryResult<readonly LibraryEntry[]> {
  const store = storageOf(storage);
  if (!store) return fail('UNAVAILABLE');
  try { store.setItem(LIBRARY_KEY, JSON.stringify({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, entries })); return ok(entries); }
  catch (error) { return fail(isQuota(error) ? 'QUOTA' : 'WRITE_FAILED', error instanceof Error ? error.message : String(error)); }
}
/** Saves or replaces a draft by id. Never touches published revisions. */
export function saveDraft(draft: DraftDefinition, storage?: LibraryStorage, now = Date.now()): LibraryResult<readonly LibraryEntry[]> {
  const read = readLibrary(storage);
  if (!read.ok) return read;
  const entries = read.value;
  const existing = entries.find(entry => entry.id === draft.id);
  if (!existing && entries.length >= MAX_LIBRARY_ENTRIES) return fail('FULL', String(MAX_LIBRARY_ENTRIES));
  if (new TextEncoder().encode(JSON.stringify(draft)).length > MAX_DEFINITION_BYTES) return fail('TOO_LARGE', String(MAX_DEFINITION_BYTES));
  const next: LibraryEntry = { id: draft.id, updatedAt: now, draft: structuredClone(draft), published: existing?.published ?? [] };
  return writeLibrary(existing ? entries.map(entry => entry.id === draft.id ? next : entry) : [next, ...entries], storage);
}
export function deleteEntry(id: string, storage?: LibraryStorage): LibraryResult<readonly LibraryEntry[]> {
  const read = readLibrary(storage);
  if (!read.ok) return read;
  if (!read.value.some(entry => entry.id === id)) return fail('NOT_FOUND', id);
  return writeLibrary(read.value.filter(entry => entry.id !== id), storage);
}
/** Validates the draft and appends an immutable published revision. Invalid drafts publish nothing. */
export function publishDraft(id: string, storage?: LibraryStorage, now = Date.now()): LibraryResult<{ entries: readonly LibraryEntry[]; definition: ResolvedMissionDefinition }> {
  const read = readLibrary(storage);
  if (!read.ok) return read;
  const entry = read.value.find(item => item.id === id);
  if (!entry) return fail('NOT_FOUND', id);
  let draft = entry.draft, checked = validateMissionDefinition(draft);
  if (!checked.ok) return fail('INVALID', undefined, checked.issues);
  // Identical content is idempotent; every other publication follows the greatest stored revision.
  const checkedDigest = checked.definition.digest;
  if (entry.published.some(item => item.digest === checkedDigest)) return ok({ entries: read.value, definition: checked.definition });
  if (entry.published.length >= MAX_PUBLISHED_REVISIONS) return fail('REVISION_FULL', String(MAX_PUBLISHED_REVISIONS));
  const latestRevision = Math.max(0, ...entry.published.map(item => item.revision));
  if (checked.definition.revision <= latestRevision) {
    draft = { ...draft, revision: latestRevision + 1 };
    checked = validateMissionDefinition(draft);
    if (!checked.ok) return fail('INVALID', undefined, checked.issues);
  }
  const { definition } = checked;
  const published = [...entry.published, { revision: definition.revision, digest: definition.digest, savedAt: now, definition: toDraft(definition) }];
  const written = writeLibrary(read.value.map(item => item.id === id ? { ...item, draft, updatedAt: now, published } : item), storage);
  return written.ok ? ok({ entries: written.value, definition }) : written;
}
/** Draft id for an imported or duplicated mission that does not collide with an existing library id. */
export function freshId(base: string, taken: ReadonlySet<string>): string {
  const stem = base.replace(/-\d+$/, '').slice(0, 43);
  let n = 2;
  while (taken.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}
/** Strictly validated import. A collision never overwrites: the file becomes a copy with a fresh id. */
export function importMissionText(text: string, existing: readonly LibraryEntry[]): LibraryResult<{ draft: DraftDefinition; renamed: boolean }> {
  const result = importMissionDefinition(text);
  if (!result.ok) return fail('INVALID', undefined, result.issues);
  const draft = toDraft(result.definition), taken = new Set(existing.map(entry => entry.id));
  if (!taken.has(draft.id)) return ok({ draft, renamed: false });
  return ok({ draft: { ...draft, id: freshId(draft.id, taken), revision: 1, derivedFrom: { id: draft.id, digest: result.definition.digest } }, renamed: true });
}
/** Canonical export of the current draft; fails with its issues rather than writing an invalid file. */
export function exportDraftText(draft: DraftDefinition): LibraryResult<{ text: string; definition: ResolvedMissionDefinition }> {
  const checked = validateMissionDefinition(draft);
  if (!checked.ok) return fail('INVALID', undefined, checked.issues);
  return ok({ text: exportMissionDefinition(checked.definition), definition: checked.definition });
}
