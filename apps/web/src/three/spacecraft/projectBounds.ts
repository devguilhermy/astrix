// Pattern from Void Protocol rendering/celestial/projectBodyBounds.ts, pin 218625d (owner-authorized reuse under project Apache-2.0;
// upstream pin declares no licence): a conservative projected silhouette, full viewport when it crosses the near plane.
import { Vector3, type Box3, type Camera } from 'three';
import type { ScreenRect } from '../../ui/layout/trackedTargets';

export interface CanvasRect { left: number; top: number; width: number; height: number }
const corner = new Vector3(), view = new Vector3();

/**
 * Projects a world-space box into viewport CSS pixels. Returns null when the box is empty, wholly behind the camera,
 * or wholly off the canvas. A box that crosses the camera plane reports the whole canvas rather than a wrong rectangle.
 */
export function projectBox(box: Box3, camera: Camera, canvas: CanvasRect): ScreenRect | null {
  if (box.isEmpty()) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, behind = 0;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    view.copy(corner).applyMatrix4(camera.matrixWorldInverse);
    if (view.z >= 0) { behind++; continue; }
    corner.project(camera);
    minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
  }
  if (behind === 8) return null;
  if (behind > 0) return { left: canvas.left, top: canvas.top, right: canvas.left + canvas.width, bottom: canvas.top + canvas.height };
  if (maxX < -1 || minX > 1 || maxY < -1 || minY > 1) return null;
  return {
    left: canvas.left + (minX + 1) / 2 * canvas.width,
    right: canvas.left + (maxX + 1) / 2 * canvas.width,
    top: canvas.top + (1 - maxY) / 2 * canvas.height,
    bottom: canvas.top + (1 - minY) / 2 * canvas.height,
  };
}
