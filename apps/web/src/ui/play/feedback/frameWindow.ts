/**
 * Pure geometry for the simulated observation frame. The archive maps are
 * equirectangular with longitude 0 at the horizontal centre and the north pole at
 * the top, the same convention the planet texture uses in the scene.
 */

/** Frame aspect ratio, width over height. */
export const FRAME_ASPECT = 16 / 10;

/** One horizontal piece of the window, in map fractions (u) and frame fractions (x). */
export interface FrameSlice { u0: number; u1: number; x0: number; x1: number }
export interface FrameWindow {
  centerLatDeg: number;
  centerLonDeg: number;
  lonSpanDeg: number;
  latSpanDeg: number;
  /** Top and bottom edges in map fractions (0 = north pole). */
  v0: number;
  v1: number;
  /** One slice, or two when the window crosses ±180°. */
  slices: readonly FrameSlice[];
}
export type FrameLight = 'day' | 'twilight' | 'night';

const wrap180 = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;

/** Longitude span sized to the map resolution: 36° for a 2048 px map, 60° for smaller maps. */
export function lonSpanFor(mapWidthPx: number): number {
  return mapWidthPx >= 2048 ? 36 : 60;
}

/** Window centred on a ground point, clamped so it never leaves ±90° latitude. */
export function frameWindow(center: { latDeg: number; lonDeg: number }, mapWidthPx: number): FrameWindow {
  const lonSpanDeg = lonSpanFor(mapWidthPx), latSpanDeg = lonSpanDeg / FRAME_ASPECT, half = latSpanDeg / 2;
  const lat = Number.isFinite(center.latDeg) ? center.latDeg : 0, lon = Number.isFinite(center.lonDeg) ? center.lonDeg : 0;
  const centerLatDeg = Math.min(90 - half, Math.max(-90 + half, lat)), centerLonDeg = wrap180(lon);
  const v0 = (90 - (centerLatDeg + half)) / 180, v1 = (90 - (centerLatDeg - half)) / 180;
  const width = lonSpanDeg / 360, start = (centerLonDeg - lonSpanDeg / 2 + 180) / 360, end = start + width;
  const slices: FrameSlice[] = [];
  if (start < 0) {
    const split = -start / width;
    slices.push({ u0: start + 1, u1: 1, x0: 0, x1: split }, { u0: 0, u1: end, x0: split, x1: 1 });
  } else if (end > 1) {
    const split = (1 - start) / width;
    slices.push({ u0: start, u1: 1, x0: 0, x1: split }, { u0: 0, u1: end - 1, x0: split, x1: 1 });
  } else slices.push({ u0: start, u1: end, x0: 0, x1: 1 });
  return { centerLatDeg, centerLonDeg, lonSpanDeg, latSpanDeg, v0, v1, slices };
}

/** Hermite smoothstep between two edges. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

/** Ground brightness from the Sun's elevation: 0.18 at night, 1 in full daylight. */
export function frameBrightness(sunElevationDeg: number): number {
  return 0.18 + 0.82 * smoothstep(-6, 12, Number.isFinite(sunElevationDeg) ? sunElevationDeg : -90);
}

/** Night below civil twilight (−6°), day once the Sun is 6° above the horizon. */
export function frameLight(sunElevationDeg: number): FrameLight {
  return !(sunElevationDeg >= -6) ? 'night' : sunElevationDeg < 6 ? 'twilight' : 'day';
}

/** Source rectangle in map pixels and destination rectangle in frame pixels for each slice. */
export function sliceRects(window: FrameWindow, mapWidth: number, mapHeight: number, frameWidth: number, frameHeight: number) {
  return window.slices.map(slice => ({
    sx: slice.u0 * mapWidth, sy: window.v0 * mapHeight, sw: (slice.u1 - slice.u0) * mapWidth, sh: (window.v1 - window.v0) * mapHeight,
    dx: slice.x0 * frameWidth, dy: 0, dw: (slice.x1 - slice.x0) * frameWidth, dh: frameHeight,
  }));
}
