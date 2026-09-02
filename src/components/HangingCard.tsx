/* ============================================================================
   HANGING CARD — framer-motion pendulum rig (01 · THE ANCHOR FEATURE)

   The roster cards no longer float: they hang off the section's suspension
   rod on a cord, punched through a grommet at the top-centre of each card.

   PHYSICS MODEL (all framer-motion, all compositor channels)
     · The rod is the carriage. Whatever moves the rail — scroll, drag, an
       arrow jump — moves the pivot. `useVelocity` reads that carriage speed.
     · Inertia: the hem lags the pivot. A leftward pull throws the bottom of
       the card to the right, so the swing target is the NEGATED velocity —
       shaped through a power curve (see SWING RESPONSE below) so a slow
       scroll barely registers and only a real flick reaches full throw.
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
     PENDULUM { stiffness: 35.6–46, mass: 1.15–1.35, damping = 2ζ√(km) at
                ζ = 0.92 (≈ 13.3–15.0) — heavy, settles in one soft kick }

   Transform authority: the outer node owns layout/presence (no transform
   motion values — layout projection and `rotate` must never share an
   element), the inner arm owns the rotation.

   MOBILE RENDERING
     The rig animates ONE property, on ONE element: `transform` on .hang__arm.
     Nothing here touches layout (width/height/top/left) or paint (box-shadow,
     filter, background) per frame, so a swing is a compositor job.
     · The arm is force-promoted with translateZ(0) + will-change: transform
       + backface-visibility: hidden, so the swinging subtree is rasterised
       once and only re-composited.
     · suspension.css strips the per-frame-expensive passes INSIDE a hanger on
       touch/small screens (the blend-mode grain pass, image filters, the
       idle-sway keyframes and the parallax layer's will-change) — those are
       what turned a cheap rotation into a full re-raster of every card.
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

/* ---------------------------------------------------------------------------
   SWING RESPONSE — a heavy rack, dampened hard

   The cards read as HEAVY. Three limiters, in series:

   1. A power response bound to the carriage's velocity delta:
          angle = MAX * (|v| / FLICK) ^ CURVE            (signed)
      with MAX only 3°, so even a saturating flick is a micro-interaction:
          ~300 px/s  (slow scroll)   →  0.02°   — imperceptible
          ~900 px/s  (steady scroll) →  0.15°   — a breath
          ~1800 px/s (brisk swipe)   →  0.79°   — a visible nudge
          3200+ px/s (hard flick)    →  3.0°    — the cap
   2. A near-critically damped spring (ζ = 0.92, derived per card from its own
      stiffness and mass below) — one small overshoot, then it is done. The
      old ζ ≈ 0.45 is what made it wallow like a playground swing.
   3. A HARD CLAMP on the spring's OUTPUT. Springs overshoot their target, and
      impulses stack on top of the velocity term, so the visible rotation is
      clamped to ±HARD_CAP no matter what the inputs do.
--------------------------------------------------------------------------- */

/** Degrees of swing at (and above) a hard flick. */
const MAX_SWING = 3;
/** Carriage speed (px/s) that saturates the swing. */
const FLICK = 3200;
/** Response exponent — >1 crushes slow movement, preserves fast movement. */
const CURVE = 1.7;
/** Absolute ceiling on visible rotation, applied AFTER the spring. */
const HARD_CAP = 3.2;
/** Damping ratio: 1 = critical. Just under, so it settles with one soft kick. */
const ZETA = 0.92;

/* A secondary, much weaker channel: the page's own scroll velocity jostles
   the rack as the section passes. */
const GUST_MAX = 0.7;
const GUST_AT = 3200;
const GUST_CURVE = 1.9;

/** Torque impulse (deg) injected by a deliberate poke. */
const POKE = 2.4;
/** How long an impulse is held before the spring is allowed to ring out. */
const POKE_HOLD = 90;

/** Signed, clamped power response. Inertia is opposite the carriage: pulling
    the rod left throws the hem of the card to the right. */
function swing(v: number, max: number, at: number, curve: number) {
  const n = Math.min(1, Math.abs(v) / at);
  return -Math.sign(v) * max * Math.pow(n, curve);
}

export interface HangingCardProps {
  children: ReactNode;
  /**
   * Position (px) whose velocity drives the swing — normally the roster
   * rail's x. Omit and the card simply hangs still.
   */
  drive?: MotionValue<number>;
  /**
   * Page scroll position — its velocity feeds the weak "gust" channel so the
   * rack reacts to being scrolled past, not just swiped.
   */
  gust?: MotionValue<number>;
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
  gust,
  index = 0,
  cord,
  className = '',
  style,
}: HangingCardProps) {
  const reduce = useReducedMotion();

  /* ---- carriage velocity delta → swing target ---------------------------- */
  const idle = useMotionValue(0);
  const carriage = drive ?? idle;
  const velocity = useVelocity(carriage);
  const inertia = useTransform(velocity, (v) => swing(v, MAX_SWING, FLICK, CURVE));

  /* ---- page-scroll gust (weak, alternating so the rack never sways as one) */
  const idleGust = useMotionValue(0);
  const gustVelocity = useVelocity(gust ?? idleGust);
  const lean = index % 2 === 0 ? 1 : -0.8;
  const breeze = useTransform(gustVelocity, (v) => swing(v, GUST_MAX, GUST_AT, GUST_CURVE) * lean);

  /* ---- poke impulse ------------------------------------------------------ */
  const poke = useMotionValue(0);
  const pokeTimer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(pokeTimer.current), []);

  const torque = useTransform<number, number>(
    [inertia, breeze, poke],
    ([a, b, c]) => a + b + c,
  );

  /* Per-card pendulum character. Longer cord → lazier spring, heavier bob.
     Damping is DERIVED from the card's own stiffness and mass at a fixed
     ratio (c = 2ζ√(km)), so every card in the rack settles with the same
     heavy, near-critical character no matter how its cord is tuned. */
  const seed = index % 5;
  const drop = cord ?? 26 + seed * 6; // 26…50px of cord
  const stiffness = 46 - seed * 2.6; // 46 → 35.6
  const mass = 1.15 + seed * 0.05; // 1.15 → 1.35
  const rotate = useSpring(torque, {
    stiffness,
    mass,
    damping: ZETA * 2 * Math.sqrt(stiffness * mass), // ζ = 0.92
    restDelta: 0.005,
  });

  /* Hard ceiling on the visible angle — the spring may overshoot and the
     impulse channels stack, but the card physically cannot swing past this. */
  const capped = useTransform(rotate, (v) => Math.max(-HARD_CAP, Math.min(HARD_CAP, v)));

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
    nudge(Math.max(-0.7, Math.min(0.7, -dx * 0.12)));
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
          window.setTimeout(() => nudge(dir * 0.55), (index % 4) * 70);
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
        style={{
          rotate: reduce ? 0 : capped,
          transformOrigin: '50% 0%',
          /* Compositor contract (see MOBILE RENDERING below): promote the arm
             to its own GPU layer and keep it there for the life of the rig. */
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
        /* Force a 3D matrix. Framer emits only the transforms it is driving —
           a lone `rotate()` is a 2D matrix, which several mobile GPUs
           re-rasterise per frame instead of compositing, producing the
           tearing/stutter this rig showed on phones. Prefixing translateZ(0)
           (the CSS equivalent of `transform-gpu`, and the same thing GSAP's
           force3D does) guarantees a 3D matrix on every frame. */
        transformTemplate={(_, generated) => `translateZ(0) ${generated}`}
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
