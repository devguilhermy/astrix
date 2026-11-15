import { create } from 'zustand';
import type { Trajectory } from '@astrix/core/interop/gmat';

interface ViewerState {
 active: boolean; trajectory: Trajectory | null; time: number; playing: boolean;
 open(trajectory: Trajectory): void; exit(): void; seek(time: number): void; play(playing: boolean): void;
}
export const trajectoryViewer = create<ViewerState>(set => ({
 active:false, trajectory:null, time:0, playing:false,
 open: trajectory => set({active:true, trajectory, time:trajectory.segments[0].samples[0].time, playing:false}),
 exit: () => set({active:false, trajectory:null, playing:false}),
 seek: time => set(state => {
  if (!state.active || !state.trajectory || !Number.isFinite(time)) return state;
  const segments = state.trajectory.segments, first = segments[0].samples[0].time, last = segments[segments.length-1].samples.at(-1)!.time;
  return {time: Math.max(first,Math.min(last,time))};
 }), play: playing => set(state => state.active ? {playing} : state),
}));
