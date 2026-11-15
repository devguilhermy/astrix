import { forwardRef, useMemo, type ComponentRef } from 'react';
import { Line } from '@react-three/drei';
import type { InterleavedBufferAttribute } from 'three';
import type { MissionSceneDefinition, SceneVector } from './missionScenes';
import { Planet } from './space/Planet';

export type SceneLineObject = ComponentRef<typeof Line>;
export interface SceneLineProps {
  points: readonly SceneVector[];
  color: string;
  opacity?: number;
  closed?: boolean;
  /** Screen-space width in CSS pixels. */
  width?: number;
  dashed?: boolean;
}

/** A screen-space polyline. Transparent lines never write depth, so rings and trails do not cut each other. */
export const SceneLine = forwardRef<SceneLineObject, SceneLineProps>(function SceneLine({ points, color, opacity = 1, closed = false, width = 1, dashed = false }, ref) {
  const path = useMemo(() => closed && points.length > 2 ? [...points, points[0]!] : points, [points, closed]);
  // About forty dashes along the whole line, whatever its scale.
  const dash = useMemo(() => {
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1], path[i]![2] - path[i - 1]![2]);
    return Math.max(length, 1e-6) / 40;
  }, [path]);
  if (path.length < 2) return null;
  const transparent = opacity < 1;
  return <Line ref={ref} points={path} color={color} lineWidth={width} dashed={dashed} dashSize={dash * .6} gapSize={dash * .4} transparent={transparent} opacity={opacity} depthWrite={!transparent}/>;
});

/** Moves the only segment of a two-point `SceneLine` in place, without reallocating its buffers. */
export function setSceneSegment(line: SceneLineObject | null, from: readonly number[], to: readonly number[]) {
  const start = line?.geometry.attributes.instanceStart as InterleavedBufferAttribute | undefined;
  if (!start) return;
  const array = start.data.array as Float32Array;
  array[0] = from[0]!; array[1] = from[1]!; array[2] = from[2]!; array[3] = to[0]!; array[4] = to[1]!; array[5] = to[2]!;
  start.data.needsUpdate = true;
}

/** Retained normalized-radius API for the independent trajectory viewer.
 * Mission shots use Planet's kilometre default through SpaceBackdrop instead.
 */
export function PlanetBody({ kit, radius = 1 }: { kit: MissionSceneDefinition; radius?: number }) {
 return <Planet body={kit.body} radiusKm={radius} lowResolution/>;
}

export function GroundDish({ color = '#e7bb7a' }: { color?: string }) {
 return <group>
  <mesh position={[0, .06, 0]}><cylinderGeometry args={[.04, .06, .12, 12]}/><meshStandardMaterial color="#b4bfcc"/></mesh>
  <mesh position={[0, .17, 0]} rotation={[.4, 0, 0]}><coneGeometry args={[.15, .1, 20, 1, true]}/><meshStandardMaterial color={color} side={2}/></mesh>
  <mesh position={[0, .24, 0]}><sphereGeometry args={[.025, 8, 6]}/><meshBasicMaterial color={color}/></mesh>
 </group>;
}

export function ObservationTarget({ radius = .2, color = '#63e2d3' }: { radius?: number; color?: string }) {
 return <group>
  <mesh><ringGeometry args={[radius * .85, radius, 40]}/><meshBasicMaterial color={color} transparent opacity={.8} side={2} depthWrite={false}/></mesh>
  <mesh><circleGeometry args={[radius * .45, 28]}/><meshBasicMaterial color={color} transparent opacity={.18} side={2} depthWrite={false}/></mesh>
 </group>;
}

export function SolarContext({ compact = false }: { compact?: boolean }) {
 const rays = useMemo<SceneVector[][]>(() => [-.6, 0, .6].map(z => [[-3.4, .2, z], [-1.7, .2, z]]), []);
 return <group scale={compact ? .7 : 1}>
  <mesh position={[-3.8, .2, 0]}><sphereGeometry args={[.35, 24, 16]}/><meshBasicMaterial color="#f2ba67"/></mesh>
  <mesh position={[-3.8, .2, 0]}><sphereGeometry args={[.46, 20, 12]}/><meshBasicMaterial color="#efb775" wireframe transparent opacity={.2}/></mesh>
  {rays.map((points, i) => <SceneLine key={i} points={points} color="#efb775" opacity={.55}/>)}
 </group>;
}
