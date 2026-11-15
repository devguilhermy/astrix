import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CONSTANTS } from '@astrix/core';
import { MAX_INTERPOLATION_GAP_MS, sampleTrajectory, type TrajectorySample } from '@astrix/core/interop/gmat';
import { trajectoryViewer } from '../ui/advanced/trajectoryStore';
import { planetKit, type SceneVector } from './missionScenes';
import { PlanetBody, SceneLine } from './ScenePrimitives';

export function TrajectoryScene() {
 const trajectory = trajectoryViewer(s=>s.trajectory), time = trajectoryViewer(s=>s.time), invalidate = useThree(s=>s.invalidate);
 const paths = useMemo(() => {
  if (!trajectory) return [];
  const runs: TrajectorySample[][] = [];
  for (const segment of trajectory.segments) {
   let run: TrajectorySample[] = [];
   for (const sample of segment.samples) {
    if (run.length && sample.time - run[run.length-1].time > MAX_INTERPOLATION_GAP_MS) { if (run.length > 1) runs.push(run); run = []; }
    run.push(sample);
   }
   if (run.length > 1) runs.push(run);
  }
  // Discard whole runs if needed rather than joining gaps; bound draw calls and vertices.
  const runStride = Math.max(1, Math.ceil(runs.length / 512));
  const selected = runs.filter((_,i) => i % runStride === 0), total = selected.reduce((n,run) => n + run.length, 0);
  return selected.map(run => {
   const budget = Math.max(2, Math.floor(7168 * run.length / total));
   const stride = Math.max(1, Math.ceil((run.length - 1) / (budget - 1))), radius = CONSTANTS[trajectory.body].radius.v;
   return run.filter((_,i)=>i%stride === 0 || i === run.length-1).map(s=>[s.positionKm[0]/radius,s.positionKm[2]/radius,-s.positionKm[1]/radius] as SceneVector);
  });
 }, [trajectory]);
 useEffect(()=>{invalidate();},[time,trajectory,invalidate]);
 if (!trajectory) return null;
 const radius = CONSTANTS[trajectory.body].radius.v, position = sampleTrajectory(trajectory,time);
 return <group scale={1.65}><ambientLight intensity={.5}/><directionalLight position={[-8,0,0]} intensity={2}/><PlanetBody kit={planetKit(trajectory.body === 'MARS' ? 'MARS' : 'EARTH')}/>{paths.map((points,i)=><SceneLine key={i} points={points} color="#71e5ed"/>)}{position && <mesh name="mission-spacecraft" position={[position[0]/radius,position[2]/radius,-position[1]/radius]}><sphereGeometry args={[.06,12,8]}/><meshBasicMaterial color="#fff2b4"/></mesh>}</group>;
}
