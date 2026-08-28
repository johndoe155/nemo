/* ============================================================================
   loop/shaders — every GLSL program of the "One Loop" cinema in one module.

   Written WebGL1-style (three.js ShaderMaterial conventions: built-in
   attributes `position`/`uv`/`normal`, `varying`, `gl_FragColor`) so three
   can feed them to a WebGL2 context without a rewrite.

   Palette discipline (see DESIGN notes in Loop.tsx):
     · cyan    — active pathways / rest energy      (uCyan)
     · magenta — interactive hover states           (uMagenta)
     · silver  — structural, non-interactive light
   Everything is authored in LINEAR space: three converts the final buffer to
   sRGB (renderer.outputColorSpace), so the "void" constants below read as
   near-black on screen rather than grey.
   ========================================================================== */

/* ------------------------------- shared noise ------------------------------ */

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/* ============================ CORE — liquid crystal ======================== */

export const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uPulse;
uniform float uHover;

varying vec3 vWorld;
varying vec3 vNrm;
varying float vNoise;

${NOISE}

float surface(vec3 p) {
  return fbm3(p * 0.9 + vec3(0.0, uTime * 0.11, uTime * 0.06));
}

void main() {
  float amp = 0.085 + 0.055 * uPulse + 0.05 * uHover;
  vec3 p = position;
  float d = surface(p);
  vNoise = d;

  vec3 displaced = p + normal * d * amp;

  /* rebuild the normal from two tangent-offset samples so the displaced
     surface still shades like a real refractive body */
  vec3 t1 = normalize(cross(normal, vec3(0.0, 1.0, 0.13)));
  vec3 t2 = normalize(cross(normal, t1));
  float e = 0.09;
  vec3 pa = p + t1 * e;
  vec3 pb = p + t2 * e;
  vec3 da = pa + normalize(pa) * surface(pa) * amp;
  vec3 db = pb + normalize(pb) * surface(pb) * amp;
  vec3 n = normalize(cross(da - displaced, db - displaced));
  if (dot(n, normal) < 0.0) n = -n;

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorld = world.xyz;
  vNrm = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CORE_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uPulse;
uniform float uBlur;      /* 0 = sharp, 1 = fully defocused (camera push-in) */
uniform float uHover;
uniform vec3  uCursor;    /* world-space position of the cursor point light  */
uniform float uCursorI;   /* 0..1 intensity                                  */
uniform vec3  uCyan;
uniform vec3  uMagenta;

varying vec3 vWorld;
varying vec3 vNrm;
varying float vNoise;

${NOISE}

/* Procedural environment the crystal refracts: a void, one cool key light
   overhead, and a magenta interactive bounce that only exists on hover. */
vec3 envColor(vec3 d) {
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.0016, 0.0018, 0.0032), vec3(0.008, 0.011, 0.019), h);

  float key = pow(max(0.0, dot(d, normalize(vec3(-0.35, 0.9, 0.42)))), 8.0);
  c += vec3(0.10, 0.30, 0.42) * key * 1.15;

  float bounce = pow(max(0.0, dot(d, normalize(vec3(0.78, -0.36, 0.5)))), 12.0);
  c += uMagenta * bounce * (0.10 + 0.85 * uHover);

  float band = pow(max(0.0, 1.0 - abs(d.y) * 2.7), 10.0);
  c += vec3(0.16, 0.21, 0.30) * band * 0.5;

  float sparkle = snoise(d * 6.5 + vec3(0.0, uTime * 0.05, uTime * 0.03));
  c += vec3(0.35, 0.5, 0.7) * smoothstep(0.88, 1.0, sparkle) * 0.22;
  return c;
}

/* Cheaper environment for the defocused state: the sparkle octave is lost in
   the blur anyway, and defocus is the one moment the core fills the frame. */
vec3 envFast(vec3 d) {
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.0016, 0.0018, 0.0032), vec3(0.008, 0.011, 0.019), h);
  float key = pow(max(0.0, dot(d, normalize(vec3(-0.35, 0.9, 0.42)))), 8.0);
  c += vec3(0.10, 0.30, 0.42) * key * 1.15;
  float bounce = pow(max(0.0, dot(d, normalize(vec3(0.78, -0.36, 0.5)))), 12.0);
  c += uMagenta * bounce * (0.10 + 0.85 * uHover);
  float band = pow(max(0.0, 1.0 - abs(d.y) * 2.7), 10.0);
  c += vec3(0.16, 0.21, 0.30) * band * 0.5;
  return c;
}

/* Multi-jittered environment lookup — this is the depth-of-field. Sharp costs
   three samples (one per channel for dispersion); defocused costs four cheap
   ones and drops the dispersion, which the blur would hide regardless. */
