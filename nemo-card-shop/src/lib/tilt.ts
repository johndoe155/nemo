/* Restrained 3D hover physics for card triggers (from the Hub's useTilt).
   Inert under prefers-reduced-motion and on coarse pointers. framer owns
   `transform`; stylesheet motion uses independent translate/scale elsewhere so
   the two never fight. */
import { useRef } from 'react';
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';

const TILT = { stiffness: 260, damping: 22, mass: 0.6 };
const LIFT = { stiffness: 220, damping: 20, mass: 0.6 };
const PRESS = { stiffness: 500, damping: 26, mass: 1 };
const PAR = { stiffness: 200, damping: 24, mass: 0.6 };

export function useTilt(maxDeg = 2.2, lift = -6, parallax = 0) {
  const ref = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const ty = useMotionValue(0);
  const sc = useMotionValue(1);
  const rotateX = useSpring(rx, TILT);
  const rotateY = useSpring(ry, TILT);
  const y = useSpring(ty, LIFT);
  const scale = useSpring(sc, PRESS);
  const range = maxDeg * 2;
  const px = useSpring(useTransform(ry, [-range, range], [parallax, -parallax]), PAR);
  const py = useSpring(useTransform(rx, [-range, range], [-parallax, parallax]), PAR);

  const active = () => {
    if (reduce) return false;
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches;
  };

  const pending = useRef<React.PointerEvent | null>(null);
  const raf = useRef(0);
  const apply = () => {
    raf.current = 0;
    const e = pending.current;
    const el = ref.current;
    if (!e || !el) return;
    const r = el.getBoundingClientRect();
    const relX = (e.clientX - r.left) / r.width - 0.5;
    const relY = (e.clientY - r.top) / r.height - 0.5;
    ry.set(Math.max(-0.5, Math.min(0.5, relX)) * maxDeg * 2);
    rx.set(Math.max(-0.5, Math.min(0.5, -relY)) * maxDeg * 2);
  };

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (!active()) return;
      ty.set(lift);
      handlers.onPointerMove(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!active()) return;
      pending.current = e;
      if (!raf.current) raf.current = requestAnimationFrame(apply);
    },
    onPointerDown: () => {
      if (active()) sc.set(0.985);
    },
    onPointerLeave: () => {
      rx.set(0);
      ry.set(0);
      ty.set(0);
      sc.set(1);
      pending.current = null;
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      }
    },
  };

  const style = { rotateX, rotateY, y, scale, transformPerspective: 900 };
  return { ref, style, handlers, layer: { x: px, y: py }, springs: { rx: rotateX, ry: rotateY } };
}
