import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Marquee, toast } from '../components/ui';
import { KineticLink, MagneticButton, RollText } from '../components/motion';
import {
  ARTISTS,
  DROP_LABEL,
  FOOTER_NAV,
  SOCIALS,
  UNIVERSE_DROP_ISO,
  UNIVERSES,
} from '../lib/data';
import { LOGO_SRC } from '../lib/assets';
import { useCountdown } from '../lib/hooks';

gsap.registerPlugin(ScrollTrigger);

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* House pattern (Hero.tsx reads matchMedia the same way): stable, no first-
   pass flicker — every reveal below collapses to its finished state for
   reduced-motion visitors. */
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------------------
   THE SIGN-OFF — closing credits

   Beats:
     0 · curtain     — "END OF TRANSMISSION" end-card label + hairline that
                       draws itself in as the band enters (GSAP scrub)
     0b· crawl       — outlined credit crawl, slower + reversed vs. the
                       mid-page ticker, data-driven (counts + drop label)
     1 · anchor      — giant ghost watermark (BUG-1 fixed), two-line mask
                       title reveal, gold drop clock → "TRANSMISSION LIVE",
                       primary CTA (unchanged physics) + ghost replay link
     2 · credits     — asymmetric editorial grid: identity + UNIVERSE /
                       SYSTEMS / SIGNALS link groups, staggered entrance
     3 · ribbon      — legal bar + magnetic REWIND
   Easter egg: hold NEMO's star ≥ 1.2s — the persona signs off.
--------------------------------------------------------------------------- */

const CRAWL_ITEMS = [
  `${UNIVERSES.length} UNIVERSES REGISTERED`,
  `${ARTISTS.length} ARTISTS CREDITED FOREVER`,
  `NEXT DROP ${DROP_LABEL.toUpperCase()}`,
  'HOLDERS WALK IN FIRST',
  'EVERY MINT PULLS A PIECE',
  'ONE CANON · INFINITE VERSIONS',
  'NEMOVERSE PROTOCOL v0.1.0',
];

/* ------------------------------ Drop clock ------------------------------ */

function DropClock() {
  const t = useCountdown(UNIVERSE_DROP_ISO);
  const cells: Array<[string, string]> = [
    [t.d, 'days'],
    [t.h, 'hrs'],
    [t.m, 'min'],
    [t.s, 'sec'],
  ];

  if (t.done) {
    return (
      <div className="signoff__live" role="timer" aria-label="The next drop is live">
        <span className="signoff__live-dot" aria-hidden="true" />
        TRANSMISSION LIVE · U-007 IS HERE
      </div>
    );
  }

  return (
    <div className="signoff__clock">
      <span className="signoff__clock-label">NEXT DROP IN</span>
      <div className="countdown countdown--signoff" role="timer" aria-label="Countdown to next drop">
        {cells.map(([v, l]) => (
          <div className="countdown__cell" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  /* Scoped GSAP: the curtain hairline draws itself in; the anchor block
     drifts up slower than scroll while the ghost watermark sinks — two
     composited layers of real depth. All scrubbed, all killed on unmount,
     all inert under reduced motion (CSS owns the finished state there). */
  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        /* Curtain: the end-card label resolves as the band enters, and the
           hairline draws itself in beneath it. */
        gsap.fromTo(
          '.signoff__curtain-label',
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            ease: 'none',
            force3D: true,
            scrollTrigger: {
              trigger: '.signoff__curtain',
              start: 'top 96%',
              end: 'top 72%',
              scrub: 0.4,
            },
          },
        );
        gsap.fromTo(
          '.signoff__curtain-rule',
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            force3D: true,
            transformOrigin: '0% 50%',
            scrollTrigger: {
              trigger: '.signoff__curtain',
              start: 'top 92%',
              end: 'top 55%',
              scrub: 0.5,
            },
          },
        );

        const anchor = el.querySelector('.signoff__anchor');
        const watermark = el.querySelector('.signoff__watermark');
        if (anchor && watermark) {
          /* Watermark sinks slower than the anchor rises — the two layers
             cross-fade past each other as the anchor scrolls through. */
          gsap.fromTo(
            watermark,
            { yPercent: 16 },
            {
              yPercent: -8,
              ease: 'none',
              force3D: true,
              scrollTrigger: {
                trigger: anchor,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.8,
                invalidateOnRefresh: true,
              },
            },
          );
          gsap.fromTo(
            anchor,
            { yPercent: 5 },
            {
              yPercent: -9,
              ease: 'none',
              force3D: true,
              scrollTrigger: {
                trigger: anchor,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.8,
                invalidateOnRefresh: true,
              },
            },
          );
        }
      }, el);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <footer className="footer signoff" id="connect" ref={root}>
      {/* Beat 0 — the curtain */}
      <div className="signoff__curtain">
        <span className="signoff__curtain-label">
          <span className="signoff__dot" aria-hidden="true" />
          END OF TRANSMISSION
          <span className="signoff__dot" aria-hidden="true" />
        </span>
        <span className="signoff__curtain-rule" aria-hidden="true" />
      </div>

      {/* Beat 0b — closing-credit crawl */}
      <div className="signoff__crawl">
        <Marquee items={CRAWL_ITEMS} speed="110s" variant="credits" />
      </div>

      {/* Beat 1 — the anchor */}
      <div className="signoff__anchor">
        <span className="ghost-num ghost-num--huge signoff__watermark" aria-hidden="true">
          NEMO
        </span>

        <motion.p
          className="signoff__kicker"
          initial={prefersReduced ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: EASE_EXPO }}
        >
          <span className="signoff__dot" aria-hidden="true" />
          U-007 · THE LAST AURORA · {DROP_LABEL.toUpperCase()} · HOLDERS ENTER FIRST
        </motion.p>

        <h2 className="signoff__title">
          <span className="signoff__line">
            <motion.span
              className="signoff__line-in signoff__line-in--dim"
              initial={prefersReduced ? false : { y: '112%' }}
              whileInView={{ y: '0%' }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1.0, ease: EASE_EXPO }}
            >
              ENTER THE
            </motion.span>
          </span>
          <span className="signoff__line">
            <motion.span
              className="signoff__line-in signoff__title-main"
              initial={prefersReduced ? false : { y: '112%' }}
              whileInView={{ y: '0%' }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1.2, delay: 0.14, ease: EASE_EXPO }}
            >
              <span className="txt-grad chroma" data-text="NEMOVERSE.">
                NEMOVERSE.
              </span>
            </motion.span>
          </span>
        </h2>

        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: 0.55, ease: EASE_EXPO }}
        >
          <DropClock />
        </motion.div>

        <motion.div
          className="signoff__actions"
          initial={prefersReduced ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: 0.7, ease: EASE_EXPO }}
        >
          <KineticLink
            href="#nemoverse"
            className="btn btn-primary"
            cursor="ENTER"
            label="EXPLORE THE UNIVERSES"
            swap="ENTER THE VOID"
          />
          <KineticLink
            href="#top"
            className="btn btn-ghost signoff__replay"
            cursor="REPLAY"
            label="REPLAY THE LOOP"
            arrow
          />
        </motion.div>
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
