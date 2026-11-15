// Pattern: Void Protocol (© Guilhermy), starfieldShader.ts (304 LOC) @ 218625d.
// Owner-authorized reuse under ASTRIX Apache-2.0; see CREDITS.md.
// Only fixed angular star layers and a far-depth vacuum sphere are retained as patterns.
// All GLSL below is independently implemented. No Dave Hoskins hash, atmosphere,
// liquid, cloud, weather, telemetry or time-dependent twinkling code is copied.
export const SKY_VERTEX_SHADER = /* glsl */ `
 varying vec3 vDirection;
 // logdepthbuf_vertex calls common's isPerspectiveMatrix in Three r182+.
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main() {
  vDirection = mat3(modelMatrix) * position;
  // Ignore camera translation: one camera-centred sphere, fixed to MJ2000Eq.
  vec4 mvPosition = vec4(mat3(viewMatrix) * vDirection, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  gl_Position.z = gl_Position.w;
 }
`;

export const STARFIELD_FRAGMENT_SHADER = /* glsl */ `
 varying vec3 vDirection;
 uniform sampler2D uSky;
 uniform bool uHasSky;
 uniform float uDensity;
 #include <logdepthbuf_pars_fragment>

 // Independent integer cell mixer. Integer wraparound and LCG arithmetic avoid
 // large-argument sine precision loss without borrowing a third-party hash.
 float cellValue(ivec3 cell, uint salt) {
  uvec3 p = uvec3(cell + ivec3(1024));
  uint n = p.x * 173u + p.y * 241u + p.z * 337u + salt;
  n = n * 1664525u + 1013904223u;
  n ^= n >> 11u;
  n = n * 1664525u + 1013904223u;
  n ^= n >> 17u;
  return float(n & 0x00ffffffu) / 16777216.0;
 }
 vec3 angularLayer(vec3 direction, float cells, float probability, float pixelAngle) {
  ivec3 cell = ivec3(floor(direction * cells));
  float choice = cellValue(cell, 19u);
  if (choice > probability) return vec3(0.0);
  vec3 jitter = vec3(cellValue(cell, 71u), cellValue(cell, 137u), cellValue(cell, 283u));
  vec3 centre = normalize((vec3(cell) + 0.25 + 0.5 * jitter) / cells);
  float distancePx = length(cross(direction, centre)) / pixelAngle;
  float radius = mix(0.45, 1.15, cellValue(cell, 419u));
  float disc = 1.0 - smoothstep(max(0.0, radius - 0.5), radius + 0.5, distancePx);
  float warmth = cellValue(cell, 557u);
  vec3 tint = mix(vec3(0.68, 0.79, 1.0), vec3(1.0, 0.82, 0.62), warmth);
  return tint * disc * mix(0.45, 1.1, choice / probability);
 }
 void main() {
  vec3 direction = normalize(vDirection);
  vec3 colour;
  if (uHasSky) {
   // NASA SVS 4851: RA 0 at the centre, increasing left; north is at the top.
   // Core [x,y,z] -> render [x,z,-y] is a rotation, not a reflected UV hack.
   float ra = atan(-direction.z, direction.x);
   float dec = asin(clamp(direction.y, -1.0, 1.0));
   vec2 celestialUv = vec2(0.5 - ra / 6.28318530718, 0.5 + dec / 3.14159265359);
   colour = texture2D(uSky, celestialUv).rgb;
  } else {
   float pixelAngle = max(length(fwidth(direction)), 0.000001);
   colour = angularLayer(direction, 110.0 * uDensity, 0.08, pixelAngle)
          + angularLayer(direction, 230.0 * uDensity, 0.035, pixelAngle) * 0.45;
  }
  gl_FragColor = vec4(colour, 1.0);
  #include <logdepthbuf_fragment>
  // The log-depth fragment chunk must not bring the background in front of bodies.
  gl_FragDepth = 1.0;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
