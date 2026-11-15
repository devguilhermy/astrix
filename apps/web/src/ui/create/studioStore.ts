import { create } from 'zustand';
import { editAsCopy, type ResolvedMissionDefinition } from '@astrix/core';
import { freshId, readLibrary, toDraft, type DraftDefinition } from './library';
import type { TFunction } from 'i18next';
import i18n from '../../i18n/config';
import { labelText } from '../missions/definitionView';

/** A request, from anywhere in the app, to open the studio with a draft (e.g. "Edit this mission" in a report). */
interface StudioRequest { readonly request: { readonly draft: DraftDefinition } | null; open(draft: DraftDefinition): void; clear(): void }
export const useStudioRequest = create<StudioRequest>(set => ({ request: null, open: draft => set({ request: { draft } }), clear: () => set({ request: null }) }));

/** Copy the visible localized brief and avoid replacing an independently saved mission. */
export function editableCopy(definition: ResolvedMissionDefinition, t: TFunction): DraftDefinition {
  const draft = editAsCopy(definition, {
    name: labelText(t, definition.name),
    description: labelText(t, definition.description),
    objectiveSummary: labelText(t, definition.objectiveSummary),
    objectiveLabels: Object.fromEntries(definition.objectives.map(objective => [objective.id, labelText(t, objective.label)])),
  });
  const library = readLibrary(), taken = new Set(library.ok ? library.value.map(entry => entry.id) : []);
  return taken.has(draft.id) ? { ...draft, id: freshId(draft.id, taken) } : draft;
}
/** Custom missions continue as the same mission (a new revision on publish); everything else becomes an editable copy. */
export function openEditorFor(definition: ResolvedMissionDefinition): void {
  useStudioRequest.getState().open(definition.origin === 'CUSTOM' ? toDraft(definition) : editableCopy(definition, i18n.t));
}
