// Adapted from Void Protocol (© Guilhermy), apps/web/src/rendering/WebGLFailureNotice.tsx @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function WebGLFailureNotice({ onFailure }: { onFailure(error?: unknown): void }) {
 const { gl, setFrameloop } = useThree();
 useEffect(() => {
  const stop = (event: Event) => {
   event.preventDefault();
   setFrameloop('never');
   onFailure(event instanceof CustomEvent && event.detail ? event.detail : new Error(event.type === 'webglcontextlost' ? 'WebGL context lost' : 'Scene rendering failed'));
  };
  gl.domElement.addEventListener('webglcontextlost', stop);
  gl.domElement.addEventListener('astrix-render-failure', stop);
  if (gl.getContext().isContextLost()) { setFrameloop('never'); onFailure(new Error('WebGL context lost')); }
  return () => {
   gl.domElement.removeEventListener('webglcontextlost', stop);
   gl.domElement.removeEventListener('astrix-render-failure', stop);
  };
 }, [gl, onFailure, setFrameloop]);
 return null;
}
