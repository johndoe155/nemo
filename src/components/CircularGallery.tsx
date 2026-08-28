import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
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
   · Auto-spin idles when the section is off-screen and when
     `prefers-reduced-motion: reduce` is set.
   · Heading, subtitle, badge counts and hint copy are all props — no copy is
     hardcoded in the render path.
   ========================================================================== */

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
  /** Degrees added per frame while idle. 0 disables auto-spin. */
  autoSpinSpeed?: number;
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

const AUTO_SPIN_RESUME_DELAY = 1800;

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
  autoSpinSpeed = 0.038,
  wheelRotate = 'horizontal',
  hint = 'Drag · swipe · ← → to rotate',
  showCredits = true,
  stageHeight,
}: CircularGalleryProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  const rotation = useMotionValue(0);
  const springRotation = useSpring(rotation, { damping: 34, stiffness: 110, mass: 0.9 });

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startRotationRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const autoSpinRafRef = useRef<number | null>(null);
  const isAutoSpinPausedRef = useRef(false);
  const autoSpinResumeTimeoutRef = useRef<number | null>(null);
  const inViewRef = useRef(true);
  const reducedMotionRef = useRef(false);

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

  /* -------------------------- Momentum -------------------------- */

  const stopMomentum = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const pauseAutoSpin = (delay = AUTO_SPIN_RESUME_DELAY) => {
    isAutoSpinPausedRef.current = true;
    if (autoSpinResumeTimeoutRef.current) {
      clearTimeout(autoSpinResumeTimeoutRef.current);
    }
    autoSpinResumeTimeoutRef.current = window.setTimeout(() => {
      isAutoSpinPausedRef.current = false;
    }, delay) as unknown as number;
  };

  const startMomentum = () => {
    stopMomentum();
    let vel = velocityRef.current;
    if (Math.abs(vel) < 0.005) {
      pauseAutoSpin(AUTO_SPIN_RESUME_DELAY);
      return;
    }
    const friction = 0.96;
    const animate = () => {
      vel *= friction;
      if (Math.abs(vel) < 0.008) {
        stopMomentum();
        pauseAutoSpin(AUTO_SPIN_RESUME_DELAY);
        return;
      }
      rotation.set(rotation.get() + vel * 16.666);
      velocityRef.current = vel;
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  /* -------------------------- Auto-spin -------------------------- */

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedMotionRef.current = mq.matches;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Idle the rAF loop whenever the rotunda is scrolled out of view.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]) inViewRef.current = entries[0].isIntersecting;
      },
      { rootMargin: '15% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (autoSpinSpeed <= 0) return;
    const animate = () => {
      if (
        !isDraggingRef.current &&
        !isAutoSpinPausedRef.current &&
        !reducedMotionRef.current &&
        inViewRef.current
      ) {
        rotation.set(rotation.get() + autoSpinSpeed);
      }
      autoSpinRafRef.current = requestAnimationFrame(animate);
    };
    autoSpinRafRef.current = requestAnimationFrame(animate);
    return () => {
      if (autoSpinRafRef.current) cancelAnimationFrame(autoSpinRafRef.current);
      autoSpinRafRef.current = null;
      if (autoSpinResumeTimeoutRef.current) {
        clearTimeout(autoSpinResumeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpinSpeed, rotation]);

  /* --------------------------- Pointer --------------------------- */

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    isAutoSpinPausedRef.current = true;
    if (autoSpinResumeTimeoutRef.current) {
      clearTimeout(autoSpinResumeTimeoutRef.current);
    }
    startXRef.current = e.clientX;
    startRotationRef.current = rotation.get();
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    stopMomentum();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    if (stageRef.current) stageRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const sensitivity = 0.32;
    rotation.set(startRotationRef.current + (e.clientX - startXRef.current) * sensitivity);

    const now = performance.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) {
      velocityRef.current = ((e.clientX - lastXRef.current) / dt) * sensitivity;
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
    startMomentum();
  };

  /* ---------------------------- Wheel ---------------------------- */

  useEffect(() => {
    const el = stageRef.current;
    if (!el || wheelRotate === 'none') return;

    let wheelRaf: number | null = null;
    let wheelVelocity = 0;
    let wheelIdleTimeout: number | null = null;

    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX);
      const dy = Math.abs(e.deltaY);

      // Vertical wheel belongs to the page — never trap the user's scroll.
      if (wheelRotate === 'horizontal' && dx <= dy) return;

      let delta = wheelRotate === 'horizontal' ? e.deltaX : dx > dy ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 80;

      e.preventDefault();
      isAutoSpinPausedRef.current = true;
      stopMomentum();
      if (wheelRaf) cancelAnimationFrame(wheelRaf);
      if (wheelIdleTimeout) clearTimeout(wheelIdleTimeout);

      delta *= 0.22;
      wheelVelocity = delta * 0.09;
      rotation.set(rotation.get() + delta);

      const decay = () => {
        wheelVelocity *= 0.92;
        if (Math.abs(wheelVelocity) < 0.01) {
          wheelRaf = null;
          wheelIdleTimeout = window.setTimeout(() => {
            isAutoSpinPausedRef.current = false;
          }, AUTO_SPIN_RESUME_DELAY) as unknown as number;
          return;
        }
        rotation.set(rotation.get() + wheelVelocity * 16.666);
        wheelRaf = requestAnimationFrame(decay);
      };

      wheelIdleTimeout = window.setTimeout(() => {
        wheelRaf = requestAnimationFrame(decay);
      }, 80) as unknown as number;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelRaf) cancelAnimationFrame(wheelRaf);
      if (wheelIdleTimeout) clearTimeout(wheelIdleTimeout);
      stopMomentum();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotation, wheelRotate]);

  useEffect(() => stopMomentum, []);

  /* -------------------------- Keyboard -------------------------- */

  const nudge = (dir: -1 | 1) => {
    const step = 360 / Math.max(items.length, 1);
    stopMomentum();
    pauseAutoSpin(AUTO_SPIN_RESUME_DELAY);
    rotation.set(rotation.get() + dir * step);
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
          <motion.div className="cg-ring" style={{ rotateY: springRotation, z: -radius }}>
            {items.map((item, i) => (
              <Card
                key={`${item.code}-${i}-${item.title}`}
                item={item}
                index={i}
                total={count}
                radius={radius}
                rotation={springRotation}
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
