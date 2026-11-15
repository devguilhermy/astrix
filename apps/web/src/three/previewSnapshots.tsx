// Adapted from Void Protocol (© Guilhermy), rendering/previewSnapshots.tsx @218625d.
// Owner-authorized project reuse; see CREDITS.md. One existing renderer, no WebGL root.
import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import { Color, PerspectiveCamera, Scene, WebGLRenderTarget } from 'three';
import type { Design } from '@astrix/core';
import { SpacecraftModel } from './spacecraft/SpacecraftModel';
import { BUS_GEOMETRY } from './spacecraft/slots';

const snapshots = new Map<string, string>(), listeners = new Set<() => void>();
export function snapshotKey(design: Design) {
 return `${design.scenarioId}:${design.levelId}:${design.rulesVersion}:${design.busId}:${design.revision}:${design.parts.map(part => `${part.partId}:${part.qty}:${part.propellantKg ?? 0}`).join('|')}`;
}
export function usePreviewSnapshot(design: Design | null) {
 const key = design ? snapshotKey(design) : '';
 return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => snapshots.get(key) ?? null, () => null);
}
export function PreviewSnapshot({ design }: { design: Design }) {
 const scene = useMemo(() => new Scene(), []), { gl } = useThree(), key = snapshotKey(design);
 useLayoutEffect(() => {
  if (snapshots.has(key) || gl.getContext().isContextLost()) return;
  const radius = Math.max(...BUS_GEOMETRY[design.busId].dimensions) * 1.3;
  const target = new WebGLRenderTarget(256, 192), camera = new PerspectiveCamera(36, 256 / 192, radius / 1000, radius * 30);
  camera.position.set(.65, .4, .9).normalize().multiplyScalar(radius / Math.sin(Math.PI / 10));
  camera.lookAt(0, 0, 0);
  const previous = gl.getRenderTarget(), oldClear = gl.getClearColor(new Color()), alpha = gl.getClearAlpha(), buffer = new Uint8Array(256 * 192 * 4);
  try {
   gl.setRenderTarget(target); gl.setClearColor('#080f1d', 1); gl.clear(); gl.render(scene, camera); gl.readRenderTargetPixels(target, 0, 0, 256, 192, buffer);
   const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 192;
   const context = canvas.getContext('2d');
   if (context) {
    const pixels = new Uint8ClampedArray(buffer.length);
    for (let y = 0; y < 192; y++) pixels.set(buffer.subarray((191 - y) * 256 * 4, (192 - y) * 256 * 4), y * 256 * 4);
    context.putImageData(new ImageData(pixels, 256, 192), 0, 0); snapshots.set(key, canvas.toDataURL('image/png'));
    if (snapshots.size > 60) snapshots.delete(snapshots.keys().next().value!);
    listeners.forEach(listener => listener());
   }
  } finally { gl.setRenderTarget(previous); gl.setClearColor(oldClear, alpha); target.dispose(); }
 }, [gl, key, scene, design.busId]);
 return createPortal(<><ambientLight intensity={1.4}/><directionalLight position={[5, 5, 5]} intensity={3}/><SpacecraftModel design={design} reducedMotion/></>, scene);
}
