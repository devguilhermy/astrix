import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { Design } from '@astrix/core';
import { SpacecraftModel } from './spacecraft/SpacecraftModel';

export type LaunchPresentation = 'IDLE' | 'PLAYING' | 'COMPLETE';
/** Authored metre-proportioned stack at a true-scale Earth limb. This local
 * storyboard never mutates simulation time, propulsion, launch readiness or fuel.
 * Static frames and Skip are equivalent presentation outcomes under reduced motion.
 */
export function LaunchScene({ design, presentation, reducedMotion, previewEquipment, onComplete, onStage }: {
 design: Design; presentation: LaunchPresentation; reducedMotion: boolean; previewEquipment: boolean; onComplete(): void; onStage?(stage: number): void;
}) {
 const stack = useRef<Group>(null), booster = useRef<Group>(null), craft = useRef<Group>(null);
 const elapsed = useRef(0), lastStage = useRef(-1);
 const invalidate = useThree(state => state.invalidate);
 useEffect(() => { elapsed.current = presentation === 'COMPLETE' ? 6 : 0; lastStage.current = -1; invalidate(); }, [presentation, design.definitionDigest, invalidate]);
 useFrame((_, wallDelta) => {
  if (presentation === 'PLAYING' && !reducedMotion) elapsed.current = Math.min(6, elapsed.current + Math.min(wallDelta, .1));
  else elapsed.current = presentation === 'COMPLETE' ? 6 : 0;
  const progress = elapsed.current / 6, stage = progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2;
  if (lastStage.current !== stage) { lastStage.current = stage; onStage?.(stage); }
  if (stack.current) { stack.current.position.set(progress ** 2 * .025, progress * .14, 0); stack.current.rotation.z = -progress * .16; }
  if (booster.current) { booster.current.position.y = -.01 - Math.max(0, progress - 1 / 3) * .08; booster.current.rotation.z = Math.max(0, progress - 1 / 3) * .3; }
  if (craft.current) { craft.current.visible = stage === 2; craft.current.position.set(.01 + Math.max(0, progress - 2 / 3) * .06, .04, 0); }
  if (presentation === 'PLAYING' && !reducedMotion) { if (elapsed.current >= 6) onComplete(); else invalidate(); }
 });
 return <group>
  <group ref={stack} name="launch-storyboard-stack">
   <group scale={.001}>
    <mesh position={[0, 16, 0]}><cylinderGeometry args={[2, 2, 25, 20]}/><meshStandardMaterial color="#e4eaf0" metalness={.25} roughness={.65}/></mesh>
    <mesh position={[0, 33, 0]}><coneGeometry args={[2, 9, 20]}/><meshStandardMaterial color="#eef3f6" metalness={.2}/></mesh>
    <mesh position={[0, 4, 0]}><cylinderGeometry args={[2, 2, 2, 20]}/><meshStandardMaterial color="#4e6574"/></mesh>
   </group>
   <group ref={booster}><group scale={.001}><mesh position={[0, -6, 0]}><cylinderGeometry args={[2, 2.2, 20, 20]}/><meshStandardMaterial color="#ccd6dd" metalness={.35}/></mesh><mesh position={[0, -17, 0]}><coneGeometry args={[1.6, 3, 16, 1, true]}/><meshStandardMaterial color="#56616a" side={2}/></mesh></group></group>
   <group ref={craft} name="mission-spacecraft" visible={false} scale={.001}><SpacecraftModel design={design} previewEquipment={previewEquipment} reducedMotion={reducedMotion}/></group>
  </group>
 </group>;
}
