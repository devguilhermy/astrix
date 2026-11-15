import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, type Object3D } from 'three';
import { setTrackedRect } from '../../ui/layout/trackedTargets';
import { projectBox } from './projectBounds';
import { useWorkbench } from './workbenchState';

const box = new Box3();

function shown(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) if (!current.visible) return false;
  return true;
}

/** Installed instances of the part, else its empty workbench slot. Proposals and ghosts are never anchors. */
function collect(scene: Object3D, partId: string): Object3D[] {
  const installed: Object3D[] = [], slots: Object3D[] = [];
  scene.traverse(object => {
    if (object.userData.partId !== partId || !shown(object)) return;
    if (object.userData.installed === true && object.name.startsWith('part:')) installed.push(object);
    else if (object.name.startsWith('slot:')) slots.push(object);
  });
  return installed.length ? installed : slots;
}

/**
 * Publishes the inspected component's projected silhouette every rendered frame, so the Component panel stays
 * beside it while the camera is dragged. Mount after the camera rig so the projection uses this frame's camera.
 */
export function PartTracker() {
  const partId = useWorkbench(state => state.inspectedPartId);
  const invalidate = useThree(state => state.invalidate);
  const anchors = useRef<Object3D[]>([]), lookup = useRef(0);
  useEffect(() => {
    anchors.current = []; lookup.current = 0;
    if (partId) invalidate(); else setTrackedRect('part', null);
    return () => setTrackedRect('part', null);
  }, [partId, invalidate]);
  useFrame(({ scene, camera, size }) => {
    if (!partId) return;
    // Re-resolve when an anchor was unmounted or hidden (install, removal, shot change); throttle empty searches.
    if (anchors.current.some(object => !object.parent || !shown(object)) || (!anchors.current.length && lookup.current-- <= 0)) {
      anchors.current = collect(scene, partId);
      lookup.current = 15;
    }
    if (!anchors.current.length) { setTrackedRect('part', null); return; }
    box.makeEmpty();
    for (const object of anchors.current) { object.updateWorldMatrix(true, true); box.expandByObject(object); }
    camera.updateMatrixWorld();
    const rect = projectBox(box, camera, size);
    setTrackedRect('part', rect && { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) });
  });
  return null;
}
