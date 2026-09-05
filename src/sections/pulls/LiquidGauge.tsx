/* ============================================================================
   ProbabilityNode — floating kinetic odds nodes with liquid shader gauges.

   Resting state: a levitating rarity orb with a tracked label.
   Hover / focus / tap: the node expands into a live liquid gauge whose fill
   is rendered by a fragment shader (WebGL1) — a simulated fluid column with
   surface waves, rising bubbles and caustic shimmer — showing the real-time
   normalised pull probability for that rarity. Falls back to a pure-CSS
   gauge when WebGL is unavailable.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import type { Rarity } from '../../lib/data';
import { RARITY_ACCENT } from './usePullEngine';
import { webglSupported } from './webgl';

/* ------------------------------ GL plumbing ------------------------------ */

import { GAUGE_VERT, GAUGE_FRAG } from './shaders';

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
  }
  return sh;
}

interface GaugeGL {
  gl: WebGLRenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
  stop: () => void;
  setFill: (f: number) => void;
}

function createGaugeGL(canvas: HTMLCanvasElement, fill: number, hex: string): GaugeGL {
  // alpha:true — the drawing buffer stays transparent until the liquid is
  // drawn, so a mid-expansion 0-sized frame can never paint as a solid
  // black slab over the node.
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
  if (!gl) throw new Error('webgl unavailable');
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, GAUGE_VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, GAUGE_FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uniforms: Record<string, WebGLUniformLocation | null> = {
    uRes: gl.getUniformLocation(prog, 'uRes'),
    uTime: gl.getUniformLocation(prog, 'uTime'),
    uFill: gl.getUniformLocation(prog, 'uFill'),
    uColor: gl.getUniformLocation(prog, 'uColor'),
  };
  const rgb = hexToRgb(hex);
  let raf = 0;
  let live = true;
  let cur = fill;
  let target = fill;
  let lost = false;

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const tick = (t: number) => {
    if (lost || !live) return;
    cur += (target - cur) * 0.12;
    // The gauge container animates 0 → 132px on hover; the canvas mounts at
    // the start of that transition, so keep the drawing buffer glued to the
    // live CSS size every frame. Without this, the first (zero-sized) frame
    // is the last one ever drawn — the classic "solid black pill" failure.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uTime, t / 1000);
    gl.uniform1f(uniforms.uFill, cur);
    gl.uniform3f(uniforms.uColor, rgb[0], rgb[1], rgb[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    gl,
    uniforms,
    stop: () => {
      live = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
    setFill: (f) => {
      target = f;
    },
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/* ------------------------------ the node ------------------------------ */

function useFloatRoll(value: number): number {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}

export function ProbabilityNode({
  rarity,
  pct,
  index,
}: {
  rarity: Rarity;
  pct: number;
  index: number;
}) {
  const accent = RARITY_ACCENT[rarity];
  const [hot, setHot] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GaugeGL | null>(null);
  const [glOk, setGlOk] = useState(true);
  const rolled = useFloatRoll(pct);
  const hold = useRef(0);

  const engage = () => {
    window.clearTimeout(hold.current);
    setHot(true);
  };
  const release = () => {
    // grace period lets the collapsing gauge finish animating before teardown
    hold.current = window.setTimeout(() => setHot(false), 420);
  };
  useEffect(() => () => window.clearTimeout(hold.current), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hot) return;
    // Pre-probe: if the platform has no WebGL at all, fall straight to the
    // pure-CSS liquid bar instead of mounting a doomed context.
    if (!webglSupported()) {
      setGlOk(false);
      return;
    }
    try {
      engineRef.current = createGaugeGL(canvas, pct / 100, accent.color);
      setGlOk(true);
    } catch {
      engineRef.current = null;
      setGlOk(false);
    }
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
    // engine is (re)built only on hot-mount and colour change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hot, accent.color]);

  useEffect(() => {
    // live probability re-tunes the liquid level while the gauge is open
    engineRef.current?.setFill(pct / 100);
  }, [pct]);

  return (
    <button
      type="button"
      className={`npx__node ${hot ? 'is-hot' : ''}`}
      style={{ '--c': accent.color, '--cg': accent.glow, ['--i' as string]: index }}
      onPointerEnter={engage}
      onPointerLeave={release}
      onFocus={engage}
      onBlur={release}
      aria-label={`${rarity.toUpperCase()} — ${pct.toFixed(1)}% pull probability`}
    >
      <span className="npx__node-orb" aria-hidden="true">
        <i />
      </span>
      <span className="npx__node-tag">
        {rarity.toUpperCase()} <b>{rolled.toFixed(1)}%</b>
      </span>
      <span className="npx__node-gauge" aria-hidden="true">
        {hot && (
          <canvas ref={canvasRef} className="npx__node-gl" />
        )}
        {!glOk && <i className="npx__node-bar" style={{ width: `${pct}%` }} />}
      </span>
    </button>
  );
}
