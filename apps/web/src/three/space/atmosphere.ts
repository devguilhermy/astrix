/** Original ASTRIX illustrative Fresnel limb, not a weather/scattering simulation. */
export const PLANET_VERTEX_SHADER = /* glsl */ `
 varying vec3 vLocalNormal;
 varying vec3 vWorldNormal;
 varying vec3 vViewPosition;
 // Shared by planet and atmosphere; logarithmic depth requires this helper chunk.
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main() {
  vLocalNormal = normal;
  vWorldNormal = mat3(modelMatrix) * normal;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
 }
`;

export const PLANET_FRAGMENT_SHADER = /* glsl */ `
 varying vec3 vLocalNormal;
 varying vec3 vWorldNormal;
 uniform sampler2D uSurface;
 uniform bool uHasSurface;
 uniform bool uPackedNight;
 uniform vec3 uFallback;
 uniform vec3 uSunDirection;
 #include <logdepthbuf_pars_fragment>
 void main() {
  #include <logdepthbuf_fragment>
  vec3 localNormal = normalize(vLocalNormal);
  float longitude = atan(-localNormal.z, localNormal.x);
  float latitude = asin(clamp(localNormal.y, -1.0, 1.0));
  vec2 surfaceUv = vec2(0.5 + longitude / 6.28318530718, 0.5 + latitude / 3.14159265359);
  vec4 surface = uHasSurface ? texture2D(uSurface, surfaceUv) : vec4(uFallback, 0.0);
  float solarCosine = dot(normalize(vWorldNormal), normalize(uSunDirection));
  float day = max(0.0, solarCosine);
  float night = 1.0 - smoothstep(-0.08, 0.05, solarCosine);
  // Packed alpha is the historical Black Marble grayscale observation, not opacity.
  // Its warm display tint is illustrative; no city illumination is invented.
  float lights = uPackedNight ? pow(surface.a, 2.2) : 0.0;
  // A dim, cool fill keeps night-side terrain legible (launch pads, markers); it is display lighting, not data.
  vec3 colour = surface.rgb * day + surface.rgb * vec3(0.55, 0.72, 1.0) * 0.055
              + vec3(1.0, 0.66, 0.30) * lights * night * 1.5;
  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

export const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
 varying vec3 vWorldNormal;
 varying vec3 vViewPosition;
 uniform vec3 uSunDirection;
 uniform vec3 uRimColour;
 uniform float uStrength;
 #include <logdepthbuf_pars_fragment>
 void main() {
  #include <logdepthbuf_fragment>
  vec3 normal = normalize(vWorldNormal);
  vec3 viewNormal = normalize(mat3(viewMatrix) * normal);
  float fresnel = pow(1.0 - abs(dot(viewNormal, normalize(vViewPosition))), 3.0);
  float lit = smoothstep(-0.18, 0.45, dot(normal, normalize(uSunDirection)));
  float alpha = fresnel * lit * uStrength;
  gl_FragColor = vec4(uRimColour, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
