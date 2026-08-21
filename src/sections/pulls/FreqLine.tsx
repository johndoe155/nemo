/* ============================================================================
   FreqLine — the glowing audio-visual frequency line.

   Replaces the static "THE ARCHIVE IS SHUFFLED" subtext with a live spectrum
   strip. Its amplitude is bound to the ambient sound toggle: with interface
   sound ON the line runs hot and full-range (it is "hearing" the archive
   hum); muted, it idles as a faint slow-motion carrier wave. While a pull is
   spinning, the line overdrives into bright cyan. Drawn on a 2D canvas with glow
   stacking; honours reduced motion with a frozen waveform.
   ========================================================================== */

import { useEffect, useRef } from 'react';

const BARS = 56;

export function FreqLine({ spin = false }: { spin?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spinRef = useRef(spin);
  const soundRef = useRef(false);

  useEffect(() => {
    spinRef.current = spin;
  }, [spin]);

  useEffect(() => {
    const readSound = () => {
      try {
        soundRef.current = localStorage.getItem('ocu:sound') === 'on';
      } catch {
        soundRef.current = false;
      }
    };
    readSound();
    const onSound = (e: Event) => {
      soundRef.current = Boolean((e as CustomEvent<{ enabled: boolean }>).detail?.enabled);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ocu:sound') {
        soundRef.current = e.newValue === 'on';
      }
    };
    window.addEventListener('ocu:sound', onSound);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ocu:sound', onSound);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
    io?.observe(canvas);

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sec = t / 1000;
      const hot = soundRef.current || spinRef.current;
      const drive = spinRef.current ? 1 : hot ? 0.85 : 0.22;
      const speed = spinRef.current ? 5.2 : hot ? 2.6 : 0.8;
      const barW = canvas.width / BARS;
      const mid = canvas.height / 2;
      const spinHot = spinRef.current;

      for (let i = 0; i < BARS; i++) {
        if (reduce) {
          const amp = 0.5 + 0.5 * Math.sin(i * 0.7);
          const bh = Math.max(2, amp * 0.3 * canvas.height * (hot ? 1 : 0.5));
          fillBar(ctx, i, barW, mid, bh, spinHot);
          continue;
        }
        // layered sines → organic spectrum, biased by a low-frequency envelope
        const env =
          0.55 +
          0.45 * Math.sin(sec * 0.9 + i * 0.55) * Math.sin(sec * 0.4 + i * 0.13);
        const wave =
          Math.abs(
            Math.sin(i * 0.62 + sec * speed) * 0.55 +
              Math.sin(i * 1.13 - sec * speed * 1.4) * 0.3 +
              Math.sin(i * 2.07 + sec * speed * 2.1) * 0.15,
          ) * env;
        const bh = Math.max(2, wave * drive * canvas.height * 0.92);
        fillBar(ctx, i, barW, mid, bh, spinHot);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="npx__freq" aria-hidden="true" />;
}

function fillBar(
  ctx: CanvasRenderingContext2D,
  i: number,
  barW: number,
  mid: number,
  halfHeight: number,
  hot: boolean,
) {
  const x = i * barW + barW * 0.22;
  const w = barW * 0.56;
  const grad = ctx.createLinearGradient(0, mid - halfHeight, 0, mid + halfHeight);
  if (hot) {
    grad.addColorStop(0, 'rgba(63, 232, 255, 0.04)');
    grad.addColorStop(0.5, 'rgba(140, 226, 255, 0.9)');
    grad.addColorStop(1, 'rgba(63, 232, 255, 0.04)');
  } else {
    grad.addColorStop(0, 'rgba(63, 232, 255, 0.03)');
    grad.addColorStop(0.5, 'rgba(110, 205, 255, 0.75)');
    grad.addColorStop(1, 'rgba(224, 228, 236, 0.04)');
  }
  ctx.fillStyle = grad;
  ctx.shadowColor = hot ? 'rgba(63, 232, 255, 0.7)' : 'rgba(63, 210, 255, 0.45)';
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.roundRect(x, mid - halfHeight, w, halfHeight * 2, w / 2);
  ctx.fill();
}
