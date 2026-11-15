import { useMemo, useRef } from 'react';
import { SceneHtml } from '../SceneHtml';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { Vector3, type Group } from 'three';
import { planetPosition, type BusId } from '@astrix/core';
import { usePilot } from '../../ui/flight/pilotState';
import { useMissionPose } from '../space/useMissionPose';
import { renderDirection } from '../space/FloatingOrigin';
import { BUS_GEOMETRY } from './slots';

export function PilotAnchors({ busId, epochUTC, mars }: { busId: BusId; epochUTC: string; mars: boolean }) {
 const { t } = useTranslation();
 const enabled = usePilot(state => state.enabled);
 const readPose = useMissionPose();
 const root = useRef<Group>(null);
 const vectors = useMemo(() => ({ sun: new Vector3(), target: new Vector3(), earth: new Vector3() }), []);
 const radius = Math.max(...BUS_GEOMETRY[busId].dimensions) * .001 * 1.6;
 useFrame(() => {
  if (!enabled || !root.current) return;
  const pose = readPose();
  renderDirection(vectors.sun, pose.sunDir).normalize().multiplyScalar(radius);
  renderDirection(vectors.target, pose.positionKm).normalize().multiplyScalar(-radius);
  if (pose.stationPosKm) vectors.earth.set(pose.stationPosKm[0] - pose.positionKm[0], pose.stationPosKm[2] - pose.positionKm[2], -(pose.stationPosKm[1] - pose.positionKm[1])).normalize().multiplyScalar(radius);
  else if (mars) {
   const earth = planetPosition('EARTH', pose.t, epochUTC), planet = planetPosition('MARS', pose.t, epochUTC);
   vectors.earth.set(earth[0] - planet[0], earth[2] - planet[2], -(earth[1] - planet[1])).normalize().multiplyScalar(radius);
  } else vectors.earth.copy(vectors.target);
  root.current.children[0].position.copy(vectors.sun);
  root.current.children[1].position.copy(vectors.target);
  root.current.children[2].position.copy(vectors.earth);
 });
 if (!enabled) return null;
 return <group ref={root}>{(['sun', 'target', 'earth'] as const).map((anchor, index) => <group key={anchor}>
  <mesh><sphereGeometry args={[radius * .035, 12, 8]}/><meshBasicMaterial color={['#ffd17b', '#65e3d5', '#74bfff'][index]} transparent opacity={.85} depthTest={false}/></mesh>
  <SceneHtml center style={{ pointerEvents: 'none', fontSize: '11px', color: '#e5f5fa', whiteSpace: 'nowrap', transform: 'translateY(-18px)', textShadow: '0 1px 4px #000' }}>{t(`flight.${anchor}`)}</SceneHtml>
 </group>)}</group>;
}
