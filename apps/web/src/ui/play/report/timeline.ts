import type { TurnMoment } from '../turnMoments';

export type ChipBadgeKind = 'data' | 'stored' | 'fuel' | 'energy';
export interface ChipBadge { kind: ChipBadgeKind; value: number; unit: 'MB' | 'kg' | 'Wh' }

/** Default selection: the last turn that captured or returned data, otherwise the last turn. */
export function defaultTurn(moments: readonly TurnMoment[]): number | null {
  for (let index = moments.length - 1; index >= 0; index--) if (moments[index]!.capturedMB > 0 || moments[index]!.deliveredMB > 0) return moments[index]!.index;
  return moments.at(-1)?.index ?? null;
}

/** The selected turn when it exists in this attempt, otherwise the default. */
export function effectiveTurn(moments: readonly TurnMoment[], selected: number | null): number | null {
  return selected !== null && moments.some(moment => moment.index === selected) ? selected : defaultTurn(moments);
}

/** Roving-tabindex step: arrows move one chip (no wrap), Home and End jump; other keys return null. */
export function rovingIndex(position: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  const next = key === 'ArrowRight' || key === 'ArrowDown' ? position + 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? position - 1 : key === 'Home' ? 0 : key === 'End' ? count - 1 : null;
  return next === null ? null : Math.min(count - 1, Math.max(0, next));
}

/** Up to two deltas worth showing on a chip, in priority order: data returned, data stored, fuel, energy. */
export function chipBadges(moment: TurnMoment): readonly ChipBadge[] {
  const candidates: ChipBadge[] = [
    { kind: 'data', value: moment.deliveredMB, unit: 'MB' },
    { kind: 'stored', value: Math.max(0, moment.delta.storedMB), unit: 'MB' },
    { kind: 'fuel', value: moment.delta.fuelKg, unit: 'kg' },
    { kind: 'energy', value: moment.delta.energyWh, unit: 'Wh' },
  ];
  return candidates.filter(badge => Math.abs(badge.value) >= .005).slice(0, 2);
}
