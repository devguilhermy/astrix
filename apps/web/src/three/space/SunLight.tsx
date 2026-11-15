import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Vector3, type DirectionalLight } from 'three';
import { renderDirection, type KmVector } from './FloatingOrigin';
import { SKY_VERTEX_SHADER } from './starfieldShader';

const SUN_FRAGMENT_SHADER = /* glsl */ `
 varying vec3 vDirection;
 uniform vec3 uSunDirection;
 uniform float uAngularRadius;
 #include <logdepthbuf_pars_fragment>
 void main() {
  vec3 direction = normalize(vDirection);
  float separation = length(cross(direction, normalize(uSunDirection)));
  if (dot(direction, uSunDirection) <= 0.0) discard;
  float edge = max(fwidth(separation), 0.000001);
  float disc = 1.0 - smoothstep(uAngularRadius - edge, uAngularRadius + edge, separation);
  float glare = exp(-separation * separation / (uAngularRadius * uAngularRadius * 8.0)) * 0.09;
  float alpha = disc + glare;
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(vec3(1.0, 0.90, 0.69) * 3.0, alpha);
  #include <logdepthbuf_fragment>
  gl_FragDepth = 0.9999999;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

export interface SunLightProps {
 /** Direction toward the Sun in core MJ2000Eq, not a camera-facing decoration. */
 direction: KmVector;
 /** Core eclipse controls spacecraft light; the planetary shader remains solar-lit. */
 sunlit?: boolean;
 angularRadiusRad?: number;
 /** Heliocentric transfer has a physical Sun at its origin instead. */
 disc?: boolean;
}

/** An angular Sun disc, depth-occluded by opaque bodies, and one directional light.
 * Sun radius 695,700 km: https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
 * Glare is a presentation halo, not an atmosphere or a stellar physics model.
 */
export const SunLight = forwardRef<DirectionalLight, SunLightProps>(function SunLight({
 direction, sunlit = true, angularRadiusRad = 0.0046505, disc = true,
}, ref) {
 const light = useRef<DirectionalLight>(null);
 useImperativeHandle(ref, () => light.current!, []);
 const uniforms = useMemo(() => ({
  uSunDirection: { value: new Vector3() },
  uAngularRadius: { value: angularRadiusRad },
 }), []);
 uniforms.uAngularRadius.value = angularRadiusRad;
 renderDirection(uniforms.uSunDirection.value, direction).normalize();
 useFrame(() => {
  renderDirection(uniforms.uSunDirection.value, direction).normalize();
  light.current?.position.copy(uniforms.uSunDirection.value);
 }, -1);
 return <>
  <directionalLight
   ref={light}
   position={uniforms.uSunDirection.value}
   intensity={sunlit ? 2.4 : 0}
   color="#fff3dc"
  />
  <mesh name="mission-sun-disc" visible={disc} frustumCulled={false} renderOrder={1001} raycast={() => null}>
   <sphereGeometry args={[1, 32, 16]}/>
   <shaderMaterial
    uniforms={uniforms}
    vertexShader={SKY_VERTEX_SHADER}
    fragmentShader={SUN_FRAGMENT_SHADER}
    side={BackSide}
    transparent
    blending={AdditiveBlending}
    depthWrite={false}
   />
  </mesh>
 </>;
});
