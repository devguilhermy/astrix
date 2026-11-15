import { approachFactor } from '../camera/approach';
import {
  addScaled3, copy3, copyQuat, cross3, distance3, dot3, length3, multiplyQuat, normalize3, normalizeQuat,
  quatFromAxisAngle, quatFromRotationVector, rotate3, scale3, set3, sub3, vec3, quatIdentity,
  type Quat, type ReadonlyQuat, type ReadonlyVec3, type Vec3,
} from './vecMath';

/**
 * Explore ship flight model. Pure and deterministic: no React, no three.js, no clock.
 *
 * Scene units are those of `SOLAR_BODIES` (Sun radius 6, planets 0.015 to 0.62 on compressed
 * orbits out to 33). The ship's forward axis is local −Z, up +Y, right +X, matching a three.js camera,
 * so the cockpit camera can share the ship orientation.
 *
 * Feel (ideas only from the Void Protocol controls document, no code): thrust under a selectable speed
 * limit, gentle coasting drag, a strong brake, frame-rate-independent exponential responses, a
 * closing-speed limit near every body and a swept hard constraint so the ship can never enter a body.
 */

export interface FlightBody { readonly id: string; readonly position: ReadonlyVec3; readonly radius: number }
export type AutopilotStatus = 'off' | 'engaged' | 'arrived';

export interface FlightState {
  position: Vec3;
  velocity: Vec3;
  orientation: Quat;
  /** Body-frame angular velocity, rad/s: [about +X (nose up), about +Y (nose left), about +Z (roll left)]. */
  angular: Vec3;
  autopilot: AutopilotStatus;
  /** Last applied forward thrust, −1…1; drives the engine glow and camera shake. */
  thrust: number;
}

/** Pilot-oriented input. Axes are −1…1; steer values are radians to apply in this step (drag steering). */
export interface FlightInput {
  thrust: number;
  /** +1 turns the nose right. */
  yaw: number;
  /** +1 raises the nose. */
  pitch: number;
  /** +1 rolls clockwise as seen from the cockpit (right wing down). */
  roll: number;
  brake: boolean;
  steerYaw: number;
  steerPitch: number;
}

export interface FlightSettings { speedLimit: number; target: FlightBody | null }

/** Fixed simulation step, seconds of wall time. Mission time never advances. */
export const FIXED_STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 8;
/** Frame gaps beyond this (tab hidden, demand loop asleep) are not replayed. */
export const MAX_FRAME_DELTA = .1;

/** Speed limits in scene units per second, slowest first. Index 3 is the boarding default. */
export const SPEED_LIMITS = [.005, .02, .08, .3, 1, 3] as const;
export const DEFAULT_SPEED_TIER = 3;

/** Enlarged ship's half-span plus margin, scene units. */
export const SHIP_CLEARANCE = .004;
/** Avoidance sphere as a multiple of the body radius, before the ship clearance is added. */
export const AVOID_FACTOR = 1.15;
/** Closing speed allowed per unit of clearance (1/s): the ship cannot close the remaining gap faster than in about 0.7 s. */
export const PROXIMITY_RATE = 1.5;
/** Closing speed always allowed so the ship can creep up to the avoidance sphere. */
export const MIN_CLOSING_SPEED = .0015;
/** A velocity ray missing the avoidance sphere by more than this factor is a pass-by and is not slowed. */
export const PASS_MARGIN = 1.05;

/** Acceleration as a fraction of the speed limit per second. Reverse thrust uses half. */
export const ACCEL_RATE = 1.5;
export const REVERSE_FACTOR = .5;
export const COAST_DAMPING = .8;
export const BRAKE_DAMPING = 5;
/** While thrusting forward the velocity swings toward the nose at this rate (course assistance). */
export const ALIGN_RATE = 2;
export const OVERSPEED_DAMPING = 4;
/** Below this fraction of the speed limit an unpowered ship is at rest, so the demand frame loop can sleep. */
export const REST_FRACTION = .002;

export const PITCH_RATE = 1.1;
export const YAW_RATE = 1.1;
export const ROLL_RATE = 1.6;
export const TURN_RESPONSE = 8;

export const AUTOPILOT_TURN_RATE = 1.6;
export const AUTOPILOT_RESPONSE = 2.5;
export const APPROACH_GAIN = 1.2;
/** Obstacles within this multiple of their avoidance radius of the planned path deflect it. */
export const DEFLECT_ZONE = 1.6;
export const DEFLECT_STRENGTH = 2;

const FORWARD: ReadonlyVec3 = [0, 0, -1];
const UP: ReadonlyVec3 = [0, 1, 0];

