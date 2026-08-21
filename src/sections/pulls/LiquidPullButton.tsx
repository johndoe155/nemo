/* ============================================================================
   LiquidPullButton — the PULL FROM THE NEMOVERSE liquid-glass CTA.

   The button's body is a Three.js fragment-shader slab:
     · flowing liquid-glass refraction (domain-warped fbm caustics)
     · an internal light streak that tracks the cursor
     · metallic gold rim lighting with a slow phase
     · full chromatic-aberration split + shockwave on every click
   The shell is magnetically pulled toward the cursor with GSAP QuickSetters
   (position + rotation), releasing on an elastic snap. Falls back to a
   CSS glass gradient when WebGL is unavailable.
   ========================================================================== */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { webglSupported } from './webgl';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  spin?: boolean;
  label: string;
  spinLabel?: string;
}

import { CTA_VERT, CTA_FRAG } from './shaders';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  spin?: boolean;
  label: string;
  spinLabel?: string;
}

export default function LiquidPullButton({ onClick, disabled, spin, label, spinLabel }: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;
    if (!webglSupported()) {
      // silent CSS-glass fallback
      btn.classList.add('npx__cta--fallback');
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
      });
    } catch {
      btn.classList.add('npx__cta--fallback');
      return;
    }
    const gl = renderer.getContext();
    if (!gl) {
      btn.classList.add('npx__cta--fallback');
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-999, -999) },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uClick: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: CTA_VERT,
      fragmentShader: CTA_FRAG,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(btn.clientWidth * dpr));
      const h = Math.max(1, Math.round(btn.clientHeight * dpr));
      renderer!.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(btn);

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
    io?.observe(btn);
    const onVis = () => {
      if (document.hidden) visible = false;
    };
    document.addEventListener('visibilitychange', onVis);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      uniforms.uTime.value = performance.now() / 1000;
      renderer!.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    /* -------- magnetic pull — GSAP QuickSetter -------- */
    const xSet = gsap.quickSetter(btn, 'x', 'px');
    const ySet = gsap.quickSetter(btn, 'y', 'px');
    const rSet = gsap.quickSetter(btn, 'rotation', 'deg');
    const snap = () => {
      gsap.to(btn, { x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.42)' });
    };
    const onMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const relX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const relY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      uniforms.uMouse.value.set(e.clientX - rect.left, rect.height - (e.clientY - rect.top));
      if (reduce || !fine) return;
      xSet(relX * 14);
      ySet(relY * 7);
      rSet(relX * 2.4);
    };
    const onEnter = () => {
      gsap.to(uniforms.uHover, { value: 1, duration: 0.35, ease: 'power2.out' });
    };
    const onLeave = () => {
      gsap.to(uniforms.uHover, { value: 0, duration: 0.5, ease: 'power2.out' });
      snap();
    };
    const onClickEv = () => {
      gsap.fromTo(
        uniforms.uClick,
        { value: 1 },
        { value: 0, duration: 1.05, ease: 'expo.out' },
      );
    };
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerenter', onEnter);
    btn.addEventListener('pointerleave', onLeave);
    btn.addEventListener('click', onClickEv);

    const onLost = (e: Event) => {
      e.preventDefault();
      btn.classList.add('npx__cta--fallback');
      canvas.style.opacity = '0';
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerenter', onEnter);
      btn.removeEventListener('pointerleave', onLeave);
      btn.removeEventListener('click', onClickEv);
      canvas.removeEventListener('webglcontextlost', onLost);
      gsap.killTweensOf(btn);
      gsap.killTweensOf(uniforms.uHover);
      gsap.killTweensOf(uniforms.uClick);
      material.dispose();
      scene.clear();
      renderer!.dispose();
    };
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      className="npx__cta"
      onClick={onClick}
      disabled={disabled}
      data-spin={spin ? 'true' : 'false'}
      aria-label={spin ? spinLabel ?? 'Archives splitting' : label}
    >
      <canvas ref={canvasRef} className="npx__cta-gl" aria-hidden="true" />
      <span className="npx__cta-borderglow" aria-hidden="true" />
      <span className="npx__cta-label">
        <span className="npx__cta-star" aria-hidden="true">
          ✦
        </span>
        {spin ? spinLabel ?? 'ARCHIVE SPLITTING…' : label}
      </span>
      <span className="npx__cta-shine" aria-hidden="true" />
    </button>
  );
}
