import { create } from 'zustand';
import type { Vec3 } from './flightState';

/** Recorded actual path, one point per accepted state sample. Cleared for every new attempt; never extended by prediction. */
const MAX_POINTS = 1600;
interface TrailState { key: string; points: readonly Vec3[]; times: readonly number[]; push(key: string, t: number, point: Vec3, minSpacingKm: number): void; clear(): void }
export const useFlightTrail = create<TrailState>((set, get) => ({
  key: '', points: [], times: [],
  push(key, t, point, minSpacingKm) {
    const state = get();
    if (state.key !== key) { set({ key, points: [point], times: [t] }); return; }
    const last = state.points.at(-1), lastTime = state.times.at(-1) ?? -1;
    if (t <= lastTime) { if (t < lastTime - 1) set({ key, points: [point], times: [t] }); return; }
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1], point[2] - last[2]) < minSpacingKm) return;
    const points = [...state.points, point], times = [...state.times, t];
    if (points.length > MAX_POINTS) { points.splice(1, 1); times.splice(1, 1); }
    set({ points, times });
  },
  clear() { set({ key: '', points: [], times: [] }); },
}));
