import { CONSTANTS, bodyRotationAngle, history, planetPosition, telemetry, type BodyId, type Design, type Telemetry, type TurnGameState } from '@astrix/core';
import { Euler, Quaternion, Vector3 } from 'three';
import { renderAttitude } from './space/FloatingOrigin';
import { hardwareRadiusM } from './spacecraft/extent';

export type ScenePoint = [number, number, number];
export type SceneView = 'solar' | 'explore' | 'prepare' | 'play' | 'journal' | 'gmat' | 'help' | 'missing';
/** Core MJ2000Eq kilometres to render units of one central-body radius. */
export const renderPoint = (r: readonly number[], radius: number): ScenePoint => [r[0]! / radius, r[2]! / radius, -r[1]! / radius];

/** Every craft is drawn with this bounding radius, in central-body radii (D6). */
export const HULL_RADIUS = .2;
/** Earth drawn in a Sun-centred scene, in solar radii: about 55 times its true size. */
export const EARTH_MARKER_RADIUS = .5;
/** Outer radius of the drawn atmosphere shell; the Sun has none. Matches `space/Planet.tsx`. */
export function bodyShell(body: BodyId, radiusKm: number): number {
  return body === 'SUN' ? 1 : 1 + (body === 'EARTH' ? 100 : 30) / radiusKm;
}
export interface SecondaryBody { centre: ScenePoint; radius: number }
/**
 * Altitude-aware schematic clearance: on the pad the hull stands on the surface, it rises
 * continuously through the first 100 km, and in orbit it clears the atmosphere shell.
 */
export function displayedRadius(trueRadius: number, altitudeKm: number, hullRadius: number, shell: number): number {
  const ground = 1 + hullRadius + .004, floor = shell + hullRadius + .06;
  const x = Math.min(1, Math.max(0, (Number.isFinite(altitudeKm) ? altitudeKm : 0) / 100));
  return Math.max(trueRadius, ground + (floor - ground) * x * x * (3 - 2 * x));
}
const radialScratch = new Vector3(), centreScratch = new Vector3(), awayScratch = new Vector3();
/**
 * Displayed hardware centre for a true marker position. A zero-length marker falls back to
 * +X; a shown secondary body is cleared by pushing the hull along the separation.
 */
export function clearedCraft(marker: readonly number[], altitudeKm: number, hullRadius: number, shell: number, secondary: SecondaryBody | null = null, out: ScenePoint = [0, 0, 0]): ScenePoint {
  const radial = radialScratch.set(marker[0]!, marker[1]!, marker[2]!);
  const length = radial.length(), valid = length > 1e-9 && Number.isFinite(length);
  if (!valid) radial.set(1, 0, 0);
  radial.setLength(displayedRadius(valid ? length : 0, altitudeKm, hullRadius, shell));
  if (secondary) {
    const centre = centreScratch.set(...secondary.centre), away = awayScratch.copy(radial).sub(centre), minimum = secondary.radius + hullRadius + .06;
    if (away.length() < minimum) {
      if (away.lengthSq() < 1e-18) away.set(1, 0, 0);
      radial.copy(centre).add(away.setLength(minimum));
    }
  }
  out[0] = radial.x; out[1] = radial.y; out[2] = radial.z;
  return out;
}

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
  /** Stable across decisions; a revision is deliberately not a camera identity. */
  identity: string;
  body: BodyId;
  design: Design | null;
  current: Telemetry | null;
  physical: boolean;
  cruise: boolean;
  /** Displayed hardware centre: the true marker lifted to the schematic clearance. */
  craft: ScenePoint;
  /** True telemetry position. */
  marker: ScenePoint | null;
  attitude: Quaternion;
  trail: ScenePoint[];
  /** Mission time of each trail point. */
  trailT: number[];
  orbit: ScenePoint[];
  moon: ScenePoint | null;
  earth: ScenePoint | null;
  /** Earth's heliocentric path in a Sun-centred scene. */
  earthOrbit: ScenePoint[];
  /** Drawn radius of the Moon (Earth-centred) or Earth (Moon- or Sun-centred), render units. */
  secondaryRadius: number;
  rotation: number;
  radiusKm: number;
  epochUTC: string | undefined;
  /** Model metres to render units: every craft gets the same displayed hull radius. */
  craftScale: number;
  hullRadius: number;
  shell: number;
  altitudeKm: number;
  /** Flight phase of the latest telemetry; non-flight missions have none. */
  phase: string | null;
}

