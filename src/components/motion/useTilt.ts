/* ============================================================================
   MOTION / TILT — restrained 3D hover physics for card triggers.

   rotateX/rotateY springs (default ±2.5°) plus a springy -8px lift that
   replaces the old one-note CSS translateY hover. All values ride on
   framer transform channels (GPU), nothing touches layout. Inert under
   prefers-reduced-motion and on coarse pointers: the card simply rests.
============================================================================ */

import { useRef } from 'react';
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

const TILT_SPRING = { stiffness: 260, damping: 22, mass: 0.6 } as const;
const LIFT_SPRING = { stiffness: 220, damping: 20, mass: 0.6 } as const;

interface TiltHandlers {
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
}

export function useTilt<T extends HTMLElement>({ maxDeg = 2.5, lift = -8 } = {}) {
  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion();

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const ty = useMotionValue(0);
  const rotateX = useSpring(rx, TILT_SPRING);
  const rotateY = useSpring(ry, TILT_SPRING);
  const y = useSpring(ty, LIFT_SPRING);

  const active = () => {
    if (reduce) return false;
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches;
  };

  const handlers: TiltHandlers = {
    onPointerEnter: (e) => {
      if (!active()) return;
      ty.set(lift);
      handlers.onPointerMove(e);
    },
    onPointerMove: (e) => {
      if (!active()) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const relX = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
      const relY = (e.clientY - r.top) / r.height - 0.5;
      ry.set(relX * maxDeg * 2);
      rx.set(-relY * maxDeg * 2);
    },
    onPointerLeave: () => {
      rx.set(0);
      ry.set(0);
      ty.set(0);
    },
  };

  const style = { rotateX, rotateY, y, transformPerspective: 900 } as const;

  return { ref, style, handlers };
}
