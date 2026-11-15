// Adapted from Void Protocol (© Guilhermy), apps/web/src/utils/flightInput.ts
// at218625d (224 LOC): exponential approach only; owner-authorized Apache-2.0 reuse.
export function approachFactor(rate: number, wallDeltaSec: number): number {
 if (!(rate > 0) || !(wallDeltaSec > 0)) return 0;
 return -Math.expm1(-rate * wallDeltaSec);
}
export function approach(current: number, target: number, rate: number, wallDeltaSec: number): number {
 return current + (target - current) * approachFactor(rate, wallDeltaSec);
}
export function cameraClearance(radiusKm: number, nearKm: number): number {
 return radiusKm + Math.max(nearKm * 2, radiusKm * 1e-7);
}
