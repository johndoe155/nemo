import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { KineticLabel } from './motion/KineticLabel';
import { GhostArrow } from './motion/GhostArrow';

/* ============================================================================
   PORTAL BUTTONS — hero CTA overhaul ("ENTER THE NEMOVERSE" + "HOLDER PERKS")

   Four upgrades bundled into this module:

   1. Liquid WebGL shader (primary) — a purple→cyan fragment-shader surface
      whose domain warps, swirls and ripples around the real-time cursor
      position, plus an RGB shockwave fired from the press point on click.
   2. Magnetic spring physics — both CTAs sit in a GSAP-powered container
      that pulls toward the cursor within a 60px edge threshold and snaps
      back with an elastic spring.
   3. Kinetic hover typography — labels are split per character and roll
      through a vertical Y mask with a rotational tilt; the swap label
      staggers in and snaps with power4.out.
   4. Refractive glassmorphism (secondary) — animated 1px gradient inner
      border + backdrop-filter: blur(12px), with a custom SVG chevron that
      elongates and splits into a double arrow on hover.

   All motion collapses under prefers-reduced-motion; the liquid falls back
   to the CSS gradient when WebGL is unavailable.
============================================================================ */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const COARSE_QUERY = '(pointer: coarse)';

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_QUERY).matches;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------------------------------------------------------------------------
   KineticLabel — MOVED to components/motion/KineticLabel.tsx (system
   primitive). Imported above; hero usage below is unchanged.
--------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   PortalMagnetic — GSAP spring container. Within a 60px threshold of the
   button's edge the button pulls toward the cursor (proportional strength);
   outside it springs home with elastic.out — a tactile physical snap.
--------------------------------------------------------------------------- */

