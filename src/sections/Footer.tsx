import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Marquee } from '../components/ui';
import { KineticLabel } from '../components/motion';
import { ARTISTS, DROP_LABEL, UNIVERSES } from '../lib/data';

gsap.registerPlugin(ScrollTrigger);

const CRAWL_ITEMS = [
  `${UNIVERSES.length} UNIVERSES REGISTERED`,
  `${ARTISTS.length} ARTISTS CREDITED FOREVER`,
  `NEXT DROP ${DROP_LABEL}`,
  'HOLDERS WALK IN FIRST',
  'EVERY MINT PULLS A PIECE',
  'ONE CANON · INFINITE VERSIONS',
  'NEMOVERSE PROTOCOL v0.1.0',
];

/* The same open/close state machine the Kinetic CTA barrel uses — drives the
   KineticLabel roll swap on hover AND keyboard focus. */
function useOpen() {
  const [open, setOpen] = useState(false);
  return {
    open,
    bind: {
      onPointerEnter: () => setOpen(true),
      onPointerLeave: () => setOpen(false),
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
    },
  };
}

/* ============================================================================
   THE SIGN-OFF — minimal closing statement

   DOM contract (strict): the anchor holds ONLY the stacked headline
   ("ENTER THE" / "NEMOVERSE.") and the single primary CTA. All elevation is
   motion, driven strictly by GSAP:

     1 · Cinematic scroll reveal  — masked line translates, staggered,
                                    power4.out (ScrollTrigger)
     2 · Spatial parallax         — the headline drifts against the page at a
                                    different rate than scroll (scrubbed)
     3 · Magnetic button          — quickTo pull toward the cursor inside an
                                    approach field, elastic release
     4 · Living gradient ink      — the hero CANON/VERSIONS sweep on the
                                    NEMOVERSE. gradient (background-position)

   The static styling of the headline and the button (classes, type, colors,
   gradients) is untouched. Hover/focus effects on NEMOVERSE. (txt-grad
   reveal + chroma aberration) are CSS and stay active as before.
   ========================================================================== */

export default function Footer() {
  const root = useRef<HTMLElement | null>(null);
  const cta = useRef<HTMLAnchorElement | null>(null);
  const { open, bind } = useOpen();

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    /* Reduced motion: no tweens are created — the approved static styling
       (headline + button, already in their final positions) is the state. */
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        /* 1 · Cinematic scroll reveal — masked translates, staggered.
           The actions are pre-set to their from-state so nothing flashes
           visible while the headline is still masked. */
        gsap.set('.signoff__actions', { autoAlpha: 0, y: 28 });
        gsap
          .timeline({
            defaults: { ease: 'power4.out' },
            scrollTrigger: {
              trigger: '.signoff__anchor',
              start: 'top 80%',
              once: true,
            },
          })
          .fromTo(
            '.signoff__line-in',
            { yPercent: 120 },
            { yPercent: 0, duration: 1.3, stagger: 0.14 },
          )
          .to('.signoff__actions', { y: 0, autoAlpha: 1, duration: 1.0, ease: 'power3.out' }, '-=0.6');

        /* 2 · Spatial parallax — the headline moves at a slightly different
           rate than the scrolling background: deep physical space. */
        gsap.fromTo(
          '.signoff__title',
          { yPercent: 6 },
          {
            yPercent: -6,
            ease: 'none',
            force3D: true,
            scrollTrigger: {
              trigger: '.signoff__anchor',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
          },
        );

        /* 4 · Living gradient ink on NEMOVERSE — the same background-position
           sweep the hero uses on CANON / VERSIONS, clipped to the glyphs. */
        const ink = el.querySelector('.signoff__title-main .txt-grad');
        if (ink) {
          gsap.fromTo(
            ink,
            { backgroundPosition: '0% 50%', backgroundSize: '200% 200%' },
            {
              backgroundPosition: '100% 50%',
              duration: 4.5,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: -1,
            },
          );
        }
      }, el);

      /* 3 · Magnetic button — GSAP quickTo physics. The button is pulled
         toward the cursor while it is inside an approach field and springs
         back with an elastic bounce on release. */
      const btn = cta.current;
      if (btn && window.matchMedia('(pointer: fine)').matches) {
        const xTo = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3.out' });
        const yTo = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3.out' });
        let active = false;

        /* While magnetism is engaged GSAP owns `transform`; the stylesheet's
           transform transition would low-pass filter quickTo into mush. It is
           only suppressed during engagement, so the approved CSS hover lift
           keeps its easing when the cursor is far away. */
        const engage = () => {
          btn.style.transition =
            'filter 0.35s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s cubic-bezier(0.16, 1, 0.3, 1), color 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        };
        const release = () => {
          if (!active) return;
          active = false;
          gsap.to(btn, {
            x: 0,
            y: 0,
            duration: 0.9,
            ease: 'elastic.out(1, 0.45)',
            clearProps: 'transform',
            onComplete: () => {
              btn.style.transition = '';
            },
          });
        };

        const onMove = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = e.clientX - cx;
          const dy = e.clientY - cy;
          const dist = Math.hypot(dx, dy);
          const radius = Math.max(r.width, r.height) * 1.75 + 60;

          if (dist > radius) {
            release();
            return;
          }
          if (!active) {
            active = true;
            engage();
            gsap.killTweensOf(btn, 'x,y');
          }
          const falloff = 1 - dist / radius;
          const pull = falloff * falloff;
          xTo(gsap.utils.clamp(-18, 18, dx * 0.25 * pull));
          yTo(gsap.utils.clamp(-18, 18, dy * 0.25 * pull));
        };

        /* Tactile press — replaces the .btn:active CSS squash, which an
           inline GSAP transform would otherwise suppress. */
        const onDown = () => {
          gsap.to(btn, { scale: 0.96, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 });
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('blur', release);
        document.documentElement.addEventListener('pointerleave', release);
        btn.addEventListener('pointerdown', onDown);

        return () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('blur', release);
          document.documentElement.removeEventListener('pointerleave', release);
          btn.removeEventListener('pointerdown', onDown);
          btn.style.transition = '';
          ctx.revert();
        };
      }

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <footer className="footer signoff" id="connect" ref={root}>
      {/* Closing-credit crawl (retained) */}
      <div className="signoff__crawl">
        <Marquee items={CRAWL_ITEMS} speed="110s" variant="credits" />
      </div>

      {/* The anchor — stacked headline + single primary CTA */}
      <div className="signoff__anchor">
        <h2 className="signoff__title">
          <span className="signoff__line">
            <span className="signoff__line-in signoff__line-in--dim">ENTER THE</span>
          </span>
          <span className="signoff__line">
            <span className="signoff__line-in signoff__title-main">
              <span className="txt-grad chroma" data-text="NEMOVERSE.">
                NEMOVERSE.
              </span>
            </span>
          </span>
        </h2>

        <div className="signoff__actions">
          <a ref={cta} href="#nemoverse" className="btn btn-primary" data-cursor="ENTER" {...bind}>
            <span className="btn-spark" aria-hidden="true" />
            <KineticLabel label="EXPLORE THE UNIVERSES" swap="ENTER THE VOID" open={open} />
          </a>
        </div>
      </div>
    </footer>
  );
}
