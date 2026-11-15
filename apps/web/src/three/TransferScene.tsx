import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { Group, Vector3 } from 'three';
import { CONSTANTS, planetPosition, transferPosition, type Design } from '@astrix/core';
import { hohmann } from '@astrix/core/physics';
import { SceneLine } from './ScenePrimitives';
import type { SceneVector } from './missionScenes';
import { Planet } from './space/Planet';
import { useMissionPose } from './space/useMissionPose';
import { relativePosition } from './space/FloatingOrigin';
import { useQualityProfile } from './quality';

const ZERO = [0, 0, 0] as const;
const convert = (p: readonly [number, number, number]): SceneVector => [p[0], p[2], -p[1]];
/** The scene and core share the same epoch-aligned ideal two-body transfer.
 * Planet surfaces retain actual radii; map billboards, never enlarged planets or
 * spacecraft meshes, identify objects too small to resolve at heliocentric scale.
 */
export interface TransferPlayback { fromSec: number; toSec: number }
export function TransferScene({ design, playback, onComplete }: { design: Design; playback?: TransferPlayback | null; onComplete?(): void }) {
 const { t } = useTranslation();
 const readPose = useMissionPose();
 const elapsed = useRef(0), invalidate = useThree(state => state.invalidate);
 useEffect(() => { elapsed.current = 0; invalidate(); }, [playback, invalidate]);
 const quality = useQualityProfile();
 const epoch = design.orbit!.epochUTC;
 const earth = useRef<Group>(null), mars = useRef<Group>(null), marker = useRef<Group>(null);
 const sunDirections = useMemo(() => ({ earth: [1, 0, 0] as [number, number, number], mars: [1, 0, 0] as [number, number, number], vector: new Vector3(), time: NaN }), []);
 const paths = useMemo(() => {
  const samples = quality.orbitSamples;
  return {
   earth: Array.from({ length: samples + 1 }, (_, i) => convert(planetPosition('EARTH', CONSTANTS.EARTH.yearSec.v * i / samples, epoch))),
   mars: Array.from({ length: samples + 1 }, (_, i) => convert(planetPosition('MARS', CONSTANTS.MARS.yearSec.v * i / samples, epoch))),
   transfer: Array.from({ length: samples + 1 }, (_, i) => convert(transferPosition(hohmann().transferSec * i / samples, epoch))),
  };
 }, [epoch, quality.orbitSamples]);
 useFrame((_, wallDelta) => {
  const pose = readPose();
  if (playback) elapsed.current = Math.min(2.4, elapsed.current + Math.min(.1, wallDelta));
  const time = playback ? playback.fromSec + (playback.toSec - playback.fromSec) * elapsed.current / 2.4 : pose.t;
  if (playback) { if (elapsed.current >= 2.4) onComplete?.(); else invalidate(); }
  if (time !== sunDirections.time) {
   const e = planetPosition('EARTH', time, epoch), m = planetPosition('MARS', time, epoch);
   if (earth.current) relativePosition(earth.current.position, e, ZERO);
   if (mars.current) relativePosition(mars.current.position, m, ZERO);
   sunDirections.vector.fromArray(e).normalize().negate().toArray(sunDirections.earth);
   sunDirections.vector.fromArray(m).normalize().negate().toArray(sunDirections.mars);
   if (marker.current) relativePosition(marker.current.position, transferPosition(time, epoch), ZERO);
   sunDirections.time = time;
  }
 });
 return <>
  <mesh><sphereGeometry args={[695700, 24, 16]}/><meshBasicMaterial color="#ffd292"/></mesh>
  <SceneLine points={paths.earth} closed color="#397b9c" opacity={.4}/>
  <SceneLine points={paths.mars} closed color="#ae6f53" opacity={.4}/>
  <SceneLine points={paths.transfer} color="#71e5ed"/>
  <group ref={earth}><Planet body="EARTH" lowResolution sunDirection={sunDirections.earth}/><sprite scale={[.014, .014, 1]}><spriteMaterial color="#66b8ec" sizeAttenuation={false} depthTest={false}/></sprite>{quality.labelBudget > 0 && <Html style={{ pointerEvents: 'none', color: '#b9e7ff', fontSize: '11px' }}>{t('flight.earth')}</Html>}</group>
  <group ref={mars}><Planet body="MARS" lowResolution sunDirection={sunDirections.mars}/><sprite scale={[.014, .014, 1]}><spriteMaterial color="#efa785" sizeAttenuation={false} depthTest={false}/></sprite>{quality.labelBudget > 1 && <Html style={{ pointerEvents: 'none', color: '#f1b59c', fontSize: '11px' }}>{t('flight.mars')}</Html>}</group>
  <group ref={marker} name="mission-spacecraft"><sprite scale={[.018, .018, 1]}><spriteMaterial color="#e5fffb" sizeAttenuation={false} depthTest={false}/></sprite>{quality.labelBudget > 2 && <Html style={{ pointerEvents: 'none', color: '#d2fff7', fontSize: '11px', whiteSpace: 'nowrap' }}>{t('scene.focus')}</Html>}</group>
 </>;
}
