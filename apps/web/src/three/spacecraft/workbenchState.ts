import { create } from 'zustand';
import type { OrbitChoice } from '@astrix/core';

export interface WorkbenchState {
  hoveredCategory: string | null;
  selectedCategory: string | null;
  /** Component whose details panel is open; viewing never changes the design or the flight. */
  inspectedPartId: string | null;
  previewPartId: string | null;
  previewOrbit: OrbitChoice | null;
  exploded: boolean;
  dimensions: boolean;
  turntable: boolean;
  setHoveredCategory(category: string | null): void;
  selectCategory(category: string | null): void;
  setPreviewPartId(partId: string | null): void;
  inspect(partId: string | null): void;
  setExploded(exploded: boolean): void;
  setPreviewOrbit(orbit: OrbitChoice | null): void;
  setDimensions(dimensions: boolean): void;
  setTurntable(turntable: boolean): void;
}

/** Device-local presentation only: never installs equipment or changes attitude. */
export const useWorkbench = create<WorkbenchState>(set => ({
  hoveredCategory: null,
  selectedCategory: null,
  previewPartId: null,
  inspectedPartId: null,
  exploded: false,
  dimensions: false,
  previewOrbit: null,
  turntable: false,
  setHoveredCategory: hoveredCategory => set({ hoveredCategory }),
  selectCategory: selectedCategory => set({ selectedCategory }),
  setPreviewPartId: previewPartId => set({ previewPartId }),
  inspect: inspectedPartId => set({ inspectedPartId }),
  setExploded: exploded => set({ exploded }),
  setDimensions: dimensions => set({ dimensions }),
  setTurntable: turntable => set({ turntable }),
  setPreviewOrbit: previewOrbit => set({ previewOrbit }),
}));
