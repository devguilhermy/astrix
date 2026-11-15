import { missionById } from '@astrix/core';
import { toDraft, type DraftDefinition } from './library';

/** A complete, valid starting point for a new mission: the shortest learning mission with its learning profile removed. */
export function blankDraft(): DraftDefinition {
  const base = toDraft(missionById('FIRST_SIGNAL')), { learning: _learning, ...rest } = base;
  return { ...rest, id: 'user.untitled', revision: 1, origin: 'CUSTOM', derivedFrom: null, name: { text: '' }, description: { text: '' }, objectiveSummary: { text: '' }, objectives: base.objectives.map(objective => ({ ...objective, label: { text: '' } })) };
}
export function slugId(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `user.${slug.length >= 3 ? slug : slug ? `${slug}-m` : 'untitled'}`;
}
