// Adapted from Void Protocol stores/uiTracking.ts, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
/**
 * Screen rectangles for panels that follow a 3D object (the Component panel).
 * Written up to once per rendered frame by the scene, read by DraggablePanel,
 * which places the panel beside the rectangle as a direct DOM style. Kept out of
 * Zustand: a store write would re-render React subscribers every frame.
 */
export interface ScreenRect { left: number; top: number; right: number; bottom: number }

export interface TrackedTarget {
  /** The object's projected silhouette in viewport CSS pixels, or null when it is not on screen. */
  rect: ScreenRect | null;
  /** Automatic placement is on until the player moves the panel by hand. */
  isTracking: boolean;
}

type Listener = (target: TrackedTarget) => void;
const targets = new Map<string, TrackedTarget>();
const listeners = new Map<string, Set<Listener>>();

function targetFor(id: string): TrackedTarget {
  let target = targets.get(id);
  if (!target) { target = { rect: null, isTracking: false }; targets.set(id, target); }
  return target;
}
function notify(id: string, target: TrackedTarget): void {
  for (const listener of listeners.get(id) ?? []) listener(target);
}
const same = (a: ScreenRect | null, b: ScreenRect | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);

export function getTrackedTarget(id: string): TrackedTarget | undefined { return targets.get(id); }

/** Moves the target; unchanged rectangles do not notify. */
export function setTrackedRect(id: string, rect: ScreenRect | null): void {
  const target = targetFor(id);
  if (same(target.rect, rect)) return;
  target.rect = rect ? { ...rect } : null;
  notify(id, target);
}

export function setTracking(id: string, isTracking: boolean): void {
  const target = targetFor(id);
  if (target.isTracking === isTracking) return;
  target.isTracking = isTracking;
  notify(id, target);
}

export function subscribeTrackedTarget(id: string, listener: Listener): () => void {
  let set = listeners.get(id);
  if (!set) { set = new Set(); listeners.set(id, set); }
  set.add(listener);
  return () => { set.delete(listener); };
}
