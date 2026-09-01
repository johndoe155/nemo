/* ============================================================================
   MOTION / MAGNETIC — the single source of truth for cursor magnetism.

   Replaces the four divergent implementations that used to exist:
     · lib/magnetic.tsx            (framer springs — NemoChat pills/send)
     · components/Cursor.tsx       <Magnetic> (framer — footer CTA wrapper)
     · PortalButton.tsx            <PortalMagnetic> (GSAP — hero, untouched)
     · LiquidPullButton.tsx        bespoke quickSetter (pulls, untouched)

   Behaviour
   ---------
   · When the cursor enters a field around the element (`radius` px outside
     its bounds), the element is pulled toward the cursor on two springs,
     and a normalised `--pull` (0 → 1) proximity value is written to the
     node so CSS can bleed a glow outward without repainting layout.
   · Content drifts a touch further than the shell — parallax inside.
   · Press tactile: whileTap squash (works on touch where magnetism is off).
   · Honours prefers-reduced-motion and coarse pointers (no magnetism).

   Presets
   -------
   PILL   — tier-1/2 CTAs. Generous field, assertive travel, soft overshoot.
   CHROME — system furniture (nav, burger, chips, small pills). Short leash,
            tight return — nearly invisible until you feel it.
============================================================================ */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';

export type MagneticPreset = 'pill' | 'chrome';

export interface MagneticOptions {
  preset?: MagneticPreset;
  /** How far outside the element bounds the magnetic field reaches (px). */
  radius?: number;
  /** How hard the element is pulled toward the cursor (0 → 1). */
  strength?: number;
  /** Hard clamp on the travel distance (px). */
  max?: number;
}

interface PresetSpec {
  radius: number;
  strength: number;
  max: number;
  spring: { stiffness: number; damping: number; mass: number };
  glowSpring: { stiffness: number; damping: number; mass: number };
}

const PRESETS: Record<MagneticPreset, PresetSpec> = {
  pill: {
    radius: 26,
    strength: 0.34,
    max: 16,
    /* light overshoot on release — the elastic snap character */
    spring: { stiffness: 240, damping: 17, mass: 0.5 },
    glowSpring: { stiffness: 150, damping: 26, mass: 0.5 },
  },
  chrome: {
    radius: 22,
    strength: 0.3,
    max: 7,
    spring: { stiffness: 320, damping: 24, mass: 0.5 },
    glowSpring: { stiffness: 200, damping: 26, mass: 0.5 },
  },
};

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

export function useMagnetic<T extends HTMLElement>({
  preset = 'pill',
  radius,
  strength,
  max,
}: MagneticOptions = {}) {
  const spec = PRESETS[preset];
  const radiusPx = radius ?? spec.radius;
  const pullStrength = strength ?? spec.strength;
  const maxPx = max ?? spec.max;

  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawPull = useMotionValue(0);

  const x = useSpring(rawX, spec.spring);
  const y = useSpring(rawY, spec.spring);
  const pull = useSpring(rawPull, spec.glowSpring);

  /* Content drifts a touch further than the shell — parallax inside the pill. */
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

      /* Distance from the cursor to the element's rectangle (0 when inside). */
      const dx = Math.max(r.left - point.x, 0, point.x - r.right);
      const dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
      const dist = Math.hypot(dx, dy);

      if (dist > radiusPx) {
        release();
        return;
      }

      const falloff = 1 - dist / (radiusPx || 1); // 1 on the element, 0 at the field edge
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      rawX.set(clamp((point.x - cx) * pullStrength * falloff, maxPx));
      rawY.set(clamp((point.y - cy) * pullStrength * falloff, maxPx));
      rawPull.set(falloff);
      el.dataset.magnetic = 'engaged';
    };

    const onMove = (e: PointerEvent) => {
      latest = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    function onScrollRelease() {
      if (latest && !frame) frame = requestAnimationFrame(apply);
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', release);
    document.addEventListener('pointerleave', release);
    document.addEventListener('scroll', onScrollRelease, { passive: true, capture: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', release);
      document.removeEventListener('pointerleave', release);
      document.removeEventListener('scroll', onScrollRelease, { capture: true });
      if (frame) cancelAnimationFrame(frame);
    };
  }, [radiusPx, pullStrength, maxPx, reduce, rawX, rawY, rawPull]);

  return { ref, x, y, pull, innerX, innerY, reduce };
}

/* ----------------------------------------------------------------------------
   <MagneticButton /> — a button whose shell springs toward the cursor while
   its label drifts with a softer parallax. Press: tactile squash via
   framer's whileTap (this also serves touch, where magnetism is disabled —
   framer writes `transform` inline, which would otherwise defeat the CSS
   :active scale on .btn).
---------------------------------------------------------------------------- */

type MagneticButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  MagneticOptions & {
    children: ReactNode;
    innerClassName?: string;
    /** Absolute-positioned chrome (e.g. .btn-spark sheen) rendered OUTSIDE
        the parallax label span, so it sizes to the button, not the label.
        (A transformed element becomes the containing block for absolute
        descendants — the inner span would clip a spark to the text box.) */
    layers?: ReactNode;
  };

export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  function MagneticButton(
    { children, preset, radius, strength, max, innerClassName, layers, style, ...rest },
    forwardedRef,
  ) {
    const { ref, x, y, pull, innerX, innerY } = useMagnetic<HTMLButtonElement>({
      preset,
      radius,
      strength,
      max,
    });
    useImperativeHandle(forwardedRef, () => ref.current as HTMLButtonElement);

    return (
      <motion.button
        {...(rest as Record<string, unknown>)}
        ref={ref}
        style={{ ...(style as CSSProperties), x, y, ['--pull' as string]: pull }}
        whileTap={{ scale: 0.97 }}
      >
        {layers}
        {/* inline-flex + inherited gap: multi-part labels (chip dot + roll
            text) keep the host button's spacing rhythm through the parallax
            shell */}
        <motion.span
          className={innerClassName}
          style={{ x: innerX, y: innerY, display: 'inline-flex', alignItems: 'center', gap: 'inherit' }}
        >
          {children}
        </motion.span>
      </motion.button>
    );
  },
);

/* ----------------------------------------------------------------------------
   <Magnetic /> — wrapper form for anchors/links (or any child). Renders a
   shrink-wrapped inline span; pass `block` for full-width CTAs.
---------------------------------------------------------------------------- */

export function Magnetic({
  children,
  preset = 'pill',
  radius,
  strength,
  max,
  className = '',
  innerClassName = '',
  block = false,
}: MagneticOptions & {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  block?: boolean;
}) {
  const { ref, x, y, pull, innerX, innerY } = useMagnetic<HTMLSpanElement>({
    preset,
    radius,
    strength,
    max,
  });

  return (
    <motion.span
      ref={ref}
      className={`magnetic ${block ? 'magnetic--block' : ''} ${className}`}
      style={{
        x,
        y,
        ['--pull' as string]: pull,
        display: block ? 'block' : 'inline-block',
      }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.span
        className={innerClassName}
        style={{ x: innerX, y: innerY, display: block ? 'block' : 'inline-block' }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}
