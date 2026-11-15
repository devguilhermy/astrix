import { create } from 'zustand';
import type { HistorySample } from '@astrix/core';

interface ReviewPlayback {
 sample: HistorySample | null;
 select(sample: HistorySample): void;
 exit(): void;
}
/** Review-only display selection. Does not alter the flight, clock or result. */
export const reviewPlayback = create<ReviewPlayback>(set => ({
 sample: null,
 select: sample => set({sample}),
 exit: () => set({sample:null}),
}));
