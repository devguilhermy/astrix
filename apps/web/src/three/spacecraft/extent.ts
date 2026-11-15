import type { Design } from '@astrix/core';
import { installedInstances } from './model';
import { BUS_GEOMETRY, type PartSlot } from './slots';

/** Farthest reach of a part from its own origin, always for the deployed state so the clearance never jumps. */
function reachM(slot: PartSlot): number {
  const [x, y, z] = slot.size;
  switch (slot.shape) {
    case 'wings': return Math.hypot(x / 2, y / 2, 1.22 * z);
    case 'whip': return Math.hypot(x / 2, y / 2, 3.8 * z);
    case 'dish': return Math.hypot(x / 2, y / 2, .84 * z);
    default: return Math.hypot(x / 2, y / 2, z / 2);
  }
}

/**
 * Bounding radius of the displayed hardware in metres: the bus half-diagonal or, per
 * installed instance, its distance from the bus centre plus its deployed reach.
 */
export function hardwareRadiusM(design: Design): number {
  let radius = Math.hypot(...BUS_GEOMETRY[design.busId].dimensions) / 2;
  for (const instance of installedInstances(design)) radius = Math.max(radius, Math.hypot(...instance.position) + reachM(instance.slot));
  return radius;
}
