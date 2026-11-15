/**
 * Small tuple vector and quaternion helpers for the Explore flight model.
 * Scene units, three.js axes (Y up, right-handed). Quaternions are [x, y, z, w].
 * Functions that take an `out` argument write into it and return it, so the fixed step allocates nothing.
 */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type ReadonlyVec3 = readonly [number, number, number];
export type ReadonlyQuat = readonly [number, number, number, number];

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const quatIdentity = (): Quat => [0, 0, 0, 1];

export function copy3(out: Vec3, a: ReadonlyVec3): Vec3 { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }
export function set3(out: Vec3, x: number, y: number, z: number): Vec3 { out[0] = x; out[1] = y; out[2] = z; return out; }
export function add3(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 { return set3(out, a[0] + b[0], a[1] + b[1], a[2] + b[2]); }
export function sub3(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 { return set3(out, a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
export function scale3(out: Vec3, a: ReadonlyVec3, s: number): Vec3 { return set3(out, a[0] * s, a[1] * s, a[2] * s); }
/** out = a + b × s */
export function addScaled3(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3, s: number): Vec3 { return set3(out, a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s); }
export const dot3 = (a: ReadonlyVec3, b: ReadonlyVec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length3 = (a: ReadonlyVec3): number => Math.hypot(a[0], a[1], a[2]);
export const distance3 = (a: ReadonlyVec3, b: ReadonlyVec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function cross3(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  return set3(out, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
}
/** Unit vector; a zero vector becomes `fallback` (default +Y). */
export function normalize3(out: Vec3, a: ReadonlyVec3, fallback: ReadonlyVec3 = [0, 1, 0]): Vec3 {
  const length = length3(a);
  return length > 1e-12 ? scale3(out, a, 1 / length) : copy3(out, fallback);
}

export function copyQuat(out: Quat, q: ReadonlyQuat): Quat { out[0] = q[0]; out[1] = q[1]; out[2] = q[2]; out[3] = q[3]; return out; }
export function normalizeQuat(out: Quat, q: ReadonlyQuat): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(length > 1e-12)) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
  out[0] = q[0] / length; out[1] = q[1] / length; out[2] = q[2] / length; out[3] = q[3] / length;
  return out;
}
/** out = a ⊗ b (apply b first, then a). Safe when out aliases a or b. */
export function multiplyQuat(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}
/** Rotation by `angle` radians about a unit `axis`. */
export function quatFromAxisAngle(out: Quat, axis: ReadonlyVec3, angle: number): Quat {
  const half = angle / 2, s = Math.sin(half);
  out[0] = axis[0] * s; out[1] = axis[1] * s; out[2] = axis[2] * s; out[3] = Math.cos(half);
  return out;
}
/** Rotation vector (axis × angle) to quaternion; exact for any angle. */
export function quatFromRotationVector(out: Quat, x: number, y: number, z: number): Quat {
  const angle = Math.hypot(x, y, z);
  if (angle < 1e-12) { out[0] = x / 2; out[1] = y / 2; out[2] = z / 2; out[3] = 1; return normalizeQuat(out, out); }
  const s = Math.sin(angle / 2) / angle;
  out[0] = x * s; out[1] = y * s; out[2] = z * s; out[3] = Math.cos(angle / 2);
  return out;
}
/** out = q · v · q⁻¹ for a unit quaternion. Safe when out aliases v. */
export function rotate3(out: Vec3, q: ReadonlyQuat, v: ReadonlyVec3): Vec3 {
  const [qx, qy, qz, qw] = q, [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  return set3(out, vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx);
}
/** Shortest-arc normalized interpolation; adequate for the small per-frame steps used here. */
export function nlerpQuat(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat, t: number): Quat {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  out[0] = a[0] + (b[0] * sign - a[0]) * t;
  out[1] = a[1] + (b[1] * sign - a[1]) * t;
  out[2] = a[2] + (b[2] * sign - a[2]) * t;
  out[3] = a[3] + (b[3] * sign - a[3]) * t;
  return normalizeQuat(out, out);
}
