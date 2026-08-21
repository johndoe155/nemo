/* ---------------------------------------------------------------------------
   MAGNETIC — spring-physics pointer attraction.

   When the cursor enters a field around the element (default 26px outside its
   bounds), the element is pulled toward the cursor on two critically-damped
   springs, and a normalised `--pull` (0 → 1) proximity value is written to the
   node so CSS can bleed a glow outward without repainting layout.

   Honours prefers-reduced-motion and coarse pointers (no magnetism on touch).
--------------------------------------------------------------------------- */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

export interface MagneticOptions {
  /** How far outside the element bounds the magnetic field reaches (px). */
  radius?: number;
  /** How hard the element is pulled toward the cursor (0 → 1). */
  strength?: number;
  /** Hard clamp on the travel distance (px). */
  max?: number;
}

const SPRING = { stiffness: 260, damping: 20, mass: 0.4 } as const;
const GLOW_SPRING = { stiffness: 150, damping: 26, mass: 0.5 } as const;

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

export function useMagnetic<T extends HTMLElement>({
  radius = 26,
  strength = 0.34,
  max = 16,
}: MagneticOptions = {}) {
  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawPull = useMotionValue(0);

  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);
  const pull = useSpring(rawPull, GLOW_SPRING);

  // Content drifts a touch further than the shell — parallax inside the pill.
  const innerX = useTransform(x, (v) => v * 0.34);
  const innerY = useTransform(y, (v) => v * 0.34);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    let latest: { x: number; y: number } | null = null;

    const release = () => {
      rawX.set(0);
      rawY.set(0);
      rawPull.set(0);
      el.removeAttribute('data-magnetic');
    };

    const apply = () => {
      frame = 0;
      const point = latest;
      if (!point) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;

      // Distance from the cursor to the element's rectangle (0 when inside).
      const dx = Math.max(r.left - point.x, 0, point.x - r.right);
      const dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
      const dist = Math.hypot(dx, dy);

      if (dist > radius) {
        release();
        return;
      }

      const falloff = 1 - dist / (radius || 1); // 1 on the element, 0 at the field edge
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      rawX.set(clamp((point.x - cx) * strength * falloff, max));
      rawY.set(clamp((point.y - cy) * strength * falloff, max));
      rawPull.set(falloff);
      el.dataset.magnetic = 'engaged';
    };

    const onMove = (e: PointerEvent) => {
      latest = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', release);
    document.addEventListener('pointerleave', release);
    document.addEventListener('scroll', onScrollRelease, { passive: true, capture: true });

    function onScrollRelease() {
      if (latest && !frame) frame = requestAnimationFrame(apply);
    }

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', release);
      document.removeEventListener('pointerleave', release);
      document.removeEventListener('scroll', onScrollRelease, { capture: true });
      if (frame) cancelAnimationFrame(frame);
    };
  }, [radius, strength, max, reduce, rawX, rawY, rawPull]);

  return { ref, x, y, pull, innerX, innerY, reduce };
}

/* --------------------------------------------------------------------------
   <MagneticButton /> — a button whose shell springs toward the cursor while
   its label drifts with a softer parallax.
-------------------------------------------------------------------------- */

type MagneticButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  MagneticOptions & { children: ReactNode; innerClassName?: string };

export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  function MagneticButton(
    { children, radius, strength, max, innerClassName, ...rest },
    forwardedRef,
  ) {
    const { ref, x, y, pull, innerX, innerY } = useMagnetic<HTMLButtonElement>({
      radius,
      strength,
      max,
    });
    useImperativeHandle(forwardedRef, () => ref.current as HTMLButtonElement);

    return (
      <motion.button
        {...(rest as Record<string, unknown>)}
        ref={ref}
        style={{ x, y, ['--pull' as string]: pull }}
      >
        <motion.span className={innerClassName} style={{ x: innerX, y: innerY }}>
          {children}
        </motion.span>
      </motion.button>
    );
  },
);
