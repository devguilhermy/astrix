import { forwardRef } from 'react';
import type { Group } from 'three';

export const LAUNCH_PLUME = 'launch-plume';

/**
 * Schematic launch stack of unit height, centred on its origin with +Y pointing away from the
 * planet. Scaled to twice the hull radius it fills the hull's own clearance sphere, so the
 * pad clearance also holds for the stack; the spacecraft rides hidden inside the fairing.
 * Adapted from the retained `AscentStack` reference in `FlightScene.tsx`.
 */
export const LaunchStack = forwardRef<Group, { scale: number; climbing?: boolean }>(function LaunchStack({ scale, climbing = false }, ref) {
  return <group ref={ref} name="launch-stack" scale={scale}>
    <mesh position={[0, -.225, 0]}><cylinderGeometry args={[.09, .09, .55, 20]}/><meshStandardMaterial color="#e4e8f0" metalness={.2} roughness={.65}/></mesh>
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * .1, -.44, Math.sin(i * Math.PI / 2) * .1]} rotation={[0, -i * Math.PI / 2, 0]}><boxGeometry args={[.06, .12, .01]}/><meshStandardMaterial color="#9fb0c5" metalness={.3} roughness={.5}/></mesh>)}
    <mesh position={[0, .075, 0]}><cylinderGeometry args={[.08, .09, .05, 20]}/><meshStandardMaterial color="#3d4a5a" metalness={.3} roughness={.6}/></mesh>
    <mesh position={[0, .2, 0]}><cylinderGeometry args={[.08, .08, .2, 20]}/><meshStandardMaterial color="#cdd5e0" metalness={.2} roughness={.65}/></mesh>
    <mesh position={[0, .36, 0]}><cylinderGeometry args={[.11, .11, .12, 20]}/><meshStandardMaterial color="#f1f3f6" metalness={.15} roughness={.55}/></mesh>
    <mesh position={[0, .46, 0]}><coneGeometry args={[.11, .08, 20]}/><meshStandardMaterial color="#f1f3f6" metalness={.15} roughness={.55}/></mesh>
    <group name={LAUNCH_PLUME} position={[0, -.5, 0]} visible={climbing}>
      <mesh position={[0, -.15, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.075, .3, 16, 1, true]}/><meshBasicMaterial color="#ffb35c" transparent opacity={.85} depthWrite={false}/></mesh>
      <mesh position={[0, -.08, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.045, .16, 12, 1, true]}/><meshBasicMaterial color="#fff1c4" transparent opacity={.9} depthWrite={false}/></mesh>
    </group>
  </group>;
});
