// Heliocentric orbits shared by the solar-orbit ride (catalog) and the Sun missions (builtins); neither module may import the other.
import type { OrbitChoice } from '../contracts';
import { CONSTANTS } from '../physics';

const AU_KM = CONSTANTS.EARTH.distanceKm.v;
/** Elements are MJ2000Eq like every OrbitChoice. An orbit in the ecliptic plane has inclination equal to the obliquity (23.439°)
 * and its ascending node at the equinox (RAAN 0), so argument of periapsis + true anomaly is the ecliptic longitude used by planetPosition. */
const ecliptic = (smaAu: number, ecc: number, perihelionLongitudeDeg: number, trueAnomalyDeg: number, epochUTC: string): OrbitChoice => ({
 body: 'SUN', epochUTC, frame: 'MJ2000Eq', smaKm: smaAu * AU_KM, ecc, inclinationDeg: 23.439, raanDeg: 0, argPeriapsisDeg: perihelionLongitudeDeg, trueAnomalyDeg,
});
const EPOCH = '2026-11-14T00:00:00Z';
/** STEREO-A-like leading orbit: 0.96 AU, near-circular (346-day period, so it keeps drifting ahead of Earth).
 * At the epoch Earth is at ecliptic longitude 51.6°; the craft starts at perihelion 120° ahead of it (171.6°). */
export const SUN_AHEAD: OrbitChoice = ecliptic(0.96, 0.005, 171.6, 0, EPOCH);
/** Preset identifiers and orbits offered by the solar-orbit ride, in display order. */
export const SOLAR_ORBIT_PRESETS: readonly { readonly id: string; readonly orbit: OrbitChoice }[] = [{ id: 'SUN_AHEAD', orbit: SUN_AHEAD }];
