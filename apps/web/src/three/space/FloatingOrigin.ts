import { Quaternion, Vector3 } from 'three';

export type KmVector = readonly [number, number, number];
/** CPU doubles remain in MJ2000Eq km. Only relative positions reach GPU floats.
 * Pattern: Void Protocol 218625d apps/web/src/rendering/renderOrigin.ts (78 LOC); owner-authorized Apache-2.0 selected reuse.
 * A spacecraft-centred origin is exact, not grid-rounded: metre hardware remains precise.
 * [x,z,-y] is a proper rotation; [x,z,y] would reflect attitude and reverse handedness.
 */
export function relativePosition(out: Vector3, position: KmVector, origin: KmVector): Vector3 {
 return out.set(position[0] - origin[0], position[2] - origin[2], -(position[1] - origin[1]));
}
export function renderDirection(out: Vector3, direction: KmVector): Vector3 {
 return out.set(direction[0], direction[2], -direction[1]);
}
export const CORE_TO_RENDER = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
/** Model geometry remains body-local. Its quaternion includes the inertial basis rotation. */
export function renderAttitude(out: Quaternion, q: readonly [number, number, number, number]): Quaternion {
 return out.fromArray(q).premultiply(CORE_TO_RENDER);
}