export function PortalMagnetic({
  children,
  threshold = 60,
  strength = 0.4,
}: {
  children: ReactNode;
  threshold?: number;
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) return;
    if (window.matchMedia(COARSE_QUERY).matches) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 1.05, ease: 'elastic.out(1, 0.42)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 1.05, ease: 'elastic.out(1, 0.42)' });

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      /* distance from the cursor to the button's EDGE (0 when inside) */
      const ex = Math.max(Math.abs(dx) - r.width / 2, 0);
      const ey = Math.max(Math.abs(dy) - r.height / 2, 0);
      const edge = Math.hypot(ex, ey);
      if (edge < threshold) {
        const pull = 1 - edge / threshold; // 1 on the button → 0 at threshold
        const s = strength * (0.35 + 0.65 * pull);
        xTo(dx * s);
        yTo(dy * s);
      } else {
        xTo(0);
        yTo(0);
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [strength, threshold]);

  return (
    <span className="portal-magnetic" ref={ref}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Liquid WebGL shader (primary CTA)
--------------------------------------------------------------------------- */

const VERT_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;   /* normalized 0..1, top-down (button space) */
uniform float u_hover;   /* 0..1 eased hover intensity */
uniform float u_active;  /* 0..1 click shockwave intensity */
uniform vec2  u_click;   /* normalized press point */

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_res;

  /* --- liquid swirl: rotate the sample domain around the cursor --- */
  vec2 d = uv - u_mouse;
  float dist = length(d);
  float swirl = 0.6 * exp(-dist * 4.5) * sin(u_time * 1.5 - dist * 7.0)
              * (0.3 + 0.7 * u_hover);
  float cs = cos(swirl);
  float sn = sin(swirl);
  vec2 p = u_mouse + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  /* the whole field is gently dragged toward the pointer */
  p += (u_mouse - 0.5) * 0.28 * (0.25 + 0.75 * u_hover);

  float t = u_time * 0.3;

  /* --- domain-warped fbm — the "liquid" --- */
  vec2 q = vec2(
    fbm(p * 2.6 + vec2(t, -t * 0.8)),
    fbm(p * 2.6 + vec2(-t * 0.7, t * 0.6) + 3.7)
  );
  vec2 r = vec2(
    fbm(p * 3.4 + 2.6 * q + vec2(1.7, 9.2) + t * 0.5),
    fbm(p * 3.4 + 2.2 * q + vec2(8.3, 2.8) - t * 0.4)
  );
  float f = fbm(p * 3.8 + 2.1 * r + vec2(t, t * 0.6));

  /* --- ripples radiating outward from the cursor --- */
  float ripple = sin(dist * 26.0 - u_time * 4.0) * exp(-dist * 5.0);
  ripple *= 0.3 + 0.7 * u_hover;

  /* --- click shockwave (digital energy burst) --- */
  float cd = length(uv - u_click) * 6.0;
  float shock = exp(-cd * 3.2) * sin(cd * 16.0 - u_active * 12.0);
  shock *= u_active;

  /* --- palette: purple → cyan, with magenta intrusions --- */
  vec3 purple  = vec3(0.541, 0.302, 1.000);
  vec3 cyan    = vec3(0.247, 0.910, 1.000);
  vec3 magenta = vec3(1.000, 0.240, 0.604);

  float mixA = clamp(f * 1.35 + ripple * 0.55 + uv.x * 0.22 + q.x * 0.28, 0.0, 1.0);
  float mixB = clamp(fbm(p * 2.0 + q * 1.5) * 1.7 + shock * 0.6, 0.0, 1.0);

  vec3 col = mix(purple, cyan, mixA);
  col = mix(col, magenta, mixB * 0.5);
  col += ripple * vec3(0.35, 0.7, 0.85) * 0.45;
  col += shock * vec3(0.95, 0.45, 1.0) * 0.9;
  col += 0.05 * sin((p.x + p.y) * 22.0 + f * 7.0 + t * 2.0); /* liquid sheen */

  /* --- material depth: vignette + top light --- */
  float vig = smoothstep(1.25, 0.45, length(uv - 0.5) * 1.35);
  col *= mix(0.78, 1.0, vig);
  col += (1.0 - uv.y) * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
`;

interface GLHandle {
  gl: WebGLRenderingContext;
  uniforms: {
    res: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    mouse: WebGLUniformLocation | null;
    hover: WebGLUniformLocation | null;
    active: WebGLUniformLocation | null;
    click: WebGLUniformLocation | null;
  };
}

function initGL(canvas: HTMLCanvasElement): GLHandle | null {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[portal] shader compile failed:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[portal] program link failed:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  /* fullscreen triangle */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (name: string) => gl.getUniformLocation(prog, name);
  return {
    gl,
    uniforms: {
      res: U('u_res'),
      time: U('u_time'),
      mouse: U('u_mouse'),
      hover: U('u_hover'),
      active: U('u_active'),
      click: U('u_click'),
    },
  };
}

/* ---------------------------------------------------------------------------
   LiquidButton — the primary CTA. WebGL canvas behind a KineticLabel; the
   shader receives live cursor coordinates, hover intensity and click pulses.
--------------------------------------------------------------------------- */

export function LiquidButton({ href }: { href: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const anchor = canvas?.parentElement as HTMLElement | null;
    if (!canvas || !anchor) return;

    const handle = initGL(canvas);
    if (!handle) {
      anchor.classList.add('no-webgl');
      return;
    }
    const { gl, uniforms } = handle;
    const reduced = prefersReduced();

    let raf = 0;
    let running = true;
    const t0 = performance.now();

    /* eased uniform state */
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let hover = 0;
    let hoverT = 0;
    let active = 0;
    let activeT = 0;
    const click = { x: 0.5, y: 0.5 };
    let burstTimer = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = anchor.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(r.width * dpr));
      canvas.height = Math.max(2, Math.round(r.height * dpr));
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(anchor);

    const onPointerMove = (e: PointerEvent) => {
      const r = anchor.getBoundingClientRect();
      mouse.tx = clamp01((e.clientX - r.left) / r.width);
      mouse.ty = clamp01((e.clientY - r.top) / r.height);
      hoverT = 1;
    };
    const onPointerLeave = () => {
      hoverT = 0;
      mouse.tx = 0.5;
      mouse.ty = 0.5;
    };
    const onPointerDown = (e: PointerEvent) => {
      const r = anchor.getBoundingClientRect();
      click.x = clamp01((e.clientX - r.left) / r.width);
      click.y = clamp01((e.clientY - r.top) / r.height);
      activeT = 1;
      if (!reduced) {
        anchor.classList.add('is-burst');
        window.clearTimeout(burstTimer);
        burstTimer = window.setTimeout(() => anchor.classList.remove('is-burst'), 460);
      }
    };

    anchor.addEventListener('pointermove', onPointerMove, { passive: true });
    anchor.addEventListener('pointerleave', onPointerLeave, { passive: true });
    anchor.addEventListener('pointerdown', onPointerDown, { passive: true });

    /* stop burning GPU once the hero scrolls out of view */
    let inView = true;
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            if (inView && !reduced && !raf) render();
          })
        : null;
    io?.observe(anchor);

    const render = () => {
      raf = 0;
      if (!running || !inView) return;
      /* ease uniforms toward targets — silky instead of stepped */
      mouse.x += (mouse.tx - mouse.x) * 0.1;
      mouse.y += (mouse.ty - mouse.y) * 0.1;
      hover += (hoverT - hover) * 0.12;
      active += (activeT - active) * 0.14;
      if (activeT === 0 && active < 0.012) active = 0;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.res, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, (performance.now() - t0) / 1000);
      gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
      gl.uniform1f(uniforms.hover, hover);
      gl.uniform1f(uniforms.active, active);
      gl.uniform2f(uniforms.click, click.x, click.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reduced) raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(burstTimer);
      io?.disconnect();
      ro?.disconnect();
      anchor.removeEventListener('pointermove', onPointerMove);
      anchor.removeEventListener('pointerleave', onPointerLeave);
      anchor.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <a
      href={href}
      className="btn btn-primary portal-btn portal-btn--liquid"
      data-cursor="ENTER"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <canvas className="pk-liquid" ref={canvasRef} aria-hidden="true" />
      <KineticLabel label="ENTER THE NEMOVERSE" swap="OPEN THE PORTAL" open={open} />
      <span className="btn-spark" aria-hidden="true" />
    </a>
  );
}

/* ---------------------------------------------------------------------------
   GhostArrow — MOVED to components/motion/GhostArrow.tsx (system primitive).
   Imported above; hero usage below is unchanged.
--------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   GlassButton — the secondary CTA. Refractive glassmorphism with an animated
   gradient inner border + blurred backdrop, kinetic label and custom icon.
--------------------------------------------------------------------------- */

export function GlassButton({ href }: { href: string }) {
  const [open, setOpen] = useState(false);

  return (
    <a
      href={href}
      className="btn btn-ghost portal-btn portal-btn--glass"
      data-cursor="VIEW"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <KineticLabel label="HOLDER PERKS" swap="VIEW PERKS" open={open} />
      <GhostArrow open={open} />
    </a>
  );
}
