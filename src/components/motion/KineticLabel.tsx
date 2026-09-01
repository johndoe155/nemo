/* ============================================================================
   MOTION / KINETIC LABEL — extracted from the hero's PortalButton module and
   promoted to a system primitive.

   Splits a label into per-character Y-mask wrappers and rolls the default
   label out / the swap label in on hover/focus with a GSAP timeline. Both
   layers share one grid cell so the button NEVER reflows; the resting width
   is the wider of the two labels, constant across states.

   SSR/AT contract: the --out layer is the accessible text; the --in layer is
   aria-hidden. Everything collapses to static text under reduced-motion.
============================================================================ */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_QUERY).matches;
}

function splitChars(text: string) {
  return text.split('').map((c, i) =>
    c === ' ' ? (
      <span key={i} className="pk-char pk-char--sp">
        {'\u00A0'}
      </span>
    ) : (
      <span key={i} className="pk-char">
        <span className="pk-char-in">{c}</span>
      </span>
    ),
  );
}

export function KineticLabel({
  label,
  swap,
  open,
}: {
  label: string;
  swap: string;
  open: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const reduced = useRef(prefersReduced()).current;

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      tlRef.current = gsap
        .timeline({ paused: true })
        /* default label rolls up and out, per char, with a slight rotation */
        .to(
          '.pk-layer--out .pk-char-in',
          {
            yPercent: -120,
            rotation: 7,
            opacity: 0,
            duration: 0.32,
            ease: 'power3.in',
            stagger: 0.02,
          },
          0,
        )
        /* swap label rolls in from below with a tilt, then snaps flat */
        .fromTo(
          '.pk-layer--in .pk-char-in',
          { yPercent: 120, rotation: -11, opacity: 0 },
          {
            yPercent: 0,
            rotation: 0,
            opacity: 1,
            duration: 0.52,
            ease: 'power4.out',
            stagger: 0.026,
          },
          0.05,
        );
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const tl = tlRef.current;
    if (!tl) return;
    if (open) tl.play();
    else tl.reverse();
  }, [open, reduced]);

  return (
    <span className="pk-stack" ref={ref}>
      <span className="pk-layer pk-layer--out">{splitChars(label)}</span>
      <span className="pk-layer pk-layer--in" aria-hidden="true">
        {splitChars(swap)}
      </span>
    </span>
  );
}
