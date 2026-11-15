import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { CONSTANTS, orbitPosition, sunDirection, transferPosition, type AttitudeTelemetry, type Design, type HistorySample, type Telemetry } from '@astrix/core';
import { hohmann } from '@astrix/core/physics';
import { liveMission } from '../../store';
import { isCloseShot, type CameraMode } from '../camera/modes';
import type { SceneKind } from '../missionScenes';
import type { KmVector } from './FloatingOrigin';
import { flightRegime, padPose, poseFromSample, poseFromTelemetry, type FlightPose, type FlightRegime } from '../flight/flightState';
import { usesMoon } from '../../ui/missions/definitionView';

export interface MissionPose {
 positionKm: KmVector;
 velocityKmSec: KmVector;
 sunDir: KmVector;
 stationPosKm: KmVector | null;
 originKm: KmVector;
 t: number;
 telemetry: Telemetry | null;
 recorded: boolean;
 attitude: AttitudeTelemetry | null;
 discontinuity: number;
 /** Authoritative flight state for `flight` scenes (Earth-inertial world frame); null for analytic scenes. */
 flight: FlightPose | null;
 regime: FlightRegime | null;
}
type PoseReader = () => MissionPose;
const PoseContext = createContext<PoseReader | null>(null);
const ZERO: KmVector = [0, 0, 0];
interface PoseInputs {
 design: Design;
 live: boolean;
 telemetry: Telemetry | null;
 reviewSample: HistorySample | null;
 kind: SceneKind;
 mode: CameraMode;
}

/** The sole mission snapshot adapter used by spacecraft, camera, Sun and overlays.
 * Preview isolation is explicit: a candidate can never read the active run.
 * No render-side interpolation claims an uncomputed physical state.
 */
export function MissionPoseProvider({ children, ...inputs }: PoseInputs & { children: ReactNode }) {
 const latest = useRef(inputs);
 latest.current = inputs;
 const reader = useMemo<PoseReader>(() => {
  let lastTelemetry: Telemetry | null | undefined;
  let lastReview: HistorySample | null | undefined;
  let lastDesign: Design | undefined;
  let lastKind: SceneKind | undefined;
  let lastMode: CameraMode | undefined;
  let lastGeneration = -1;
  const pose: MissionPose = { positionKm: ZERO, velocityKmSec: ZERO, sunDir: [1, 0, 0], stationPosKm: null, originKm: ZERO, t: 0, telemetry: null, recorded: false, discontinuity: 0, attitude: null, flight: null, regime: null };
  return () => {
   const { design, live, telemetry: published, reviewSample, kind, mode } = latest.current;
   const telemetry = live && !reviewSample ? liveMission.telemetry ?? published : null;
   const generation = live ? liveMission.generation : -1;
   if (lastTelemetry === telemetry && lastReview === reviewSample && lastDesign === design && lastKind === kind && lastMode === mode && lastGeneration === generation) return pose;
   const previousTime = pose.t;
   const time = reviewSample?.t ?? telemetry?.t ?? 0;
   const orbit = design.orbit;
   const epoch = orbit?.epochUTC ?? design.definition.environment.epochUTC;
   const elapsedOrbit = orbit?.body === 'MARS' ? telemetry ? Math.max(0, telemetry.clock.plannedSec - telemetry.clock.remainingSec) : Math.max(0, time - hohmann().transferSec) : time;
   const transfer = kind === 'transfer';
   const flight = kind === 'flight' ? telemetry ? poseFromTelemetry(telemetry) : reviewSample ? poseFromSample(reviewSample) : padPose(design, 0) : null;
   const position: KmVector = flight ? flight.earthKm : transfer ? transferPosition(time, epoch) : kind === 'launch' ? [0, 0, CONSTANTS.EARTH.radius.v + .02] : reviewSample?.positionKm ?? telemetry?.positionKm ?? (orbit ? orbitPosition(orbit, 0) : ZERO);
   // Tangent is analytical core propagation, used only to choose a camera boom.
   const next = transfer ? transferPosition(time + .5, epoch) : orbit && !flight ? orbitPosition(orbit, elapsedOrbit + .5) : position;
   pose.velocityKmSec = flight ? flight.velocityKms ?? ZERO : [(next[0] - position[0]) * 2, (next[1] - position[1]) * 2, (next[2] - position[2]) * 2];
   pose.positionKm = position;
   pose.sunDir = kind === 'launch' ? sunDirection('EARTH', 0, undefined, epoch) : reviewSample?.sunDir ?? telemetry?.sunDir ?? sunDirection(orbit?.body ?? 'EARTH', time, undefined, epoch);
   pose.stationPosKm = flight && flight.central !== 'EARTH' ? null : reviewSample?.stationPosKm ?? telemetry?.stationPosKm ?? null;
   pose.flight = flight;
   pose.regime = flight ? flightRegime(flight, usesMoon(design.definition)) : null;
   pose.originKm = isCloseShot(mode, kind) ? position : pose.regime?.focusKm ?? ZERO;
   pose.t = time;
   pose.telemetry = telemetry;
   pose.recorded = !!reviewSample;
   if (generation !== lastGeneration || lastKind !== kind || lastMode !== mode || time < previousTime || time - previousTime > 120) pose.discontinuity++;
   pose.attitude = reviewSample?.attitude ?? telemetry?.attitude ?? null;
   lastTelemetry = telemetry;
   lastReview = reviewSample;
   lastDesign = design;
   lastKind = kind;
   lastMode = mode;
   lastGeneration = generation;
   return pose;
  };
 }, []);
 return <PoseContext.Provider value={reader}>{children}</PoseContext.Provider>;
}

export function useMissionPose(): PoseReader {
 const reader = useContext(PoseContext);
 if (!reader) throw new Error('Mission pose requires an explicit candidate or active-flight provider.');
 return reader;
}
