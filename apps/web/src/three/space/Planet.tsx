import { forwardRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Vector3, type Group, type Texture } from 'three';
import { CONSTANTS, sunDirection as coreSunDirection, type BodyId } from '@astrix/core';
import { useQuality, useQualityProfile } from '../quality';
import { renderDirection, type KmVector } from './FloatingOrigin';
import { useSpaceTexture } from './textures';
import { ATMOSPHERE_FRAGMENT_SHADER, PLANET_FRAGMENT_SHADER, PLANET_VERTEX_SHADER } from './atmosphere';

export interface PlanetProps {
 body: BodyId;
 /** Kilometres. Explicit radius also supports the historical normalized viewer. */
 radiusKm?: number;
 /** Core MJ2000Eq direction, read without mutation on each frame. */
 sunDirection?: KmVector;
 rotationRad?: number;
 /** Transfer's two planets use 1k maps even when its celestial sky is 4k. */
 lowResolution?: boolean;
}

/** Historical NASA surface composites with a core-driven, world-space terminator.
 * Earth RGB + Black Marble grayscale alpha share one 4k allocation. LOW keeps the
 * existing 1k daytime map and omits night lights. There is no weather/cloud layer.
 */
export const Planet = forwardRef<Group, PlanetProps>(function Planet({
 body, radiusKm = CONSTANTS[body].radius.v, sunDirection, rotationRad = 0, lowResolution = false,
}, ref) {
 const tier = useQuality();
 const quality = useQualityProfile();
 const highEarth = body === 'EARTH' && tier !== 'LOW' && !lowResolution;
 const lowFile = body === 'EARTH' ? 'earth-blue-marble-1024.png' : body === 'MARS' ? 'mars-viking-1024.jpg' : null;
 const image = useSpaceTexture(highEarth ? 'earth-blue-black-marble-4096.webp' : lowFile, highEarth ? lowFile ?? undefined : undefined);
 const initialSun = useMemo(() => coreSunDirection(body, 0), [body]);
 const uniforms = useMemo(() => ({
  uSurface: { value: null as Texture | null },
  uHasSurface: { value: false },
  uPackedNight: { value: false },
  uFallback: { value: new Color() },
  uSunDirection: { value: new Vector3() },
 }), []);
 const atmosphere = useMemo(() => ({
  uSunDirection: uniforms.uSunDirection,
  uRimColour: { value: new Color() },
  uStrength: { value: 0.5 },
 }), [uniforms]);
 uniforms.uSurface.value = image?.texture ?? null;
 uniforms.uHasSurface.value = image !== null;
 uniforms.uPackedNight.value = image?.file === 'earth-blue-black-marble-4096.webp';
 uniforms.uFallback.value.set(body === 'EARTH' ? '#16466c' : body === 'MOON' ? '#8b9096' : '#a65d43');
 atmosphere.uRimColour.value.set(body === 'EARTH' ? '#438de6' : '#ba7755');
 atmosphere.uStrength.value = body === 'EARTH' ? 0.6 : body === 'MOON' ? 0 : 0.25;
 renderDirection(uniforms.uSunDirection.value, sunDirection ?? initialSun).normalize();
 useFrame(() => {
  renderDirection(uniforms.uSunDirection.value, sunDirection ?? initialSun).normalize();
 }, -1);
 const shell = 1 + (body === 'EARTH' ? 100 : 30) / CONSTANTS[body].radius.v;
 return <group ref={ref} name={`planet-${body.toLowerCase()}`} scale={radiusKm} rotation-y={rotationRad}>
  <mesh>
   <sphereGeometry args={[1, quality.gridDensity * 8, quality.gridDensity * 4]}/>
   <shaderMaterial uniforms={uniforms} vertexShader={PLANET_VERTEX_SHADER} fragmentShader={PLANET_FRAGMENT_SHADER}/>
  </mesh>
  <mesh scale={shell} raycast={() => null}>
   <sphereGeometry args={[1, quality.gridDensity * 6, quality.gridDensity * 3]}/>
   <shaderMaterial
    uniforms={atmosphere}
    vertexShader={PLANET_VERTEX_SHADER}
    fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
    side={BackSide}
    transparent
    depthWrite={false}
   />
  </mesh>
 </group>;
});
