import { useEffect, useRef, useState } from 'react';
import { webglSupported } from '../sections/pulls/webgl';
import {
  SCENES,
  DEFAULT_SCENE,
  observeScenes,
  sceneVec,
  SCENE_FLOATS,
} from '../lib/scenes';

/* ---------------------------------------------------------------------------
   Ambience — the living, scene-aware background of the Nemoverse.

   Primary path: ONE fullscreen WebGL quad rendered at half resolution and
   upscaled (the imagery is nebular — nobody can tell). A 3-octave value-noise
   fbm domain-warps three radial colour fields so they read as slowly writhing
   aurora sheets instead of blurred circles. Uniforms:

     · scene palette / anchors / vignette / gold-warmth — lerped on the CPU
       toward the district stamped by observeScenes() (see lib/scenes.ts)
     · uScroll  — smoothed page progress; the whole nebula slides slightly
     · uMouse   — spring-smoothed cursor swell (fine pointers only)
     · uTime    — very slow idle drift so the background breathes at rest

   This single layer REPLACES the old three 70vw blur(70px) DOM blobs and the
   body's fixed-attachment radial washes — the most expensive compositor work
   the page had. The vignette is drawn in-shader; ordered dither kills the
   banding dark gradients otherwise show.

   Performance / robustness:
     · half-res quad, DPR capped at 1.75, 'low-power' context
     · adaptive: sustained slow frames drop render scale once (0.5 → 0.35)
     · prefers-reduced-motion: NO animation loop — a single static frame,
       re-rendered discretely on scene change / resize
     · WebGL lost/unavailable: silent fallback to scene-tinted CSS washes
       (overhaul.css) — blur-free radial gradients driven by data-scene
     · context-loss recovery via a generation counter re-running setup
   ------------------------------------------------------------------------ */

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime;
uniform float uScroll;
uniform vec2  uMouse;
uniform float uMouseI;
uniform vec3  uColA; uniform vec2 uPosA; uniform float uRadA;
uniform vec3  uColB; uniform vec2 uPosB; uniform float uRadB;
uniform vec3  uColC; uniform vec2 uPosC; uniform float uRadC;
uniform float uVig;
uniform float uWarm;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(19.7, 7.3);
    a *= 0.5;
  }
  return v;
}