vec3 sampleEnv(vec3 dir, float blur) {
  if (blur < 0.004) return envColor(dir);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec3 j = vec3(
      hash12(gl_FragCoord.xy + fi * 17.31 + uTime),
      hash12(gl_FragCoord.yx + fi * 31.77 - uTime),
      hash12(gl_FragCoord.xy * 1.37 + fi * 11.13)
    ) - 0.5;
    acc += envFast(normalize(dir + j * 2.0 * blur * 0.9));
  }
  return acc * 0.25;
}

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.4);

  /* dispersive refraction — three etas, one channel each */
  vec3 Rr = refract(-V, N, 0.700);
  vec3 Rg = refract(-V, N, 0.725);
  vec3 Rb = refract(-V, N, 0.750);
  if (dot(Rg, Rg) < 0.00001) { Rr = Rg = Rb = reflect(-V, N); }

  vec3 refr;
  if (uBlur > 0.004) {
    refr = sampleEnv(Rg, uBlur);
  } else {
    refr = vec3(envColor(Rr).r, envColor(Rg).g, envColor(Rb).b);
  }
  vec3 refl = sampleEnv(reflect(-V, N), uBlur * 0.55);

  float F = 0.045 + 0.955 * fres;
  vec3 col = mix(refr * 1.35, refl, F);

  /* internal volumetric light — veins of energy suspended in the body */
  float veins = smoothstep(0.05, 0.62, vNoise * 0.5 + 0.5 + 0.22 * sin(uTime * 0.55 + vNoise * 4.0));
  vec3 energy = mix(uCyan, uMagenta, uHover);
  col += energy * veins * (0.16 + 0.46 * uPulse) * (0.35 + 0.65 * (1.0 - ndv));

  /* sheer rim */
  col += vec3(0.42, 0.60, 0.80) * fres * (0.30 + 0.5 * uPulse + 0.45 * uHover);

  /* cursor point light */
  vec3 Lv = uCursor - vWorld;
  float dist = length(Lv);
  vec3 Ld = Lv / max(dist, 0.0001);
  float atten = 1.0 / (1.0 + dist * dist * 0.22);
  float diff = max(dot(N, Ld), 0.0);
  col += vec3(0.42, 0.58, 0.85) * (diff * 0.75 + 0.25) * atten * uCursorI * 1.5;
  vec3 H = normalize(Ld + V);
  col += vec3(0.85, 0.93, 1.0) * pow(max(dot(N, H), 0.0), 120.0) * uCursorI * 1.6;

  float alpha = clamp(0.70 + fres * 0.30 + veins * 0.22, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

/* ============================== AURA — shells ============================== */
/* Additive billboards that read as the core's pulse. Two shells at different
   scales/falloffs give the bloom a physical body instead of a flat ring.    */

export const AURA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const AURA_FRAG = /* glsl */ `
precision mediump float;
uniform vec3  uColor;
uniform float uIntensity;
uniform float uPower;
varying vec2 vUv;

void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  float g = pow(max(0.0, 1.0 - d), uPower);
  float core = pow(max(0.0, 1.0 - d * 1.9), 6.0);
  float a = (g * 0.7 + core * 0.9) * uIntensity;
  if (a < 0.001) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/* ============================ NODE — orbital node ========================== */
/* Flat-shaded (non-indexed geometry) crystal: dark faceted body, cyan rest
   state, magenta the moment it is hovered. Cursor light adds a local sheen.  */

export const NODE_VERT = /* glsl */ `
uniform float uHover;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec3 vLocal;

void main() {
  vec3 p = position * (1.0 + uHover * 0.16);
  vLocal = p;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const NODE_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uHover;    /* 0..1 magnetic/hover ramp                    */
uniform float uDim;      /* 1 = idle, <1 when a sibling node is focused */
uniform float uCursorI;
uniform vec3  uCursor;
uniform vec3  uCyan;
uniform vec3  uMagenta;

varying vec3 vWorld;
varying vec3 vNrm;
varying vec3 vLocal;

${NOISE}

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.6);

  /* faceted body — dark glass with a cold internal shimmer */
  float grain = fbm3(vLocal * 6.0 + vec3(0.0, uTime * 0.2, 0.0));
  vec3 body = mix(vec3(0.006, 0.007, 0.012), vec3(0.020, 0.024, 0.038), grain * 0.5 + 0.5);

  vec3 accent = mix(uCyan, uMagenta, uHover);
  body += accent * fres * (0.55 + 0.85 * uHover) * uDim;
  body += accent * 0.10 * uDim;

  /* cursor point light */
  vec3 Lv = uCursor - vWorld;
  float dist = length(Lv);
  vec3 Ld = Lv / max(dist, 0.0001);
  float atten = 1.0 / (1.0 + dist * dist * 0.5);
  body += vec3(0.5, 0.62, 0.85) * max(dot(N, Ld), 0.0) * atten * uCursorI * 1.4;
  vec3 H = normalize(Ld + V);
  body += vec3(1.0) * pow(max(dot(N, H), 0.0), 80.0) * uCursorI * 0.9;

  gl_FragColor = vec4(body, 1.0);
}
`;

/* ============================ SPLINE — one loop =========================== */
/* Tube geometry along a CatmullRom path. Alpha is rim-weighted so the tube
   reads as a glowing filament rather than a plastic pipe, and a travelling
   wave proves the loop is live. Cyan = active pathway.                      */

export const SPLINE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNrm;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const SPLINE_FRAG = /* glsl */ `
precision mediump float;

