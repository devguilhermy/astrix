import { create } from 'zustand';
import type { SceneKind } from '../missionScenes';

export type CameraMode = 'CHASE' | 'INSPECT' | 'MAP' | 'WORKBENCH' | 'CINEMATIC';
export const CAMERA_MODES: readonly CameraMode[] = ['CHASE', 'INSPECT', 'MAP', 'WORKBENCH', 'CINEMATIC'];
// Camera response constants adapted from Void Protocol 218625d,
// apps/web/src/constants/flightTuning.ts. Owner-authorized Apache-2.0 selected reuse.
export const CAMERA_UP_RESPONSE = 3.5;
export const CAMERA_DISTANCE_RESPONSE = 5;
export const CAMERA_RECENTER_RESPONSE = 2;
export const useCameraMode = create<{
 mode: CameraMode | null;
 source: 'AUTO' | 'USER';
 quickLook: boolean;
 setMode(mode: CameraMode, source?: 'AUTO' | 'USER'): void;
 cycle(): void;
 setQuickLook(active: boolean): void;
}>((set, get) => ({
 mode: null,
 source: 'AUTO',
 quickLook: false,
 setMode: (mode, source = 'USER') => set({ mode, source, quickLook: false }),
 cycle: () => set({ mode: CAMERA_MODES[(CAMERA_MODES.indexOf(get().mode ?? 'CHASE') + 1) % CAMERA_MODES.length], source: 'USER', quickLook: false }),
 setQuickLook: quickLook => set({ quickLook }),
}));

export function resolveCameraMode(mode: CameraMode | null, kind: SceneKind, warp: number, advancing: boolean, reducedMotion: boolean, source: 'AUTO' | 'USER' = 'AUTO'): CameraMode {
 if (kind === 'transfer' || advancing || ((kind === 'orbit' || kind === 'flight') && warp > 100)) return 'MAP';
 if (kind === 'assembly') return mode === 'MAP' ? 'MAP' : mode === 'CINEMATIC' && !reducedMotion ? 'CINEMATIC' : 'WORKBENCH';
 if (kind === 'launch') return reducedMotion ? 'INSPECT' : 'CINEMATIC';
 if ((kind === 'orbit' || kind === 'flight') && source === 'AUTO' && mode === 'WORKBENCH') return 'CHASE';
 const selected = mode ?? 'CHASE';
 return reducedMotion && selected === 'CINEMATIC' ? 'INSPECT' : selected;
}

export const isCloseShot = (mode: CameraMode, kind: SceneKind) => kind !== 'transfer' && mode !== 'MAP';
