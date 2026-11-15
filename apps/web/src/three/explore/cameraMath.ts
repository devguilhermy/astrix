import { approachFactor } from '../camera/approach';
import { avoidRadius, type FlightBody } from './flightMath';
import {
  addScaled3, copy3, copyQuat, length3, multiplyQuat, nlerpQuat, normalize3, quatFromAxisAngle, rotate3, scale3, set3, sub3, vec3, quatIdentity,
  type Quat, type ReadonlyQuat, type ReadonlyVec3, type Vec3,
} from './vecMath';

/**
 * Explore camera rig, pure. The camera rides with the ship: chase sits behind and above, cockpit sits at the
 * nose. Free look rotates the view about the ship without changing the flight vector. Easing is applied to
 * the ship-relative offset, never to the world position, so the ship stays framed at any speed.
 */

export type CameraMode = 'chase' | 'cockpit';
export interface LookState { yaw: number; pitch: number; /** Seconds since the last look drag. */ idle: number }

/** Chase boom in the look frame, scene units: 3.5 thousandths above, 14 behind. */
export const CHASE_OFFSET: ReadonlyVec3 = [0, .0035, .014];
/** Extra boom length at full speed, as a fraction of the boom. */
export const CHASE_SPEED_STRETCH = .25;
/** Cockpit eye in the ship frame: just ahead of the hull. */
export const COCKPIT_OFFSET: ReadonlyVec3 = [0, .0004, -.0016];
export const CHASE_OFFSET_RESPONSE = 9;
export const CHASE_TURN_RESPONSE = 10;
export const LOOK_PITCH_LIMIT = 1.45;
export const LOOK_RECENTER_DELAY = 2.5;
export const LOOK_RECENTER_RESPONSE = 2;
/** Radians of ship rotation per dragged CSS pixel in steer mode. */
export const STEER_SENSITIVITY = .004;
export const BASE_FOV = 55;
export const SPEED_FOV_GAIN = 8;
/** Camera keeps this far outside every body surface; with the 0.0002 near plane the planet is never clipped open. */
export const CAMERA_CLEARANCE = .0015;
export const NEAR_PLANE = .0002;
export const FAR_PLANE = 4000;
/** Peak shake displacement at full thrust and full speed, scene units. */
export const SHAKE_AMPLITUDE = .00012;

export const createLook = (): LookState => ({ yaw: 0, pitch: 0, idle: Number.POSITIVE_INFINITY });

/**
 * Look drag, "grab the sky": the scene follows the pointer, as with the orbit camera outside the ship.
 * Dragging the full viewport height turns the view by the vertical field of view.
 */
export function dragToLook(dx: number, dy: number, fovDeg: number, viewportHeight: number): { yaw: number; pitch: number } {
  const perPixel = fovDeg * Math.PI / 180 / Math.max(1, viewportHeight);
  return { yaw: dx * perPixel, pitch: dy * perPixel };
}

/** Steer drag: the nose follows the pointer, right turns right, up raises the nose. Radians, pilot convention of `FlightInput`. */
export function dragToSteer(dx: number, dy: number, sensitivity = STEER_SENSITIVITY): { yaw: number; pitch: number } {
  return { yaw: dx * sensitivity, pitch: -dy * sensitivity };
}

export function applyLook(look: LookState, yaw: number, pitch: number): LookState {
  look.yaw = wrapAngle(look.yaw + yaw);
  look.pitch = Math.max(-LOOK_PITCH_LIMIT, Math.min(LOOK_PITCH_LIMIT, look.pitch + pitch));
  look.idle = 0;
  return look;
}

/** Eases the look back to the ship's nose after `LOOK_RECENTER_DELAY`. Reduced motion never moves the view on its own. */
export function recenterLook(look: LookState, dt: number, reducedMotion: boolean): LookState {
  look.idle += dt;
  if (reducedMotion || look.idle < LOOK_RECENTER_DELAY) return look;
  const keep = 1 - approachFactor(LOOK_RECENTER_RESPONSE, dt);
  look.yaw *= keep;
  look.pitch *= keep;
  if (Math.abs(look.yaw) + Math.abs(look.pitch) < 1e-4) { look.yaw = 0; look.pitch = 0; }
  return look;
}

/** Look rotation in the ship frame: yaw about ship up, then pitch about the yawed right axis. */
export function lookQuat(out: Quat, look: LookState): Quat {
  quatFromAxisAngle(out, [0, 1, 0], look.yaw);
  return multiplyQuat(out, out, quatFromAxisAngle(scratchQ, [1, 0, 0], look.pitch));
}