export const avoidRadius = (radius: number): number => radius * AVOID_FACTOR + SHIP_CLEARANCE;
/** Distance from the body centre where the autopilot stops: outside the avoidance sphere, with the body filling a good part of the chase view. */
export const standOffDistance = (radius: number): number => avoidRadius(radius) + Math.min(3, Math.max(.03, radius * 2));
export const arriveTolerance = (radius: number): number => Math.max(.0005, (standOffDistance(radius) - avoidRadius(radius)) * .04);
export const speedLimitFor = (tier: number): number => SPEED_LIMITS[clampTier(tier)];
export const clampTier = (tier: number): number => Math.max(0, Math.min(SPEED_LIMITS.length - 1, Math.round(tier)));

export function createFlightState(position: ReadonlyVec3 = [0, 0, 0], orientation: ReadonlyQuat = [0, 0, 0, 1]): FlightState {
  return { position: copy3(vec3(), position), velocity: vec3(), orientation: normalizeQuat(quatIdentity(), orientation), angular: vec3(), autopilot: 'off', thrust: 0 };
}
export function copyFlightState(out: FlightState, from: FlightState): FlightState {
  copy3(out.position, from.position);
  copy3(out.velocity, from.velocity);
  copyQuat(out.orientation, from.orientation);
  copy3(out.angular, from.angular);
  out.autopilot = from.autopilot;
  out.thrust = from.thrust;
  return out;
}
export const idleInput = (): FlightInput => ({ thrust: 0, yaw: 0, pitch: 0, roll: 0, brake: false, steerYaw: 0, steerPitch: 0 });
export const hasManualInput = (input: FlightInput): boolean =>
  input.thrust !== 0 || input.yaw !== 0 || input.pitch !== 0 || input.roll !== 0 || input.brake || input.steerYaw !== 0 || input.steerPitch !== 0;

/** Fixed-step accumulator. Returns how many steps to run for this frame; `clock.alpha` is the render interpolation factor. */
export interface StepClock { accumulator: number; alpha: number }
export function consumeFrame(clock: StepClock, frameDelta: number, step = FIXED_STEP, maxSteps = MAX_STEPS_PER_FRAME): number {
  clock.accumulator += Math.min(MAX_FRAME_DELTA, Math.max(0, Number.isFinite(frameDelta) ? frameDelta : 0));
  let steps = Math.floor(clock.accumulator / step + 1e-9);
  clock.accumulator -= steps * step;
  if (steps > maxSteps) { steps = maxSteps; clock.accumulator = 0; }
  if (clock.accumulator < 0) clock.accumulator = 0;
  clock.alpha = clock.accumulator / step;
  return steps;
}

