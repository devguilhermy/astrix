// Copied from Void Protocol (© Guilhermy), apps/web/src/rendering/pixelBudget.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
export type PixelBudgetState = { step: number; slow: number; fast: number; changedAt: number };
export const PIXEL_SCALES = [0.65, 0.8, 1] as const;

/** Only GPU timings drive this policy; a slow CPU frame never lowers resolution. */
export function stepPixelBudget(state: PixelBudgetState, gpuMs: number, now: number): PixelBudgetState {
    if (!Number.isFinite(gpuMs) || gpuMs < 0) return state;
    const slow = gpuMs > 12 ? state.slow + 1 : 0;
    const fast = gpuMs < 7 ? state.fast + 1 : 0;
    if (now - state.changedAt >= 5000) {
        if (slow >= 3 && state.step > 0) return { step: state.step - 1, slow: 0, fast: 0, changedAt: now };
        if (fast >= 10 && state.step < 2) return { step: state.step + 1, slow: 0, fast: 0, changedAt: now };
    }
    return { ...state, slow, fast };
}

export function pixelBudgetDpr(width: number, height: number, nativeDpr: number, step: number, pixelCap: number): number {
    return Math.min(nativeDpr * PIXEL_SCALES[step], Math.sqrt(pixelCap / Math.max(1, width * height)));
}
