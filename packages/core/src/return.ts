import type { OrbitChoice } from './contracts';
import { CONSTANTS } from './physics';

export const CREW_DEORBIT_BURN_SEC = 10;

/** Authored recovery opportunities every 90 minutes, open ten minutes from 12 h onward. */
export function crewReturnWindow(elapsedSec: number): { open: boolean; nextSec: number; remainingSec: number } {
 const first = 12 * 3600, period = 5400, width = 600;
 if (elapsedSec < first) return { open: false, nextSec: first - elapsedSec, remainingSec: 0 };
 const phase = (elapsedSec - first) % period;
 return { open: phase < width, nextSec: phase < width ? 0 : period - phase, remainingSec: phase < width ? width - phase : 0 };
}
/** Impulsive two-body burn from orbit apoapsis to authored 80 km entry perigee. */
export function crewReturnFuel(orbit: OrbitChoice, wetMassKg: number, ispSec: number): number {
 if (orbit.body !== 'EARTH' || wetMassKg <= 0 || ispSec <= 0) return Infinity;
 const radius = CONSTANTS.EARTH.radius.v, rp = radius + 80, ra = orbit.smaKm * (1 + orbit.ecc), mu = CONSTANTS.EARTH.mu.v;
 if (ra <= rp) return Infinity;
 const vBefore = Math.sqrt(mu * (2 / ra - 1 / orbit.smaKm)), vAfter = Math.sqrt(mu * (2 / ra - 2 / (rp + ra)));
 return wetMassKg * -Math.expm1(-Math.max(0, vBefore - vAfter) * 1000 / (ispSec * CONSTANTS.g0.v));
}
