/* ============================================================================
   FilmGrain — animated noise across the whole viewport.

   A small canvas (one noise cell per 2 CSS px, upscaled) is re-seeded about
   eleven times a second and stretched over the page. It kills the colour
   banding in the deep-space gradients and gives the flat #050505 void a
   tactile, filmic finish. Static single frame under prefers-reduced-motion,
   paused when the tab is hidden.
   ========================================================================== */

import { useEffect, useRef } from 'react';

const CELL = 2; // CSS px per noise cell
const FPS = 11;

export default function FilmGrain() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.add('grain-canvas');

    let img: ImageData | null = null;

    const resize = () => {
      const w = Math.max(1, Math.round(window.innerWidth / CELL));
      const h = Math.max(1, Math.round(window.innerHeight / CELL));
      canvas.width = w;
      canvas.height = h;
      img = ctx.createImageData(w, h);
      draw();
    };

    const draw = () => {
      if (!img) return;
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };

    resize();

    let raf = 0;
    let last = 0;
    const interval = 1000 / FPS;
    const tick = (t: number) => {
      if (t - last >= interval) {
        last = t;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduce || raf) return;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.classList.remove('grain-canvas');
    };
  }, []);

  return <canvas className="filmgrain" ref={ref} aria-hidden="true" />;
}
