import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CONSTANTS, bodyRotationAngle, sunDirection, type BodyId, type Design, type Telemetry } from '@astrix/core';
import { type DirectionalLight, type Group } from 'three';
import { relativePosition, renderDirection, type KmVector } from './FloatingOrigin';
import { useMissionPose } from './useMissionPose';
import { Skybox } from './Skybox';
import { SunLight } from './SunLight';
import { Planet } from './Planet';
import { missionBody } from '../../ui/missions/definitionView';

const ZERO: KmVector = [0, 0, 0];
export interface SpaceBackdropProps {
 design: Design;
 telemetry?: Telemetry | null;
 live?: boolean;
 originKm?: KmVector;
 body?: BodyId;
 /** Transfer renders its heliocentric bodies separately with the shared Planet. */
 planet?: boolean;
 sunDisc?: boolean;
}

/** Shared open-space layers only. This component creates neither simulation state
 * nor a renderer. One MissionPoseProvider supplies preview/live/replay authority;
 * optional viewer telemetry is explicit and never reads an unrelated live run.
 */
export function SpaceBackdrop({ design, telemetry, live = false, originKm, planet = true, body: overrideBody, sunDisc = true }: SpaceBackdropProps) {
 const readPose = useMissionPose();
 const body = overrideBody ?? design.orbit?.body ?? missionBody(design.definition);
 const epoch = design.orbit?.epochUTC ?? design.definition.environment.epochUTC;
 const coreSun = useMemo(() => sunDirection(body, telemetry?.t ?? 0, undefined, epoch), [body, epoch, telemetry?.t]);
 const centre = useRef<Group>(null);
 const surface = useRef<Group>(null);
 const light = useRef<DirectionalLight>(null);
 useFrame(() => {
  const pose = readPose();
  const explicit = !live && telemetry ? telemetry : null;
  const currentSun = explicit?.sunDir ?? pose.sunDir;
  coreSun[0] = currentSun[0]; coreSun[1] = currentSun[1]; coreSun[2] = currentSun[2];
  if (centre.current) relativePosition(centre.current.position, ZERO, originKm ?? pose.originKm);
  if (surface.current) surface.current.rotation.y = bodyRotationAngle(body, explicit?.t ?? pose.t, epoch);
  if (light.current) {
   renderDirection(light.current.position, coreSun).normalize();
   // No fabricated sunlight status in design or recorded views lacking telemetry.
   light.current.intensity = (explicit ?? pose.telemetry)?.sunlit === false ? 0 : 2.4;
  }
 }, -2);
 return <>
  <Skybox/>
  <SunLight ref={light} direction={coreSun} angularRadiusRad={Math.asin(695700 / CONSTANTS[body].distanceKm.v)} disc={sunDisc}/>
  {planet && <group ref={centre}>
   <Planet ref={surface} body={body} sunDirection={coreSun}/>
  </group>}
 </>;
}
