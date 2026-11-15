/** Pure SVG geometry for the reading strip chart and the report timeline band. */

export interface SeriesRange { min: number; max: number }

/** Minimum and maximum of the finite values, or null when there are none. */
export function seriesRange(values: readonly number[]): SeriesRange | null {
  let min = Infinity, max = -Infinity;
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
  return min <= max ? { min, max } : null;
}

/**
 * Polyline points for values spread evenly across `width`, or at the centre of equal
 * columns when `centred` is set (so a band lines up with a row of equal chips).
 * Non-finite values break nothing: they are skipped. A flat series sits mid-height.
 */
export function seriesPoints(values: readonly number[], width: number, height: number, options: { range?: SeriesRange; pad?: number; centred?: boolean } = {}): string {
  const range = options.range ?? seriesRange(values), pad = options.pad ?? 0;
  if (!range || !values.length) return '';
  const span = range.max - range.min, inner = height - 2 * pad, count = values.length;
  const points: string[] = [];
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const x = options.centred ? (index + .5) * width / count : count === 1 ? width / 2 : index * width / (count - 1);
    const fraction = span > 0 ? (Math.min(range.max, Math.max(range.min, value)) - range.min) / span : .5;
    points.push(`${Math.round(x * 100) / 100},${Math.round((pad + (1 - fraction) * inner) * 100) / 100}`);
  });
  return points.join(' ');
}
