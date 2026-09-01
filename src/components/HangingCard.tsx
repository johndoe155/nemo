/* ============================================================================
   HANGING CARD — framer-motion pendulum rig (01 · THE ANCHOR FEATURE)

   The roster cards no longer float: they hang off the section's suspension
   rod on a cord, punched through a grommet at the top-centre of each card.

   PHYSICS MODEL (all framer-motion, all compositor channels)
     · The rod is the carriage. Whatever moves the rail — scroll, drag, an
       arrow jump — moves the pivot. `useVelocity` reads that carriage speed.
     · Inertia: the hem lags the pivot. A leftward pull throws the bottom of
       the card to the right, so the swing target is the NEGATED velocity,
       clamped to ±MAX_SWING degrees.
     · The target feeds an intentionally UNDER-damped spring — the overshoot
       IS the swing. Because the transform origin sits on the rod, rotating
       the arm also lifts the card along its arc: gravity/pendulum rise comes
       out of the geometry for free, no second animation.
     · Every card gets a slightly different cord length, stiffness and mass
       (derived from its index), so the rail never swings in lockstep — the
       long cords lope, the short ones chatter.
     · A poke (pointer-down) injects a torque impulse whose sign depends on
       which side of the card was hit; released a beat later the spring
       rings out naturally. Hover entry adds a feather-weight nudge in the
       direction the cursor crossed the card.

   SPRING REGISTRY (companion to styles/motion.css):
     PENDULUM { stiffness: 34–52, damping: 5.6–7.1, mass: 1.05–1.3 }

   Transform authority: the outer node owns layout/presence (no transform
   motion values — layout projection and `rotate` must never share an
   element), the inner arm owns the rotation.
   ========================================================================== */

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';

/** Degrees of swing at full carriage speed. */
const MAX_SWING = 9.5;
/** Carriage speed (px/s) that produces MAX_SWING. */
const SWING_AT = 2200;
/** Torque impulse (deg) injected by a deliberate poke. */
const POKE = 7.5;
/** How long an impulse is held before the spring is allowed to ring out. */
const POKE_HOLD = 90;

export interface HangingCardProps {
  children: ReactNode;
  /**
   * Position (px) whose velocity drives the swing — normally the roster
   * rail's x. Omit and the card simply hangs still.
   */
  drive?: MotionValue<number>;
  /** Rail index — seeds cord length + spring character so cards de-sync. */
  index?: number;
  /** Cord length in px (rod → card top edge). Defaults to a per-index stagger. */
  cord?: number;
  className?: string;
  style?: CSSProperties;
}

export default function HangingCard({
  children,
  drive,
  index = 0,
  cord,
  className = '',
  style,
}: HangingCardProps) {
  const reduce = useReducedMotion();

  /* ---- carriage velocity → swing target ---------------------------------- */
  const idle = useMotionValue(0);
  const carriage = drive ?? idle;
  const velocity = useVelocity(carriage);
  const inertia = useTransform(velocity, [-SWING_AT, SWING_AT], [MAX_SWING, -MAX_SWING], {
    clamp: true,
  });

  /* ---- poke impulse ------------------------------------------------------ */
  const poke = useMotionValue(0);
  const pokeTimer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(pokeTimer.current), []);

  const torque = useTransform<number, number>([inertia, poke], ([a, b]) => a + b);

  /* Per-card pendulum character. Longer cord → lazier spring, heavier bob. */
  const seed = index % 5;
  const drop = cord ?? 26 + seed * 6; // 26…50px of cord
  const rotate = useSpring(torque, {
    stiffness: 52 - seed * 4.4, // 52 → 34.4
    damping: 5.6 + seed * 0.38, // 5.6 → 7.1
    mass: 1.05 + seed * 0.06,
  });

  const nudge = useCallback(
    (deg: number) => {
      if (reduce) return;
      window.clearTimeout(pokeTimer.current);
      poke.set(deg);
      pokeTimer.current = window.setTimeout(() => poke.set(0), POKE_HOLD);
    },
    [poke, reduce],
  );

  /* Poke on the left half → the hem swings right (clockwise, positive). */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const side = e.clientX < r.left + r.width / 2 ? 1 : -1;
    const reach = Math.min(1, Math.abs(e.clientY - r.top) / Math.max(1, r.height)); // torque arm
    nudge(side * POKE * (0.45 + reach * 0.55));
  };

  const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    const dx = e.movementX;
    if (Math.abs(dx) < 0.5) return;
    nudge(Math.max(-2.6, Math.min(2.6, -dx * 0.4)));
  };

  /* Scroll-past release: a card entering the frame gets a small gust so the
     rack is visibly alive on touch devices, where there is no hover and the
     carriage may be standing still. Fires on entry in either direction. */
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reduce) return;
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const dir = index % 2 === 0 ? 1 : -1;
          window.setTimeout(() => nudge(dir * 3.4), (index % 4) * 70);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index, nudge, reduce]);

  return (
    <motion.div
      ref={wrap}
      className={`hang ${className}`.trim()}
      style={{
        ['--cord' as string]: `${drop}px`,
        /* Idle-sway period: long cords loll, short cords tick. */
        ['--sway' as string]: `${6.4 + seed * 1.15}s`,
        ...style,
      }}
      /* Rail reflow (filter/sort) rides the LAYOUT spring, matching the card
         it carries; presence owns the fade so the cord leaves with it. */
      layout={!reduce}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.24, ease: [0.76, 0, 0.24, 1] } }}
      transition={{ layout: { type: 'spring', stiffness: 240, damping: 26 } }}
    >
      {/* The rod-mounted carriage: a bearing that slides along the rod. */}
      <span className="hang__carriage" aria-hidden="true" />
      <motion.div
        className="hang__arm"
        style={{ rotate: reduce ? 0 : rotate, transformOrigin: '50% 0%' }}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
      >
        <span className="hang__cord" aria-hidden="true" />
        {/* Grommet: the punched hole in the card + the ring threaded through it. */}
        <span className="hang__punch" aria-hidden="true" />
        <span className="hang__ring" aria-hidden="true" />
        {children}
      </motion.div>
    </motion.div>
  );
}
