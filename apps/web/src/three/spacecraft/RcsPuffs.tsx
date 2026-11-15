import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, Quaternion, type Group, type MeshBasicMaterial } from 'three';
import type { BusId } from '@astrix/core';
import { useMissionPose } from '../space/useMissionPose';
import { BUS_GEOMETRY } from './slots';

/** Torque-couple feedback PATTERN from Void Protocol RcsThrusters.tsx (265 LOC)
 * and rcsBurstMath.ts (280 LOC), pin218625d. Owner-authorized Apache-2.0 reuse.
 * Independently authored bounded mesh effect; no copied particles/hash/shader.
 * This is an attitude-rate indicator, not a claim of modeled RCS fuel consumption.
 */
export function RcsPuffs({ busId, reducedMotion }: { busId: BusId; reducedMotion: boolean }) {
 const readPose = useMissionPose();
 const invalidate = useThree(state => state.invalidate);
 const root = useRef<Group>(null);
 const material = useRef<MeshBasicMaterial>(null);
 const state = useMemo(() => ({ previous: new Quaternion(), current: new Quaternion(), delta: new Quaternion(), valid: false, burst: 0, time: -1, generation: -1 }), []);
 const size = Math.max(...BUS_GEOMETRY[busId].dimensions);
 useFrame((_, wallDelta) => {
  const pose = readPose();
  if (!root.current || !material.current) return;
  if (pose.attitude && pose.t !== state.time) {
   state.current.fromArray(pose.attitude.q);
   if (state.valid && pose.discontinuity === state.generation && pose.attitude.rateRadSec > 1e-6) {
    state.delta.copy(state.previous).invert().multiply(state.current);
    if (Math.abs(state.delta.w) < .999999999) {
     const x = Math.abs(state.delta.x), y = Math.abs(state.delta.y), z = Math.abs(state.delta.z);
     root.current.rotation.set(x > y && x > z ? Math.PI / 2 : 0, z > x && z > y ? Math.PI / 2 : 0, 0);
     state.burst = Math.min(1, Math.max(.2, pose.attitude.rateRadSec * 15));
    }
   }
   state.previous.copy(state.current); state.time = pose.t; state.generation = pose.discontinuity; state.valid = true;
  }
  state.burst = Math.max(0, state.burst - Math.min(wallDelta, .1) * 4);
  root.current.visible = state.burst > .001;
  material.current.opacity = reducedMotion ? (state.burst > .001 ? .22 : 0) : state.burst * .55;
  if (root.current.visible) invalidate();
 });
 return <group ref={root} visible={false} userData={{ illustration: 'actual-attitude-rate', fuelModel: false }}>
  {[-1, 1].map(side => <mesh key={side} position={[side * size * .48, side * size * .3, 0]} rotation={[0, 0, side * Math.PI / 2]} scale={size}>
   <coneGeometry args={[.07, .3, 8, 1, true]}/>
   <meshBasicMaterial ref={side === 1 ? material : undefined} color="#cde8f2" transparent opacity={.3} depthWrite={false} blending={AdditiveBlending}/>
  </mesh>)}
 </group>;
}
