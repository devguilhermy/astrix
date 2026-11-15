import type { Design } from './contracts';
import { computeBudgets } from './design';
import { orbitAltitudes } from './physics';

/** Authored area/mass screening only; not propagated drag or regulatory compliance. */
export function disposalScreen(design: Design): { status: 'NOT_APPLICABLE' | 'ESTIMATE' | 'UNKNOWN'; years: [number, number] | null; assumptions: string } {
 if (design.busId !== 'CUBESAT_3U') return { status: 'NOT_APPLICABLE', years: null, assumptions: 'No disposal model for this spacecraft class.' };
 if (!design.orbit || design.orbit.body !== 'EARTH') return { status: 'UNKNOWN', years: null, assumptions: 'Earth orbit required for this screening estimate.' };
 const alt = orbitAltitudes(design.orbit), mass = computeBudgets(design).massKg.used;
 if (alt.altitudeKm < 300 || alt.apoapsisAltitudeKm > 800 || mass <= 0) return { status: 'UNKNOWN', years: null, assumptions: 'Outside the authored 300–800 km screening envelope.' };
 const area = design.parts.some(p => p.partId === 'SOLAR_WINGS') ? .12 : .04;
 const years = .5 * Math.exp((alt.apoapsisAltitudeKm - 400) / 110) * (mass / 4) * (.04 / area);
 return { status: 'ESTIMATE', years: [years * .25, years * 4], assumptions: `Authored exponential altitude screen, ${area} m² area, ${mass.toFixed(2)} kg; highly uncertain solar activity and drag. Not a compliance determination.` };
}