uniform float uTime;
uniform float uActive;   /* 0 = dormant, 1 = this pathway is live */
uniform float uDim;
uniform vec3  uCyan;
uniform vec3  uMagenta;

varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNrm;

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(N, V)), 1.7);

  float flowA = 0.5 + 0.5 * sin(vUv.x * 46.0 - uTime * 2.6);
  float flowB = 0.5 + 0.5 * sin(vUv.x * 13.0 + uTime * 1.1);
  float flow = mix(flowA * 0.65, flowB, 0.55);

  vec3 col = mix(uCyan, uMagenta, uActive * 0.55);
  float a = (0.045 + 0.20 * flow + 0.42 * uActive) * (0.35 + 0.65 * rim) * uDim;
  if (a < 0.002) discard;
  gl_FragColor = vec4(col * a * 1.6, a);
}
`;

/* ========================== TRAILS — light particles ====================== */

export const TRAIL_VERT = /* glsl */ `
attribute float aSeed;
attribute float aActive;
uniform float uPx;        /* (bufferHeight / 2) / tan(fov/2) — px per world unit at d=1 */
uniform float uTime;
varying float vSeed;
varying float vActive;
void main() {
  vSeed = aSeed;
  vActive = aActive;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(0.6, -mv.z);
  float tw = 0.7 + 0.3 * sin(uTime * 3.0 + aSeed * 60.0);
  float world = 0.075 + 0.045 * aSeed + 0.07 * aActive;
  gl_PointSize = world * uPx / depth * tw;
  gl_Position = projectionMatrix * mv;
}
`;

export const TRAIL_FRAG = /* glsl */ `
precision mediump float;
uniform vec3  uCyan;
uniform vec3  uMagenta;
uniform float uOpacity;
varying float vSeed;
varying float vActive;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float halo = 1.0 - smoothstep(0.05, 0.5, d);
  float core = 1.0 - smoothstep(0.0, 0.16, d);
  float a = (pow(halo, 2.4) * 0.55 + core) * uOpacity * (0.45 + 0.55 * vActive);
  if (a < 0.004) discard;
  vec3 col = mix(uCyan, uMagenta, vActive * 0.7) * (1.0 + vActive * 0.9);
  col += vec3(1.0) * core * 0.55;
  gl_FragColor = vec4(col * a, a);
}
`;

/* ============================ DUST — spatial haze ========================= */

export const DUST_VERT = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uPx;
uniform vec3  uCursor;
uniform float uCursorI;
varying float vSeed;
varying float vLit;
void main() {
  vSeed = aSeed;
  vec4 world = modelMatrix * vec4(position, 1.0);
  float d = length(uCursor - world.xyz);
  vLit = uCursorI / (1.0 + d * d * 0.35);
  vec4 mv = viewMatrix * world;
  float depth = max(0.6, -mv.z);
  float tw = 0.4 + 0.6 * sin(uTime * (0.4 + aSeed) + aSeed * 80.0);
  gl_PointSize = aSize * uPx / depth * tw;
  gl_Position = projectionMatrix * mv;
}
`;

export const DUST_FRAG = /* glsl */ `
precision mediump float;
varying float vSeed;
varying float vLit;
uniform float uOpacity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = 1.0 - smoothstep(0.06, 0.5, d);
  if (a < 0.01) discard;
  vec3 silver = vec3(0.62, 0.68, 0.80);
  vec3 col = mix(silver * 0.5, silver * 1.6, vLit);
  a *= uOpacity * (0.18 + 0.55 * vLit + 0.22 * vSeed);
  gl_FragColor = vec4(col * a, a);
}
`;

/* ======================= LIGHTPLANE — cursor glow ========================= */
/* A large additive plane behind the scene. It is the "localized point light"
   the custom cursor casts onto the void — without it the canvas stays dead
   black between objects.                                                    */

