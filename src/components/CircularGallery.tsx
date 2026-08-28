import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from 'framer-motion';
import type { GalleryPlate } from '../lib/data';

export type { GalleryPlate };

/* ============================================================================
   CIRCULAR GALLERY — 3D rotunda
   ----------------------------------------------------------------------------
   Ported from `circular-gallery.zip` (src/components/CircularGallery.tsx) and
   re-authored for the Nemoverse codebase:

   · Tailwind utilities → scoped `.cg-*` classes in styles/circular-gallery.css,
     built on the design tokens (global.css) and the art-directed type roles
     (typography.css). This project ships no Tailwind, so the shipped utility
     classes would have rendered unstyled.
   · The `html/body { overflow: hidden }` rules that made the original a
     full-screen standalone app are gone — this is one section of a long
     scrolling page.
   · Wheel handling is opt-in by axis (`wheelRotate`) so the ring never traps
     page scroll: vertical wheel passes through by default.
   · Heading, subtitle, badge counts and hint copy are all props — no copy is
     hardcoded in the render path.

   MOTION MODEL
   One requestAnimationFrame tick owns the ring. Input never writes to the
   rendered angle; it writes to a *target*, and the tick eases the *current*
   angle toward it — so wheel, drag, flick and ambient spin all resolve inside
   a single integrator instead of competing rAF loops:

     target  += normalised wheel delta | drag delta | flick decay | ambient
     current += (target - current) * damping          ← the weight you feel
     rotation.set(current)                            ← what the cards read

   Every easing factor is expressed per 60fps frame and re-based on real
   elapsed time, so a 144Hz display and a 60Hz display spin at the same speed.
   ========================================================================== */

/* ------------------------- Motion constants ------------------------- */

/** Reference frame for every easing factor below. */
const FRAME_MS = 1000 / 60;

/** Wheel has no release event — ambient resumes this long after the last one. */
const WHEEL_IDLE_MS = 150;

/** Ceiling for a single wheel event, in normalised pixels. */
const MAX_WHEEL_STEP = 150;
/** Pixels in one line when `deltaMode === DOM_DELTA_LINE` (1). */
const LINE_HEIGHT_PX = 16;

/**
 * Flick ceiling and decay: degrees per frame, and the per-frame multiplier.
 * A gentle flick lands ~2 plates along; the ceiling caps a hard fling at
 * ~5 plates (12°/frame ÷ 0.08 ≈ 150°) instead of spinning the whole ring.
 */
const MAX_FLICK_DEG = 12;
const FLICK_FRICTION = 0.92;

/**
 * Ambient ramp — yields to input fast (τ ≈ 140ms, a stop within ~0.4s) and
 * returns gently (τ ≈ 0.55s, full baseline in ~1.7s) so the ring never snaps
 * back into motion the instant a drag ends.
 */
const AMBIENT_RAMP_UP = 0.03;
const AMBIENT_RAMP_DOWN = 0.12;

const DEFAULT_AMBIENT_SPEED = 0.038;
const DEFAULT_DAMPING = 0.075;
const WHEEL_SENSITIVITY = 0.22;
const DRAG_SENSITIVITY = 0.32;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Re-base a per-60fps-frame easing factor onto the real elapsed frame count,
 * so lerps behave identically at 60, 120 or 144Hz.
 */
const ease = (factor: number, frames: number) => 1 - Math.pow(1 - factor, frames);

/**
 * Wheel deltas arrive in three units depending on browser and device:
 * pixels (`deltaMode` 0), lines (1) or pages (2). Normalise everything to
 * pixels so a mouse notch, a trackpad swipe and a page-mode scroll all move
 * the ring by a comparable amount.
 */
function normalizeWheel(e: WheelEvent) {
  const factor =
    e.deltaMode === 1
      ? LINE_HEIGHT_PX
      : e.deltaMode === 2
        ? window.innerHeight || 800
        : 1;
  return { x: e.deltaX * factor, y: e.deltaY * factor };
}

/* ------------------------------- Types ------------------------------- */

export interface GalleryBadge {
  /** Label rendered after the count, e.g. 'REGISTERED UNIVERSES'. */
  label: string;
  /** Numeric (or pre-formatted) value for the badge. */
  count: number | string;
  /** Optional accent — defaults to the Nemoverse gold. */
  accent?: string;
}

