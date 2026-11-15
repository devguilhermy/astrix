// Adapted from Void Protocol (© Guilhermy), apps/web/src/rendering/AdaptivePixelBudget.tsx @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
import { useEffect } from 'react';
import { addEffect, addAfterEffect, useThree } from '@react-three/fiber';
import { pixelBudgetDpr, stepPixelBudget, type PixelBudgetState } from './pixelBudget';
import { useQualityProfile } from './quality';

export function AdaptivePixelBudget({ enabled }: { enabled: boolean }) {
    const { gl: renderer, setDpr, size } = useThree();
    const profile=useQualityProfile();
    useEffect(() => {
        if (!enabled) return;
        const gl = renderer.getContext();
        if (!(gl instanceof WebGL2RenderingContext)) return;
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) return; // No CPU-interval proxy for GPU pressure.
        let state: PixelBudgetState = { step: 2, slow: 0, fast: 0, changedAt: performance.now() };
        let query: WebGLQuery | null = null;
        let started = false;
        let last = -Infinity;
        const before = addEffect(() => {
            if (gl.isContextLost()) return;
            const now = performance.now();
            if (query && !started && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
                if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
                    state = stepPixelBudget(state, gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6, now);
                    setDpr(Math.max(1,pixelBudgetDpr(size.width, size.height, Math.min(window.devicePixelRatio || 1, profile.dprMax), state.step, 1920 * 1080)));
                }
                gl.deleteQuery(query); query = null;
            }
            // Never nest another subsystem's elapsed-time query.
            if (!query && now - last >= 500 && !gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
                query = gl.createQuery();
                if (query) { gl.beginQuery(ext.TIME_ELAPSED_EXT, query); started = true; last = now; }
            }
        });
        const after = addAfterEffect(() => {
            if (started && !gl.isContextLost()) gl.endQuery(ext.TIME_ELAPSED_EXT);
            started = false;
        });
        return () => {
            before(); after();
            if (started && !gl.isContextLost()) gl.endQuery(ext.TIME_ELAPSED_EXT);
            if (query) gl.deleteQuery(query);
        };
    }, [enabled, renderer, setDpr, size.width, size.height, profile.dprMax]);
    return null;
}
