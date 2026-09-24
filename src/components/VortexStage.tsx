import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { BlackHoleStageStatus } from '../lib/singularityGate';

/* ============================================================================
   VortexStage — the trench finale renderer (IDENTITY-SPEC §2.1 Z3, §8)

   Replaces the retired WebGPU raymarcher (src/three/blackhole/, vendored
   verbatim, 186 kB gz of three/webgpu). The scroll MECHANIC above it — the
   `.bh-hold` reservation and the sign-off consumption in
   components/SignoffHorizon.tsx + lib/spaghettification.ts — is untouched and
   metaphor-agnostic; only the picture changed, from gravitational lensing to
   water: a differential-rotation vortex domain-warped through fbm streaks,
   marine snow rising against the pull, and bioluminescent points on the
   spiral arms.

   Deliberately dependency-free: one WebGL2 context on a full-cover triangle,
   the same technique eventHorizonWarp.ts already uses. No three build of any
   flavour survives in the bundle because of this section.

   Contracts kept from the stage it replaces:
     · onStatusChange('live' | 'unsupported' | 'error') — the gate's
       canWarpSignoff reads 'live'; anything else costs the reader the frozen
       sign-off overlay, never the hold.
     · IntersectionObserver pause off-screen (18% margin, first frame warm).
     · prefers-reduced-motion: NO loop — one static frame, redrawn on resize.
     · cameraHoldRef: while the sign-off hold locks the screen the water goes
       STILL (time freezes; consumption keeps feeding the mouth) — the same
       "rigidly static while the invitation falls" contract the cinematic
       camera hold used to give the raymarcher.
     · consumptionRef: 0→1 across the consumption; drives swirl speed, inflow
       and the mouth's dark radius.
     · teardown cancels the loop and loses the context (StrictMode-safe).
============================================================================ */