export interface CircularGalleryProps {
  /** Plates to hang in the rotunda. Order is the ring order. */
  items: GalleryPlate[];
  /** Anchor id for the wrapping <section>. */
  id?: string;
  className?: string;
  /** Small tracked label above the title. */
  eyebrow?: string;
  /** Display heading. */
  title?: string;
  /** Supporting paragraph under the heading. */
  subtitle?: string;
  /** Count badges rendered beside the heading. */
  badges?: GalleryBadge[];
  /** Cylinder curvature. 0 = perfect circle, higher = tighter/bent. */
  bend?: number;
  borderRadius?: number;
  /**
   * Baseline ambient rotation in degrees per 60fps frame, added to the target
   * every tick while the ring is idle. 0 disables ambient motion.
   */
  ambientSpeed?: number;
  /** @deprecated — renamed to `ambientSpeed`; still honoured if passed. */
  autoSpinSpeed?: number;
  /**
   * Inertial damping: the fraction of the target→current gap closed per 60fps
   * frame. Lower = heavier and longer-gliding (0.05–0.08 is the sweet spot).
   */
  damping?: number;
  /**
   * Which wheel axis rotates the ring.
   *   'horizontal' (default) — trackpad/swipe-X rotates, vertical scroll is
   *                            left to the page so nobody gets stuck.
   *   'all'                  — any wheel over the stage rotates it (original
   *                            behaviour; blocks page scroll while it decays).
   *   'none'                 — wheel never touches the ring.
   */
  wheelRotate?: 'horizontal' | 'all' | 'none';
  /** Interaction hint under the ring. Pass '' to hide. */
  hint?: string;
  /** Render the 'Art by …' credit line on each plate. */
  showCredits?: boolean;
  /** CSS height for the 3D stage. */
  stageHeight?: string;
}

interface CardProps {
  item: GalleryPlate;
  index: number;
  total: number;
  radius: number;
  rotation: MotionValue<number>;
  borderRadius: number;
  cardW: number;
  cardH: number;
  showCredits: boolean;
}

/* -------------------------------- Card -------------------------------- */

