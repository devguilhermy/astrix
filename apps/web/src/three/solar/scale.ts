import type { ScenePoint } from '../committedScene';
import type { SolarBodyId } from '../SolarSystemScene';

/** Sizes share one scale with the Sun: radius = SUN_DISPLAY_RADIUS × diameterKm / SUN_DIAMETER_KM.
 * NASA NSSDCA diameters (plan §5.8); the Sun's volumetric mean radius is 695,700 km. Distances do not share it.
 */
export const SUN_DISPLAY_RADIUS = 6;
export const SUN_DIAMETER_KM = 1_391_400;
export const DIAMETER_KM: Readonly<Record<SolarBodyId, number>> = {
  SUN: SUN_DIAMETER_KM, MERCURY: 4879, VENUS: 12_104, EARTH: 12_756, MOON: 3475, MARS: 6792, JUPITER: 142_984, SATURN: 120_536, URANUS: 51_118, NEPTUNE: 49_528,
};
/** Invisible hit sphere so sub-pixel worlds stay clickable. Bodies at least this large are picked by their globe. */
export const PICK_RADIUS = .4;
/** Bodies below this radius get a screen-space locator dot. */
export const LOCATOR_RADIUS = .1;
export const labelOffset = (radius: number) => Math.max(radius, .12) + .16;

/** A point on a Sun-centred guide circle, keeping the authored direction (x, z) of the earlier schematic layout. */
export function onOrbit(x: number, z: number, orbitRadius: number): ScenePoint {
  const scale = orbitRadius / Math.hypot(x, z);
  return [x * scale, 0, z * scale];
}

/** `centre` moved by `distance` along the authored `direction`. */
export function offsetFrom(centre: ScenePoint, direction: ScenePoint, distance: number): ScenePoint {
  const scale = distance / Math.hypot(...direction);
  return [centre[0] + direction[0] * scale, centre[1] + direction[1] * scale, centre[2] + direction[2] * scale];
}

/** Circle around `centre` through `point`, in the plane holding the radius and the horizontal tangent. Starts at `point`. */
export function ringThrough(centre: ScenePoint, point: ScenePoint, segments = 192): ScenePoint[] {
  const u = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
  const radius = Math.hypot(u[0], u[1], u[2]), across = Math.hypot(u[0], u[2]);
  const v = [u[2] / across * radius, 0, -u[0] / across * radius];
  return Array.from({ length: segments }, (_, i): ScenePoint => {
    const angle = i / segments * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
    return [centre[0] + c * u[0] + s * v[0], centre[1] + c * u[1] + s * v[1], centre[2] + c * u[2] + s * v[2]];
  });
}

/** sRGB hex mixed toward white; `amount` 0 keeps the colour, 1 gives white. */
export function mixTowardWhite(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0].map(shift => Math.round(((value >> shift) & 255) * (1 - amount) + 255 * amount).toString(16).padStart(2, '0')).join('')}`;
}

/** How many of this body fit across the Sun's diameter. */
export const sunDiameterRatio = (id: SolarBodyId) => SUN_DIAMETER_KM / DIAMETER_KM[id];
