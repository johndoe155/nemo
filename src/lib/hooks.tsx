import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';

/* ---------------------------------------------------------------------------
   useCountdown — precise target-time countdown with tick alignment.
--------------------------------------------------------------------------- */

export interface TimeLeft {
  d: string;
  h: string;
  m: string;
  s: string;
  done: boolean;
}

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

export function useCountdown(targetIso: string): TimeLeft {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const tick = () => {
      setNow(Date.now());
      const diff = target - Date.now();
      const delay = Math.max(250, Math.min(1000, diff % 1000 || 1000));
      timer = window.setTimeout(tick, delay);
    };
    let timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [targetIso]);

  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { d: '00', h: '00', m: '00', s: '00', done: true };
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s), done: false };
}

/* ---------------------------------------------------------------------------
   useCountUp — animate a number from 0 → target once the element enters view.
   Returns { ref, val, started }. Respects reduced motion (jumps straight to
   target). Attach `ref` to the wrapping element.
--------------------------------------------------------------------------- */

export function useCountUp(
  target: number,
  opts?: { duration?: number; delay?: number },
) {
  const ref = useRef<HTMLElement | null>(null);
  const [started, setStarted] = useState(false);
  const [val, setVal] = useState(0);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (reduce.current) {
      setVal(target);
      return;
    }
    const dur = opts?.duration ?? 1200;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, opts?.duration]);

  return { ref, val, started };
}

/* ---------------------------------------------------------------------------
   useScrollspy — returns the id of the section currently in the center band
   of the viewport. `ids` should be stable (module-level).
--------------------------------------------------------------------------- */

export function useScrollspy(ids: string[]): string {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(e.target.id);
            return;
          }
        }
        /* Nothing is in the band any more — clear the highlight. Without
           this the marker STICKS to whatever section you last crossed, so
           sitting on the hero (or any gap between sections) kept the nav
           and the side rail lit on the last section visited — e.g. "07
           ARTISTS" highlighted while the top of the page is on screen. */
        setActive('');
      },
      { rootMargin: '-38% 0px -56% 0px' },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  return active;
}

/* ---------------------------------------------------------------------------
   useFocusTrap — the WAI-ARIA dialog pattern in one hook (DESIGN_AUDIT
   P0.3). UniverseDialog hand-rolled this; the mobile menu needed the same
   guarantees, so the behavior now lives here once: focus moves into the
   container on open, Tab cycles inside it, Escape routes to the owner, and
   the previously focused element is restored on close. Page scroll is NOT
   part of this hook — locks go through lib/scroll.ts (lockPage/unlockPage),
   which keeps Lenis's position frozen alongside the CSS lock.
--------------------------------------------------------------------------- */

const TRAP_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  active: boolean,
  containerRef: { current: HTMLElement | null },
  opts: { onEscape?: () => void } = {},
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    container.setAttribute('tabindex', '-1');
    container.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        opts.onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(TRAP_FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/* Re-export what consumers may want directly */
export { motion, useScroll, useTransform, useSpring, useMotionValueEvent };
