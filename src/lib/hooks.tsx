import { useEffect, useRef, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';

/* ---------------------------------------------------------------------------
   useRevealText — split a string into word spans that stagger in when the
   element scrolls into view. Returns { ref, render(text) }.
--------------------------------------------------------------------------- */

export function useRevealText(threshold = 0.35) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  const render = (text: string, keyPrefix = 'w') =>
    text.split(' ').map((word, i) => (
      <span
        key={`${keyPrefix}-${i}`}
        className="reveal-word"
        style={{ transitionDelay: `${0.045 * i}s` }}
        aria-hidden={i < text.split(' ').length - 1 ? undefined : undefined}
      >
        {word}
      </span>
    ));

  const props = {
    ref,
    'data-revealed': on ? 'true' : 'false',
    className: `reveal-root ${on ? 'is-on' : ''}`,
  };

  return { ...props, render, on };
}

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
   useScrollProgress — spring-smoothed 0..1 page scroll progress.
--------------------------------------------------------------------------- */

export function useScrollProgress(): MotionValue<number> {
  const { scrollYProgress } = useScroll();
  return useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.4 });
}

/* ---------------------------------------------------------------------------
   useSectionReveal — generic "in view" hook returning ref + MotionValues so a
   section can drive its own cinematic parallax (y shift + opacity).
--------------------------------------------------------------------------- */

export function useSectionReveal(offset = 0.18) {
  const ref = useRef<HTMLElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setEntered(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: offset },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [offset]);

  return { ref, entered };
}

/* ---------------------------------------------------------------------------
   useParallax — returns a MotionValue transformed from window scroll,
   clamped to a range. Used for scroll-bound cinematic movement.
--------------------------------------------------------------------------- */

export function useParallax(range: [number, number], output: [number, number]) {
  const { scrollY } = useScroll();
  return useTransform(scrollY, range, output, { clamp: true });
}

/* Re-export what consumers may want directly */
export { motion, useScroll, useTransform, useSpring, useMotionValueEvent };
