import { ACCEL_RATE, type FlightState } from './flightMath';
import { multiplyQuat, quatIdentity, rotate3, vec3, type Quat, type Vec3 } from './vecMath';

/** Illustrative RCS pods on all eight hull corners, in ship-local scene units (forward −Z). */
export interface ThrusterPort { position: Vec3; exhaust: Vec3; torque: Vec3 }
const ARM = .00048;
const SURFACE = .00067;
export const THRUSTER_PORTS: readonly ThrusterPort[] = (() => {
  const ports: ThrusterPort[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    for (let axis = 0; axis < 3; axis++) {
      const position: Vec3 = [x * ARM, y * ARM, z * ARM];
      const exhaust: Vec3 = [0, 0, 0];
      const sign = axis === 0 ? x : axis === 1 ? y : z;
      position[axis] = sign * SURFACE;
      exhaust[axis] = sign;
      // r × force, with force opposite the gas. Divide by the common lever arm.
      const torque: Vec3 = [
        (position[2] * exhaust[1] - position[1] * exhaust[2]) / ARM,
        (position[0] * exhaust[2] - position[2] * exhaust[0]) / ARM,
        (position[1] * exhaust[0] - position[0] * exhaust[1]) / ARM,
      ];
      ports.push({ position, exhaust, torque });
    }
  }
  return ports;
})();

export interface ThrusterState {
  levels: Float32Array;
  rotation: Vec3;
  translation: Vec3;
  angularRate: Vec3;
  inverse: Quat;
  turn: Quat;
  time: number;
  active: boolean;
}
export function createThrusters(): ThrusterState {
  return { levels: new Float32Array(THRUSTER_PORTS.length), rotation: vec3(), translation: vec3(), angularRate: vec3(), inverse: quatIdentity(), turn: quatIdentity(), time: 0, active: false };
}

/** Observe actual fixed-step movement, including instantaneous drag steering and autopilot turns.
 * Angular acceleration selects the torque pair, so stopping/reversing fires the counter-jets.
 * This is visual feedback, not a fuel or propulsion simulation; flight dynamics are unchanged.
 */
export function sampleThrusters(out: ThrusterState, before: FlightState, after: FlightState, braking: boolean, speedLimit: number, dt: number): void {
  const q = before.orientation;
  out.inverse[0] = -q[0]; out.inverse[1] = -q[1]; out.inverse[2] = -q[2]; out.inverse[3] = q[3];
  multiplyQuat(out.turn, out.inverse, after.orientation);
  const sign = out.turn[3] < 0 ? -1 : 1;
  const sine = Math.hypot(out.turn[0], out.turn[1], out.turn[2]);
  const rateScale = sine > 1e-9 ? 2 * Math.atan2(sine, Math.abs(out.turn[3])) / (sine * dt) : 2 / dt;
  for (let axis = 0; axis < 3; axis++) {
    const rate = out.turn[axis] * sign * rateScale;
    out.rotation[axis] = Math.max(-1, Math.min(1, (rate - out.angularRate[axis]) / (dt * 18) + rate * .12));
    out.angularRate[axis] = rate;
    out.translation[axis] = (after.velocity[axis] - before.velocity[axis]) / (dt * speedLimit * ACCEL_RATE);
  }
  const orientation = after.orientation;
  out.inverse[0] = -orientation[0]; out.inverse[1] = -orientation[1]; out.inverse[2] = -orientation[2]; out.inverse[3] = orientation[3];
  rotate3(out.translation, out.inverse, out.translation);
  // Passive coasting and contact constraints are not powered maneuvers.
  if (!braking && after.thrust === 0 && after.autopilot !== 'engaged') out.translation.fill(0);
  for (let axis = 0; axis < 3; axis++) out.translation[axis] = Math.max(-1, Math.min(1, out.translation[axis]));
}

/** Balanced pairs: a pure turn has no net force; a pure translation has no net torque. */
export function portDemand(port: ThrusterPort, rotation: Vec3, translation: Vec3): number {
  const turn = port.torque[0] * rotation[0] + port.torque[1] * rotation[1] + port.torque[2] * rotation[2];
  const move = -port.exhaust[0] * translation[0] - port.exhaust[1] * translation[1] - port.exhaust[2] * translation[2];
  return Math.min(1, Math.max(0, turn + move));
}

/** Short pressure pulses with a finite gas tail. Reduced motion keeps steady, shorter jets. */
export function stepThrusters(out: ThrusterState, dt: number, reducedMotion: boolean): boolean {
  out.time += dt;
  let active = false;
  for (let index = 0; index < THRUSTER_PORTS.length; index++) {
    const demand = portDemand(THRUSTER_PORTS[index]!, out.rotation, out.translation);
    // Opposite corner pods pulse together to preserve their torque couple.
    const pulse = reducedMotion || (out.time + (index % 3) * .035) % .18 < .115;
    const target = demand > .035 ? demand * (pulse ? 1 : .16) : 0;
    const level = Math.max(target, out.levels[index]! - dt / .12);
    out.levels[index] = level > .015 ? level : 0;
    active ||= out.levels[index]! > 0;
  }
  out.active = active;
  return active;
}