/** Point outside every avoidance sphere: a point inside one is moved radially to its surface. */
export function pushOutside(out: Vec3, point: ReadonlyVec3, bodies: readonly FlightBody[], radiusOf: (radius: number) => number = avoidRadius): Vec3 {
  copy3(out, point);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const body of bodies) {
      const limit = radiusOf(body.radius);
      sub3(scratchA, out, body.position);
      const distance = length3(scratchA);
      if (distance >= limit) continue;
      normalize3(scratchA, scratchA, UP);
      addScaled3(out, body.position, scratchA, limit * (1 + 1e-9));
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

/** Nearest body by distance to its surface (centre distance minus radius). */
export function nearestSurface(position: ReadonlyVec3, bodies: readonly FlightBody[]): { body: FlightBody; distance: number } | null {
  let best: { body: FlightBody; distance: number } | null = null;
  for (const body of bodies) {
    const distance = distance3(position, body.position) - body.radius;
    if (!best || distance < best.distance) best = { body, distance };
  }
  return best;
}

/** Autopilot goal: on the ship's side of the target, `standOffDistance` from its centre. */
export function autopilotGoal(out: Vec3, position: ReadonlyVec3, target: FlightBody): Vec3 {
  sub3(out, position, target.position);
  normalize3(out, out, [1, 0, 0]);
  return addScaled3(out, target.position, out, standOffDistance(target.radius));
}

/**
 * Bends a unit travel direction around bodies that sit ahead within `DEFLECT_ZONE` avoidance radii of the
 * straight path to `goal`. The push is perpendicular to the path, strongest when the path crosses the centre.
 */
export function deflectAroundBodies(direction: Vec3, position: ReadonlyVec3, goal: ReadonlyVec3, bodies: readonly FlightBody[], skipId: string | null): Vec3 {
  const path = sub3(scratchB, goal, position);
  const pathLength = length3(path);
  if (pathLength < 1e-9) return direction;
  for (const body of bodies) {
    if (body.id === skipId) continue;
    const zone = avoidRadius(body.radius) * DEFLECT_ZONE;
    sub3(scratchC, body.position, position);
    const along = dot3(scratchC, path) / pathLength;
    if (along <= 0 || along >= pathLength + zone) continue;
    // Closest point of the path to the body centre, as an offset from the centre.
    addScaled3(scratchD, position, path, Math.min(along, pathLength) / pathLength);
    sub3(scratchD, scratchD, body.position);
    const miss = length3(scratchD);
    if (miss >= zone) continue;
    if (miss < 1e-9) {
      cross3(scratchD, path, UP);
      if (length3(scratchD) < 1e-9) cross3(scratchD, path, [1, 0, 0]);
    }
    normalize3(scratchD, scratchD);
    addScaled3(direction, direction, scratchD, (1 - miss / zone) * DEFLECT_STRENGTH);
  }
  return normalize3(direction, direction, FORWARD);
}

/** Desired autopilot velocity toward the stand-off point: cruise at the limit, brake on a constant-deceleration profile, settle exponentially. */
export function autopilotVelocity(out: Vec3, position: ReadonlyVec3, target: FlightBody, bodies: readonly FlightBody[], speedLimit: number): Vec3 {
  const goal = autopilotGoal(scratchE, position, target);
  sub3(out, goal, position);
  const distance = length3(out);
  if (distance < 1e-12) return set3(out, 0, 0, 0);
  scale3(out, out, 1 / distance);
  deflectAroundBodies(out, position, goal, bodies, target.id);
  const speed = Math.min(speedLimit, Math.sqrt(2 * ACCEL_RATE * speedLimit * distance), APPROACH_GAIN * distance);
  return scale3(out, out, speed);
}

/**
 * Limits the speed toward each body the ship is heading into to `MIN_CLOSING_SPEED + PROXIMITY_RATE × clearance`.
 * Tangential and outward motion are untouched, and a course that passes clear of the body keeps its speed.
 */
export function limitClosingSpeed(velocity: Vec3, position: ReadonlyVec3, bodies: readonly FlightBody[]): Vec3 {
  for (const body of bodies) {
    sub3(scratchA, position, body.position);
    const distance = length3(scratchA);
    if (distance < 1e-12) continue;
    scale3(scratchA, scratchA, 1 / distance);
    const closing = -dot3(velocity, scratchA);
    const limit = avoidRadius(body.radius);
    const allowed = MIN_CLOSING_SPEED + PROXIMITY_RATE * Math.max(0, distance - limit);
    if (closing <= allowed) continue;
    const cosine = closing / length3(velocity);
    const miss = distance * Math.sqrt(Math.max(0, 1 - cosine * cosine));
    if (miss > limit * PASS_MARGIN) continue;
    addScaled3(velocity, velocity, scratchA, closing - allowed);
  }
  return velocity;
}

/**
 * Moves from `from` by `velocity × dt`, stopping on the surface of the first avoidance sphere the segment
 * enters and removing the inward part of the velocity there. The result is never inside any avoidance sphere,
 * whatever the speed: this is the guarantee that the ship cannot pass through a body.
 */
export function sweepMove(out: Vec3, from: ReadonlyVec3, velocity: Vec3, dt: number, bodies: readonly FlightBody[]): Vec3 {
  const start = pushOutside(scratchF, from, bodies);
  addScaled3(out, start, velocity, dt);
  for (const body of bodies) {
    const limit = avoidRadius(body.radius);
    const delta = sub3(scratchA, out, start);
    const offset = sub3(scratchB, start, body.position);
    const a = dot3(delta, delta);
    if (a < 1e-24) continue;
    const b = 2 * dot3(offset, delta);
    const c = dot3(offset, offset) - limit * limit;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t < 0 || t > 1) continue;
    addScaled3(scratchC, offset, delta, t);
    normalize3(scratchC, scratchC, UP);
    addScaled3(out, body.position, scratchC, limit * (1 + 1e-9));
    const inward = dot3(velocity, scratchC);
    if (inward < 0) addScaled3(velocity, velocity, scratchC, -inward);
  }
  return pushOutside(out, out, bodies);
}

/** Rotates `orientation` in world space toward facing `direction` (unit) by at most `maxAngle` radians. */
export function turnToward(orientation: Quat, direction: ReadonlyVec3, maxAngle: number): Quat {
  const forward = rotate3(scratchA, orientation, FORWARD);
  const axis = cross3(scratchB, forward, direction);
  const angle = Math.atan2(length3(axis), dot3(forward, direction));
  if (angle < 1e-7) return orientation;
  if (length3(axis) < 1e-9) rotate3(axis, orientation, UP);
  normalize3(axis, axis);
  quatFromAxisAngle(scratchQ, axis, Math.min(angle, maxAngle));
  multiplyQuat(orientation, scratchQ, orientation);
  return normalizeQuat(orientation, orientation);
}

