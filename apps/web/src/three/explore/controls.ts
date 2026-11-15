import type { CameraMode } from './cameraMath';
import { DEFAULT_SPEED_TIER, SPEED_LIMITS, clampTier, type AutopilotStatus, type FlightInput } from './flightMath';

/**
 * Flight controls shared by the DOM HUD (outside the Canvas) and the flight loop (inside it).
 * The two live in different React roots, so this is a small external store: discrete settings form an
 * immutable snapshot for `useSyncExternalStore`; held buttons, the steering pad and drag deltas are
 * mutable and read by the flight loop every frame. Every change notifies listeners, which is how the
 * flight wakes a `frameloop="demand"` canvas.
 */

export type HoldControl = 'thrust' | 'reverse' | 'yawLeft' | 'yawRight' | 'pitchUp' | 'pitchDown' | 'rollLeft' | 'rollRight' | 'brake';
export type ExploreCommand = 'speedUp' | 'speedDown' | 'camera' | 'autopilot' | 'recenter' | 'dragMode' | 'help' | 'pad' | 'cancel';
export type DragMode = 'look' | 'steer';
export type KeyBinding = { kind: 'hold'; control: HoldControl } | { kind: 'command'; command: ExploreCommand };
/** What the keyboard event was aimed at: a text field or select, a native button-like control, or anything else. */
export type KeyTarget = 'field' | 'button' | 'other';

export interface ExploreControlsSnapshot {
  speedTier: number;
  camera: CameraMode;
  dragMode: DragMode;
  autopilot: AutopilotStatus;
  help: boolean;
  /** On-screen flight pad visible; defaults on for coarse pointers. */
  pad: boolean;
}

/** Physical key codes, so the layout matches on AZERTY and other keyboards. */
const KEYS: Readonly<Record<string, KeyBinding>> = {
  KeyW: { kind: 'hold', control: 'thrust' },
  KeyS: { kind: 'hold', control: 'reverse' },
  KeyA: { kind: 'hold', control: 'yawLeft' },
  KeyD: { kind: 'hold', control: 'yawRight' },
  ArrowLeft: { kind: 'hold', control: 'yawLeft' },
  ArrowRight: { kind: 'hold', control: 'yawRight' },
  ArrowUp: { kind: 'hold', control: 'pitchUp' },
  ArrowDown: { kind: 'hold', control: 'pitchDown' },
  KeyQ: { kind: 'hold', control: 'rollLeft' },
  KeyE: { kind: 'hold', control: 'rollRight' },
  Space: { kind: 'hold', control: 'brake' },
  Equal: { kind: 'command', command: 'speedUp' },
  NumpadAdd: { kind: 'command', command: 'speedUp' },
  Minus: { kind: 'command', command: 'speedDown' },
  NumpadSubtract: { kind: 'command', command: 'speedDown' },
  KeyC: { kind: 'command', command: 'camera' },
  KeyP: { kind: 'command', command: 'autopilot' },
  KeyR: { kind: 'command', command: 'recenter' },
  KeyL: { kind: 'command', command: 'dragMode' },
  KeyH: { kind: 'command', command: 'help' },
  Escape: { kind: 'command', command: 'cancel' },
};

/**
 * Flight binding for a key, or null when the key belongs to the page: modified shortcuts, typing in a field,
 * and Space or Enter on a focused button (which activates the button).
 */
export function keyBindingFor(code: string, target: KeyTarget, modified: boolean): KeyBinding | null {
  if (modified || target === 'field') return null;
  if (target === 'button' && (code === 'Space' || code === 'Enter' || code === 'NumpadEnter')) return null;
  return KEYS[code] ?? null;
}

export const STICK_DEADZONE = .12;
/** Radial deadzone, rescaled so the response starts at zero at the edge of the deadzone and reaches 1 at the rim. */
export function applyDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): [number, number] {
  const length = Math.hypot(x, y);
  if (!(length > deadzone)) return [0, 0];
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone)) / length;
  return [x * scaled, y * scaled];
}

export interface ExploreControls {
  getSnapshot(): ExploreControlsSnapshot;
  subscribe(listener: () => void): () => void;
  reset(options: { pad: boolean }): void;
  command(command: ExploreCommand): void;
  setAutopilot(status: AutopilotStatus): void;
  press(source: string, control: HoldControl): void;
  release(source: string): void;
  releaseAll(): void;
  /** Steering pad, −1…1 each axis, right and up positive, before the deadzone. */
  setStick(x: number, y: number): void;
  /** Canvas drag in CSS pixels, routed by the current drag mode. */
  drag(dx: number, dy: number): void;
  /** Assembles this step's flight input. Pending steer pixels are converted and consumed only when `consumeSteer`. */
  readInput(out: FlightInput, steerToRadians: (dx: number, dy: number) => { yaw: number; pitch: number }, consumeSteer: boolean): FlightInput;
  /** Pending look pixels, written into `out` and consumed. */
  takeLook(out: { dx: number; dy: number }): { dx: number; dy: number };
  takeRecenter(): boolean;
  /** Any held control, deflected pad or pending drag: the flight must keep rendering. */
  active(): boolean;
}

