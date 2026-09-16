import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { useQuality } from '../lib/ChapterProvider';

/* ============================================================================
   THE SHARED REVEAL GRAMMAR

   Before the overhaul every section invented its own entrance: some blurred,
   some slid, some scaled, some faded, several did two of those at once with
   different durations. The result read as "many animations" rather than as
   "one film".

   There are now exactly five moves in the vocabulary. Every section uses
   these and nothing else:

     RevealText   clip/reveal — type arrives from behind a mask with a blur
                  resolving into focus. The headline gesture.
     RevealLine   a masked tracking shift, uncovered from the baseline up.
                  For kickers, metadata and every small tracked line.
     RevealArt    crop expansion + light bloom — the plate opens from a
                  smaller crop and a single light sweeps across it.
     RevealMeta   delayed fade/slide — the last thing to arrive, always.
     RevealPlate  depth settle — cards and surfaces drop into their depth
                  plane rather than floating up out of nowhere.

   A chapter-level `at` offset lets a whole block be scored against one beat
   (0 = first, 1 = last) without hand-tuning a delay per child.

   `hold` keeps an element in its opening frame until the caller releases it —
   the hero uses it so its entrances are not spent behind the boot sequence.

   Reduced motion / low tier: everything resolves to its finished state — no
   blur, no travel, no clip. The composition is identical; only the time
   dimension is removed.
   ========================================================================== */

const EASE = [0.16, 1, 0.3, 1] as const;

interface BaseProps {
  children: ReactNode;
  /** Position in the block's beat, 0..1. */
  at?: number;
  /** Extra delay in seconds, added on top of the beat. */
  delay?: number;
  className?: string;
  as?: 'div' | 'span' | 'li' | 'p';
  /* HOLD — the entrance waits. The boot sequence covers the hero for several
     seconds, and a `whileInView` reveal that fires on mount would spend its
     whole gesture behind the loader and leave the hero already-composed when
     the page is finally handed over. Passing `hold` keeps the element in its
     opening frame until the caller releases it (Hero passes `!booted`). One
     prop, no second animation authority. */
  hold?: boolean;
}

const beat = (at = 0) => at * 0.42;

type Viewport = { once: boolean; margin: string };

/* ---- RevealText — the headline gesture ---------------------------------- */

export function RevealText({
  children,
  at = 0,
  delay = 0,
  className = '',
  as = 'div',
  hold,
}: BaseProps) {
  const reduce = useReducedMotion();
  const q = useQuality();
  const Tag = motion[as];

  if (reduce || !q.cinematicTransitions) {
    return <Tag className={`rv rv--text ${className}`}>{children}</Tag>;
  }

  return (
    <Tag
      className={`rv rv--text ${className}`}
      initial={{ opacity: 0, y: '0.42em', filter: 'blur(7px)' }}
      animate={hold ? { opacity: 0, y: '0.42em', filter: 'blur(7px)' } : undefined}
      whileInView={hold ? undefined : { opacity: 1, y: '0em', filter: 'blur(0px)' }}
      viewport={hold ? undefined : ({ once: true, margin: '-12% 0px -12% 0px' } as Viewport)}
      transition={
        hold
          ? { duration: 0 }
          : ({
              duration: 1.15,
              delay: beat(at) + delay,
              ease: EASE,
              filter: { duration: 0.85, delay: beat(at) + delay },
            } as const)
      }
    >
      {children}
    </Tag>
  );
}

/* ---- RevealLine — tracked metadata / kickers ---------------------------- */

/* NOTE — the "tracking shift" is a CLIP reveal, not an interpolation of
   `letter-spacing`. Two reasons: framer cannot interpolate between a literal
   and a var() (it produces garbage frames), and an inline letter-spacing
   would outlive the entrance and override each component's authored tracking.
   The element keeps its own tracking; the gesture is the line being uncovered
   from the baseline up. */
export function RevealLine({
  children,
  at = 0,
  delay = 0,
  className = '',
  as = 'div',
  hold,
}: BaseProps) {
  const reduce = useReducedMotion();
  const q = useQuality();
  const Tag = motion[as];

  if (reduce || !q.cinematicTransitions) {
    return <Tag className={`rv rv--line ${className}`}>{children}</Tag>;
  }

  return (
    <Tag
      className={`rv rv--line ${className}`}
      initial={{ opacity: 0, y: 12, clipPath: 'inset(0% 0% 100% 0%)' }}
      animate={hold ? { opacity: 0, y: 12, clipPath: 'inset(0% 0% 100% 0%)' } : undefined}
      whileInView={hold ? undefined : { opacity: 1, y: 0, clipPath: 'inset(-15% 0% 0% 0%)' }}
      viewport={hold ? undefined : ({ once: true, margin: '-10% 0px' } as Viewport)}
      transition={
        hold ? { duration: 0 } : ({ duration: 0.9, delay: beat(at) + delay, ease: EASE } as const)
      }
    >
      {children}
    </Tag>
  );
}

/* ---- RevealArt — crop expansion + light bloom --------------------------- */

