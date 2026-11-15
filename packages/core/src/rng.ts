// Adapted from Void Protocol (© Guilhermy), packages/shared/src/world/terrain/terrainNoise.ts @ 218625d, mulberry32 only.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
// The closure was replaced by an explicit integer state so flight saves are clone-safe.
export function next(state: number): readonly [number, number] {
 const nextState = (state + 0x6D2B79F5) >>> 0;
 let t = nextState;
 t = Math.imul(t ^ (t >>> 15), t | 1);
 t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
 return [((t ^ (t >>> 14)) >>> 0) / 4294967296, nextState];
}
