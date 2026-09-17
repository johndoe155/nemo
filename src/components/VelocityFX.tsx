import { useEffect } from 'react';

/* ---------------------------------------------------------------------------
   VelocityFX — exposes a smoothed scroll velocity as the --scroll-vel custom
   property on <html> (clamped to roughly -1..1). audit-gaps.css uses it to
   tilt the giant ghost numerals on fast scroll — the "hyperdrive" moment
   from DESIGN_AUDIT §2.3.5. Renders nothing; no-ops under
   prefers-reduced-motion.

   The rAF loop parks itself once velocity decays to rest and wakes on the
   next scroll event — no 60fps style writes while the page is idle.
--------------------------------------------------------------------------- */

const EPSILON = 0.0005;

export default function VelocityFX() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let vel = 0;
    let target = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      vel += (target - vel) * 0.08;
      target *= 0.86; // decay toward rest once scrolling stops
      if (Math.abs(vel) < EPSILON && Math.abs(target) < EPSILON) {
        vel = 0;
        target = 0;
        root.style.setProperty('--scroll-vel', '0');
        running = false; // park until the next scroll event
        return;
      }
      root.style.setProperty('--scroll-vel', vel.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(16, now - lastT);
      target = Math.max(-1, Math.min(1, ((window.scrollY - lastY) / dt) * 0.4));
      lastY = window.scrollY;
      lastT = now;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    root.style.setProperty('--scroll-vel', '0');
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      root.style.removeProperty('--scroll-vel');
    };
  }, []);

  return null;
}
