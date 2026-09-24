/* ============================================================================
   shaders — the GLSL of the reef's particle field.

   GLSL ES 1.00, written for a raw WebGL context (particleGL.ts). It used to be
   consumed as a three.js ShaderMaterial, which is why the vertex stage refers
   to three's built-in `projectionMatrix` / `modelViewMatrix` uniforms: those
   are now supplied explicitly by FIELD_MATRIX_PRELUDE, and the matrix layout is
   documented in particleGL.ts. The point size is clamped to the driver's own
   ceiling (uSizeMax), which three did internally and a raw context must ask for.
   ========================================================================== */

/** The two uniforms three.js used to inject into every ShaderMaterial. */
export const FIELD_MATRIX_PRELUDE = /* glsl */ `
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
`;

/* ------------------------------ particle field ------------------------------ */

export const FIELD_VERT = /* glsl */ `
precision mediump float;
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPx;
uniform float uPointScale;
uniform float uSizeMax;
varying float vSeed;
varying float vFade;
void main() {
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = -mv.z;
  vFade = smoothstep(60.0, 300.0, position.z);
  gl_Position = projectionMatrix * mv;
  float tw = 0.7 + 0.3 * sin(uTime * 1.4 + aSeed * 40.0);
  gl_PointSize = min(aSize * uPx * (uPointScale / max(1.0, depth)) * tw, uSizeMax);
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

  /* Reef field (IDENTITY-SPEC §2.1/§3.2): bubble white, bioluminescent cyan
     and mint — the retired neon-on-void ramp is gone. Values mirror
     src/lib/palette.ts (paper / bio-cyan / mint). */
  vec3 bubble = vec3(0.949, 0.933, 0.886);
  vec3 bio    = vec3(0.373, 0.89, 1.0);
  vec3 mint   = vec3(0.576, 0.886, 0.643);

  vec3 col;
  if (vSeed < 0.14) col = bio;
  else if (vSeed < 0.28) col = mint;
  else col = bubble;

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
