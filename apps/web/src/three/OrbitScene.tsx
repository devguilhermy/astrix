import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Quaternion, Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, listParts, orbitPosition, orbitalPeriod, sunDirection, type Design, type HistorySample, type Telemetry } from '@astrix/core';
import { cylinderEclipse, inStationContact, marsLineOfSight, radians, rotatePerifocal, stationPosition } from '@astrix/core/physics';
import { MODEL } from '@astrix/core/catalog';
import { useQualityProfile } from './quality';
import { SpacecraftModel } from './spacecraft/SpacecraftModel';
import { sceneKitFor, type SceneVector } from './missionScenes';
import { ObservationTarget, SceneLine } from './ScenePrimitives';
import { relativePosition, renderAttitude, renderDirection } from './space/FloatingOrigin';
import { useMissionPose } from './space/useMissionPose';
import { useWorkbench } from './spacecraft/workbenchState';
import { RcsPuffs } from './spacecraft/RcsPuffs';
import { PilotAnchors } from './spacecraft/PilotAnchors';
import type { CameraMode } from './camera/modes';
import { Boresights } from './spacecraft/Boresights';
import { ShadowOutline } from './spacecraft/ShadowOutline';
import { useMission } from '../store';

const point = (p: readonly [number, number, number]): SceneVector => [p[0], p[2], -p[1]];
export function OrbitScene({ design, live = false, previewEquipment = false, telemetry = null, reviewSample = null, referenceOnly = false, mode = 'MAP', reducedMotion = false }: {
 design: Design; live?: boolean; previewEquipment?: boolean; telemetry?: Telemetry | null; reviewSample?: HistorySample | null; referenceOnly?: boolean; mode?: CameraMode; reducedMotion?: boolean;
}) {
 const { t } = useTranslation();
 const kit = useMemo(() => sceneKitFor(design.definition), [design.definition]), quality = useQualityProfile();
 const readPose = useMissionPose();
 const pathRoot = useRef<Group>(null), marker = useRef<Group>(null), attitude = useRef<Group>(null), station = useRef<Group>(null), link = useRef<Group>(null), footprint = useRef<Group>(null);
 const packet = useRef<Group>(null);
 const invalidate = useThree(state => state.invalidate);
 const previewOrbit = useWorkbench(state => state.previewOrbit);
 const orbit = design.orbit;
 const close = mode !== 'MAP';
 const fastForward = useMission(state => state.warp > 100 || state.advancing);
 const points = useMemo<SceneVector[]>(() => orbit ? Array.from({ length: quality.orbitSamples + 1 }, (_, i) => point(orbitPosition(orbit, orbitalPeriod(orbit.smaKm, CONSTANTS[orbit.body].mu.v) * i / quality.orbitSamples))) : [], [orbit, quality.orbitSamples]);
 const proposalPath = useMemo<SceneVector[]>(() => previewOrbit ? Array.from({ length: quality.orbitSamples + 1 }, (_, i) => point(orbitPosition(previewOrbit, orbitalPeriod(previewOrbit.smaKm, CONSTANTS[previewOrbit.body].mu.v) * i / quality.orbitSamples))) : [], [previewOrbit, quality.orbitSamples]);
 const apsides = useMemo(() => orbit ? [orbit.smaKm * (1 - orbit.ecc), -orbit.smaKm * (1 + orbit.ecc)].map(x => point(rotatePerifocal([x, 0, 0], radians(orbit.inclinationDeg), radians(orbit.raanDeg), radians(orbit.argPeriapsisDeg)))) : [], [orbit]);
 const trail = useMemo<SceneVector[]>(() => {
  if (!orbit || !live || !fastForward || reviewSample || referenceOnly || !telemetry) return [];
  const elapsed = orbit.body === 'MARS' ? Math.max(0, telemetry.clock.plannedSec - telemetry.clock.remainingSec) : telemetry.t;
  const span = Math.min(elapsed, orbitalPeriod(orbit.smaKm, CONSTANTS[orbit.body].mu.v) / 4);
  const samples = Math.max(12, Math.floor(quality.orbitSamples / 3));
  return Array.from({ length: samples + 1 }, (_, index) => point(orbitPosition(orbit, elapsed - span + span * index / samples)));
 }, [orbit, live, fastForward, reviewSample, referenceOnly, telemetry?.t, quality.orbitSamples]);
 const overlays = useMemo(() => {
  const shadow: SceneVector[][] = [], contact: SceneVector[][] = [];
  if (!orbit || referenceOnly || reviewSample) return { shadow, contact };
  const start = telemetry?.t ?? 0, elapsed = orbit.body === 'MARS' && telemetry ? Math.max(0, telemetry.clock.plannedSec - telemetry.clock.remainingSec) : start;
  const period = orbitalPeriod(orbit.smaKm, CONSTANTS[orbit.body].mu.v);
  let shadowRun: SceneVector[] = [], contactRun: SceneVector[] = [];
  for (let i = 0; i <= quality.orbitSamples; i++) {
   const offset = period * i / quality.orbitSamples, time = start + offset, p = orbitPosition(orbit, elapsed + offset), rendered = point(p);
   const eclipsed = cylinderEclipse(p, sunDirection(orbit.body, time, undefined, orbit.epochUTC), kit.radiusKm);
   const visible = orbit.body === 'EARTH' ? inStationContact(p, stationPosition(time, 'EARTH', MODEL.stationLat.v, MODEL.stationLon.v, undefined, orbit.epochUTC), MODEL.minElevation.v) : marsLineOfSight(p, time, orbit.epochUTC);
   if (eclipsed) shadowRun.push(rendered); else if (shadowRun.length) { if (shadowRun.length > 1) shadow.push(shadowRun); shadowRun = []; }
   if (visible) contactRun.push(rendered); else if (contactRun.length) { if (contactRun.length > 1) contact.push(contactRun); contactRun = []; }
  }
  if (shadowRun.length > 1) shadow.push(shadowRun);
  if (contactRun.length > 1) contact.push(contactRun);
  return { shadow, contact };
 }, [orbit, Math.floor((telemetry?.t ?? 0) / 30), quality.orbitSamples, kit.radiusKm, referenceOnly, reviewSample]);
 const scratch = useMemo(() => ({ satellite: new Vector3(), station: new Vector3(), axis: new Vector3(0, 1, 0), direction: new Vector3(), position: new Vector3(), normal: new Vector3(), q: new Quaternion() }), []);
 const imagingParts = useMemo(() => listParts(design.busId).filter(part => part.metric === 'IMAGES' || part.metric === 'MAPS'), [design.busId]);
 useEffect(() => { invalidate(); }, [invalidate, design, live, telemetry, mode, reducedMotion, reviewSample, referenceOnly, previewOrbit]);
 useFrame(() => {
  const pose = readPose(), current = pose.telemetry;
  if (pathRoot.current) relativePosition(pathRoot.current.position, [0, 0, 0], pose.originKm);
  if (marker.current) relativePosition(marker.current.position, pose.positionKm, pose.originKm);
  if (attitude.current && pose.attitude) renderAttitude(attitude.current.quaternion, pose.attitude.q);
  if (station.current) {
   station.current.visible = !referenceOnly && !!pose.stationPosKm;
   if (pose.stationPosKm) {
    relativePosition(station.current.position, pose.stationPosKm, pose.originKm);
    renderDirection(scratch.normal, pose.stationPosKm).normalize();
    station.current.quaternion.setFromUnitVectors(scratch.axis, scratch.normal);
   }
  }
  if (link.current) {
   link.current.visible = !referenceOnly && !!current?.downlinkActive && !!pose.stationPosKm;
   if (current?.downlinkActive && pose.stationPosKm) {
    relativePosition(scratch.satellite, pose.positionKm, pose.originKm);
    relativePosition(scratch.station, pose.stationPosKm, pose.originKm);
    link.current.position.copy(scratch.station).lerp(scratch.satellite, .5);
    link.current.quaternion.setFromUnitVectors(scratch.axis, scratch.direction.copy(scratch.satellite).sub(scratch.station).normalize());
    link.current.scale.set(close ? .000001 : 2, scratch.satellite.distanceTo(scratch.station), close ? .000001 : 2);
    if (packet.current) for (let i = 0; i < packet.current.children.length; i++) packet.current.children[i].position.copy(scratch.satellite).lerp(scratch.station, (current.downlinkedMB * .03 + i / 3) % 1);
   }
  }
  if (footprint.current) {
   const observing = !!current && !current.safe && current.socWh > 0 && current.computer.state === 'RUNNING' && !current.thermal?.inhibited && current.instruments.some(instrument => {
    const part = imagingParts.find(candidate => candidate.id === instrument.partId);
    return !!part && instrument.on && !instrument.lost && instrument.dutyFraction > 0 && (!part.requiresLight || current.sunlit) && (!part.requiresTarget || current.attitude.instrumentTargetDeg <= part.coneHalfAngleDeg!.v);
   });
   footprint.current.visible = !referenceOnly && observing && !!pose.attitude;
   if (observing && pose.attitude) {
    scratch.q.fromArray(pose.attitude.q);
    scratch.direction.set(0, 0, 1).applyQuaternion(scratch.q);
    scratch.position.fromArray(pose.positionKm);
    const b = scratch.position.dot(scratch.direction), c = scratch.position.lengthSq() - kit.radiusKm ** 2, discriminant = b * b - c;
    const distance = discriminant >= 0 ? -b - Math.sqrt(discriminant) : -1;
    footprint.current.visible = distance > 0;
    if (distance > 0) {
     scratch.position.addScaledVector(scratch.direction, distance).multiplyScalar(1.00003);
     const x = scratch.position.x, y = scratch.position.y, z = scratch.position.z;
     relativePosition(footprint.current.position, [x, y, z], pose.originKm);
     renderDirection(scratch.normal, [x, y, z]).normalize();
     footprint.current.quaternion.setFromUnitVectors(scratch.direction.set(0, 0, 1), scratch.normal);
    }
   }
  }
 });
 const coneHeight = Math.max(100, (orbit?.smaKm ?? kit.radiusKm + 420) - kit.radiusKm);
 return <>
  <group ref={pathRoot} visible={!close}>
   <SceneLine points={points} closed color={kit.accent} opacity={.5}/>
   {overlays.shadow.map((arc, i) => <SceneLine key={`shadow:${i}`} points={arc} color="#ad87d8"/>)}
   {overlays.contact.map((arc, i) => <SceneLine key={`contact:${i}`} points={arc} color="#76f1ab"/>)}
   {proposalPath.length > 0 && <SceneLine points={proposalPath} closed color="#ffd58b" opacity={.8}/>}
   {trail.length > 1 && <SceneLine points={trail} color="#ffdc87" opacity={.9}/>}
   {apsides.map((position, index) => <mesh key={index} position={position}><sphereGeometry args={[24, 10, 6]}/><meshBasicMaterial color={index === 0 ? '#ffd27c' : '#f18f96'}/></mesh>)}
  </group>
  <group ref={marker} name="mission-spacecraft" visible={!referenceOnly}>
   {close ? <>
    <group ref={attitude}><group scale={.001}>
     <SpacecraftModel design={design} previewEquipment={previewEquipment} telemetry={telemetry} reducedMotion={reducedMotion} inspectable={!referenceOnly}/>
     <RcsPuffs busId={design.busId} reducedMotion={reducedMotion}/>
     <ShadowOutline busId={design.busId}/>
    </group></group>
    <PilotAnchors busId={design.busId} epochUTC={orbit?.epochUTC ?? ''} mars={kit.body === 'MARS'}/>
   </> : <><sprite scale={[.022, .022, 1]}><spriteMaterial color={telemetry?.safe ? '#ffc16c' : '#e7faff'} sizeAttenuation={false} depthTest={false}/></sprite>{quality.labelBudget > 0 && <Html center style={{ pointerEvents: 'none', fontSize: '11px', color: '#c9edf0', whiteSpace: 'nowrap', transform: 'translateY(-18px)' }}>{t('scene.focus')}</Html>}</>}
   {close && <Boresights busId={design.busId}/>}
  </group>
  <group ref={station} name="mission-station" visible={false}>
   {!close && <><mesh><sphereGeometry args={[35, 10, 6]}/><meshBasicMaterial color="#71e5ad"/></mesh><mesh position={[0, coneHeight / 2, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[coneHeight / Math.tan(MODEL.minElevation.v * Math.PI / 180), coneHeight, 24, 1, true]}/><meshBasicMaterial color="#69d6a5" wireframe transparent opacity={.06} depthWrite={false}/></mesh>{quality.labelBudget > 1 && <Html style={{ pointerEvents: 'none', fontSize: '10px', color: '#92ddb4', whiteSpace: 'nowrap' }}>{t('flight.station')} · {MODEL.minElevation.v}°</Html>}</>}
  </group>
  <group ref={link} visible={false}><mesh><cylinderGeometry args={[1, 1, 1, 5]}/><meshBasicMaterial color="#60eaca" transparent opacity={.65}/></mesh></group>
  {!close && <group ref={packet} visible={!!telemetry?.downlinkActive}>{[0, 1, 2].map(index => <mesh key={index}><sphereGeometry args={[12, 8, 6]}/><meshBasicMaterial color="#d4fff3"/></mesh>)}</group>}
  <group ref={footprint} visible={false}><ObservationTarget radius={30} color={kit.accent}/>{!close && quality.labelBudget > 2 && <Html style={{ pointerEvents: 'none', fontSize: '10px', color: '#a3ece4', maxWidth: '180px' }}>{t('flight.footprint')}</Html>}</group>
 </>;
}
