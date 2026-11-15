import { create } from 'zustand';
import { Euler, Quaternion, Vector3 } from 'three';
import { planetPosition, type AttitudeQuaternion, type PointingMode } from '@astrix/core';
import { liveMission, useMission } from '../../store';

export const PILOT_INTERVAL_MS = 250;
export const PILOT_RADIANS_PER_PIXEL = .003;
export const PILOT_KEY_RATE_RAD_SEC = .8;
export type PilotAxis = 'pitchUp' | 'pitchDown' | 'yawLeft' | 'yawRight' | 'rollLeft' | 'rollRight';
export const usePilot = create<{
 enabled: boolean; target: AttitudeQuaternion | null; dragging: boolean;
 setEnabled(value: boolean): void;
}>((set) => ({ enabled: false, target: null, dragging: false, setEnabled: enabled => {
 if (!enabled) pilotInput.release();
 set({ enabled, dragging: false });
} }));

const attitude = new Quaternion();
const delta = new Quaternion();
const euler = new Euler(0, 0, 0, 'YXZ');
const actual = new Vector3();
const direction = new Vector3();
const held = new Set<PilotAxis>();
let gesture: string | null = null;
let nextGesture = 0;
let gestureGeneration = -1;
let dirty = false;
let sentAt = -Infinity;
let finalTimer: ReturnType<typeof setTimeout> | null = null;

export function pilotAllowed(): boolean {
 const state = useMission.getState();
 return state.activeStage === 'IMPLEMENT' && (state.actor() === 'ALL' || state.actor() === 'SPACECRAFT') && !!state.sim && !state.telemetry?.ended && !state.telemetry?.cruise && !state.telemetry?.capturePending && state.warp <= 10 && !state.pendingDecisions.length && !state.explanation && !state.handoff && !state.pauseReasons.some(reason => ['home', 'chooser', 'settings', 'tour', 'graphics', 'viewer'].includes(reason));
}
function start() {
 if (!pilotAllowed()) return;
 if (finalTimer !== null) { clearTimeout(finalTimer); finalTimer = null; }
 if (gesture && gestureGeneration !== liveMission.generation) { gesture = null; dirty = false; held.clear(); }
 if (gesture) return;
 const current = liveMission.telemetry?.attitude ?? useMission.getState().telemetry?.attitude;
 if (!current) return;
 attitude.fromArray(current.target);
 gesture = `pilot:${liveMission.generation}:${++nextGesture}`;
 if (gestureGeneration !== liveMission.generation) sentAt = -Infinity;
 gestureGeneration = liveMission.generation;
}
function send(now: number) {
 if (gesture && gestureGeneration !== liveMission.generation) { gesture = null; dirty = false; return; }
 if (!dirty || !gesture || !pilotAllowed()) return;
 if (now - sentAt < PILOT_INTERVAL_MS) return;
 const q: AttitudeQuaternion = [attitude.x, attitude.y, attitude.z, attitude.w];
 useMission.getState().command({ kind: 'ATTITUDE_TARGET', q }, gesture);
 usePilot.setState({ target: q });
 dirty = false;
 sentAt = now;
}
function turn(pitch: number, yaw: number, roll: number) {
 start();
 if (!gesture) return;
 delta.setFromEuler(euler.set(pitch, yaw, roll));
 attitude.multiply(delta).normalize();
 dirty = true;
}
function release() {
 held.clear();
 if (usePilot.getState().dragging) usePilot.setState({ dragging: false });
 if (!gesture) return;
 const now = performance.now();
 send(now);
 if (dirty && pilotAllowed()) {
  clearTimeout(finalTimer ?? undefined);
  finalTimer = setTimeout(() => { finalTimer = null; send(performance.now()); gesture = null; dirty = false; }, Math.max(0, PILOT_INTERVAL_MS - (now - sentAt)));
 } else { gesture = null; dirty = false; }
}
/** S1 anchors select ordinary POINT holds, not a render-side orientation shortcut. */
function snapToAnchor(): PointingMode | null {
 const state = useMission.getState(), telemetry = liveMission.telemetry ?? state.telemetry;
 if (!telemetry || !state.design || !pilotAllowed()) return null;
 let best: PointingMode | null = null, bestCosine = Math.cos(Math.PI / 12);
 const compare = (mode: PointingMode, x: number, y: number, z: number, panel = false) => {
  actual.set(panel ? 1 : 0, 0, panel ? 0 : 1).applyQuaternion(attitude);
  direction.set(x, y, z).normalize();
  const cosine = actual.dot(direction);
  if (cosine > bestCosine) { best = mode; bestCosine = cosine; }
 };
 compare('SUN', ...telemetry.sunDir, true);
 compare('TARGET', -telemetry.positionKm[0], -telemetry.positionKm[1], -telemetry.positionKm[2]);
 if (telemetry.stationPosKm) compare('EARTH', telemetry.stationPosKm[0] - telemetry.positionKm[0], telemetry.stationPosKm[1] - telemetry.positionKm[1], telemetry.stationPosKm[2] - telemetry.positionKm[2]);
 else if (state.design.scenarioId === 'CREW_PATHFINDER') compare('EARTH', -telemetry.positionKm[0], -telemetry.positionKm[1], -telemetry.positionKm[2]);
 else if (state.design.orbit?.body === 'MARS') {
  const earth = planetPosition('EARTH', telemetry.t, state.design.orbit.epochUTC), mars = planetPosition('MARS', telemetry.t, state.design.orbit.epochUTC);
  compare('EARTH', earth[0] - mars[0], earth[1] - mars[1], earth[2] - mars[2]);
 }
 return best;
}