const VERT = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uConsume;   // 0..1 sign-off consumption playhead
uniform float uStill;     // 1 while the hold locks the screen
uniform vec3  uDeep;      // trench ground
uniform vec3  uBio;       // bioluminescent cyan
uniform vec3  uMint;      // bioluminescent mint

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1, 0)), u.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
    u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUV;
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 q = (uv - 0.5) * aspect;

  // The mouth sits a touch below centre — the page falls INTO it.
  q.y += 0.06;
  float r = length(q);
  float a = atan(q.y, q.x);

  float consume = clamp(uConsume, 0.0, 1.0);
  float t = uTime * (1.0 - uStill);           // the hold stills the water
  float spin = 0.16 + 0.5 * consume;          // the meal speeds the swirl

  // Differential rotation: inner water orbits faster (Keplerian, but wet).
  float rot = a + t * spin / (0.18 + r * 1.35) + consume * 0.9 / (0.3 + r);
  // Inflow: streaks spiral inward; the mouth drinks harder mid-consumption.
  float inflow = r + t * (0.035 + 0.09 * consume);

  vec2 pol = vec2(rot, inflow * 3.2);
  float streaks = fbm(pol * vec2(2.6, 1.4));
  float sheets  = fbm(pol * vec2(1.1, 0.7) + 4.7);

  // Water body: deep teal modulated by the warped sheets.
  vec3 col = uDeep * (0.55 + 0.85 * sheets);
  col += uDeep * 1.6 * pow(streaks, 2.2);

  // Spiral arms catch bioluminescence where the streaks crest.
  float arm = smoothstep(0.62, 0.95, streaks) * smoothstep(1.15, 0.25, r);
  col += uBio * arm * (0.16 + 0.5 * consume);
  col += uMint * smoothstep(0.78, 1.0, sheets) * 0.10 * arm;

  // Bioluminescent points: hashed sparkles pinned to the rotating field.
  vec2 cell = floor(pol * vec2(9.0, 5.0));
  float sp = hash(cell);
  float tw = 0.5 + 0.5 * sin(t * 2.1 + sp * 41.0);
  float dot_ = smoothstep(0.985, 1.0, sp) * tw * smoothstep(1.2, 0.2, r);
  col += mix(uBio, uMint, step(0.5, fract(sp * 13.0))) * dot_ * 0.9;

  // Marine snow: fine grains drifting UP against the pull.
  vec2 snowUV = vec2(rot * 0.35, r * 2.0 + t * 0.12);
  float snow = smoothstep(0.92, 1.0, hash(floor(snowUV * vec2(34.0, 22.0))));
  col += vec3(0.72, 0.86, 0.9) * snow * 0.10 * smoothstep(1.3, 0.3, r);

  // The mouth: a dark lens that opens with the consumption.
  float mouth = smoothstep(0.30 + 0.22 * consume, 0.05, r);
  col = mix(col, uDeep * 0.16, mouth);
  // Rim light where water lips over the edge of the mouth.
  float rim = smoothstep(0.10, 0.0, abs(r - (0.30 + 0.22 * consume))) ;
  col += uBio * rim * (0.25 + 0.65 * consume) * (1.0 - uStill * 0.35);

  // Vignette to the trench ground at the frame edges (seam-friendly).
  float vig = smoothstep(1.45, 0.35, length((uv - 0.5) * vec2(aspect.x, 1.6)));
  col = mix(uDeep * 0.35, col, vig);

  // Ordered dither — dark gradients band without it.
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  outColor = vec4(col, 1.0);
}`;

interface VortexStageProps {
  onStatusChange: (status: BlackHoleStageStatus) => void;
  cameraHoldRef: MutableRefObject<boolean>;
  consumptionRef: MutableRefObject<{ active: boolean; progress: number }>;
}

export default function VortexStage({
  onStatusChange,
  cameraHoldRef,
  consumptionRef,
}: VortexStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'bh-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      onStatusChange('unsupported');
      return () => canvas.remove();
    }

    const compile = (type: number, src: string) => {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        throw new Error(gl!.getShaderInfoLog(sh) ?? 'shader compile failed');
      }
      return sh;
    };

    let program: WebGLProgram | null = null;
    let raf = 0;
    let disposed = false;
    let inView = true;
    let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const U: Record<string, WebGLUniformLocation | null> = {};
    const uni = (name: string) => (U[name] ??= gl!.getUniformLocation(program!, name));

    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
      }
      gl.useProgram(program);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao); // full-cover triangle: no buffers at all
    } catch (err) {
      console.error('[trench] vortex shader failed:', err);
      onStatusChange('error');
      return () => {
        canvas.remove();
      };
    }

    /* Trench palette — mirrors --deep / --bio-cyan / --mint in the token
       layer (IDENTITY-SPEC §3.3: the shader palette table lands in Phase 2
       and replaces these literals). */
    const DEEP: [number, number, number] = [0.024, 0.125, 0.184];
    const BIO: [number, number, number] = [0.373, 0.89, 1.0];
    const MINT: [number, number, number] = [0.576, 0.886, 0.643];

    const dprCap = 1.25;
    const resize = () => {
      const box = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = Math.max(2, Math.floor(box.width * dpr));
      const h = Math.max(2, Math.floor(box.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${box.width}px`;
        canvas.style.height = `${box.height}px`;
        gl!.viewport(0, 0, w, h);
      }
    };

    let t0 = performance.now();
    let frozenAt = 0; // accumulated water-time while not still
    let lastNow = t0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const still = cameraHoldRef.current ? 1 : 0;
      if (!still) frozenAt += dt;
      resize();
      const g = gl!;
      g.uniform2f(uni('uRes'), canvas.width, canvas.height);
      g.uniform1f(uni('uTime'), frozenAt);
      g.uniform1f(uni('uConsume'), consumptionRef.current?.progress ?? 0);
      g.uniform1f(uni('uStill'), still);
      g.uniform3fv(uni('uDeep'), DEEP);
      g.uniform3fv(uni('uBio'), BIO);
      g.uniform3fv(uni('uMint'), MINT);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (inView) draw(now);
      raf = requestAnimationFrame(loop);
    };

    resize();
    draw(performance.now());
    onStatusChange('live');

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(performance.now());
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView = e.isIntersecting;
        if (reduced && inView) draw(performance.now());
      },
      { rootMargin: '18% 0px' },
    );
    io.observe(host);

    const onMq = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      if (reduced) draw(performance.now());
    };
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onMq);

    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener('change', onMq);
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
      canvas.remove();
    };
  }, [onStatusChange, cameraHoldRef, consumptionRef]);

  return <div className="bh-stage" ref={hostRef} />;
}
