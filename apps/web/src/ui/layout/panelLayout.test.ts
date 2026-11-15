import { beforeEach, describe, expect, test } from 'bun:test';
import { clampRectangle, closedControllerHeight, defaultRectangle, MISSION_PANEL_IDS, layoutClass, MINIMUM_SIZE, moveRectangle, PANEL_IDS, resizeRectangle, sheetRectangle, type Rectangle, type ResizeEdge } from './panelLayout';
import { effectiveRectangle, useWindows } from './windows';

const bounds: Rectangle = { x: 10, y: 190, width: 1260, height: 600 };
const origin: Rectangle = { x: 100, y: 240, width: 420, height: 300 };

beforeEach(() => {
 useWindows.getState().resetLayout();
 useWindows.getState().setViewport(bounds, 'desktop');
});

describe('bounded window geometry', () => {
 test('oversized restoration fits both dimensions without changing the preferred rectangle', () => {
  const preferred = { x: 1100, y: 700, width: 800, height: 650 };
  const small = { x: 7, y: 160, width: 306, height: 180 };
  const before = { ...preferred };
  expect(clampRectangle(preferred, small, MINIMUM_SIZE.mission)).toEqual(small);
  expect(preferred).toEqual(before);
 });
 test('all eight resize edges remain bounded after crossing their opposite edge', () => {
  for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]) {
   for (const delta of [{ x: -10000, y: -10000 }, { x: 10000, y: 10000 }]) {
    const next = resizeRectangle(origin, edge, delta, bounds, MINIMUM_SIZE.mission);
    expect(next.x).toBeGreaterThanOrEqual(bounds.x);
    expect(next.y).toBeGreaterThanOrEqual(bounds.y);
    expect(next.width).toBeGreaterThanOrEqual(320);
    expect(next.height).toBeGreaterThanOrEqual(240);
    expect(next.x + next.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(next.y + next.height).toBeLessThanOrEqual(bounds.y + bounds.height);
   }
  }
 });
 test('top-left resizing anchors bottom-right, including minimum-size crossing', () => {
  expect(resizeRectangle(origin, 'nw', { x: 50, y: 20 }, bounds, MINIMUM_SIZE.mission)).toEqual({ x: 150, y: 260, width: 370, height: 280 });
  expect(resizeRectangle(origin, 'nw', { x: 900, y: 900 }, bounds, MINIMUM_SIZE.mission)).toEqual({ x: 200, y: 300, width: 320, height: 240 });
 });
 test('keyboard moves use the same bounds and exact 10 / 40 pixel steps', () => {
  expect(moveRectangle(origin, 'ArrowRight', false, bounds, MINIMUM_SIZE.mission)).toEqual({ ...origin, x: 110 });
  expect(moveRectangle(origin, 'ArrowDown', true, bounds, MINIMUM_SIZE.mission)).toEqual({ ...origin, y: 280 });
  expect(moveRectangle(origin, 'ArrowUp', true, bounds, MINIMUM_SIZE.mission).y).toBe(200);
  expect(moveRectangle({ ...origin, x: 11 }, 'ArrowLeft', true, bounds, MINIMUM_SIZE.mission).x).toBe(10);
 });
 test('safe-area offsets and tiny / empty workspace never place geometry outside bounds', () => {
  for (const usable of [bounds, { x: 23, y: 270, width: 294, height: 120 }, { x: 8, y: 480, width: 0, height: 0 }]) {
   for (const id of PANEL_IDS) {
    const rect = defaultRectangle(id, usable);
    expect(rect.x).toBeGreaterThanOrEqual(usable.x);
    expect(rect.y).toBeGreaterThanOrEqual(usable.y);
    expect(rect.x + rect.width).toBeLessThanOrEqual(usable.x + usable.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(usable.y + usable.height);
   }
  }
 });
 test('compact height is bounded independently, with expand preserving its preference', () => {
  const usable = { x: 10, y: 200, width: 300, height: 420 };
  expect(sheetRectangle(280, usable, 'review')).toEqual({ x: 10, y: 340, width: 300, height: 280 });
  expect(sheetRectangle(280, usable, 'review', true)).toEqual(usable);
  expect(sheetRectangle(9000, usable, 'mission')).toEqual(usable);
  expect(layoutClass({ width: 320, height: 256 }, 80)).toBe('reading');
  expect(layoutClass({ width: 1100, height: 900 }, 400, 2)).toBe('reading');
  expect(layoutClass({ width: 320, height: 844 }, 560)).toBe('compact');
 });
});