/** Input routing/target-attitude pattern adapted from Void Protocol flightInput.ts
 * and flightTuning.ts @218625d; owner-authorized selected reuse under Apache-2.0.
 * No thrust, speed, boost or orbit controls are reused.
 */
export const pilotInput = {
 begin: start,
 drag(dx: number, dy: number) { turn(-dy * PILOT_RADIANS_PER_PIXEL, -dx * PILOT_RADIANS_PER_PIXEL, 0); send(performance.now()); },
 hold(axis: PilotAxis) {
  if (!pilotAllowed() || held.has(axis)) return;
  start();
  if (!gesture) return;
  held.add(axis);
  // A genuine quick tap can release before the next RAF. Preserve one frame's
  // angular intent immediately, then integrate continuously while it stays held.
  const nudge = PILOT_KEY_RATE_RAD_SEC / 60;
  turn(axis === 'pitchUp' ? nudge : axis === 'pitchDown' ? -nudge : 0,
   axis === 'yawLeft' ? nudge : axis === 'yawRight' ? -nudge : 0,
   axis === 'rollLeft' ? nudge : axis === 'rollRight' ? -nudge : 0);
  send(performance.now());
 },
 unhold(axis: PilotAxis) { held.delete(axis); if (!held.size) release(); },
 tick(now: number, wallDelta: number) {
  if (!pilotAllowed()) { if (gesture || held.size) release(); return; }
  if (held.size) {
   const dt = Math.min(.1, Math.max(0, wallDelta)) * PILOT_KEY_RATE_RAD_SEC;
   turn((Number(held.has('pitchUp')) - Number(held.has('pitchDown'))) * dt,
    (Number(held.has('yawLeft')) - Number(held.has('yawRight'))) * dt,
    (Number(held.has('rollLeft')) - Number(held.has('rollRight'))) * dt);
  }
  send(now);
 },
 finishDrag() {
  const anchor = snapToAnchor();
  if (anchor) {
   if (finalTimer !== null) { clearTimeout(finalTimer); finalTimer = null; }
   dirty = false; gesture = null; held.clear();
   useMission.getState().command({ kind: 'POINT', mode: anchor });
   usePilot.setState({ dragging: false, target: null });
  } else release();
 },
 release,
};
