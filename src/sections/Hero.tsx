import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion, useScroll, useTransform } from 'framer-motion';

import { LiquidButton } from '../components/PortalButton';
import { PortalMagnetic } from '../components/PortalButton';
import { RevealLine, RevealMeta, RevealText } from '../components/reveal';
import NemoParticleField from '../components/NemoParticleField';
import { useBootState, useQuality } from '../lib/ChapterProvider';
import { DROP_LABEL, UNIVERSES, UNIVERSE_DROP_ISO, visibleUniverses } from '../lib/data';
import { useCountdown } from '../lib/hooks';

/* ============================================================================
   02 · ENCOUNTER

   The hero was a dashboard: ticker, sub-block, lede, two CTAs, scroll hint,
   telemetry column, watermark, countdown badge and a progress bar — all
   visible at once, all at similar weight.

   It is now a composition with ONE focal point. The art field is the
   gravitational centre and owns the frame; the title is asymmetric and leans
   off the art's centre; there is one primary action (a portal aperture, not a
   button) and one secondary invitation. Telemetry survives at the right edge,
   revealed on approach — an instrument the visitor discovers rather than a
   readout that is always on.

   Choreography:
     · the title arrives as if PULLED FROM THE CENTRE of the image — it starts
       inside the art's mass and settles outward, while the art itself drifts
       in on a separate, slower clock (counter-motion)
     · the particle field reacts to SCROLL VELOCITY (--scroll-vel, written by
       VelocityFX) instead of running at a constant intensity
     · on exit the whole plate shears and folds into the archive rather than
       simply fading — the hero is consumed, not left behind
========================================================================== */

const totalSupply = UNIVERSES.reduce((s, u) => s + u.supply, 0);
const totalMinted = UNIVERSES.reduce((s, u) => s + u.minted, 0);

/** Per-letter glyph, kept from the original hero (the gradient must paint
    through one text mask, so the spans stay inline). */