export function RevealArt({
  children,
  at = 0,
  delay = 0,
  className = '',
  hold,
  /** Direction the crop opens from. */
  from = 'bottom',
}: BaseProps & { from?: 'bottom' | 'top' | 'left' | 'right' }) {
  const reduce = useReducedMotion();
  const q = useQuality();
  const origin = { bottom: '50% 100%', top: '50% 0%', left: '0% 50%', right: '100% 50%' }[from];

  if (reduce || !q.cinematicTransitions) {
    return <div className={`rv rv--art ${className}`}>{children}</div>;
  }

  return (
    <div className={`rv rv--art ${className}`}>
      <motion.div
        className="rv__art-inner"
        initial={{ clipPath: 'inset(22% 12% 22% 12%)', scale: 1.08, opacity: 0 }}
        animate={
          hold ? { clipPath: 'inset(22% 12% 22% 12%)', scale: 1.08, opacity: 0 } : undefined
        }
        whileInView={
          hold ? undefined : { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, opacity: 1 }
        }
        viewport={hold ? undefined : ({ once: true, margin: '-8% 0px' } as Viewport)}
        transition={
          hold
            ? { duration: 0 }
            : ({
                duration: 1.35,
                delay: beat(at) + delay,
                ease: EASE,
                clipPath: { duration: 1.5, delay: beat(at) + delay, ease: EASE },
              } as const)
        }
        style={{ transformOrigin: origin }}
      >
        {children}
      </motion.div>
      {/* The bloom: one sweep of light across the plate as it opens. */}
      <motion.span
        className="rv__art-bloom"
        aria-hidden="true"
        initial={{ opacity: 0.85, x: '-60%' }}
        animate={hold ? { opacity: 0.85, x: '-60%' } : undefined}
        whileInView={hold ? undefined : { opacity: 0, x: '60%' }}
        viewport={hold ? undefined : ({ once: true, margin: '-8% 0px' } as Viewport)}
        transition={
          hold
            ? { duration: 0 }
            : ({ duration: 1.5, delay: beat(at) + delay + 0.18, ease: EASE } as const)
        }
      />
    </div>
  );
}

/* ---- RevealMeta — always last ------------------------------------------- */

export function RevealMeta({
  children,
  at = 0,
  delay = 0,
  className = '',
  as = 'div',
  hold,
}: BaseProps) {
  const reduce = useReducedMotion();
  const q = useQuality();
  const Tag = motion[as];

  if (reduce || !q.cinematicTransitions) {
    return <Tag className={`rv rv--meta ${className}`}>{children}</Tag>;
  }

  return (
    <Tag
      className={`rv rv--meta ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={hold ? { opacity: 0, y: 10 } : undefined}
      whileInView={hold ? undefined : { opacity: 1, y: 0 }}
      viewport={hold ? undefined : ({ once: true, margin: '-6% 0px' } as Viewport)}
      transition={
        hold
          ? { duration: 0 }
          : ({ duration: 0.75, delay: beat(at) + delay + 0.24, ease: EASE } as const)
      }
    >
      {children}
    </Tag>
  );
}

/* ---- RevealPlate — cards settle into depth ------------------------------ */

export function RevealPlate({
  children,
  at = 0,
  delay = 0,
  className = '',
  hold,
  /** Vertical travel in px — negative settles from above (hanging). */
  y = 42,
}: BaseProps & { y?: number }) {
  const reduce = useReducedMotion();
  const q = useQuality();

  if (reduce || !q.cinematicTransitions) {
    return <div className={`rv rv--plate ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      className={`rv rv--plate ${className}`}
      initial={{ opacity: 0, y, scale: 0.975, rotateX: -3.5 }}
      animate={hold ? { opacity: 0, y, scale: 0.975, rotateX: -3.5 } : undefined}
      whileInView={hold ? undefined : { opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      viewport={hold ? undefined : ({ once: true, margin: '-10% 0px' } as Viewport)}
      transition={
        hold
          ? { duration: 0 }
          : ({
              duration: 1.05,
              delay: beat(at) + delay,
              ease: EASE,
              /* the settle is under-damped on purpose — surfaces have weight */
              scale: { type: 'spring', stiffness: 150, damping: 18, delay: beat(at) + delay },
            } as const)
      }
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   ChapterSeam — the scene-level transition between two chapters.

   Not a divider: a pressure change. An atmospheric band that reads as the
   archive exhaling and inhaling — light pulls out of the outgoing chapter's
   accent and resolves into the incoming one's. It is a CSS-variable-driven
   gradient (no filter, no blur, no layout), masked to fade in and out at both
   edges so it never reads as a rule.

   Under reduced motion and on low tiers it degrades to a hairline with the
   incoming chapter's accent — the beat survives, the movement does not.
--------------------------------------------------------------------------- */
export function ChapterSeam({
  from,
  to,
  label,
}: {
  from: string;
  to: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const q = useQuality();

  useEffect(() => {
    if (reduce || !q.cinematicTransitions) {
      ref.current?.setAttribute('data-lit', 'true');
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) el.dataset.lit = 'true';
      },
      { rootMargin: '-20% 0px -20% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce, q.cinematicTransitions]);

  return (
    <div
      className="seam"
      ref={ref}
      aria-hidden={label ? undefined : 'true'}
      style={{ '--seam-from': from, '--seam-to': to } as CSSProperties}
    >
      <span className="seam__band" />
      <span className="seam__line" />
      {label && (
        <span className="seam__label">
          <i aria-hidden="true" />
          {label}
        </span>
      )}
    </div>
  );
}