describe('window geometry intent retention', () => {
 test('all collapsed windows restore exact desktop geometry after temporary viewport clamping', () => {
  const preferred = { x: 620, y: 220, width: 600, height: 520 };
  useWindows.getState().setGeometry('mission', preferred);
  for (const id of PANEL_IDS) useWindows.getState().collapse(id);
  expect(PANEL_IDS.every(id => useWindows.getState().windows[id].visibility === 'COLLAPSED')).toBe(true);
  useWindows.getState().setViewport({ x: 10, y: 200, width: 500, height: 280 }, 'desktop');
  useWindows.getState().expand('mission');
  expect(effectiveRectangle('mission')).toEqual({ x: 10, y: 200, width: 500, height: 280 });
  expect(useWindows.getState().windows.mission.preferredDesktop).toEqual(preferred);
  useWindows.getState().setViewport(bounds, 'desktop');
  expect(effectiveRectangle('mission')).toEqual(preferred);
 });
 test('compact selection is not collapse and does not overwrite desktop preferences', () => {
  useWindows.getState().setGeometry('readiness', origin);
  expect(useWindows.getState().windows.readiness.preferredDesktop).toEqual(origin);
  const compactBounds = { x: 10, y: 200, width: 300, height: 500 };
  useWindows.getState().setViewport(compactBounds, 'compact');
  useWindows.getState().expand('review');
  expect(useWindows.getState().compactWindow).toBe('review');
  expect(useWindows.getState().windows.readiness.visibility).toBe('COLLAPSED');
  useWindows.getState().expand('readiness');
  useWindows.getState().setCompactHeight('readiness', 380);
  useWindows.getState().toggleExpanded('readiness');
  const expanded = effectiveRectangle('readiness');
  expect(expanded).toEqual(compactBounds);
  for (const id of MISSION_PANEL_IDS.filter(id => id !== 'readiness')) expect(effectiveRectangle(id).height).toBe(0);
  useWindows.getState().toggleExpanded('readiness');
  expect(effectiveRectangle('readiness').height).toBe(380);
  expect(useWindows.getState().windows.readiness.preferredDesktop).toEqual(origin);
  useWindows.getState().setViewport(bounds, 'desktop');
  expect(effectiveRectangle('readiness')).toEqual(origin);
 });
 test('the component sheet stays within controller-cleared bounds and retains its desktop anchor', () => {
  const compactBounds = { x: 0, y: 140, width: 390, height: 640 };
  useWindows.getState().resetLayout();
  useWindows.getState().setViewport(compactBounds, 'compact');
  useWindows.getState().expand('part');
  expect(useWindows.getState().compactWindow).toBe('part');
  const sheet = effectiveRectangle('part');
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(compactBounds.y + compactBounds.height);
  for (const id of MISSION_PANEL_IDS) expect(effectiveRectangle(id).height).toBe(0);
  const desktop = { x: 8, y: 56, width: 1424, height: 760 };
  const rect = defaultRectangle('part', desktop);
  expect(rect.x + rect.width).toBeLessThanOrEqual(desktop.x + desktop.width - 296);
  expect(rect.y).toBe(desktop.y + 8);
 });
 test('raising a expanded window preserves geometry and independent collapsed intents', () => {
  useWindows.getState().setGeometry('mission', origin);
  useWindows.getState().collapse('review');
  useWindows.getState().expand('mission');
  useWindows.getState().raise('readiness');
  expect(effectiveRectangle('mission')).toEqual(origin);
  expect(useWindows.getState().windows.review.visibility).toBe('COLLAPSED');
  expect(useWindows.getState().windows.readiness.order).toBeGreaterThan(useWindows.getState().windows.mission.order);
 });
});

test('resetting layout changes only geometry / visibility / order, retaining content scroll memory', () => {
 const state = useWindows.getState();
 useWindows.setState({ windows: { ...state.windows, mission: { ...state.windows.mission, scrollPositions: { DESIGN: 275 } } } });
 useWindows.getState().setGeometry('mission', origin);
 useWindows.getState().collapse('mission');
 useWindows.getState().resetLayout();
 expect(useWindows.getState().windows.mission.visibility).toBe('EXPANDED');
 expect(useWindows.getState().windows.mission.preferredDesktop).toBeNull();
 expect(useWindows.getState().windows.mission.scrollPositions.DESIGN).toBe(275);
});

test('collapsed tools consume no scene area and restore their complete preferred rectangle',()=>{useWindows.getState().setGeometry('mission',origin);useWindows.getState().collapse('mission');expect(effectiveRectangle('mission').height).toBe(0);expect(effectiveRectangle('mission').width).toBe(0);useWindows.getState().expand('mission');expect(effectiveRectangle('mission')).toEqual(origin);});
test('entering compact layout starts with a clear scene without erasing desktop expansion intent',()=>{useWindows.getState().setViewport({x:8,y:240,width:374,height:360},'compact');expect(useWindows.getState().compactWindow).toBeNull();expect(useWindows.getState().windows.mission.visibility).toBe('EXPANDED');expect(effectiveRectangle('mission').height).toBe(0);});

test('modal pause text does not switch a normal-height phone flight to reading, while real panel bounds reserve it',()=>{
 const viewport={width:320,height:844},workspaceTop=250,base=309,notice=19,gap=4;
 const usableWithoutNotice=viewport.height-base-16-workspaceTop;
 const baseWithNotice=base+notice+gap;
 expect(layoutClass(viewport,usableWithoutNotice)).toBe('compact');
 expect(layoutClass(viewport,viewport.height-baseWithNotice-16-workspaceTop)).toBe('reading');
 const stableHeight=closedControllerHeight(baseWithNotice,notice,gap);
 expect(stableHeight).toBe(base);
 expect(layoutClass(viewport,viewport.height-stableHeight-16-workspaceTop)).toBe('compact');
 const controllerTop=viewport.height-baseWithNotice-8;
 const actualBounds={x:8,y:workspaceTop,width:304,height:controllerTop-8-workspaceTop};
 const panel=clampRectangle({x:8,y:workspaceTop,width:304,height:420},actualBounds,MINIMUM_SIZE.mission);
 expect(panel.y+panel.height).toBeLessThanOrEqual(controllerTop-8);
 expect(panel.height).toBe(actualBounds.height);
 expect(closedControllerHeight(base,0,gap)).toBe(base);
});
