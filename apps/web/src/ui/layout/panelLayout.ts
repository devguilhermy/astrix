/** Docked panels always have a header; `part` is a transient component sheet opened from the spacecraft. */
export const DOCKED_PANEL_IDS = ['mission', 'readiness', 'review', 'log'] as const;
export const PANEL_IDS = [...DOCKED_PANEL_IDS, 'part'] as const;
export type PanelId = typeof PANEL_IDS[number];
export type LayoutClass = 'desktop' | 'compact' | 'reading';
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rectangle extends Point, Size {}
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const MINIMUM_SIZE: Record<PanelId, Size> = {
 mission: { width: 320, height: 240 }, readiness: { width: 260, height: 180 }, review: { width: 260, height: 160 }, log: { width: 260, height: 160 }, part: { width: 260, height: 200 },
};
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

/** Bounds are the usable workspace, already excluding chrome and safe areas. Never mutate the preferred rectangle. */
export function clampRectangle(preferred: Rectangle, bounds: Rectangle, minimum: Size): Rectangle {
 const width = clamp(finite(preferred.width, minimum.width), Math.min(minimum.width, bounds.width), bounds.width);
 const height = clamp(finite(preferred.height, minimum.height), Math.min(minimum.height, bounds.height), bounds.height);
 return {
  x: clamp(finite(preferred.x, bounds.x), bounds.x, bounds.x + bounds.width - width),
  y: clamp(finite(preferred.y, bounds.y), bounds.y, bounds.y + bounds.height - height), width, height,
 };
}

/** Opposite edges stay anchored, including when dragging beyond a minimum or across the opposite edge. */
export function resizeRectangle(origin: Rectangle, edge: ResizeEdge, delta: Point, bounds: Rectangle, minimum: Size): Rectangle {
 const right = origin.x + origin.width, bottom = origin.y + origin.height;
 const minWidth = Math.min(minimum.width, bounds.width), minHeight = Math.min(minimum.height, bounds.height);
 let { x, y, width, height } = origin;
 if (edge.includes('w')) { x = clamp(origin.x + delta.x, bounds.x, right - minWidth); width = right - x; }
 if (edge.includes('e')) width = clamp(origin.width + delta.x, minWidth, bounds.x + bounds.width - origin.x);
 if (edge.includes('n')) { y = clamp(origin.y + delta.y, bounds.y, bottom - minHeight); height = bottom - y; }
 if (edge.includes('s')) height = clamp(origin.height + delta.y, minHeight, bounds.y + bounds.height - origin.y);
 return clampRectangle({ x, y, width, height }, bounds, minimum);
}

export function moveRectangle(origin: Rectangle, key: string, large: boolean, bounds: Rectangle, minimum: Size): Rectangle {
 const step = large ? 40 : 10;
 return clampRectangle({ ...origin,
  x: origin.x + (key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0),
  y: origin.y + (key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0),
 }, bounds, minimum);
}

export function defaultRectangle(id: PanelId, bounds: Rectangle): Rectangle {
 if (id === 'part') {
  // Beside the right-hand header column, clear of the centred spacecraft and of CAPCOM.
  const width = Math.min(300, bounds.width * .3), height = Math.min(430, bounds.height * .7);
  return clampRectangle({ x: bounds.x + bounds.width - width - 296, y: bounds.y + 8, width, height }, bounds, MINIMUM_SIZE[id]);
 }
 const width = id === 'mission' ? Math.min(380, bounds.width * .3) : 280;
 const height = id === 'mission' ? Math.min(390, bounds.height * .55) : 240;
 return clampRectangle({ x: id === 'mission' ? bounds.x + Math.min(192,bounds.width*.15) : id === 'log' ? bounds.x : bounds.x + bounds.width - width,
  y: id === 'mission' ? bounds.y + bounds.height - height : id === 'log' ? bounds.y + bounds.height - 44 : bounds.y + (id === 'review' ? 270 : 218), width, height }, bounds, MINIMUM_SIZE[id]);
}

export function sheetRectangle(preferredHeight: number, bounds: Rectangle, id: PanelId, expanded = false): Rectangle {
 const height = expanded ? bounds.height : clamp(finite(preferredHeight, 360), Math.min(MINIMUM_SIZE[id].height, bounds.height), bounds.height);
 return { x: bounds.x, y: bounds.y + bounds.height - height, width: bounds.width, height };
}

/** Compact sheets leave both rows of panel headers reachable below the body. */
export function compactSheetBounds(bounds: Rectangle): Rectangle {
 const headerRows = Math.ceil(DOCKED_PANEL_IDS.length / 2);
 return { ...bounds, height: Math.max(0, bounds.height - headerRows * 44 - 8) };
}

export function layoutClass(viewport: Size, usableHeight: number, scale = 1): LayoutClass {
 if (usableHeight < 260 || (scale > 1.5 && usableHeight < 440)) return 'reading';
 return viewport.width < 900 ? 'compact' : 'desktop';
}
