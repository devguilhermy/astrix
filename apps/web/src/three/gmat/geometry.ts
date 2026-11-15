import { CONSTANTS, type OrbitChoice } from '@astrix/core';
import { elementsForOrbit, orbitalPeriod, propagate, rotatePerifocal, type Vec3 } from '@astrix/core/physics';
import { MAX_INTERPOLATION_GAP_MS, type Trajectory } from '@astrix/core/interop/gmat';
import type { GmatSubject } from '../../ui/advanced/trajectoryStore';

/** Scene unit = one radius of the central body, axes as committedScene's renderPoint (MJ2000Eq Z is scene up). */
export const toScene = (r: readonly number[], radiusKm: number): [number, number, number] => [r[0]! / radiusKm, r[2]! / radiusKm, -r[1]! / radiusKm];

export const orbitPeriodSec = (orbit: OrbitChoice): number => orbitalPeriod(orbit.smaKm, CONSTANTS[orbit.body].mu.v);

/** Time span shown by the scrubber: one orbital period from the epoch, or the sampled trajectory's bounds. */
export function subjectRange(subject: GmatSubject): [number, number] {
 if (subject.kind === 'orbit') { const start = Date.parse(subject.orbit.epochUTC); return [start, start + orbitPeriodSec(subject.orbit) * 1000]; }
 const segments = subject.trajectory.segments;
 return [segments[0]!.samples[0]!.time, segments.at(-1)!.samples.at(-1)!.time];
}

/** Closed conic sampled by true anomaly, so a highly eccentric orbit stays smooth at periapsis. */
export function orbitPath(orbit: OrbitChoice, count = 256): Vec3[] {
 const { a, e, i, raan, argPeriapsis } = elementsForOrbit(orbit), p = a * (1 - e * e), out: Vec3[] = [];
 for (let k = 0; k < count; k++) {
  const nu = k / count * Math.PI * 2, r = p / (1 + e * Math.cos(nu));
  out.push(rotatePerifocal([r * Math.cos(nu), r * Math.sin(nu), 0], i, raan, argPeriapsis));
 }
 return out;
}
export function apsides(orbit: OrbitChoice): { periapsis: Vec3; apoapsis: Vec3 } {
 const { a, e, i, raan, argPeriapsis } = elementsForOrbit(orbit);
 return { periapsis: rotatePerifocal([a * (1 - e), 0, 0], i, raan, argPeriapsis), apoapsis: rotatePerifocal([-a * (1 + e), 0, 0], i, raan, argPeriapsis) };
}
/** Two-body state at an absolute UTC time (ms). */
export function orbitStateAt(orbit: OrbitChoice, timeMs: number): { position: Vec3; velocity: Vec3 } {
 return propagate(elementsForOrbit(orbit), CONSTANTS[orbit.body].mu.v, (timeMs - Date.parse(orbit.epochUTC)) / 1000);
}

export interface TimedPoint { time: number; positionKm: Vec3 }
/**
 * Continuous display runs: split at segment boundaries and at sample gaps longer than the
 * interpolation limit, never joined across them; decimated to a bounded vertex count.
 */
export function trajectoryRuns(trajectory: Trajectory, budget = 7168): TimedPoint[][] {
 const runs: TimedPoint[][] = [];
 for (const segment of trajectory.segments) {
  let run: TimedPoint[] = [];
  for (const sample of segment.samples) {
   if (run.length && sample.time - run.at(-1)!.time > MAX_INTERPOLATION_GAP_MS) { runs.push(run); run = []; }
   run.push(sample);
  }
  runs.push(run);
 }
 const stride = Math.max(1, Math.ceil(runs.reduce((n, run) => n + run.length, 0) / budget));
 return runs.map(run => run.filter((_, index) => index % stride === 0 || index === run.length - 1));
}

/** Bounding sphere of the drawn points and the central body (radius 1 at the origin), for camera framing. */
export function frameOf(points: readonly (readonly number[])[]): { centre: [number, number, number]; radius: number } {
 const low = [-1, -1, -1], high = [1, 1, 1];
 for (const p of points) for (let axis = 0; axis < 3; axis++) { low[axis] = Math.min(low[axis]!, p[axis]!); high[axis] = Math.max(high[axis]!, p[axis]!); }
 const centre: [number, number, number] = [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2];
 let radius = Math.hypot(...centre) + 1;
 for (const p of points) radius = Math.max(radius, Math.hypot(p[0]! - centre[0], p[1]! - centre[1], p[2]! - centre[2]));
 return { centre, radius };
}
