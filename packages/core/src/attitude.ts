import type { AttitudeQuaternion } from './contracts';
import { clamp, degrees, dot, norm, type Vec3 } from './physics';

/** Canonical sign makes equivalent q/-q intents serialize identically. */
export function normalizeAttitude(q: AttitudeQuaternion): AttitudeQuaternion {
 if (q.length !== 4 || !q.every(Number.isFinite)) throw new RangeError('Attitude requires four finite components');
 const n = Math.hypot(...q);
 if (n < 1e-12) throw new RangeError('Attitude quaternion cannot be zero');
 const sign = q[3] < 0 || q[3] === 0 && (q[0] || q[1] || q[2]) < 0 ? -1 : 1;
 return [q[0] * sign / n, q[1] * sign / n, q[2] * sign / n, q[3] * sign / n];
}
export function rotateAttitudeVector(q: AttitudeQuaternion, v: readonly [number, number, number]): Vec3 {
 const [x, y, z, w] = q, [vx, vy, vz] = v;
 const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
 return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx];
}
export function attitudeDistance(a: AttitudeQuaternion, b: AttitudeQuaternion): number {
 return 2 * Math.acos(clamp(Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]), 0, 1));
}
export function slewAttitude(a: AttitudeQuaternion, b: AttitudeQuaternion, maxAngle: number): AttitudeQuaternion {
 const angle = attitudeDistance(a, b);
 if (angle <= maxAngle || angle < 1e-12) return b;
 const f = Math.max(0, maxAngle) / angle, half = angle / 2;
 const sign = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3] < 0 ? -1 : 1;
 const wa = Math.sin((1-f)*half) / Math.sin(half), wb = sign*Math.sin(f*half) / Math.sin(half);
 return normalizeAttitude([a[0]*wa+b[0]*wb, a[1]*wa+b[1]*wb, a[2]*wa+b[2]*wb, a[3]*wa+b[3]*wb]);
}
export function unitDirection(v: Vec3): Vec3 {
 const n = norm(v);
 if (n < 1e-12) throw new RangeError('Direction cannot be zero');
 return [v[0]/n, v[1]/n, v[2]/n];
}
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
/** +Z boresight follows direction; +X panel is the projected preferred panel direction. */
export function attitudeTargetForDirection(direction: Vec3, panelDirection: Vec3): AttitudeQuaternion {
 const z = unitDirection(direction), projection = dot(z, panelDirection);
 let x: Vec3 = [panelDirection[0]-projection*z[0], panelDirection[1]-projection*z[1], panelDirection[2]-projection*z[2]];
 if (norm(x) < 1e-8) { const axis: Vec3 = Math.abs(z[2]) < .9 ? [0,0,1] : [0,1,0]; x = cross(axis,z); }
 x = unitDirection(x);
 const y = cross(z,x), trace = x[0]+y[1]+z[2];
 let q: AttitudeQuaternion;
 if (trace > 0) { const s = Math.sqrt(trace+1)*2; q = [(y[2]-z[1])/s,(z[0]-x[2])/s,(x[1]-y[0])/s,s/4]; }
 else if (x[0] > y[1] && x[0] > z[2]) { const s = Math.sqrt(1+x[0]-y[1]-z[2])*2; q = [s/4,(y[0]+x[1])/s,(z[0]+x[2])/s,(y[2]-z[1])/s]; }
 else if (y[1] > z[2]) { const s = Math.sqrt(1+y[1]-x[0]-z[2])*2; q = [(y[0]+x[1])/s,s/4,(z[1]+y[2])/s,(z[0]-x[2])/s]; }
 else { const s = Math.sqrt(1+z[2]-x[0]-y[1])*2; q = [(z[0]+x[2])/s,(z[1]+y[2])/s,s/4,(x[1]-y[0])/s]; }
 return normalizeAttitude(q);
}
export function angleToDirectionDeg(q: AttitudeQuaternion, axis: Vec3, direction: Vec3): number {
 return degrees(Math.acos(clamp(dot(rotateAttitudeVector(q,axis), unitDirection(direction)), -1, 1)));
}
/** Positive body-Y error is a retained deterministic calibration bias, not random jitter. */
export function biasedAttitude(q: AttitudeQuaternion, angle: number): AttitudeQuaternion {
 const s = Math.sin(angle/2), c = Math.cos(angle/2), [x,y,z,w] = q;
 return normalizeAttitude([x*c-z*s,y*c+w*s,z*c+x*s,w*c-y*s]);
}
export function antennaGain(errorDeg: number, halfPowerDeg: number): number {
 const cosine = Math.cos(errorDeg*Math.PI/180);
 return cosine <= 0 ? 0 : cosine ** (Math.log(.5)/Math.log(Math.cos(halfPowerDeg*Math.PI/180)));
}