float field(vec2 st, vec2 pos, float rad, float aspect) {
  vec2 d = st - pos;
  d.x *= aspect;
  float r = length(d) / max(rad, 1e-3);
  return exp(-r * r * 1.7);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 st = vec2(uv.x, 1.0 - uv.y);      /* y = 0 at top, matching scene space */
  float aspect = uRes.x / uRes.y;
  float t = uTime * 0.03;                 /* glacial idle drift */

  /* Domain warp: two fbm channels bend space so the radial fields smear into
     organic aurora sheets rather than perfect circles. */
  vec2 ns = st * vec2(aspect, 1.0);
  vec2 q = vec2(
    fbm(ns * 1.4 + vec2(t, -t * 0.7)),
    fbm(ns * 1.4 + vec2(-t * 0.8, t * 0.6) + 3.71)
  );
  vec2 w = st + (q - 0.5) * 0.34;
  w.y += (uScroll - 0.5) * 0.16;          /* nebula slides with page travel */

  /* Fine filaments: higher-frequency fbm modulates each field's brightness
     (counter-phased between fields so colours interleave, not just stack). */
  float fil = fbm(ns * 3.1 + (q - 0.5) * 1.2 - vec2(t * 0.5, t * 0.35));

  vec3 glow = vec3(0.0);
  glow += uColA * (field(w, uPosA, uRadA, aspect) * (0.72 + 0.50 * fil));
  glow += uColB * (field(w, uPosB, uRadB, aspect) * (0.72 + 0.50 * (1.0 - fil)));
  glow += uColC * (field(w, uPosC, uRadC, aspect) * (0.78 + 0.36 * fil));

  /* Gold ingress (vault district): faint rarity-light shafts from above. */
  float shaft = fbm(vec2(ns.x * 2.3 + t * 0.45, st.y * 0.8 - t * 0.2));
  glow += vec3(1.0, 0.78, 0.34) * (uWarm * 0.06 * shaft * shaft * (1.0 - st.y));

  /* Cursor swell — a subtle atmospheric response, warm inside the vault. */
  vec2 md = st - uMouse;
  md.x *= aspect;
  vec3 swell = mix(vec3(0.36, 0.42, 0.78), vec3(0.92, 0.74, 0.42), uWarm * 0.65);
  glow += swell * (exp(-dot(md, md) * 7.5) * 0.13 * uMouseI);

  /* Gentle compression keeps overlap hotspots classy; base void untouched so
     it matches the CSS --void behind rubber-band overscroll exactly. */
  glow = 1.0 - exp(-glow * 1.35);
  vec3 col = vec3(0.0196, 0.0196, 0.0392) + glow;   /* #05050a */

  /* In-shader vignette (replaces the .vignette div on the GL path). */
  vec2 vd = st - vec2(0.5, 0.42);
  vd.x *= 0.88;
  float vig = smoothstep(0.55, 1.15, length(vd) * 1.6);
  col = mix(col, vec3(0.0), vig * uVig);

  /* Ordered-ish dither — kills banding on these very dark gradients. */
  col += (hash(mod(gl_FragCoord.xy, 289.0) + fract(uTime) * 61.7) - 0.5) * 0.006;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function Ambience() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'gl' | 'css'>(() =>
    typeof window !== 'undefined' && webglSupported() ? 'gl' : 'css',
  );
  /* Bumped on webglcontextrestored to re-run the whole GL setup. */
  const [gen, setGen] = useState(0);

  /* CSS fallback still gets scene-aware colour: the observer stamps
     data-scene on <html>; the html[data-scene] rules in overhaul.css
     retarget the --amb-* wash colours. */
  useEffect(() => {
    if (mode !== 'css') return;
    return observeScenes();
  }, [mode]);

  useEffect(() => {
    if (mode !== 'gl') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power', // ambient layer — never spin up a dGPU
    }) as WebGLRenderingContext | null;
    if (!gl) {
      setMode('css');
      return;
    }

    /* ---- Program ---- */
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[ambience] shader compile:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      setMode('css');
      return;
    }
    const prog = gl.createProgram();
    if (!prog) {
      setMode('css');
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[ambience] link:', gl.getProgramInfoLog(prog));
      setMode('css');
      return;
    }
    gl.useProgram(prog);

    /* Fullscreen triangle (fewer helper invocations than a quad). */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U('uRes');
    const uTime = U('uTime');
    const uScroll = U('uScroll');
    const uMouse = U('uMouse');
    const uMouseI = U('uMouseI');
    const uColA = U('uColA'), uPosA = U('uPosA'), uRadA = U('uRadA');
    const uColB = U('uColB'), uPosB = U('uPosB'), uRadB = U('uRadB');
    const uColC = U('uColC'), uPosC = U('uPosC'), uRadC = U('uRadC');
    const uVig = U('uVig');
    const uWarm = U('uWarm');

    /* ---- State ---- */
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;

    const cur = sceneVec(SCENES[DEFAULT_SCENE]); // rendered palette
    const tgt = sceneVec(SCENES[DEFAULT_SCENE]); // target palette

    let raf = 0;
    let time = reduce ? 7.31 : 0; // frozen mid-drift for the static frame
    let scroll = 0; // smoothed 0..1 page progress
    let mx = 0.5, my = 0.5; // smoothed cursor (uv)
    let tx = 0.5, ty = 0.5; // cursor target
    let mi = 0, tmi = 0; // cursor-swell intensity (smoothed / target)
    let docH = 1;
    let frames = 0;

    /* Adaptive quality: one step down if frames stay slow. */
    let scale = 0.5;
    let emaDt = 1 / 60;
    let slowRun = 0;

    const draw = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uScroll, scroll);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uMouseI, mi);
      gl.uniform3f(uColA, cur[0], cur[1], cur[2]);
      gl.uniform2f(uPosA, cur[3], cur[4]);
      gl.uniform1f(uRadA, cur[5]);
      gl.uniform3f(uColB, cur[6], cur[7], cur[8]);
      gl.uniform2f(uPosB, cur[9], cur[10]);
      gl.uniform1f(uRadB, cur[11]);
      gl.uniform3f(uColC, cur[12], cur[13], cur[14]);
      gl.uniform2f(uPosC, cur[15], cur[16]);
      gl.uniform1f(uRadC, cur[17]);
      gl.uniform1f(uVig, cur[18]);
      gl.uniform1f(uWarm, cur[19]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, Math.round(window.innerWidth * dpr * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * dpr * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (reduce) draw(); // static path re-renders per resize
    };
    resize();

    /* ---- Scene targeting ---- */
    const stopScenes = observeScenes((id) => {
      tgt.set(sceneVec(SCENES[id]));
      if (reduce) {
        cur.set(tgt); // discrete state change, no animation
        draw();
      }
    });

    /* ---- Input ---- */
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth;
      ty = e.clientY / window.innerHeight;
      tmi = 1;
    };
    const onLeaveDoc = () => {
      tmi = 0;
    };
    if (fine && !reduce) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', onLeaveDoc);
    }
    window.addEventListener('resize', resize);

    /* ---- Context loss ---- */
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const onRestored = () => setGen((g) => g + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    /* ---- Loop (skipped entirely under reduced motion) ---- */
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1; // tab was hidden — don't lurch
      time += dt;

      /* Adaptive resolution: rAF-throttling browsers aside, a sustained
         ~1.5s of >26ms frames means we're too heavy — step down once. */
      emaDt = emaDt * 0.95 + dt * 0.05;
      slowRun = emaDt > 0.026 ? slowRun + 1 : 0;
      if (slowRun > 90 && scale > 0.36) {
        scale = 0.35;
        slowRun = 0;
        resize();
      }

      /* Refresh doc height occasionally (cheap; avoids layout reads/frame). */
      if ((frames++ & 127) === 0) {
        docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      }

      const kFast = 1 - Math.exp(-dt * 3.0); // scroll / cursor spring
      const kSlow = 1 - Math.exp(-dt * 2.0); // palette glide (~1.5s settle)
      scroll += (window.scrollY / docH - scroll) * kFast;
      mx += (tx - mx) * kFast;
      my += (ty - my) * kFast;
      mi += (tmi - mi) * kSlow;
      for (let i = 0; i < SCENE_FLOATS; i++) cur[i] += (tgt[i] - cur[i]) * kSlow;

      draw();
    };

    if (reduce) {
      draw(); // one static frame; scene changes re-render discretely above
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      stopScenes();
      window.removeEventListener('resize', resize);
      if (fine && !reduce) {
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('mouseleave', onLeaveDoc);
      }
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      try {
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buf);
      } catch {
        /* context may already be lost — nothing to free */
      }
    };
  }, [mode, gen]);

  if (mode === 'css') {
    /* No-WebGL fallback: scene-tinted, blur-free radial washes + DOM
       vignette. Colours retarget via html[data-scene] (overhaul.css). */
    return (
      <div className="ambience" aria-hidden="true">
        <div className="neb neb--1" />
        <div className="neb neb--2" />
        <div className="neb neb--3" />
        <div className="vignette" />
      </div>
    );
  }

  return (
    <div className="ambience" aria-hidden="true">
      <canvas ref={canvasRef} className="ambience__canvas" />
    </div>
  );
}
