import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

/* ---------------------------------------------------------------------------
   CrawlRise — P3.12 (DESIGN_AUDIT 2.4, "sign-off crawl").

   The credit crawl used to simply *be there* as you scrolled into it. This
   wraps it in a scrubbed reveal: a clip-path inset() that closes over the
   strip from above, plus a small translateY, so the credits physically
   RISE OUT OF THE VOID as the crawl crosses the lower viewport. The last
   frame holds pinned by the scrub itself — the crawl is fully revealed only
   when the section owns its spot.

   Mechanism per the audit: GSAP + ScrollTrigger (same vocabulary as the
   signoff-horizon rig), `scrub` against `clip-path: inset()` + transform.
   clip-path and transform are the exact two channels the P3 frame-budget
   rule blesses; reduced motion builds nothing and the CSS default (fully
   open) stays.
--------------------------------------------------------------------------- */

export default function CrawlRise({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: el,
            start: 'top 97%', // bottom edge kisses the viewport floor…
            end: 'top 58%', // …and the strip finishes rising just below mid
            scrub: 0.5,
          },
        })
        .from(el, { y: '42%', autoAlpha: 0.2, duration: 0.4 }, 0)
        .fromTo(
          el,
          { clipPath: 'inset(100% 0 0 0)' }, // closed from the top: only the floor line
          { clipPath: 'inset(0% 0 0 0)', duration: 1 }, // uncloses upward = rise
          0,
        );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="crawl-rise">
      {children}
    </div>
  );
}
