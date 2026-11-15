import { describe, expect, test } from 'bun:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { followsTrackedTarget, placeBesideBounds, TRACKED_BOUNDS_GAP } from './panelPlacement';
import { getTrackedTarget, setTrackedRect, setTracking, subscribeTrackedTarget } from './trackedTargets';
import { projectBox } from '../../three/spacecraft/projectBounds';

const workspace = { x: 8, y: 56, width: 1424, height: 760 };
const size = { width: 300, height: 400 };
const inside = (p: { x: number; y: number }) => p.x >= workspace.x && p.y >= workspace.y && p.x + size.width <= workspace.x + workspace.width && p.y + size.height <= workspace.y + workspace.height;

describe('tracked component panel placement', () => {
  test('sits to the right of the silhouette with the gap, vertically centred', () => {
    const body = { left: 600, top: 380, right: 700, bottom: 480 };
    const placed = placeBesideBounds(body, size, workspace, []);
    expect(placed).toEqual({ x: 700 + TRACKED_BOUNDS_GAP, y: 430 - 200, side: 'right' });
  });
  test('flips to a free side near the right edge and never leaves the workspace', () => {
    const body = { left: 1250, top: 380, right: 1400, bottom: 480 };
    const placed = placeBesideBounds(body, size, workspace, []);
    expect(placed.side).toBe('left');
    expect(placed.x + size.width).toBeLessThanOrEqual(body.left - TRACKED_BOUNDS_GAP);
    expect(inside(placed)).toBe(true);
  });
  test('avoids an occupied HUD surface when another side is clear', () => {
    const body = { left: 600, top: 380, right: 700, bottom: 480 };
    const capcom = { x: 700, y: 56, width: 732, height: 760 };
    const placed = placeBesideBounds(body, size, workspace, [capcom]);
    expect(placed.side).toBe('left');
  });
  test('keeps its previous side despite a sliver of overlap, instead of flickering while the view is dragged', () => {
    const body = { left: 600, top: 380, right: 700, bottom: 480 };
    // Grazes the left placement (x 276..576, y 230..630) by 16 px²; the right side is entirely clear.
    const sliver = [{ x: 560, y: 229, width: 20, height: 2 }];
    expect(placeBesideBounds(body, size, workspace, sliver).side).toBe('right');
    expect(placeBesideBounds(body, size, workspace, sliver, 'left').side).toBe('left');
    // A large overlap does move it.
    expect(placeBesideBounds(body, size, workspace, [{ x: 276, y: 230, width: 300, height: 400 }], 'left').side).toBe('right');
  });
  test('a dragged or manually placed panel never follows', () => {
    expect(followsTrackedTarget({ isTracking: true }, false)).toBe(true);
    expect(followsTrackedTarget({ isTracking: true }, true)).toBe(false);
    expect(followsTrackedTarget({ isTracking: false }, false)).toBe(false);
    expect(followsTrackedTarget(undefined, false)).toBe(false);
  });
  test('the tracking store notifies only on change', () => {
    let calls = 0;
    const stop = subscribeTrackedTarget('test', () => calls++);
    setTrackedRect('test', { left: 1, top: 2, right: 3, bottom: 4 });
    setTrackedRect('test', { left: 1, top: 2, right: 3, bottom: 4 });
    setTracking('test', true); setTracking('test', true);
    stop(); setTrackedRect('test', null);
    expect(calls).toBe(2);
    expect(getTrackedTarget('test')?.isTracking).toBe(true);
  });
});

describe('component silhouette projection', () => {
  const canvas = { left: 0, top: 0, width: 1000, height: 500 };
  const camera = new PerspectiveCamera(50, 2, .01, 100);
  camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  test('a centred box projects symmetrically around the canvas centre', () => {
    const rect = projectBox(new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)), camera, canvas)!;
    expect((rect.left + rect.right) / 2).toBeCloseTo(500, 6);
    expect((rect.top + rect.bottom) / 2).toBeCloseTo(250, 6);
    expect(rect.right - rect.left).toBeGreaterThan(0);
  });
  test('a box behind the camera or off screen has no rectangle', () => {
    expect(projectBox(new Box3(new Vector3(-.1, -.1, 6), new Vector3(.1, .1, 7)), camera, canvas)).toBeNull();
    expect(projectBox(new Box3(new Vector3(40, -.1, -.1), new Vector3(41, .1, .1)), camera, canvas)).toBeNull();
    expect(projectBox(new Box3(), camera, canvas)).toBeNull();
  });
  test('a box crossing the camera plane reports the whole canvas', () => {
    expect(projectBox(new Box3(new Vector3(-1, -1, 4), new Vector3(1, 1, 6)), camera, canvas)).toEqual({ left: 0, top: 0, right: 1000, bottom: 500 });
  });
});