export function createExploreControls(): ExploreControls {
  let snapshot: ExploreControlsSnapshot = { speedTier: DEFAULT_SPEED_TIER, camera: 'chase', dragMode: 'steer', autopilot: 'off', help: false, pad: false };
  const listeners = new Set<() => void>();
  const held = new Map<string, HoldControl>();
  const stick = [0, 0];
  const pendingSteer = [0, 0];
  const pendingLook = [0, 0];
  let recenter = false;
  const emit = () => { for (const listener of listeners) listener(); };
  const update = (next: Partial<ExploreControlsSnapshot>) => {
    const merged = { ...snapshot, ...next };
    if ((Object.keys(next) as (keyof ExploreControlsSnapshot)[]).every(key => merged[key] === snapshot[key])) return;
    snapshot = merged;
    emit();
  };
  const isHeld = (control: HoldControl) => {
    for (const value of held.values()) if (value === control) return true;
    return false;
  };
  const clearMotion = () => {
    held.clear();
    stick[0] = stick[1] = 0;
    pendingSteer[0] = pendingSteer[1] = 0;
    pendingLook[0] = pendingLook[1] = 0;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    reset({ pad }) {
      clearMotion();
      recenter = false;
      snapshot = { speedTier: DEFAULT_SPEED_TIER, camera: 'chase', dragMode: 'steer', autopilot: 'off', help: false, pad };
      emit();
    },
    command(command) {
      switch (command) {
        case 'speedUp': update({ speedTier: clampTier(snapshot.speedTier + 1) }); break;
        case 'speedDown': update({ speedTier: clampTier(snapshot.speedTier - 1) }); break;
        case 'camera': update({ camera: snapshot.camera === 'chase' ? 'cockpit' : 'chase' }); break;
        case 'dragMode': update({ dragMode: snapshot.dragMode === 'look' ? 'steer' : 'look' }); break;
        case 'help': update({ help: !snapshot.help }); break;
        case 'pad': update({ pad: !snapshot.pad }); break;
        case 'autopilot': update({ autopilot: snapshot.autopilot === 'engaged' ? 'off' : 'engaged' }); break;
        case 'recenter': recenter = true; emit(); break;
        case 'cancel':
          if (snapshot.autopilot === 'engaged') update({ autopilot: 'off' });
          else if (snapshot.help) update({ help: false });
          break;
      }
    },
    setAutopilot(status) { update({ autopilot: status }); },
    press(source, control) {
      if (held.get(source) === control) return;
      held.set(source, control);
      emit();
    },
    release(source) {
      if (held.delete(source)) emit();
    },
    releaseAll() {
      clearMotion();
      emit();
    },
    setStick(x, y) {
      const [nextX, nextY] = applyDeadzone(x, y);
      if (nextX === stick[0] && nextY === stick[1]) return;
      stick[0] = nextX;
      stick[1] = nextY;
      emit();
    },
    drag(dx, dy) {
      if (!dx && !dy) return;
      // As in Void Protocol: a drag steers the ship in manual flight; while the autopilot flies,
      // or in free look, it only turns the view and never touches the heading.
      const pending = snapshot.dragMode === 'steer' && snapshot.autopilot !== 'engaged' ? pendingSteer : pendingLook;
      pending[0] += dx;
      pending[1] += dy;
      emit();
    },
    readInput(out, steerToRadians, consumeSteer) {
      const axis = (positive: HoldControl, negative: HoldControl) => (isHeld(positive) ? 1 : 0) - (isHeld(negative) ? 1 : 0);
      out.thrust = axis('thrust', 'reverse');
      out.yaw = Math.max(-1, Math.min(1, axis('yawRight', 'yawLeft') + stick[0]));
      out.pitch = Math.max(-1, Math.min(1, axis('pitchUp', 'pitchDown') + stick[1]));
      out.roll = axis('rollRight', 'rollLeft');
      out.brake = isHeld('brake');
      out.steerYaw = 0;
      out.steerPitch = 0;
      if (consumeSteer && (pendingSteer[0] || pendingSteer[1])) {
        const steer = steerToRadians(pendingSteer[0], pendingSteer[1]);
        out.steerYaw = steer.yaw;
        out.steerPitch = steer.pitch;
        pendingSteer[0] = pendingSteer[1] = 0;
      }
      return out;
    },
    takeLook(out) {
      out.dx = pendingLook[0];
      out.dy = pendingLook[1];
      pendingLook[0] = pendingLook[1] = 0;
      return out;
    },
    takeRecenter() {
      const requested = recenter;
      recenter = false;
      return requested;
    },
    active: () => held.size > 0 || stick[0] !== 0 || stick[1] !== 0 || pendingSteer[0] !== 0 || pendingSteer[1] !== 0 || pendingLook[0] !== 0 || pendingLook[1] !== 0 || recenter,
  };
}

/** The one store shared by `ExploreFlight` and `ExploreHud`. */
export const exploreControls = createExploreControls();
export const SPEED_TIER_COUNT = SPEED_LIMITS.length;
