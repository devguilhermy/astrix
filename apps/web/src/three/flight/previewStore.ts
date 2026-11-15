import { create } from 'zustand';
import type { AscentPreview, BurnPreview, TrajectoryForecast } from '@astrix/core';

/**
 * Device-local candidate previews computed in a Worker from a design revision. The scene draws them as dashed
 * predictions, visually distinct from the recorded path; they never affect authority.
 */
interface FlightPreviewState {
  revision: number | null;
  ascent: AscentPreview | null;
  forecast: TrajectoryForecast | null;
  burn: BurnPreview | null;
  setAscent(revision: number, ascent: AscentPreview | null): void;
  setForecast(revision: number, forecast: TrajectoryForecast | null): void;
  setBurn(burn: BurnPreview | null): void;
  clear(): void;
}
export const useFlightPreview = create<FlightPreviewState>(set => ({
  revision: null, ascent: null, forecast: null, burn: null,
  setAscent: (revision, ascent) => set({ revision, ascent }),
  setForecast: (revision, forecast) => set({ revision, forecast }),
  setBurn: burn => set({ burn }),
  clear: () => set({ revision: null, ascent: null, forecast: null, burn: null }),
}));
