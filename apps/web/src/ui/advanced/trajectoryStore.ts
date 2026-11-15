import { create } from 'zustand';
import type { OrbitChoice } from '@astrix/core';
import type { Trajectory } from '@astrix/core/interop/gmat';
import { subjectRange } from '../../three/gmat/geometry';

/** What the 3D view shows on the GMAT tools page: external samples, or one conic initial state. Display only. */
export type GmatSubject =
 | { kind: 'trajectory'; trajectory: Trajectory; origin: 'import' }
 | { kind: 'orbit'; orbit: OrbitChoice; label: string; origin: 'import' | 'export' };

/** Simulated seconds per real second. */
export const PLAYBACK_SPEEDS = [10, 60, 600, 3600, 21600] as const;

interface ViewerState {
 subject: GmatSubject | null; time: number; playing: boolean; speed: number;
 show(subject: GmatSubject): void; exit(): void; seek(time: number): void; play(playing: boolean): void; setSpeed(speed: number): void;
}
/** Starts with roughly a 30-second play-through of the subject. */
function defaultSpeed(subject: GmatSubject): number {
 const [start, end] = subjectRange(subject), target = (end - start) / 1000 / 30;
 return PLAYBACK_SPEEDS.reduce((best, speed) => Math.abs(Math.log(speed / target)) < Math.abs(Math.log(best / target)) ? speed : best);
}
export const trajectoryViewer = create<ViewerState>(set => ({
 subject:null, time:0, playing:false, speed:PLAYBACK_SPEEDS[1],
 show: subject => set({subject, time:subjectRange(subject)[0], playing:false, speed:defaultSpeed(subject)}),
 exit: () => set({subject:null, playing:false}),
 seek: time => set(state => {
  if (!state.subject || !Number.isFinite(time)) return state;
  const [first, last] = subjectRange(state.subject);
  return {time: Math.max(first, Math.min(last, time))};
 }),
 play: playing => set(state => state.subject ? {playing} : state),
 setSpeed: speed => set({speed}),
}));
