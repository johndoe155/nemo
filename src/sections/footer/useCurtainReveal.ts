import { useLayoutEffect, type RefObject } from 'react';

const HEIGHT_TOKEN = '--curtain-footer-height';

/**
 * Keeps the document's reveal gutter in lockstep with the fixed footer.
 *
 * The footer is intentionally removed from normal flow. A ResizeObserver is
 * used instead of a one-time viewport calculation so font loading, wrapping,
 * orientation changes, and user text zoom all keep the curtain threshold
 * exact. The CSS fallback makes the first paint stable before this hook runs.
 */
export function useCurtainReveal(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const footer = ref.current;
    if (!footer || typeof window === 'undefined') return;

    const root = document.documentElement;
    let frame = 0;
    let active = true;

    const updateHeight = () => {
      if (!active) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty(HEIGHT_TOKEN, `${footer.getBoundingClientRect().height}px`);
      });
    };

    updateHeight();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    observer?.observe(footer);
    window.addEventListener('resize', updateHeight, { passive: true });

    // ResizeObserver catches the final font metrics in modern browsers. This
    // second hook covers older engines where document.fonts resolves without
    // producing an observed size notification.
    const fontsReady = document.fonts?.ready;
    fontsReady?.then(updateHeight).catch(() => undefined);

    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
      root.style.removeProperty(HEIGHT_TOKEN);
    };
  }, [ref]);
}
