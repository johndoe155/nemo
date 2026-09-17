/* ============================================================================
   MOTION / GHOST ARROW — extracted from the hero's PortalButton module.

   Custom SVG chevron. On hover it elongates while a second stroke draws in
   behind it: the single chevron "splits" into a dynamic double arrow. GSAP
   reverses the timeline on leave. Frozen under prefers-reduced-motion.
============================================================================ */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function GhostArrow({ open }: { open: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      tlRef.current = gsap
        .timeline({ paused: true })
        .to(
          '.pk-chev',
          { attr: { d: 'M1.5 3.5 L11.5 10 L1.5 16.5' }, duration: 0.4, ease: 'power3.inOut' },
          0,
        )
        .to(
          '.pk-chev-duo',
          { strokeDashoffset: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
          0.14,
        )
        .to(el, { x: 4, duration: 0.45, ease: 'power3.out' }, 0);
    }, el);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tl = tlRef.current;
    if (!tl) return;
    if (open) tl.play();
    else tl.reverse();
  }, [open]);

  return (
    <span className="pk-chev-slot" ref={ref} aria-hidden="true">
      <svg className="pk-chevron" viewBox="0 0 20 20" width="13" height="13" fill="none">
        <path
          className="pk-chev"
          d="M2.5 4.5 L10.5 10 L2.5 15.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="pk-chev-duo"
          d="M12 4.5 L19 10 L12 15.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="18"
          strokeDashoffset="18"
          opacity="0"
        />
      </svg>
    </span>
  );
}