function Card({
  item,
  index,
  total,
  radius,
  rotation,
  borderRadius,
  cardW,
  cardH,
  showCredits,
}: CardProps) {
  const angle = useMemo(() => (index * 360) / total, [index, total]);

  // Shortest signed distance (deg) from the front of the ring.
  const normalized = useTransform(rotation, (r: number) => {
    const current = angle + r;
    return ((current % 360) + 540) % 360 - 180;
  });

  const absAngle = useTransform(normalized, (n: number) => Math.abs(n));

  const opacity = useTransform(absAngle, [0, 60, 120, 180], [1, 0.92, 0.45, 0.18]);
  const scale = useTransform(absAngle, [0, 180], [1, 0.82]);
  const zIndex = useTransform(absAngle, (v: number) => 200 - Math.round(v));
  const brightness = useTransform(absAngle, [0, 90, 180], [1, 0.85, 0.35]);
  const blur = useTransform(absAngle, [0, 80, 180], [0, 0, 1.6]);
  const saturate = useTransform(absAngle, [0, 180], [1, 0.6]);

  const filter = useMotionTemplate`brightness(${brightness}) saturate(${saturate}) blur(${blur}px)`;

  const safeRadius = Number.isFinite(radius) && radius > 100 ? radius : 600;

  // MotionStyle (not CSSProperties) so motion values and the `--c` custom
  // property used by the plate accent rule both typecheck.
  const innerStyle: MotionStyle = {
    borderRadius,
    scale,
    opacity,
    filter,
    '--c': item.accent,
  };

  return (
    <motion.div
      className="cg-card"
      style={{
        width: cardW,
        height: cardH,
        marginLeft: -cardW / 2,
        marginTop: -cardH / 2,
        transform: `rotateY(${angle}deg) translateZ(${safeRadius}px)`,
        zIndex,
      }}
    >
      {/* Filter/scale live on the inner element so the outer 3D transform is
          never flattened by a filter-creating property. */}
      <motion.div className="cg-card__inner" style={innerStyle}>
        <img
          className="cg-card__img"
          src={item.image}
          alt={item.alt ?? `${item.code} — ${item.title}`}
          draggable={false}
          loading={index < 6 ? 'eager' : 'lazy'}
          decoding="async"
          style={{ objectPosition: item.focus ?? 'center' }}
        />

        <span className="cg-card__scrim" aria-hidden="true" />
        <span className="cg-card__grad" aria-hidden="true" />

        <div className="cg-card__meta">
          <span className="cg-card__code">{item.code}</span>
          <h3 className="cg-card__title">{item.title}</h3>
          <p className="cg-card__sub">{item.subtitle}</p>
          {showCredits && item.credit ? (
            <p className="cg-card__credit">Art by {item.credit}</p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------- Main gallery ---------------------------- */

export default function CircularGallery({
  items,
  id = 'gallery',
  className = '',
  eyebrow = '02 · THE ROTUNDA',
  title = 'Drift through the canon',
  subtitle = 'Every commissioned universe, hung in one rotating hall. The ring never stops moving — drag it, swipe it, or walk it with the arrow keys.',
  badges = [],
  bend = 0.5,
  borderRadius = 14,
  ambientSpeed,
  autoSpinSpeed,
  damping = DEFAULT_DAMPING,
  wheelRotate = 'horizontal',
  hint = 'Drag · swipe · ← → to rotate',
  showCredits = true,
  stageHeight,
}: CircularGalleryProps) {
  // `ambientSpeed` supersedes the original `autoSpinSpeed` name.
  const baselineAmbient = ambientSpeed ?? autoSpinSpeed ?? DEFAULT_AMBIENT_SPEED;

  const stageRef = useRef<HTMLDivElement>(null);

  /* ------------------------- Physics state ------------------------- */

  // `rotation` is the rendered angle the cards read. `target` is where input
  // wants it; `current` is where it actually is after damping.
  const rotation = useMotionValue(0);
  const targetRotationRef = useRef(0);
  const currentRotationRef = useRef(0);
  // Starts at 0 so the ring eases into its ambient drift instead of snapping
  // to full speed on mount.
  const ambientSpeedRef = useRef(0);
  // Residual pointer velocity after release, in degrees per frame.
  const flickRef = useRef(0);

  const isInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const [inView, setInView] = useState(true);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startTargetRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  /** Smoothed drag velocity in degrees per millisecond. */
  const velocityRef = useRef(0);

  // Cards render at a fixed high resolution and the whole ring is scaled down
  // to fit, so rasterisation stays crisp at every breakpoint.
  const [cardSize, setCardSize] = useState({ w: 440, h: 660 });
  const [galleryScale, setGalleryScale] = useState(1);
  const [perspective, setPerspective] = useState(2000);

  /* --------------------------- Sizing --------------------------- */

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const cw = stage.clientWidth || window.innerWidth;
      const ch = stage.clientHeight || window.innerHeight;

      // [card width, card height, needed width, needed height]
      let card: [number, number];
      let need: [number, number];
      if (cw < 640) {
        card = [400, 600];
        need = [520, 700];
        setPerspective(1600);
      } else if (cw < 1024) {
        card = [420, 630];
        need = [900, 760];
        setPerspective(1800);
      } else {
        card = [440, 660];
        need = [1180, 800];
        setPerspective(2000);
      }

      setCardSize({ w: card[0], h: card[1] });
      const fit = Math.min(1, Math.min(cw / need[0], ch / need[1]));
      setGalleryScale(Math.max(0.58, Math.min(1, fit)));
    };

    measure();

    const ro =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(stage);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Cylinder radius — wide enough that neighbouring plates never collide.
  const radius = useMemo(() => {
    const count = Math.max(items.length, 1);
    if (count === 1) return 0;
    const gap = 64;
    const base = (cardSize.w + gap) / (2 * Math.tan(Math.PI / count));
    const bent = Math.max(base, 520) * (1 - bend * 0.12) * 1.35;
    const finalRadius = Math.max(bent, 300);
    if (!Number.isFinite(finalRadius) || finalRadius < 150) return 680;
    return finalRadius;
  }, [items.length, cardSize.w, bend]);

  /* ---------------------- Interaction state ---------------------- */

  const beginInteraction = () => {
    isInteractingRef.current = true;
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  };

  const endInteraction = () => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    isInteractingRef.current = false;
  };

  /** Wheel/drag have no release event — end them on a short debounce. */
  const endInteractionAfter = (delay: number) => {
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = window.setTimeout(() => {
      isInteractingRef.current = false;
      interactionTimeoutRef.current = null;
    }, delay) as unknown as number;
  };

  /* ------------------------- Environment ------------------------- */

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedMotionRef.current = mq.matches;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Park the rAF loop entirely while the rotunda is scrolled out of view.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { rootMargin: '15% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* --------------------------- Main loop --------------------------- */

  useEffect(() => {
    if (!inView) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // Clamp the step so a backgrounded tab doesn't resume with one huge jump.
      const dt = clamp(now - last, 0, 50);
      last = now;
      const frames = dt / FRAME_MS; // 1.0 at 60fps

      /* 1 · Ambient spin — decays to a stop while input owns the ring, then
            eases back to baseline instead of snapping. */
      const ambientTarget =
        isInteractingRef.current || reducedMotionRef.current ? 0 : baselineAmbient;
      const ambientRate =
        ambientTarget > ambientSpeedRef.current ? AMBIENT_RAMP_UP : AMBIENT_RAMP_DOWN;
      ambientSpeedRef.current +=
        (ambientTarget - ambientSpeedRef.current) * ease(ambientRate, frames);
      if (Math.abs(ambientTarget - ambientSpeedRef.current) < 1e-4) {
        ambientSpeedRef.current = ambientTarget;
      }
      targetRotationRef.current += ambientSpeedRef.current * frames;

      /* 2 · Flick — release velocity feeds the same target, then decays. */
      if (Math.abs(flickRef.current) > 1e-3) {
        targetRotationRef.current += flickRef.current * frames;
        flickRef.current *= Math.pow(FLICK_FRICTION, frames);
      } else {
        flickRef.current = 0;
      }

      /* 3 · Inertial damping — current chases target, never snaps to it. */
      currentRotationRef.current +=
        (targetRotationRef.current - currentRotationRef.current) * ease(damping, frames);
      rotation.set(currentRotationRef.current);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [baselineAmbient, damping, inView, rotation]);

  useEffect(
    () => () => {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    },
    [],
  );

  /* --------------------------- Pointer --------------------------- */

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    beginInteraction();
    // A new grab cancels whatever the ring was still doing.
    flickRef.current = 0;
    velocityRef.current = 0;
    startXRef.current = e.clientX;
    startTargetRef.current = targetRotationRef.current;
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    if (stageRef.current) stageRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    beginInteraction();

    targetRotationRef.current =
      startTargetRef.current + (e.clientX - startXRef.current) * DRAG_SENSITIVITY;

    const now = performance.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) {
      const instant = ((e.clientX - lastXRef.current) / dt) * DRAG_SENSITIVITY; // deg/ms
      // Smoothed so a single jittery sample can't dominate the release flick.
      velocityRef.current = velocityRef.current * 0.7 + instant * 0.3;
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (stageRef.current) stageRef.current.style.cursor = 'grab';

    // Hand the release velocity to the flick term (deg/ms → deg per frame).
    flickRef.current = clamp(velocityRef.current * FRAME_MS, -MAX_FLICK_DEG, MAX_FLICK_DEG);
    velocityRef.current = 0;
    endInteraction();
  };

  /* ---------------------------- Wheel ---------------------------- */

  useEffect(() => {
    const el = stageRef.current;
    if (!el || wheelRotate === 'none') return;

    const onWheel = (e: WheelEvent) => {
      const { x, y } = normalizeWheel(e);
      const horizontal = Math.abs(x) > Math.abs(y);

      // Vertical wheel belongs to the page — never trap the user's scroll.
      if (wheelRotate === 'horizontal' && !horizontal) return;

      const raw = wheelRotate === 'horizontal' ? x : horizontal ? x : y;
      // Clamp one event so page-mode wheels (deltaMode 2 → a whole viewport)
      // can't fling the ring across the room in a single notch.
      const delta = clamp(raw, -MAX_WHEEL_STEP, MAX_WHEEL_STEP) * WHEEL_SENSITIVITY;

      e.preventDefault();
      beginInteraction();
      endInteractionAfter(WHEEL_IDLE_MS);
      flickRef.current = 0; // wheel input owns the target from here
      targetRotationRef.current += delta;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheelRotate]);

  /* -------------------------- Keyboard -------------------------- */

  const nudge = (dir: -1 | 1) => {
    const step = 360 / Math.max(items.length, 1);
    beginInteraction();
    targetRotationRef.current += dir * step;
    endInteractionAfter(WHEEL_IDLE_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudge(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudge(1);
    }
  };

  /* ---------------------------- Render ---------------------------- */

  const count = Math.max(items.length, 1);

  return (
    <section className={`section cg ${className}`.trim()} id={id}>
      <div className="shell">
        <header className="cg__head">
          <div className="cg__headtext">
            {eyebrow ? <span className="kicker">{eyebrow}</span> : null}
            {title ? (
              <h2 className="display cg__title" style={{ fontSize: 'var(--fs-h2)' }}>
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="cg__sub">{subtitle}</p> : null}
          </div>

          {badges.length > 0 ? (
            <ul className="cg__badges">
              {badges.map((b) => (
                <li
                  className="badge cg__badge"
                  key={b.label}
                  style={{ '--c': b.accent ?? 'var(--gold)' } as CSSProperties}
                >
                  <b>{b.count}</b>
                  {b.label}
                </li>
              ))}
            </ul>
          ) : null}
        </header>
      </div>

      <div
        ref={stageRef}
        className="cg-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={title || 'Circular gallery'}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          perspective: `${perspective}px`,
          height: stageHeight,
        }}
      >
        {/* Downscales the high-resolution ring to fit the stage. */}
        <div className="cg-scaler" style={{ transform: `scale(${galleryScale})` }}>
          <motion.div className="cg-ring" style={{ rotateY: rotation, z: -radius }}>
            {items.map((item, i) => (
              <Card
                key={`${item.code}-${i}-${item.title}`}
                item={item}
                index={i}
                total={count}
                radius={radius}
                rotation={rotation}
                borderRadius={borderRadius}
                cardW={cardSize.w}
                cardH={cardSize.h}
                showCredits={showCredits}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {hint ? (
        <div className="shell">
          <p className="cg__hint">
            <span className="cg__hint-keys" aria-hidden="true" />
            {hint}
          </p>
        </div>
      ) : null}
    </section>
  );
}
