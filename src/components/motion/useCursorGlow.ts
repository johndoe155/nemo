/* ============================================================================
   MOTION / CURSOR GLOW — delegated pointer tracking for bloom/glare layers.

   One passive window listener writes --mx / --my (% coords) onto whichever
   interactive surface the pointer is over (rAF-batched). CSS layers consume
   the vars — radial bloom on .btn::before, glare on .sheen::after — with
   opacity-only fades. No React state, no re-renders, no layout: the vars
   feed `background` gradients, which are paint-only on small elements.

   Under prefers-reduced-motion the loop stays inert so blooms rest centred;
   on coarse pointers the hook never engages (bloom rests centred too).
============================================================================ */

import { useEffect } from 'react';

const GLOW_SELECTOR =
  '.btn, .chip, .npill, .nchat__send, .npx__cta-mini, .npx__ghostbtn, .sheen, .soundtoggle, .roster__arrow, .sort-dd__trigger, [data-glow]';

export function useCursorGlow() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let el: HTMLElement | null = null;
    let pt: { x: number; y: number } | null = null;
    let raf = 0;

    const clear = () => {
      if (el) {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
        el = null;
      }
    };

    const apply = () => {
      raf = 0;
      if (!el || !pt) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      el.style.setProperty('--mx', `${(((pt.x - r.left) / r.width) * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(((pt.y - r.top) / r.height) * 100).toFixed(2)}%`);
    };

    const onMove = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.(GLOW_SELECTOR) as HTMLElement | null;
      if (t !== el) {
        clear();
        el = t;
      }
      if (!el) return;
      pt = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', clear);
    window.addEventListener('blur', clear);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', clear);
      window.removeEventListener('blur', clear);
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, []);
}
