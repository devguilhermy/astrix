import { CONSTANTS, bodyRotationAngle, history, telemetry, type BodyId, type Design, type Telemetry, type TurnGameState } from '@astrix/core';
import { Euler, Quaternion, Vector3 } from 'three';
import { renderAttitude } from './space/FloatingOrigin';

export type ScenePoint = [number, number, number];
export type SceneView = 'explore' | 'prepare' | 'play' | 'journal' | 'gmat' | 'help' | 'missing';
const renderPoint = (r: readonly number[], radius: number): ScenePoint => [r[0]! / radius, r[2]! / radius, -r[1]! / radius];

/** Instantaneous two-body conic, not a forecast or a record of travelled distance. */
function osculatingPath(current: Telemetry, radius: number): ScenePoint[] {
  const flight = current.flight;
  if (!flight || flight.phase === 'ASCENT' || flight.phase === 'PRELAUNCH') return [];
  const r = new Vector3(...flight.view.central.rKm), v = new Vector3(...flight.view.central.vKms);
  const mu = CONSTANTS[flight.view.central.body].mu.v;
  const h = new Vector3().crossVectors(r, v), p = h.lengthSq() / mu;
  if (p < 1e-6) return [];
  const eccentricity = new Vector3().crossVectors(v, h).divideScalar(mu).sub(r.clone().normalize());
  const e = eccentricity.length();
  const u = e > 1e-7 ? eccentricity.normalize() : r.clone().normalize();
  const w = new Vector3().crossVectors(h.normalize(), u).normalize();
  // Clip unbound conics to eight current radii; do not draw their asymptote at infinity.
  const limit = Math.max(radius * 4, r.length() * 8);
  const halfAngle = e < 1 ? Math.PI : Math.acos(Math.min(1, Math.max(-1, (p / limit - 1) / e)));
  const points: ScenePoint[] = [];
  for (let i = 0; i <= 160; i++) {
    const angle = -halfAngle + 2 * halfAngle * i / 160;
    const distance = p / (1 + e * Math.cos(angle));
    if (distance <= 0 || distance > limit * 1.001) continue;
    const point = u.clone().multiplyScalar(distance * Math.cos(angle)).addScaledVector(w, distance * Math.sin(angle));
    points.push(renderPoint(point.toArray(), radius));
  }
  return points;
}

export interface CommittedScene {
  body: BodyId;
  design: Design | null;
  current: Telemetry | null;
  physical: boolean;
  cruise: boolean;
  craft: ScenePoint;
  marker: ScenePoint | null;
  attitude: Quaternion;
  trail: ScenePoint[];
  orbit: ScenePoint[];
  moon: ScenePoint | null;
  earth: ScenePoint | null;
  rotation: number;
  radiusKm: number;
}

/** Only committed engine state enters this snapshot. Rendering cannot advance mission time. */
export function committedScene(design: Design | null, game: TurnGameState | null, body: BodyId, view: SceneView): CommittedScene {
  const mission = view === 'play' ? game : null;
  const current = mission ? telemetry(mission.sim) : null;
  const hardware = mission?.design ?? (view === 'prepare' ? design : null);
  const cruise = !!current?.cruise || !!current?.capturePending;
  const physical = !!current && !cruise;
  const central = physical ? current.flight?.view.central.body ?? hardware?.orbit?.body ?? body : body;
  const radiusKm = CONSTANTS[central].radius.v;
  const position = current?.flight?.view.central.rKm ?? current?.positionKm;
  const marker = physical && position ? renderPoint(position, radiusKm) : null;
  const craft: ScenePoint = marker ? [...marker] : [1.5, .22, .6];
  // The exact cyan marker stays at telemetry position. Enlarged hardware is lifted only
  // when its display-size hull would intersect the surface; this clearance is schematic.
  if (marker) {
    const radial = new Vector3(...marker);
    if (radial.length() < 1.28) radial.setLength(1.28);
    craft[0] = radial.x; craft[1] = radial.y; craft[2] = radial.z;
  }
  const attitude = current ? renderAttitude(new Quaternion(), current.attitude.q) : new Quaternion().setFromEuler(new Euler(.2, .45, -.2));
  const trail: ScenePoint[] = [];
  if (mission && physical) {
    const samples = history(mission.sim), stride = Math.max(1, Math.ceil(samples.length / 1200));
    for (let i = 0; i < samples.length; i += stride) {
      const sample = samples[i]!;
      if (sample.flight && sample.flight.centralBody !== central) continue;
      const position = sample.flight?.earthRKm ?? sample.positionKm;
      const moon = central === 'MOON' ? sample.flight?.moonRKm : null;
      trail.push(renderPoint(moon ? [position[0] - moon[0], position[1] - moon[1], position[2] - moon[2]] : position, radiusKm));
    }
    if (marker) trail.push(marker);
  }
  const moonPosition = current?.flight?.view.moonEphemeris?.rKm;
  const moon = physical && central === 'EARTH' && moonPosition ? renderPoint(moonPosition, radiusKm) : null;
  const earth = physical && central === 'MOON' && moonPosition ? renderPoint(moonPosition.map(value => -value), radiusKm) : null;
  const epoch = hardware?.definition.environment.epochUTC;
  return { body: central, design: hardware, current, physical, cruise, craft, marker, attitude, trail,
    orbit: physical && current ? osculatingPath(current, radiusKm) : [], moon, earth,
    rotation: bodyRotationAngle(central, current?.t ?? 0, epoch), radiusKm };
}
