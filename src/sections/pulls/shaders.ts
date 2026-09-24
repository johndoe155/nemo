/* ============================================================================
   shaders — every GLSL program of the pulls canvas in one module.

   Written as WebGL1-style GLSL (three.js ShaderMaterial conventions: built-in
   attributes `position`/`uv`, `varying`, `gl_FragColor`). Three.js adapts
   these to WebGL2 automatically. Keeping them here lets the build-time QA
   validator compile them against ES 3.00 semantics.
   ========================================================================== */

/* ------------------------------ particle field ------------------------------ */

export const FIELD_VERT = /* glsl */ `
precision mediump float;
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPx;
uniform float uPointScale;
varying float vSeed;
varying float vFade;
void main() {
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = -mv.z;
  vFade = smoothstep(60.0, 300.0, position.z);
  gl_Position = projectionMatrix * mv;
  float tw = 0.7 + 0.3 * sin(uTime * 1.4 + aSeed * 40.0);
  gl_PointSize = aSize * uPx * (uPointScale / max(1.0, depth)) * tw;
}
`;

export const FIELD_FRAG = /* glsl */ `
precision mediump float;
uniform float uTime;
varying float vSeed;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = 1.0 - smoothstep(0.08, 0.5, d);
  if (a < 0.01) discard;

  vec3 silver = vec3(0.878, 0.894, 0.925);
  vec3 cyan   = vec3(0.247, 0.91, 1.0);
  vec3 iris   = vec3(0.541, 0.302, 1.0);

  vec3 col;
  if (vSeed < 0.14) col = cyan;
  else if (vSeed < 0.28) col = iris;
  else col = silver;

  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + vSeed * 1.6) + vSeed * 90.0);
  gl_FragColor = vec4(col * tw * a * vFade, a * vFade * 0.8);
}
`;

/* ------------------------------ liquid CTA ------------------------------ */

/* ---------------------------------------------------------------------------
   The CTA (liquid-glass slab) and GAUGE (per-node liquid fill) shaders were
   retired with their components in the stamp-book recomposition
   (IDENTITY-SPEC §2.2 beat 3 / §8): the press is a CSS stamp pad and the odds
   are printed bars, so the only shader left in this file is the reef particle
   field's.
--------------------------------------------------------------------------- */
