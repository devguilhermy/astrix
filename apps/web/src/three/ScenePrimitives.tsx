import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Line, LineLoop, LineBasicMaterial } from 'three';
import type { MissionSceneDefinition, SceneVector } from './missionScenes';
import { Planet } from './space/Planet';

export function SceneLine({ points, color, opacity = 1, closed = false }: { points: readonly SceneVector[]; color: string; opacity?: number; closed?: boolean }) {
 const line = useMemo(() => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
  const material = new LineBasicMaterial({ color, transparent: true, opacity });
  return closed ? new LineLoop(geometry, material) : new Line(geometry, material);
 }, [points, color, opacity, closed]);
 useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
 return <primitive object={line}/>;
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
