/* ============================================================================
   ParticleField — the atmospheric WebGL layer of the split canvas.

   A field of ~700 additive particles (gold / silver / hyper-violet) drifts
   under a gravity vector + organic curl flow. The field actively *bends
   around* the two active panels (control rail + 3D stage): particles within
   a panel's influence radius are pushed along its silhouette instead of
   passing through it. Cursor movement injects velocity — fast sweeps swirl
   the field behind the pointer. Rendered with Three.js Points + custom
   shaders, paused offscreen, static under reduced motion.
   ========================================================================== */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { webglSupported } from './webgl';

interface Props {
  /** DOM nodes whose silhouettes the field must bend around */
  obstacles: React.RefObject<HTMLElement | null>[];
  sectionRef: React.RefObject<HTMLElement | null>;
}

import { FIELD_VERT, FIELD_FRAG } from './shaders';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  seed: number;
  size: number;
}

export default function ParticleField({ obstacles, sectionRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    // degrade silently — the CSS backdrop already carries the atmosphere
    if (!webglSupported()) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const W = () => section.clientWidth;
    const H = () => section.clientHeight;
    const count = W() < 900 ? 340 : 760;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 1, 6000);
    camera.position.set(0, 0, 700);

    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    const particles: Particle[] = [];
    const bounds = { w: 0, h: 0 };

    const material = new THREE.ShaderMaterial({
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uPointScale: { value: 400 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const fit = () => {
      bounds.w = W();
      bounds.h = H();
      const aspect = bounds.w / Math.max(1, bounds.h);
      camera.aspect = aspect;
      // pull the camera back so the particle plane frames the whole section
      const fov = (52 * Math.PI) / 180;
      const dist = bounds.h / 2 / Math.tan(fov / 2) + 320;
      camera.position.z = dist;
      material.uniforms.uPointScale.value = dist * 0.55;
      camera.updateProjectionMatrix();
    };
    fit();

    for (let i = 0; i < count; i++) {
      const p: Particle = {
        x: (Math.random() - 0.5) * (bounds.w + 240),
        y: (Math.random() - 0.5) * (bounds.h + 240),
        z: 60 + Math.random() * 360,
        vx: 0,
        vy: 0,
        seed: Math.random(),
        size: 1.1 + Math.random() * 2.6,
      };
      particles.push(p);
      seed[i] = p.seed;
      size[i] = p.size;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(section);

    let raf = 0;
    let visible = true;
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting;
            },
            { threshold: 0 },
          )
        : null;
    io?.observe(section);
    const onVis = () => {
      if (document.hidden) visible = false;
    };
    document.addEventListener('visibilitychange', onVis);

    /* ---- cursor velocity ---- */
    const pointer = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = e.clientX - r.left - bounds.w / 2;
      pointer.y = bounds.h / 2 - (e.clientY - r.top);
      pointer.vx = pointer.x - pointer.px;
      pointer.vy = pointer.y - pointer.py;
    };
    if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });

    /* ---- per-frame state ---- */
    let last = performance.now();
    const sim = (t: number) => {
      raf = requestAnimationFrame(sim);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!visible) return;
      if (!reduce) {
        // gather obstacle silhouettes once per frame, in section-local coords
        const secRect = section.getBoundingClientRect();
        const rects: Obstacle[] = [];
        for (const ref of obstacles) {
          const el = ref.current;
          if (!el) continue;
          const r = el.getBoundingClientRect();
          rects.push({
            ox: r.left - secRect.left - bounds.w / 2 + r.width / 2,
            oy: r.top - secRect.top - bounds.h / 2 + r.height / 2,
            hw: r.width / 2 + 26,
            hh: r.height / 2 + 26,
          });
        }
        updateField(particles, bounds, pointer, rects, dt);
      }
      for (let i = 0; i < count; i++) {
        const p = particles[i];
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
      }
      geometry.attributes.position.needsUpdate = true;
      material.uniforms.uTime.value = t / 1000;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(sim);

    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [obstacles, sectionRef]);

  return <canvas ref={canvasRef} className="npx__field" aria-hidden="true" />;
}

/* ------------------------- field dynamics ------------------------- */

interface Obstacle {
  ox: number;
  oy: number;
  hw: number;
  hh: number;
}

function updateField(
  ps: Particle[],
  bounds: { w: number; h: number },
  pointer: { x: number; y: number; vx: number; vy: number },
  obstacles: Obstacle[],
  dt: number,
) {
  const t = performance.now() / 1000;
  const halfW = bounds.w / 2;
  const halfH = bounds.h / 2;

  for (const p of ps) {
    /* gravity vector + gentle curl noise flow */
    const g = 7.2;
    const n1 = Math.sin(p.y * 0.0022 + t * 0.32) * Math.cos(p.x * 0.0016 - t * 0.21);
    const n2 = Math.sin(p.x * 0.0026 - t * 0.27) * Math.cos(p.y * 0.0019 + t * 0.24);
    p.vx += (n1 * 14 - p.vx * 0.4) * dt;
    p.vy += (-g + n2 * 12 - p.vy * 0.4) * dt;

    /* cursor injection: swirl around fast sweeps */
    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.hypot(pointer.vx, pointer.vy);
    if (dist < 260 && dist > 0.001 && speed > 2) {
      const f = ((260 - dist) / 260) * Math.min(1, speed / 900);
      p.vx += ((-dy / dist) * f * 460 - (dx / dist) * f * 60) * dt;
      p.vy += ((dx / dist) * f * 460 - (dy / dist) * f * 60) * dt;
    }

    /* panel silhouette bending — push along the nearest edge normal */
    for (const o of obstacles) {
      const qx = p.x - o.ox;
      const qy = p.y - o.oy;
      if (Math.abs(qx) > o.hw || Math.abs(qy) > o.hh) continue;
      const px = qx / (o.hw || 1);
      const py = qy / (o.hh || 1);
      const ax = Math.abs(px);
      const ay = Math.abs(py);
      const closeness = ax > ay ? 1 - ax : 1 - ay;
      const force = (18 + closeness * 130) * 2;
      if (ax > ay) {
        p.vx += Math.sign(px) * force * dt * 60;
        p.vy += py * 0.4 * force * dt * 60;
      } else {
        p.vy += Math.sign(py) * force * dt * 60;
        p.vx += px * 0.4 * force * dt * 60;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    /* wrap with margin */
    if (p.x > halfW + 60) p.x = -halfW - 60;
    else if (p.x < -halfW - 60) p.x = halfW + 60;
    if (p.y > halfH + 60) {
      p.y = -halfH - 60;
      p.x = -halfW + Math.random() * bounds.w;
    } else if (p.y < -halfH - 60) p.y = halfH + 60;
  }
}