/** One fixed step. Mutates and returns `state`. */
export function stepFlight(state: FlightState, input: FlightInput, bodies: readonly FlightBody[], settings: FlightSettings, dt: number): FlightState {
  const manual = hasManualInput(input);
  const target = settings.target;
  if (state.autopilot === 'engaged' && (manual || !target)) state.autopilot = 'off';
  if (state.autopilot === 'arrived' && manual) state.autopilot = 'off';
  const limit = Math.max(1e-6, settings.speedLimit);
  const velocity = state.velocity;

  if (state.autopilot === 'engaged' && target) {
    const desired = autopilotVelocity(scratchG, state.position, target, bodies, limit);
    const desiredSpeed = length3(desired);
    const facing = desiredSpeed > limit * 1e-3 ? normalize3(scratchH, desired) : normalize3(scratchH, sub3(scratchH, target.position, state.position), FORWARD);
    turnToward(state.orientation, facing, AUTOPILOT_TURN_RATE * dt);
    set3(state.angular, 0, 0, 0);
    const k = approachFactor(AUTOPILOT_RESPONSE, dt);
    for (let axis = 0; axis < 3; axis++) velocity[axis] += (desired[axis] - velocity[axis]) * k;
    state.thrust = Math.min(1, desiredSpeed / limit);
  } else {
    const k = approachFactor(TURN_RESPONSE, dt);
    const angular = state.angular;
    angular[0] += (clampUnit(input.pitch) * PITCH_RATE - angular[0]) * k;
    angular[1] += (-clampUnit(input.yaw) * YAW_RATE - angular[1]) * k;
    angular[2] += (-clampUnit(input.roll) * ROLL_RATE - angular[2]) * k;
    quatFromRotationVector(scratchQ, angular[0] * dt + input.steerPitch, angular[1] * dt - input.steerYaw, angular[2] * dt);
    multiplyQuat(state.orientation, state.orientation, scratchQ);
    normalizeQuat(state.orientation, state.orientation);

    const thrust = clampUnit(input.thrust);
    const speedBefore = length3(velocity);
    const forward = rotate3(scratchA, state.orientation, FORWARD);
    if (thrust > 0) {
      addScaled3(velocity, velocity, forward, thrust * ACCEL_RATE * limit * dt);
      const speed = length3(velocity);
      const align = approachFactor(ALIGN_RATE * thrust, dt);
      for (let axis = 0; axis < 3; axis++) velocity[axis] += (forward[axis] * speed - velocity[axis]) * align;
    } else if (thrust < 0) {
      addScaled3(velocity, velocity, forward, thrust * REVERSE_FACTOR * ACCEL_RATE * limit * dt);
    } else {
      scale3(velocity, velocity, Math.exp(-COAST_DAMPING * dt));
    }
    if (input.brake) scale3(velocity, velocity, Math.exp(-BRAKE_DAMPING * dt));
    const speed = length3(velocity);
    if (speed > limit) {
      const allowed = speedBefore > limit ? limit + (speedBefore - limit) * Math.exp(-OVERSPEED_DAMPING * dt) : limit;
      if (speed > allowed) scale3(velocity, velocity, allowed / speed);
    }
    if (thrust === 0 && length3(velocity) < limit * REST_FRACTION) set3(velocity, 0, 0, 0);
    state.thrust = thrust;
  }

  limitClosingSpeed(velocity, state.position, bodies);
  sweepMove(state.position, state.position, velocity, dt, bodies);

  if (state.autopilot === 'engaged' && target) {
    const goal = autopilotGoal(scratchE, state.position, target);
    if (distance3(goal, state.position) <= arriveTolerance(target.radius)) {
      state.autopilot = 'arrived';
      set3(velocity, 0, 0, 0);
      state.thrust = 0;
    }
  }
  return state;
}

/** Render pose between two fixed steps. */
export function interpolatePose(outPosition: Vec3, outOrientation: Quat, previous: FlightState, current: FlightState, alpha: number): void {
  for (let axis = 0; axis < 3; axis++) outPosition[axis] = previous.position[axis] + (current.position[axis] - previous.position[axis]) * alpha;
  const a = previous.orientation, b = current.orientation;
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  for (let axis = 0; axis < 4; axis++) outOrientation[axis] = a[axis] + (b[axis] * sign - a[axis]) * alpha;
  normalizeQuat(outOrientation, outOrientation);
}

/** True while the ship still moves or turns; the demand frame loop keeps rendering until this is false. */
export const isFlightActive = (state: FlightState): boolean =>
  state.autopilot === 'engaged' || length3(state.velocity) > 0 || Math.abs(state.angular[0]) + Math.abs(state.angular[1]) + Math.abs(state.angular[2]) > 1e-4;


const clampUnit = (value: number): number => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const scratchA = vec3(), scratchB = vec3(), scratchC = vec3(), scratchD = vec3(), scratchE = vec3(), scratchF = vec3(), scratchG = vec3(), scratchH = vec3();
const scratchQ = quatIdentity();
