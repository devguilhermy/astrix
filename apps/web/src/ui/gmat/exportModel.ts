import { orbitAltitudes, type OrbitChoice } from '@astrix/core';
import { exportInitialOrbit, parseInitialOrbit, utcMillis } from '@astrix/core/interop/gmat';

export type ExportBody = 'EARTH' | 'MARS';
export interface ExportDraft { body: ExportBody; epochUTC: string; sma: string; ecc: string; inc: string; raan: string; aop: string; ta: string }
export type ExportBuild =
  | { ok: true; orbit: OrbitChoice; script: string; periapsisAltKm: number; apoapsisAltKm: number; roundTrip: 'exact' | 'mismatch' }
  | { ok: false; error: string };

export const SPACECRAFT = 'Astrix';
export const defaultDraft: ExportDraft = { body: 'EARTH', epochUTC: '2024-05-01T00:00:00.000Z', sma: '7000', ecc: '0.01', inc: '51.6', raan: '73', aop: '116', ta: '205' };

function number(label: string, text: string): number {
  if (!text.trim()) throw new Error(`${label} is required`);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

/**
 * Builds the GMAT initial-state script and proves it by feeding it back through the importer:
 * the importer owns every validity rule (SMA, eccentricity, inclination, periapsis above surface),
 * so a draft that exports is a draft that imports.
 */
export function buildExport(draft: ExportDraft): ExportBuild {
  try {
    const orbit: OrbitChoice = {
      body: draft.body, frame: 'MJ2000Eq', epochUTC: new Date(utcMillis(draft.epochUTC)).toISOString(),
      smaKm: number('SMA', draft.sma), ecc: number('ECC', draft.ecc), inclinationDeg: number('INC', draft.inc),
      raanDeg: number('RAAN', draft.raan), argPeriapsisDeg: number('AOP', draft.aop), trueAnomalyDeg: number('TA', draft.ta),
    };
    const script = exportInitialOrbit(orbit);
    const back = parseInitialOrbit(script, SPACECRAFT);
    const same = (Object.keys(orbit) as (keyof OrbitChoice)[]).every(key => orbit[key] === back[key]);
    const altitudes = orbitAltitudes(orbit);
    return { ok: true, orbit, script, periapsisAltKm: altitudes.altitudeKm, apoapsisAltKm: altitudes.apoapsisAltitudeKm, roundTrip: same ? 'exact' : 'mismatch' };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
}
