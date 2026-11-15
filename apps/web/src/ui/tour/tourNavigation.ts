// Copied from Void Protocol components/ui/tourNavigation.ts, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
/** Navigation remains available whether or not the current target is mounted. */
export function tourNavigation(index: number, total: number, action: 'back' | 'next'): { index: number; finish: boolean } {
    if (action === 'back') return { index: Math.max(0, index - 1), finish: false };
    return index >= total - 1 ? { index, finish: true } : { index: index + 1, finish: false };
}