export const LIGHTPLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LIGHTPLANE_FRAG = /* glsl */ `
precision mediump float;
uniform float uTime;
uniform vec2  uPoint;      /* 0..1 in plane space */
uniform float uIntensity;
uniform float uAspect;
uniform vec3  uColor;
varying vec2 vUv;

${NOISE}

void main() {
  vec2 p = (vUv - uPoint) * vec2(uAspect, 1.0);
  float d = length(p);
  float n = fbm3(vec3(vUv * 3.0, uTime * 0.06)) * 0.5 + 0.5;
  float glow = exp(-d * d * (5.0 + n * 3.0));
  float halo = exp(-d * 2.2) * 0.35;
  float a = (glow * 0.9 + halo) * uIntensity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/* ====================== FLUID HEADLINE — kinetic type ===================== */
/* "NOTHING WASTED" is rasterised to a canvas texture, then advected by a ring
   of decaying mouse-velocity impulses. Each impulse contributes a push along
   its velocity vector plus a vortex swirl, both falling off radially — so the
   type warps into the cursor's wake and settles back to crisp as it decays. */

export const FLUID_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FLUID_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTex;
uniform vec2  uRes;        /* canvas resolution in CSS px */
uniform float uTime;
uniform float uSpeed;      /* smoothed |mouse velocity|, 0..1 */
uniform float uAspect;
uniform vec4  uImp[8];     /* xy = position (uv), zw = velocity vector */
uniform float uImpA[8];    /* decaying amplitude per impulse */
uniform vec3  uCyan;
uniform vec3  uMagenta;
uniform float uReveal;     /* 0..1 scroll-in */

${NOISE}

void main() {
  vec2 uv = vUv;
  float aspect = uAspect;

  /* idle breathing — a slow standing wave so the type is never dead */
  float n1 = fbm3(vec3(uv * 2.2, uTime * 0.045));
  float n2 = fbm3(vec3(uv * 2.2 + 5.3, uTime * 0.04));
  vec2 drift = (vec2(n1, n2) - 0.5) * 0.0045;

  vec2 warp = drift;
  for (int i = 0; i < 8; i++) {
    vec4 imp = uImp[i];
    float amp = uImpA[i];
    float live = step(0.0015, amp);
    vec2 d = (uv - imp.xy) * vec2(aspect, 1.0);
    float r2 = dot(d, d);
    float fall = exp(-r2 * 16.0) * live;
    vec2 perp = vec2(-d.y, d.x);
    warp += amp * fall * (perp * 1.15 + imp.zw * 0.55) * 0.09;
  }

  float mag = length(warp);
  float ca = clamp(mag * 1.6 + uSpeed * 0.0025, 0.0, 0.02);
  vec2 dir = mag > 0.00001 ? normalize(warp) : vec2(1.0, 0.0);

  vec2 uvR = uv + warp + dir * ca;
  vec2 uvG = uv + warp;
  vec2 uvB = uv + warp - dir * ca;

  float ar = texture2D(uTex, uvR).a;
  float ag = texture2D(uTex, uvG).a;
  float ab = texture2D(uTex, uvB).a;

  /* ink: cool platinum with a faint vertical lift */
  float lift = smoothstep(0.0, 1.0, 1.0 - uv.y);
  vec3 ink = mix(vec3(0.62, 0.63, 0.72), vec3(0.95, 0.96, 1.0), lift);
  ink = mix(ink, vec3(1.0), 0.25);

  vec3 col = vec3(ar, ag, ab) * ink;

  /* energy fringe — cyan at rest, magenta when the cursor is driving */
  float fringe = abs(ar - ab) + abs(ag - ab);
  col += mix(uCyan, uMagenta, clamp(uSpeed * 1.6, 0.0, 1.0)) * fringe * 0.85;

  /* bloom: a handful of taps on the alpha mask, tinted by motion */
  float b = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ang = fi * 1.0472 + uTime * 0.4;
    vec2 o = vec2(cos(ang), sin(ang)) * (0.004 + 0.006 * uSpeed);
    b += texture2D(uTex, uvG + o).a;
    b += texture2D(uTex, uvG + o * 2.2).a * 0.5;
  }
  b /= 9.0;
  float bloomMask = clamp(b - max(ag, 0.0), 0.0, 1.0);
  vec3 bloomCol = mix(uCyan * 0.55, uMagenta * 0.85, clamp(uSpeed * 1.4, 0.0, 1.0));
  col += bloomCol * bloomMask * (0.55 + 0.9 * uSpeed);

  float alpha = max(max(ar, ag), ab) + bloomMask * (0.18 + 0.35 * uSpeed);
  alpha *= uReveal;

  /* vertical wipe so the reveal reads as the type materialising */
  float wipe = smoothstep(0.0, 0.35, uReveal * 1.4 - uv.y * 0.35);
  alpha *= wipe;

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col * uReveal, alpha);
}
`;
