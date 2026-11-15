// Pattern: Void Protocol (© Guilhermy), StarfieldSkybox.tsx (321 LOC) @ 218625d.
// Owner-authorized reuse under ASTRIX Apache-2.0; see CREDITS.md.
// Vacuum sphere only: no atmospheric/liquid/telemetry coupling or borrowed hash.
import { useMemo } from 'react';
import { BackSide, type Texture } from 'three';
import { useQuality } from '../quality';
import { useSpaceTexture } from './textures';
import { SKY_VERTEX_SHADER, STARFIELD_FRAGMENT_SHADER } from './starfieldShader';

/** One declarative, camera-centred sky fixed to MJ2000Eq for all camera shots.
 * NASA SVS Deep Star Maps 2020, Gaia DR2: ESA/Gaia/DPAC (asset-sources.json).
 * Optional image loading never suspends or delays the first committed draw.
 */
export function Skybox() {
 const tier = useQuality();
 const image = useSpaceTexture(tier === 'LOW' ? 'starmap-2020-1024.jpg' : 'starmap-2020-4096.jpg', 'starmap-2020-1024.jpg');
 const uniforms = useMemo(() => ({
  uSky: { value: null as Texture | null }, uHasSky: { value: false }, uDensity: { value: 1 },
 }), []);
 uniforms.uSky.value = image?.texture ?? null;
 uniforms.uHasSky.value = image !== null;
 uniforms.uDensity.value = tier === 'LOW' ? 0.7 : 1;
 return <mesh name="mission-sky" frustumCulled={false} renderOrder={1000} raycast={() => null}>
  <sphereGeometry args={[1, 32, 16]}/>
  <shaderMaterial
   side={BackSide}
   depthWrite={false}
   uniforms={uniforms}
   vertexShader={SKY_VERTEX_SHADER}
   fragmentShader={STARFIELD_FRAGMENT_SHADER}
  />
 </mesh>;
}
