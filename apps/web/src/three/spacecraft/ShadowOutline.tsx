import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import type { Group } from 'three';
import type { BusId } from '@astrix/core';
import { useMissionPose } from '../space/useMissionPose';
import { BUS_GEOMETRY } from './slots';

/** An explicitly unlit inspection overlay, not sunlight or emitting hardware.
 * The real model remains shadowed and the core's generation stays unchanged.
 * Body-local metre envelope follows the actual attitude through its parent.
 */
export function ShadowOutline({ busId }: { busId: BusId }) {
 const { t } = useTranslation();
 const readPose = useMissionPose(), root = useRef<Group>(null);
 const [x, y, z] = BUS_GEOMETRY[busId].dimensions;
 useFrame(() => { if (root.current) root.current.visible = readPose().telemetry?.sunlit === false; });
 return <group ref={root} visible={false} name="shadow-inspection-overlay" userData={{ illustration: 'inspection-envelope', solarIllumination: false }}>
  <mesh scale={1.01} renderOrder={5} raycast={() => null}>
   {busId === 'CREW_CAPSULE' ? <cylinderGeometry args={[x / 2, x / 2, y, 12, 1, true]}/> : <boxGeometry args={[x, y, z]}/>}
   <meshBasicMaterial color="#a9e0eb" wireframe transparent opacity={.65} depthWrite={false}/>
  </mesh>
  <Html position={[0, y * .7, 0]} center style={{ pointerEvents: 'none', color: '#b7dbe4', fontSize: '11px', whiteSpace: 'nowrap', textShadow: '0 1px 4px #000' }}>{t('flight.shadowOutline')}</Html>
 </group>;
}
