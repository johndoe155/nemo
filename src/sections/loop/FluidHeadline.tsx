/* ============================================================================
   FluidHeadline — kinetic typography for "NOTHING WASTED".

   The phrase is rasterised into an offscreen 2D canvas in PP Neue Machina
   Inktrap, uploaded as a texture, and advected by a ring of eight decaying
   mouse-velocity impulses. Each impulse contributes
     · a push along its own velocity vector, and
     · a vortex swirl perpendicular to the offset,
   both falling off radially — so the type warps into the cursor's wake and
   settles back to crisp the instant the pointer stops. A per-channel offset
   adds chromatic dispersion proportional to the warp magnitude.

   The DOM keeps the real text for assistive tech; the canvas is decorative.
   Without WebGL (or under reduced motion) the phrase renders as plain type.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { webglSupported } from '../pulls/webgl';
import { FLUID_FRAG, FLUID_VERT } from './shaders';

const IMPULSES = 8;
const FONT_STACK = `'PP Neue Machina Inktrap', ui-sans-serif, system-ui, sans-serif`;

interface Props {
  text: string;
  className?: string;
}

export default function FluidHeadline({ text, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (!webglSupported()) {
      setFallback(true);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setFallback(true);
      return;
    }

    /* ------------------------------ text plate ----------------------------- */
    const plate = document.createElement('canvas');
    const ctx = plate.getContext('2d');
    if (!ctx) {
      setFallback(true);
      return;
    }

    let cssW = host.clientWidth || 1;
    let cssH = host.clientHeight || 1;

    const drawPlate = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      plate.width = Math.max(2, Math.round(cssW * dpr));
      plate.height = Math.max(2, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let size = cssH * 0.92;
      ctx.font = `800 ${size}px ${FONT_STACK}`;
      const w = ctx.measureText(text).width;
      if (w > 0) size = Math.min(size, (size * (cssW * 0.965)) / w);
      ctx.font = `800 ${size}px ${FONT_STACK}`;
      const spaced = size * 0.02;
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spaced}px`;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, cssW / 2 + spaced * 0.5, cssH * 0.54);
    };
    drawPlate();

    /* ------------------------------- renderer ------------------------------ */
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const texture = new THREE.CanvasTexture(plate);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const imp = new Float32Array(IMPULSES * 4);
    const impA = new Float32Array(IMPULSES);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLUID_VERT,
      fragmentShader: FLUID_FRAG,
      uniforms: {
        uTex: { value: texture },
        uRes: { value: new THREE.Vector2(cssW, cssH) },
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uAspect: { value: cssW / Math.max(1, cssH) },
        uImp: { value: imp },
        uImpA: { value: impA },
        uCyan: { value: new THREE.Color('#3fe8ff') },
        uMagenta: { value: new THREE.Color('#ff3d9a') },
        uReveal: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    scene.add(quad);
    const camera = new THREE.Camera();

    /* loop state — declared before resize() because resize() triggers a
       synchronous repaint through renderOnce() */
    let raf = 0;
    let running = false;
    let visible = true;
    let last = performance.now();
    let time = 0;

    function renderOnce() {
      mat.uniforms.uTime.value = time;
      renderer.render(scene, camera);
    }

    const resize = () => {
      cssW = host.clientWidth || 1;
      cssH = host.clientHeight || 1;
      renderer.setSize(cssW, cssH, false);
      mat.uniforms.uRes.value.set(cssW, cssH);
      mat.uniforms.uAspect.value = cssW / Math.max(1, cssH);
      drawPlate();
      texture.needsUpdate = true;
      if (!running) renderOnce();
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(host);
    resize();

    /* Re-rasterise once the display face is actually available, otherwise the
       plate is measured with the fallback metrics and jumps on swap. */
    if (document.fonts?.load) {
      document.fonts
        .load(`800 120px ${FONT_STACK}`, text)
        .then(() => {
          drawPlate();
          texture.needsUpdate = true;
          if (!running) renderOnce();
        })
        .catch(() => undefined);
    }

    /* ------------------------------- impulses ------------------------------ */
    let impHead = 0;
    let lastPush = 0;
    let lastX = 0;
    let lastY = 0;
    let hasLast = false;
    let speed = 0;
    let speedTarget = 0;

    const push = (ux: number, uy: number, vx: number, vy: number) => {
      const i = impHead % IMPULSES;
      imp[i * 4] = ux;
      imp[i * 4 + 1] = uy;
      imp[i * 4 + 2] = vx;
      imp[i * 4 + 3] = vy;
      impA[i] = 1;
      impHead++;
    };

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const ux = (e.clientX - r.left) / Math.max(1, r.width);
      const uy = 1 - (e.clientY - r.top) / Math.max(1, r.height);
      const now = performance.now();
      if (hasLast) {
        const dx = ux - lastX;
        const dy = uy - lastY;
        const dist = Math.hypot(dx, dy);
        const dt = Math.max(8, now - lastPush);
        if (dist > 0.012) {
          const vx = (dx / dt) * 320;
          const vy = (dy / dt) * 320;
          const len = Math.hypot(vx, vy);
          speedTarget = Math.min(1, len * 0.55);
          push(ux, uy, (vx / (len || 1)) * Math.min(1.6, len * 0.8), (vy / (len || 1)) * Math.min(1.6, len * 0.8));
          lastPush = now;
          lastX = ux;
          lastY = uy;
        }
      } else {
        lastX = ux;
        lastY = uy;
        lastPush = now;
        hasLast = true;
      }
    };
    const onLeave = () => {
      hasLast = false;
      speedTarget = 0;
    };
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);

    /* -------------------------------- reveal ------------------------------- */
    let reveal = 0;
    let revealTarget = 0;
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              revealTarget = entries[0].isIntersecting ? 1 : 0;
            },
            { threshold: 0.25 },
          )
        : null;
    io?.observe(host);
    if (!io) revealTarget = 1;

    /* --------------------------------- loop -------------------------------- */
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      time += dt;

      const decay = Math.exp(-dt * 2.6);
      for (let i = 0; i < IMPULSES; i++) impA[i] *= decay;
      speedTarget *= 0.9;
      speed += (speedTarget - speed) * (1 - Math.exp(-dt * 9));
      reveal += (revealTarget - reveal) * (1 - Math.exp(-dt * 4.2));

      mat.uniforms.uTime.value = time;
      mat.uniforms.uSpeed.value = speed;
      mat.uniforms.uReveal.value = reveal;
      renderer.render(scene, camera);

      const settled = reveal < 0.005 && speed < 0.002 && impA.every((a) => a < 0.002);
      if (running && !settled) raf = requestAnimationFrame(frame);
      else if (running && settled) running = false;
    };

    const kick = () => {
      if (!visible) return;
      if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const visIo =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting;
              if (visible) {
                revealTarget = 1;
                kick();
              }
            },
            { rootMargin: '80px' },
          )
        : null;
    visIo?.observe(host);
    kick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      visIo?.disconnect();
      ro?.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      texture.dispose();
      mat.dispose();
      quad.geometry.dispose();
      renderer.dispose();
    };
  }, [text]);

  return (
    <span className={`fluidtype${className ? ` ${className}` : ''}`} ref={hostRef}>
      <span className="fluidtype__sr">{text}</span>
      {!fallback && <canvas className="fluidtype__canvas" ref={canvasRef} aria-hidden="true" />}
      {fallback && (
        <span className="fluidtype__static txt-grad" aria-hidden="true">
          {text}
        </span>
      )}
    </span>
  );
}
