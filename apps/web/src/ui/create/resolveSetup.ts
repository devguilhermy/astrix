import { validateMissionDefinition, type ResolvedMissionDefinition } from '@astrix/core';
import { builtinDefinition, type SetupDraft } from '../screens/Wizard';
import { readLibrary, type LibraryError } from './library';

export type SetupResolution = { readonly ok: true; readonly definition: ResolvedMissionDefinition } | { readonly ok: false; readonly error: LibraryError };
/**
 * Resolves the setup choice to an immutable definition at start time: a built-in as shipped, or a saved mission's
 * current draft (falling back to its latest published revision when the draft no longer validates).
 */
export function resolveSetupDefinition(draft: SetupDraft): SetupResolution {
  const builtin = builtinDefinition(draft);
  if (builtin) return { ok: true, definition: builtin };
  if (draft.track !== 'CREATE' || !draft.mission) return { ok: false, error: { code: 'NOT_FOUND', detail: String(draft.mission) } };
  const library = readLibrary();
  if (!library.ok) return { ok: false, error: library.error };
  const entry = library.value.find(item => item.id === draft.mission);
  if (!entry) return { ok: false, error: { code: 'NOT_FOUND', detail: draft.mission } };
  const current = validateMissionDefinition(entry.draft);
  if (current.ok) return { ok: true, definition: current.definition };
  const latest = entry.published.at(-1);
  if (latest) { const published = validateMissionDefinition(latest.definition); if (published.ok) return { ok: true, definition: published.definition }; }
  return { ok: false, error: { code: 'INVALID', issues: current.issues } };
}
