/* ============================================================================
   MOTION / TILT v2 — restrained 3D hover physics for card triggers.

   rotateX/rotateY springs (default ±2.5°) plus a springy lift and a press
   confirm. All values ride framer transform channels (GPU); nothing touches
   layout. Reads are rAF-batched (one getBoundingClientRect per frame max,
   never interleaved with writes). Inert under prefers-reduced-motion and on
   coarse pointers: the card simply rests.

   v2 additions:
   · press — pointerdown drives a fast scale spring (0.985) for tactile
     confirmation, released on pointerup/cancel.
   · parallax — `layer` exposes spring-smoothed counter-translate values
     (±parallax px, inverse to tilt) for inner card layers (art counter-moves
     against the tilt while scrims/chrome hold — see UniverseCard).
   · springs — the smoothed rotate springs are exposed so consumers can
     derive their own depth transforms via useTransform.
============================================================================ */

import { useRef } from 'react';
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

const TILT_SPRING = { stiffness: 260, damping: 22, mass: 0.6 } as const;
const LIFT_SPRING = { stiffness: 220, damping: 20, mass: 0.6 } as const;
const PRESS_SPRING = { stiffness: 500, damping: 26, mass: 1 } as const;
const PARALLAX_SPRING = { stiffness: 200, damping: 24, mass: 0.6 } as const;

interface TiltHandlers {
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function useTilt<T extends HTMLElement>({
  maxDeg = 2.5,
  lift = -8,
  parallax = 0,
} = {}) {
  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion();

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const ty = useMotionValue(0);
  const sc = useMotionValue(1);
  const rotateX = useSpring(rx, TILT_SPRING);
  const rotateY = useSpring(ry, TILT_SPRING);
  const y = useSpring(ty, LIFT_SPRING);
  const scale = useSpring(sc, PRESS_SPRING);

  // Inner-layer parallax: counter-translate, spring-smoothed, scaled from the
  // tilt angle so the layer always settles exactly back to 0.
  const range = maxDeg * 2;
  const px = useSpring(useTransform(ry, [-range, range], [parallax, -parallax]), PARALLAX_SPRING);
  const py = useSpring(useTransform(rx, [-range, range], [-parallax, parallax]), PARALLAX_SPRING);

  const active = () => {
    if (reduce) return false;
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches;
  };

  // rAF batching: keep only the latest event; read geometry once per frame.
  const pending = useRef<React.PointerEvent | null>(null);
  const raf = useRef(0);
  const apply = () => {
    raf.current = 0;
    const e = pending.current;
    const el = ref.current;
    if (!e || !el) return;
    const r = el.getBoundingClientRect();
    const relX = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
    const relY = (e.clientY - r.top) / r.height - 0.5;
    ry.set(Math.max(-0.5, Math.min(0.5, relX)) * maxDeg * 2);
    rx.set(Math.max(-0.5, Math.min(0.5, -relY)) * maxDeg * 2);
  };

  const handlers: TiltHandlers = {
    onPointerEnter: (e) => {
      if (!active()) return;
      ty.set(lift);
      handlers.onPointerMove(e);
    },
    onPointerMove: (e) => {
      if (!active()) return;
      pending.current = e;
      if (!raf.current) raf.current = requestAnimationFrame(apply);
    },
    onPointerDown: () => {
      if (!active()) return;
      sc.set(0.985);
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

  const style = { rotateX, rotateY, y, scale, transformPerspective: 900 } as const;
  const layer = { x: px, y: py } as { x: MotionValue<number>; y: MotionValue<number> };
  const springs = { rx: rotateX, ry: rotateY } as const;

  return { ref, style, handlers, layer, springs };
}
