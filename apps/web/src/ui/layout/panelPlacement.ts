// Adapted from Void Protocol utils/panelPlacement.ts (placeBesideBounds, containmentShift, followsTrackedTarget), pin 218625d
// (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence). Bounds here are ASTRIX workspace rectangles.
import type { Rectangle } from './panelLayout';
import type { ScreenRect, TrackedTarget } from './trackedTargets';

/** Clearance between a projected component silhouette and its panel. */
export const TRACKED_BOUNDS_GAP = 24;
/** Area (px²) a previous side may lose to occupied surfaces before the panel jumps sides. */
const SIDE_STABILITY = 64;

export type PanelSide = 'right' | 'left' | 'bottom' | 'top';
export interface Placement { x: number; y: number; side: PanelSide }

function axisShift(start: number, size: number, min: number, max: number): number {
  // Larger than the free span: pin the start edge so the header stays reachable.
  if (size > max - min) return min - start;
  if (start < min) return min - start;
  if (start + size > max) return max - (start + size);
  return 0;
}

/** The smallest move that brings the box inside the workspace (start edges win when it cannot fit). */
export function containmentShift(box: Rectangle, bounds: Rectangle): { dx: number; dy: number } {
  return {
    dx: Math.round(axisShift(box.x, box.width, bounds.x, bounds.x + bounds.width)),
    dy: Math.round(axisShift(box.y, box.height, bounds.y, bounds.y + bounds.height)),
  };
}

const overlap = (a: ScreenRect, b: ScreenRect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const toScreen = (r: Rectangle): ScreenRect => ({ left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height });

/**
 * Places a panel of `size` beside the whole silhouette: right, left, bottom, then top, each contained in the workspace,
 * ranked by silhouette overlap, then overlap with occupied HUD surfaces, then distance from the previous placement.
 * The previous side is kept while it stays clear of the silhouette and within a small occupied-area band, so the panel
 * does not flicker between sides while the view is dragged.
 */
export function placeBesideBounds(body: ScreenRect, size: { width: number; height: number }, bounds: Rectangle, occupied: readonly Rectangle[], previousSide?: PanelSide): Placement {
  const cx = (body.left + body.right) / 2, cy = (body.top + body.bottom) / 2;
  const raw: { side: PanelSide; x: number; y: number }[] = [
    { side: 'right', x: body.right + TRACKED_BOUNDS_GAP, y: cy - size.height / 2 },
    { side: 'left', x: body.left - TRACKED_BOUNDS_GAP - size.width, y: cy - size.height / 2 },
    { side: 'bottom', x: cx - size.width / 2, y: body.bottom + TRACKED_BOUNDS_GAP },
    { side: 'top', x: cx - size.width / 2, y: body.top - TRACKED_BOUNDS_GAP - size.height },
  ];
  const candidates = raw.map(candidate => {
    const box = { x: candidate.x, y: candidate.y, ...size }, shift = containmentShift(box, bounds);
    const x = Math.round(box.x + shift.dx), y = Math.round(box.y + shift.dy), rect = toScreen({ x, y, ...size });
    return { side: candidate.side, x, y, bodyOverlap: overlap(rect, body), occupiedOverlap: occupied.reduce((sum, other) => sum + overlap(rect, toScreen(other)), 0), displacement: 0 };
  });
  const previous = previousSide && candidates.find(candidate => candidate.side === previousSide);
  const prior = previous ?? candidates[0];
  for (const candidate of candidates) candidate.displacement = (candidate.x - prior.x) ** 2 + (candidate.y - prior.y) ** 2;
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.bodyOverlap < best.bodyOverlap
      || (candidate.bodyOverlap === best.bodyOverlap && candidate.occupiedOverlap < best.occupiedOverlap)
      || (candidate.bodyOverlap === best.bodyOverlap && candidate.occupiedOverlap === best.occupiedOverlap && candidate.displacement < best.displacement)) best = candidate;
  }
  if (previous && previous.bodyOverlap === 0 && previous.occupiedOverlap <= best.occupiedOverlap + SIDE_STABILITY) best = previous;
  return { x: best.x, y: best.y, side: best.side };
}

/** A manual move turns tracking off and only a new inspection or Follow turns it back on; a panel being dragged never follows. */
export function followsTrackedTarget(target: Pick<TrackedTarget, 'isTracking'> | undefined, dragging: boolean): boolean {
  return target?.isTracking === true && !dragging;
}
