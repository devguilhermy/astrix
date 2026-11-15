import { CONSTANTS, MOON_SOI_RADIUS_KM, bodyRotationAngle, moonState, type BodyId, type Design, type HistorySample, type MissionPhase, type Telemetry } from '@astrix/core';
import type { DefinitionLike } from '../../ui/missions/definitionView';

export type Vec3 = [number, number, number];
/**
 * Everything the flight scene draws comes from here, and everything here comes from engine state: a live telemetry
 * `flight` block, a recorded `HistorySample.flight`, or (before liftoff only) the launch site's rotating-Earth position.
 * Nothing is interpolated between states or invented to look like motion.
 */
export interface FlightPose {
  readonly source: 'LIVE' | 'RECORDED' | 'PAD';
  readonly phase: MissionPhase;
  /** Spacecraft relative to Earth, inertial km (world frame of the scene). */
  readonly earthKm: Vec3;
  readonly velocityKms: Vec3 | null;
  /** Moon relative to Earth at the same epoch, when modelled. */
  readonly moonKm: Vec3 | null;
  readonly central: BodyId;
  readonly altitudeKm: number;
  readonly speedKms: number;
  readonly t: number;
  readonly stage: { attached: boolean; stageIndex: number; thrustKN: number; throttle: number } | null;
}
export const EARTH_RADIUS_KM = CONSTANTS.EARTH.radius.v;
export const MOON_RADIUS_KM = CONSTANTS.MOON.radius.v;
const ZERO: Vec3 = [0, 0, 0];

export function poseFromTelemetry(telemetry: Telemetry): FlightPose | null {
  const flight = telemetry.flight;
  if (!flight) return null;
  const ascent = flight.ascent, stage = flight.mass.stage;
  return {
    source: 'LIVE', phase: flight.phase, earthKm: flight.view.earth.rKm, velocityKms: flight.view.earth.vKms, moonKm: flight.view.moonEphemeris?.rKm ?? null,
    central: flight.view.central.body, altitudeKm: flight.view.altitudeKm, speedKms: flight.view.speedKms, t: telemetry.t,
    stage: ascent && stage ? { attached: stage.attached, stageIndex: ascent.stageIndex, thrustKN: ascent.thrustKN, throttle: ascent.throttle } : null,
  };
}
export function poseFromSample(sample: HistorySample): FlightPose | null {
  const flight = sample.flight;
  if (!flight) return null;
  return { source: 'RECORDED', phase: flight.phase, earthKm: flight.earthRKm, velocityKms: null, moonKm: flight.moonRKm, central: flight.centralBody, altitudeKm: flight.altitudeKm, speedKms: flight.speedKms, t: sample.t, stage: null };
}
/** Launch site in the inertial frame at mission time `t`, on the rotating Earth. Only used before telemetry exists. */
export function padPose(design: Design, t = 0): FlightPose {
  const start = design.definition.start;
  const lat = start.kind === 'SURFACE_LAUNCH' ? start.site.latDeg * Math.PI / 180 : 0, lon = start.kind === 'SURFACE_LAUNCH' ? start.site.lonDeg * Math.PI / 180 : 0;
  const spin = bodyRotationAngle('EARTH', t, design.definition.environment.epochUTC), angle = lon + spin;
  const earthKm: Vec3 = [EARTH_RADIUS_KM * Math.cos(lat) * Math.cos(angle), EARTH_RADIUS_KM * Math.cos(lat) * Math.sin(angle), EARTH_RADIUS_KM * Math.sin(lat)];
  const moon = design.definition.trajectory.model === 'PATCHED_CONICS' && design.definition.trajectory.bodies.includes('MOON') ? moonState(t, design.definition.environment.epochUTC).r : null;
  return { source: 'PAD', phase: 'PRELAUNCH', earthKm, velocityKms: null, moonKm: moon, central: 'EARTH', altitudeKm: 0, speedKms: 0, t, stage: null };
}

export type RegimeId = 'pad' | 'earth' | 'transfer' | 'moon';
export interface FlightRegime {
  readonly id: RegimeId;
  /** Camera framing radius in km, quantized to a power of two so a steadily changing state never re-frames the camera every frame. */
  readonly radiusKm: number;
  /** World point the map camera orbits. */
  readonly focusKm: Vec3;
}
const quantize = (value: number) => 2 ** Math.ceil(Math.log2(Math.max(value, 1e-3)));
export function moonDistanceKm(pose: FlightPose): number {
  return pose.moonKm ? Math.hypot(...pose.moonKm) : 0;
}
export function flightRegime(pose: FlightPose, lunar: boolean): FlightRegime {
  if (pose.source === 'PAD') return { id: 'pad', radiusKm: 0.08, focusKm: pose.earthKm };
  if (pose.central === 'MOON' && pose.moonKm) {
    const rel = Math.hypot(pose.earthKm[0] - pose.moonKm[0], pose.earthKm[1] - pose.moonKm[1], pose.earthKm[2] - pose.moonKm[2]);
    return { id: 'moon', radiusKm: quantize(Math.max(MOON_RADIUS_KM * 4, rel * 2.5)), focusKm: pose.moonKm };
  }
  const r = Math.hypot(...pose.earthKm);
  if (r > EARTH_RADIUS_KM * 8) return { id: 'transfer', radiusKm: quantize(Math.max(lunar ? moonDistanceKm(pose) : 0, r) * 1.25), focusKm: ZERO };
  return { id: 'earth', radiusKm: quantize(Math.max(r, EARTH_RADIUS_KM + 300) * 1.4), focusKm: ZERO };
}
export function moonSoiRadiusKm(): number {
  return MOON_SOI_RADIUS_KM;
}
/** Great-circle-free helper: a circle in the plane normal to `normal` through `radiusKm` at origin `centre`. */
export function ringPoints(centre: Vec3, radiusKm: number, normal: Vec3, segments = 128): Vec3[] {
  const n = normalize(normal), helper: Vec3 = Math.abs(n[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(n, helper)), v = cross(n, u);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = i / segments * Math.PI * 2, c = Math.cos(a) * radiusKm, s = Math.sin(a) * radiusKm;
    return [centre[0] + u[0] * c + v[0] * s, centre[1] + u[1] * c + v[1] * s, centre[2] + u[2] * c + v[2] * s];
  });
}
export function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function normalize(a: Vec3): Vec3 { const length = Math.hypot(...a) || 1; return [a[0] / length, a[1] / length, a[2] / length]; }
