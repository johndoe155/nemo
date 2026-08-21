/* ============================================================================
   shaders — every GLSL program of the pulls canvas in one module.

   Written as WebGL1-style GLSL (three.js ShaderMaterial conventions: built-in
   attributes `position`/`uv`, `varying`, `gl_FragColor`). Three.js adapts
   these to WebGL2 automatically. Keeping them here lets the build-time QA
   validator compile them against ES 3.00 semantics.
   ========================================================================== */

/* ------------------------------ particle field ------------------------------ */

export const FIELD_VERT = /* glsl */ `
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
  vec3 gold   = vec3(1.0, 0.843, 0.0);
  vec3 violet = vec3(0.431, 0.145, 0.992);

  vec3 col;
  if (vSeed < 0.16) col = gold;
  else if (vSeed < 0.34) col = violet;
  else col = silver;

  float tw = 0.65 + 0.35 * sin(uTime * (0.8 + vSeed * 2.0) + vSeed * 90.0);
  gl_FragColor = vec4(col * tw * a * vFade, a * vFade * 0.85);
}
`;

/* ------------------------------ liquid CTA ------------------------------ */

export const CTA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const CTA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2  uRes;
uniform vec2  uMouse;
uniform float uTime;
uniform float uHover;
uniform float uClick;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;

  float r = min(uRes.x, uRes.y) * 0.30;
  float d = sdRoundBox(p - uRes * 0.5, uRes * 0.5 - 1.0, r);
  float mask = 1.0 - smoothstep(-1.5, 1.5, d);
  float edge = 1.0 - smoothstep(0.0, 3.0, abs(d));

  float t = uTime;
  float n = fbm(uv * vec2(3.0 * aspect, 3.0) + vec2(t * 0.22, -t * 0.16));
  float n2 = fbm(uv * vec2(6.0 * aspect, 6.0) - vec2(t * 0.3, t * 0.24));

  /* liquid refraction warp */
  vec2 warp = (vec2(n, n2) - 0.5) * (0.055 + 0.05 * uHover + 0.09 * uClick);
  vec2 wuv = uv + warp;

  /* obsidian → hyper-violet glass body */
  vec3 deep = vec3(0.039, 0.039, 0.055);
  vec3 violet = vec3(0.431, 0.145, 0.992);
  vec3 body = mix(deep, violet * 0.75, smoothstep(0.05, 0.9, wuv.y));
  body += vec3(0.10, 0.06, 0.22) * n;

  /* internal light refraction streak following the cursor */
  float my = mix(0.5, uMouse.y / uRes.y, 0.55);
  float band = exp(-pow((wuv.y - my - 0.12 * sin(wuv.x * 9.0 + t * 1.4)) * 9.0, 2.0));
  float caust = sin(wuv.x * 42.0 * aspect + n2 * 9.0 - t * 3.2) * 0.5 + 0.5;
  body += vec3(0.85, 0.92, 1.0) * band * caust * (0.16 + 0.22 * uHover);

  /* violet under-glow breathing */
  body += violet * (0.05 + 0.05 * sin(t * 1.7 + n * 6.28)) * (0.4 + 0.6 * uHover);

  /* metallic gold rim lighting with a slow phase */
  vec3 gold = vec3(1.0, 0.843, 0.0);
  float rimPhase = 0.62 + 0.38 * sin(t * 2.2 + uv.x * 6.28 * 0.5);
  body += gold * edge * (0.55 * rimPhase + 0.5 * uHover);

  /* click shockwave + chromatic aberration */
  vec2 mc = uMouse / uRes;
  float ring = 1.0 - smoothstep(0.0, 0.055, abs(length(uv - mc) - uClick * 0.42 * aspect * 0.9));
  body += gold * ring * uClick * 0.9;
  body += vec3(0.7, 0.75, 1.0) * (1.0 - smoothstep(0.0, 0.03, abs(length(uv - mc) - uClick * 0.42))) * uClick * 0.5;

  float mag = uClick * (0.016 + 0.02 * n2);
  /* spectral split against the body colour */
  vec3 split = vec3(
    body.r * (1.0 - mag * 1.5),
    body.g,
    body.b * (1.0 + mag * 1.5)
  );

  /* grain */
  float grain = hash(uv * uRes + fract(t)) * 0.05;

  vec3 col = mix(body, split, clamp(uClick * 2.2, 0.0, 1.0)) + grain;
  float a = mask * (0.92 + 0.08 * uHover);
  gl_FragColor = vec4(col, a);
}
`;

/* ------------------------------ liquid gauge ------------------------------ */

export const GAUGE_VERT = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const GAUGE_FRAG = /* glsl */ `
precision mediump float;
uniform vec2  uRes;
uniform float uTime;
uniform float uFill;
uniform vec3  uColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = vec3(0.0);

  /* glass housing */
  float edge = smoothstep(0.0, 0.02, uv.y) * (1.0 - smoothstep(0.98, 1.0, uv.y));
  col += vec3(0.12, 0.13, 0.18) * edge * 0.5;

  /* liquid body */
  float surf = uFill;
  surf += 0.035 * sin(uv.x * 18.0 + uTime * 2.6);
  surf += 0.03 * sin(uv.x * 37.0 - uTime * 3.4 + 1.7);
  surf += 0.02 * (noise(vec2(uv.x * 14.0, uTime * 0.9)) - 0.5);
  surf = clamp(surf, 0.02, 0.97);

  float liquid = 1.0 - smoothstep(surf - 0.012, surf + 0.012, uv.y);
  if (liquid > 0.0) {
    vec3 deep = uColor * 0.35;
    vec3 bright = uColor * 1.15 + vec3(0.25);
    col = mix(deep, bright, pow(1.0 - uv.y / max(surf, 0.001), 1.4) * 0.8);
    float caust = sin(uv.x * 24.0 - uTime * 2.2 + noise(vec2(uv.x * 6.0, uTime * 0.5)) * 5.0)
                * sin(uv.y * 26.0 - uTime * 1.8) * 0.5 + 0.5;
    col += uColor * caust * 0.22 * (1.0 - smoothstep(surf - 0.25, surf, uv.y));
    col += vec3(1.0) * (1.0 - smoothstep(surf, surf + 0.02, uv.y)) * 0.35;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 seed = vec2(fi * 13.7, fi * 7.3);
      vec2 bp = vec2(hash(seed), fract(hash(seed + 3.1) + uTime * (0.05 + fi * 0.02)));
      float r = 0.012 + hash(seed + 9.0) * 0.014;
      float d = length(uv - bp);
      if (bp.y < surf && d < r) {
        col += vec3(0.8, 0.9, 1.0) * (1.0 - d / r) * 0.55;
      }
    }
  }

  /* rim glow in rarity colour */
  float rim = (1.0 - smoothstep(0.0, 0.06, uv.y)) + smoothstep(0.94, 1.0, uv.y);
  col += uColor * rim * 0.35;

  /* fill marker ticks */
  float tick = step(0.965, fract(uv.x * 10.0));
  col += mix(vec3(0.0), vec3(0.5), tick) * 0.18;

  gl_FragColor = vec4(col, 1.0);
}
`;
