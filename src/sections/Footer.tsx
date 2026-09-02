import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Marquee, toast } from '../components/ui';
import { KineticLabel, MagneticButton, RollText } from '../components/motion';
import {
  ARTISTS,
  DROP_LABEL,
  FOOTER_NAV,
  SOCIALS,
  UNIVERSES,
} from '../lib/data';
import { LOGO_SRC } from '../lib/assets';

gsap.registerPlugin(ScrollTrigger);

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* House pattern (Hero.tsx reads matchMedia the same way): stable, no first-
   pass flicker — every reveal below collapses to its finished state for
   reduced-motion visitors. */
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
   THE SIGN-OFF — closing statement + global footer

   The anchor holds ONLY the stacked headline ("ENTER THE" / "NEMOVERSE.")
   and the single primary CTA — the approved minimal layout constraints.
   All elevation there is motion, driven strictly by GSAP:

     1 · Cinematic scroll reveal  — masked line translates, staggered,
                                    power4.out (ScrollTrigger)
     2 · Spatial parallax         — the headline drifts against the page at a
                                    different rate than scroll (scrubbed)
     3 · Magnetic button          — quickTo pull toward the cursor inside an
                                    approach field, elastic release
     4 · Living gradient ink      — the hero CANON/VERSIONS sweep on the
                                    NEMOVERSE. gradient (background-position)

   Below the anchor sits the global site footer: the closing-credit crawl,
   the credits grid (identity + UNIVERSE / SYSTEMS / SIGNALS link groups,
   staggered entrance) and the full-bleed legal ribbon with the magnetic
   REWIND control. Easter egg: hold NEMO's star ≥ 1.2s — the persona signs
   off.
   ========================================================================== */

/* --------------------------- Easter egg: star --------------------------- */
/* Press and hold NEMO's star for 1.2s — the persona has been teasing all
   page; this is where it pays off. Pure bonus: never blocks anything, so a
   plain release (or any other pointer) is a no-op. */

function StarEasterEgg() {
  const [holding, setHolding] = useState(false);
  const timer = useRef(0);

  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      toast('you made it to the end. i always knew you would.');
    }, 1200);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      className={`footer__brand ${holding ? 'is-holding' : ''}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      data-cursor="NEMO SEES YOU"
      role="img"
      aria-label="The Nemoverse logo — hold to hear from NEMO"
    >
      <img src={LOGO_SRC} alt="" width={48} height={48} loading="lazy" />
      <span>
        NEMO<b>VERSE</b>
      </span>
    </div>
  );
}

/* ------------------------------ REWIND ------------------------------ */

function RewindButton() {
  return (
    <MagneticButton
      className="signoff__rewind"
      preset="chrome"
      data-cursor="TOP"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}
    >
      <RollText text="REWIND" />
      <svg
        className="signoff__rewind-chev"
        viewBox="0 0 20 20"
        width="12"
        height="12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4.5 12.5 L10 4.5 L15.5 12.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </MagneticButton>
  );
}

/* ------------------------------ Footer ------------------------------ */

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

      {/* Beat 2 — closing credits */}
      <div className="shell signoff__credits">
        <motion.div
          className="signoff__identity"
          initial={prefersReduced ? false : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
          <StarEasterEgg />
          <p className="signoff__prose">
            A connected Web3 ecosystem anchored by the Nemoverse — for the character, the
            collectors, and the store. Built for <b>nemo</b> · pitched by Skippy Rizzo · July
            2026.
          </p>
          <p className="signoff__stats">
            {UNIVERSES.length} UNIVERSES REGISTERED · {ARTISTS.length} ARTISTS CREDITED · CHAIN:
            BASE / POLYGON
          </p>
        </motion.div>

        {FOOTER_NAV.map((group, gi) => (
          <motion.nav
            className="signoff__col"
            aria-label={group.label}
            key={group.label}
            initial={prefersReduced ? false : { opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.8, delay: 0.1 + gi * 0.08, ease: EASE_EXPO }}
          >
            <h4 className="signoff__col-label">
              <span className="signoff__col-num" aria-hidden="true">
                {String(gi + 1).padStart(2, '0')}
              </span>
              {group.label}
            </h4>
            {group.links.map((l) => (
              <a href={l.href} key={l.href}>
                <RollText text={l.label} />
              </a>
            ))}
          </motion.nav>
        ))}

        <motion.nav
          className="signoff__col"
          aria-label="SIGNALS"
          initial={prefersReduced ? false : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, delay: 0.34, ease: EASE_EXPO }}
        >
          <h4 className="signoff__col-label">
            <span className="signoff__col-num" aria-hidden="true">
              04
            </span>
            SIGNALS
          </h4>
          {SOCIALS.map((s) => (
            <a href={s.href} className="signoff__social" key={s.label}>
              <RollText text={s.label} />
              <span className="signoff__social-handle">{s.handle}</span>
            </a>
          ))}
        </motion.nav>
      </div>

      {/* Beat 3 — the ribbon (full-bleed: the hairline rule spans the viewport) */}
      <motion.div
        className="signoff__ribbon"
        initial={prefersReduced ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, delay: 0.25, ease: EASE_EXPO }}
      >
        <span>© 2026 THE NEMOVERSE · CONCEPT PITCH DEMO</span>
        <span>NEMOVERSE PROTOCOL v0.1.0</span>
        <span className="signoff__made">MADE IN THE VOID</span>
        <RewindButton />
      </motion.div>
    </footer>
  );
}