function GlitchLetters({ word }: { word: string }) {
  return (
    <>
      {word.split('').map((ch, i) => (
        <span className="hero__char" data-text={ch} key={`${ch}-${i}`}>
          {ch}
        </span>
      ))}
    </>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const plateRef = useRef<HTMLDivElement | null>(null);
  const quality = useQuality();
  const { booted } = useBootState();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const t = useCountdown(UNIVERSE_DROP_ISO);

  /* ---- The fold ------------------------------------------------------------
     One scrubbed tween writes ONE custom property (--enc-fold) that the CSS
     uses for the shear, the lift, the light collapse and the art's
     desaturation. GSAP owns the timeline; CSS owns every visual consequence.
     Two authorities would fight — this way there is one writer. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!quality.cinematicTransitions) return;

    const ctx = gsap.context(() => {
      const holder = { v: 0 };
      const write = () => el.style.setProperty('--enc-fold', holder.v.toFixed(4));
      gsap.to(holder, {
        v: 1,
        ease: 'none',
        onUpdate: write,
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom 42%',
          scrub: 0.6,
        },
      });
    });
    return () => {
      ctx.revert();
      el.style.removeProperty('--enc-fold');
    };
  }, [quality.cinematicTransitions]);

  /* ---- Counter-motion ------------------------------------------------------
     Art and typography move at different rates. The art lags and scales; the
     plate leads and lifts. Both read --enc-fold / scrollYProgress, so there
     is still only one source per channel. */
  const artY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const artScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.24]);
  const plateY = useTransform(scrollYProgress, [0, 1], [0, -70]);

  /* ---- Pull-from-centre entrance ------------------------------------------
     The art starts TIGHT and settles out; the title starts WIDE (inside the
     art's mass) and settles in. They cross, which is what makes the title
     read as being pulled out of the image rather than laid over it. */

  const statusLine = t.done
    ? 'THE NEMOVERSE IS LIVE · U-007 IS IN THE REGISTRY'
    : `EST. 2026 · THE NEMOVERSE IS LIVE · U-007 DROPS IN ${t.d}D ${t.h}H`;

  return (
    <header className={`hero enc${booted ? ' is-live' : ''}`} ref={ref} id="top">
      {/* The gravitational centre. Everything else in the hero orbits it. */}
      {/* TRANSFORM AUTHORITY: framer owns this element's transform (the
          scroll parallax y + scale). The entrance is therefore a CSS
          animation on opacity + filter, and the velocity/fold response lives
          on the field's own wrapper — three channels, three owners, no
          property written twice. */}
      <motion.div className="hero__bg" style={{ y: artY, scale: artScale }}>
        <NemoParticleField hostRef={ref} />
      </motion.div>

      {/* The residue of the boot: the hero's first light source, and its only
          continuous light. One column, not a wash. */}
      <div className="enc__light" aria-hidden="true" />
      <div className="hero__wash" aria-hidden="true" />
      <div className="hero__scanlines" aria-hidden="true" />

      {/* .enc__lift is a transform-authority boundary: framer owns
          `.enc__plate`'s y, CSS owns the fold's shear/lift on the wrapper, so
          the two never write the same property. */}
      <motion.div className="enc__lift" style={{ y: plateY }}>
      <div className="shell enc__plate" ref={plateRef}>
        {/* The archive marking — one printed line. Replaces the old
            permanently-scrolling ticker as the hero's first read. */}
        <RevealLine className="enc__mark" at={0} hold={!booted}>
          <span className="enc__mark-dot" aria-hidden="true" />
          LIVING ARCHIVE · CANON REGISTRY
        </RevealLine>

        {/* The telemetry — relocated to the edge, revealed on approach. */}
        <div className="enc__meta" aria-hidden="true">
          <span className="enc__meta-row">
            REGISTERED <b>{UNIVERSES.length}</b>
          </span>
          <span className="enc__meta-row">
            SUPPLY <b>{totalSupply}</b>
          </span>
          <span className="enc__meta-row">
            MINTED <b>{totalMinted}</b>
          </span>
          <span className="enc__meta-row">
            NEXT <b>{t.done ? 'LIVE' : `D-${t.d}`}</b>
          </span>
        </div>

        {/* The title. Asymmetric, and it arrives from inside the art. */}
        <h1 className="display hero__title enc__title" aria-label="One canon. Infinite versions.">
          <RevealText as="span" at={0.12} className="hero__line hero__line--1" hold={!booted}>
            <span className="hero__one">ONE</span>{' '}
            <span className="hero__glow">
              <span className="hero__wide hero__grad">CANON</span>
            </span>
            <span className="hero__period">.</span>
          </RevealText>

          <RevealText as="span" at={0.34} className="hero__line hero__line--2" hold={!booted}>
            <span className="hero__hollow">INFINITE</span>
          </RevealText>

          <RevealText as="span" at={0.52} className="hero__line hero__line--3" hold={!booted}>
            <span className="hero__glow">
              <span className="hero__wide hero__grad hero__vers">
                <GlitchLetters word="VERSIONS" />
              </span>
            </span>
            <span className="hero__period">.</span>
          </RevealText>
        </h1>

        <RevealText at={0.7} className="enc__lede" hold={!booted}>
          One character. <em>{visibleUniverses.length} registered universes</em> — each
          commissioned from a different artist, numbered, canonized, and minted as a limited
          run. Holders enter new universes first.
        </RevealText>

        {/* One portal aperture. One invitation. Nothing else. */}
        <RevealMeta at={0.86} className="enc__act" hold={!booted}>
          <PortalMagnetic>
            <span className="aperture">
              <LiquidButton href="#nemoverse" />
            </span>
          </PortalMagnetic>
          <a className="enc__invite" href="#persona">
            MEET THE VOICE BEHIND IT <i aria-hidden="true">→</i>
          </a>
        </RevealMeta>
      </div>
      </motion.div>

      {/* The colophon — printed on the baseline of the frame, in the
          archive's own voice. Replaces the old animated scroll hint and the
          hero progress bar. */}
      <div className="enc__colophon" aria-hidden="true">
        <span>
          <em>{statusLine}</em>
        </span>
        <span className="enc__rule" />
        <span>SCROLL TO OPEN THE ARCHIVE</span>
      </div>

      {/* The status announcement is real content, so it stays in the
          accessibility tree — but it is ONE polite sentence that changes only
          when the situation changes, not a live region re-announcing a
          countdown every second. */}
      <span className="vh" role="status">
        {t.done
          ? 'The Nemoverse is live. Universe U-007 is in the registry.'
          : `The Nemoverse is live. Next drop: U-007, ${DROP_LABEL}.`}
      </span>
      {t.done && <span className="vh" role="alert">U-007 drop is live now.</span>}
    </header>
  );
}