/** Speed-dependent field of view; fixed under reduced motion. */
export const fovFor = (speedFraction: number, reducedMotion: boolean): number =>
  reducedMotion ? BASE_FOV : BASE_FOV + SPEED_FOV_GAIN * Math.min(1, Math.max(0, speedFraction)) ** 2;

/** Desired ship-relative camera offset (world axes) and orientation, before easing. */
export function desiredCamera(outOffset: Vec3, outOrientation: Quat, shipOrientation: ReadonlyQuat, look: LookState, mode: CameraMode, speedFraction: number): void {
  multiplyQuat(outOrientation, shipOrientation, lookQuat(scratchLook, look));
  if (mode === 'cockpit') {
    rotate3(outOffset, shipOrientation, COCKPIT_OFFSET);
    return;
  }
  scale3(outOffset, CHASE_OFFSET, 1 + CHASE_SPEED_STRETCH * Math.min(1, Math.max(0, speedFraction)));
  rotate3(outOffset, outOrientation, outOffset);
}

/**
 * Moves the current offset and orientation toward the desired ones. Cockpit and reduced motion are rigid;
 * chase eases at frame-rate-independent rates.
 */
export function easeCamera(offset: Vec3, orientation: Quat, desiredOffset: ReadonlyVec3, desiredOrientation: ReadonlyQuat, dt: number, mode: CameraMode, reducedMotion: boolean): void {
  if (reducedMotion || mode === 'cockpit') {
    copy3(offset, desiredOffset);
    copyQuat(orientation, desiredOrientation);
    return;
  }
  const k = approachFactor(CHASE_OFFSET_RESPONSE, dt);
  for (let axis = 0; axis < 3; axis++) offset[axis] += (desiredOffset[axis] - offset[axis]) * k;
  nlerpQuat(orientation, orientation, desiredOrientation, approachFactor(CHASE_TURN_RESPONSE, dt));
}

/** True when the eased camera has reached its desired pose, so the demand loop can stop. */
export function cameraSettled(offset: ReadonlyVec3, orientation: ReadonlyQuat, desiredOffset: ReadonlyVec3, desiredOrientation: ReadonlyQuat): boolean {
  const offsetError = Math.hypot(offset[0] - desiredOffset[0], offset[1] - desiredOffset[1], offset[2] - desiredOffset[2]);
  const dotQ = Math.abs(orientation[0] * desiredOrientation[0] + orientation[1] * desiredOrientation[1] + orientation[2] * desiredOrientation[2] + orientation[3] * desiredOrientation[3]);
  return offsetError < 1e-6 && dotQ > 1 - 1e-9;
}

/**
 * Small deterministic shake from thrust and speed, in the camera frame. Zero under reduced motion and in the cockpit
 * (the view from the nose stays steady).
 */
export function shakeOffset(out: Vec3, timeSec: number, thrust: number, speedFraction: number, mode: CameraMode, reducedMotion: boolean): Vec3 {
  const intensity = Math.max(0, thrust) * Math.min(1, Math.max(0, speedFraction));
  if (reducedMotion || mode === 'cockpit' || intensity < .05) return set3(out, 0, 0, 0);
  const amplitude = SHAKE_AMPLITUDE * intensity;
  return set3(out,
    amplitude * (Math.sin(timeSec * 37.1) * .6 + Math.sin(timeSec * 61.7) * .4),
    amplitude * (Math.sin(timeSec * 43.3 + 1.3) * .6 + Math.sin(timeSec * 71.9 + .7) * .4),
    0);
}

/** Keeps a camera point outside every body surface by `CAMERA_CLEARANCE`. */
export function keepCameraClear(position: Vec3, bodies: readonly FlightBody[]): Vec3 {
  for (const body of bodies) {
    const limit = Math.min(avoidRadius(body.radius), body.radius + CAMERA_CLEARANCE);
    sub3(scratchA, position, body.position);
    if (length3(scratchA) >= limit) continue;
    normalize3(scratchA, scratchA);
    addScaled3(position, body.position, scratchA, limit);
  }
  return position;
}

const wrapAngle = (angle: number): number => {
  if (angle > -Math.PI && angle <= Math.PI) return angle;
  const wrapped = (angle + Math.PI) % (2 * Math.PI);
  return (wrapped < 0 ? wrapped + 2 * Math.PI : wrapped) - Math.PI;
};
const scratchA = vec3();
const scratchQ = quatIdentity(), scratchLook = quatIdentity();
