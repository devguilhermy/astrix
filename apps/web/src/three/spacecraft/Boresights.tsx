import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Quaternion, Vector3 } from 'three';
import type { BusId } from '@astrix/core';
import { usePilot } from '../../ui/flight/pilotState';
import { useMissionPose } from '../space/useMissionPose';
import { renderAttitude } from '../space/FloatingOrigin';
import { BUS_GEOMETRY } from './slots';

export function Boresights({ busId }: { busId: BusId }) {
 const enabled = usePilot(state => state.enabled), requested = usePilot(state => state.target);
 const readPose = useMissionPose(), invalidate = useThree(state => state.invalidate);
 const data = useMemo(() => {
  const line = (color: string, opacity: number) => new Line(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3)), new LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
  return { panel: line('#ffd17b', .8), instrument: line('#64e6cd', .8), requested: line('#b2a1ff', .4), vector: new Vector3(), q: new Quaternion() };
 }, []);
 const length = Math.max(...BUS_GEOMETRY[busId].dimensions) * .001 * 1.3;
 useEffect(() => { invalidate(); }, [enabled, requested, invalidate]);
 useEffect(() => () => { for (const line of [data.panel, data.instrument, data.requested]) { line.geometry.dispose(); line.material.dispose(); } }, [data]);
 useFrame(() => {
  const pose = readPose();
  data.panel.visible = enabled && !!pose.attitude;
  data.instrument.visible = enabled && !!pose.attitude;
  data.requested.visible = enabled && !!requested;
  if (!enabled || !pose.attitude) return;
  renderAttitude(data.q, pose.attitude.q);
  for (const line of [data.panel, data.instrument]) {
   data.vector.set(line === data.panel ? 1 : 0, 0, line === data.instrument ? 1 : 0).applyQuaternion(data.q).multiplyScalar(length);
   const attribute = line.geometry.getAttribute('position'); attribute.setXYZ(1, data.vector.x, data.vector.y, data.vector.z); attribute.needsUpdate = true;
  }
  if (requested) {
   renderAttitude(data.q, requested); data.vector.set(0, 0, 1).applyQuaternion(data.q).multiplyScalar(length);
   const attribute = data.requested.geometry.getAttribute('position'); attribute.setXYZ(1, data.vector.x, data.vector.y, data.vector.z); attribute.needsUpdate = true;
  }
 });
 return <group><primitive object={data.panel}/><primitive object={data.instrument}/><primitive object={data.requested}/></group>;
}