/** Display radius of the second body shown in a scene, in render units of the central body. */
export function secondaryRadius(central: BodyId, radiusKm: number): number {
  return central === 'SUN' ? EARTH_MARKER_RADIUS : central === 'MOON' ? (CONSTANTS.EARTH.radius.v + 100) / radiusKm : (CONSTANTS.MOON.radius.v + 30) / radiusKm;
}

/** Central-body-relative position of a history sample, the same frame the trail uses. */
export function samplePositionKm(sample: { positionKm: readonly number[]; flight?: { earthRKm: readonly number[]; moonRKm: readonly number[] | null } }, central: BodyId): readonly number[] {
  const position = sample.flight?.earthRKm ?? sample.positionKm;
  const moon = central === 'MOON' ? sample.flight?.moonRKm : null;
  return moon ? [position[0]! - moon[0]!, position[1]! - moon[1]!, position[2]! - moon[2]!] : position;
}

/** Position of the secondary body at mission time t, from a recorded Moon position when present. */
export function secondaryPoint(central: BodyId, moonKm: readonly number[] | null | undefined, t: number, epochUTC: string | undefined, radiusKm: number): ScenePoint | null {
  if (central === 'SUN') return renderPoint(planetPosition('EARTH', t, epochUTC), radiusKm);
  if (!moonKm) return null;
  return central === 'EARTH' ? renderPoint(moonKm, radiusKm) : central === 'MOON' ? renderPoint(moonKm.map(value => -value), radiusKm) : null;
}

function earthPath(t: number, epochUTC: string | undefined, radiusKm: number): ScenePoint[] {
  const year = CONSTANTS.EARTH.yearSec.v;
  return Array.from({ length: 161 }, (_, i) => renderPoint(planetPosition('EARTH', t + year * i / 160, epochUTC), radiusKm));
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
  const epoch = hardware?.definition.environment.epochUTC;
  const t = current?.t ?? 0;
  const moonPosition = current?.flight?.view.moonEphemeris?.rKm;
  const secondary = physical ? secondaryPoint(central, moonPosition, t, epoch, radiusKm) : null;
  const shell = bodyShell(central, radiusKm), hullRadius = hardware ? HULL_RADIUS : 0;
  const altitudeKm = current?.flight?.view.altitudeKm ?? (position ? Math.hypot(...position) - radiusKm : 0);
  const secondaryDrawn = secondaryRadius(central, radiusKm);
  // The exact cyan marker stays at telemetry position. Enlarged hardware is lifted only
  // as far as its display-size hull needs; this clearance is schematic.
  const craft: ScenePoint = marker ? clearedCraft(marker, altitudeKm, hullRadius, shell, secondary ? { centre: secondary, radius: secondaryDrawn } : null) : [1.5, .22, .6];
  const attitude = current ? renderAttitude(new Quaternion(), current.attitude.q) : new Quaternion().setFromEuler(new Euler(.2, .45, -.2));
  const trail: ScenePoint[] = [], trailT: number[] = [];
  if (mission && physical) {
    const samples = history(mission.sim), stride = Math.max(1, Math.ceil(samples.length / 1200));
    for (let i = 0; i < samples.length; i += stride) {
      const sample = samples[i]!;
      if (sample.flight && sample.flight.centralBody !== central) continue;
      trail.push(renderPoint(samplePositionKm(sample, central), radiusKm));
      trailT.push(sample.t);
    }
    if (marker) { trail.push(marker); trailT.push(t); }
  }
  return {
    identity: mission ? `mission:${mission.identity}` : hardware ? `equipment:${hardware.definitionDigest}` : `destination:${body}`,
    body: central, design: hardware, current, physical, cruise, craft, marker, attitude, trail, trailT,
    orbit: physical && current ? osculatingPath(current, radiusKm) : [],
    moon: central === 'EARTH' ? secondary : null, earth: central === 'EARTH' ? null : secondary,
    earthOrbit: physical && central === 'SUN' ? earthPath(t, epoch, radiusKm) : [],
    secondaryRadius: secondaryDrawn,
    rotation: bodyRotationAngle(central, t, epoch), radiusKm, epochUTC: epoch,
    craftScale: hardware ? HULL_RADIUS / hardwareRadiusM(hardware) : 1, hullRadius, shell, altitudeKm,
    phase: current?.flight?.phase ?? null,
  };
}
