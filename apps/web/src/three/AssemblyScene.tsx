import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { Design } from '@astrix/core';
import { useMission } from '../store';
import { SpacecraftModel } from './spacecraft/SpacecraftModel';
import { useWorkbench } from './spacecraft/workbenchState';

/** Close shot only. The shared scene composition owns lighting, backdrop and floating origin. */
export function AssemblyScene({ design, previewEquipment, reducedMotion: overrideMotion }: { design: Design; previewEquipment: boolean; reducedMotion?: boolean }) {
  const settingsMotion = useMission(state => state.settings.reducedMotion);
  const reducedMotion = overrideMotion ?? settingsMotion;
  const turntable = useWorkbench(state => state.turntable);
  const hovered = useWorkbench(state => state.hoveredCategory);
  const root = useRef<Group>(null);
  const pointerDown = useRef(false);
  const lastInteraction = useRef(-Infinity);
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const start = () => { pointerDown.current = true; lastInteraction.current = performance.now(); invalidate(); };
    const end = () => { pointerDown.current = false; lastInteraction.current = performance.now(); invalidate(); };
    const wheel = () => { lastInteraction.current = performance.now(); invalidate(); };
    gl.domElement.addEventListener('pointerdown', start);
    gl.domElement.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
    return () => {
      gl.domElement.removeEventListener('pointerdown', start);
      gl.domElement.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
    };
  }, [gl, invalidate]);
  useLayoutEffect(() => {
    if (root.current) root.current.rotation.set(0, 0, 0);
    invalidate();
  }, [design.busId, design.scenarioId, invalidate]);
  useLayoutEffect(() => { invalidate(); }, [turntable, reducedMotion, hovered, invalidate]);
  useFrame((state, delta) => {
    if (!root.current || !turntable || reducedMotion) return;
    if (!pointerDown.current && !hovered && performance.now() - lastInteraction.current > 2000) {
      root.current.rotation.y += Math.min(delta, .1) * .07;
    }
    // Keep demand-mode rendering alive while waiting for the interaction idle interval.
    state.invalidate();
  });
  return <group name="mission-spacecraft" scale={.001}>
    <group ref={root}>
      <SpacecraftModel design={design} previewEquipment={previewEquipment} workbench inspectable reducedMotion={reducedMotion}/>
    </group>
  </group>;
}
