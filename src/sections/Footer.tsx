import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from '../components/ui';
import { Magnetic, TextReveal } from '../components/motion';
import {
  ARTISTS,
  DROP_LABEL,
  FOOTER_NAV,
  SOCIALS,
  UNIVERSES,
} from '../lib/data';
import { LOGO_SRC } from '../lib/assets';

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------- Easter egg: star --------------------------- */
function StarkStarEasterEgg() {
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
      className={`stark-brand ${holding ? 'is-holding' : ''}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      data-cursor="HOLD TO TRANSMIT"
      role="button"
      tabIndex={0}
      aria-label="The Nemoverse logo — hold to hear from NEMO"
    >
      <div className="stark-brand__icon-wrap">
        <img src={LOGO_SRC} alt="" width={44} height={44} loading="lazy" />
        {holding && <div className="stark-brand__ring" />}
      </div>
      <div className="stark-brand__text">
        <span className="stark-brand__name">
          NEMO<b>VERSE</b>
        </span>
        <span className="stark-brand__meta">CANONICAL PROTOCOL · v0.1.0</span>
      </div>
    </div>
  );
}

/* ------------------------------ REWIND ------------------------------ */
function StarkRewindButton() {
  return (
    <Magnetic preset="chrome" radius={38} strength={0.28}>
      <button
        type="button"
        className="stark-rewind"
        data-cursor="TOP"
        aria-label="Back to top"
        title="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <TextReveal text="REWIND" className="stark-rewind__txt" />
        <svg
          className="stark-rewind__icon"
          viewBox="0 0 20 20"
          width="13"
          height="13"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4.5 12.5 L10 4.5 L15.5 12.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </Magnetic>
  );
}

/* --------------------------- Magnetic Social Link --------------------------- */
function MagneticSocialLink({ social }: { social: (typeof SOCIALS)[number] }) {
  return (
    <Magnetic preset="pill" radius={48} strength={0.34} max={12} className="stark-social-wrap">
      <a
        href={social.href}
        className="stark-social-link"
        data-cursor={social.label}
        target={social.href.startsWith('http') ? '_blank' : undefined}
        rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        <span className="stark-social-label">
          <TextReveal text={social.label} />
        </span>
        <span className="stark-social-meta">
          <span className="stark-social-handle">{social.handle}</span>
          <svg
            className="stark-social-arrow"
            viewBox="0 0 12 12"
            width="10"
            height="10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 9.5 L9.5 2.5 M4 2.5 L9.5 2.5 L9.5 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </a>
    </Magnetic>
  );
}

/* ---------------------- Massive Kinetic "NEMO" Lockup ---------------------- */
function KineticNemoLockup() {
  const letters = ['N', 'E', 'M', 'O'];

  return (
    <div className="stark-nemo" aria-label="NEMO">
      <div className="stark-nemo__track" aria-hidden="true">
        {letters.map((char, index) => (
          <motion.span
            key={index}
            className="stark-nemo__char"
            data-char={char}
            initial={prefersReduced ? false : { y: 60, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{
              duration: 0.9,
              delay: 0.15 + index * 0.08,
              ease: EASE_EXPO,
            }}
            whileHover={{
              y: -16,
              scale: 1.03,
              color: '#002FA7',
              transition: { type: 'spring', stiffness: 350, damping: 18 },
            }}
          >
            {char}
          </motion.span>
        ))}
      </div>
      <span className="vh">NEMO</span>
    </div>
  );
}

/* ============================================================================
   STARK INVERSE FOOTER (THE CURTAIN REVEAL BASE)
   
   Silent luxury brutalist aesthetic:
     · Fixed viewport base beneath the sliding dark canvas curtain
     · Textured off-white (#F4F4F5 Zinc / subtle pearl gradient)
     · Deep rich charcoal typography (#09090B)
     · Saturated ultramarine accents (#002FA7)
     · Asymmetrical CSS grid for site map (Universe, Systems, Signals)
     · Magnetic socials with overflow-hidden text reveals
     · Massive edge-to-edge kinetic typography lockup of "NEMO" at the base
   ========================================================================== */

export interface FooterProps {
  onHeightChange?: (height: number) => void;
}

export default function Footer({ onHeightChange }: FooterProps) {
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        document.documentElement.style.setProperty('--footer-curtain-height', `${h}px`);
        onHeightChange?.(h);
      }
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);

    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [onHeightChange]);

  return (
    <footer className="footer-curtain stark-footer" id="connect" ref={root}>
      <div className="stark-texture" aria-hidden="true" />

      {/* Editorial Masthead / Status Ticker */}
      <div className="stark-masthead">
        <div className="shell stark-masthead__inner">
          <div className="stark-masthead__item">
            <span className="stark-status-dot" />
            <span>LOC: TIMELINE ZERO // PROTOCOL v0.1.0</span>
          </div>
          <div className="stark-masthead__item stark-masthead__center">
            <span>ONE CANON · INFINITE VERSIONS</span>
          </div>
          <div className="stark-masthead__item stark-masthead__right">
            <span>NEXT DROP: <b>{DROP_LABEL}</b> · CHAIN: BASE / POLYGON</span>
          </div>
        </div>
      </div>

      {/* Top Half — Asymmetrical Site Map & Identity Grid */}
      <div className="shell stark-body">
        <div className="stark-grid">
          {/* Identity & Statement Column */}
          <motion.div
            className="stark-col stark-col--identity"
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.75, ease: EASE_EXPO }}
          >
            <StarkStarEasterEgg />
            <p className="stark-prose">
              A connected Web3 ecosystem anchored by the Nemoverse — one canon character
              manifesting across infinite artist timelines. Built for <b>nemo</b> · pitched by
              Skippy Rizzo · 2026.
            </p>
            <div className="stark-stats-badge">
              <span className="stark-badge-pill">{UNIVERSES.length} UNIVERSES</span>
              <span className="stark-badge-sep">/</span>
              <span className="stark-badge-pill">{ARTISTS.length} ARTISTS</span>
              <span className="stark-badge-sep">/</span>
              <span className="stark-badge-pill">BASE MAINNET</span>
            </div>
          </motion.div>

          {/* Nav Column 01: UNIVERSE */}
          <motion.nav
            className="stark-col stark-col--nav"
            aria-label="UNIVERSE"
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.75, delay: 0.1, ease: EASE_EXPO }}
          >
            <h4 className="stark-col__heading">
              <span className="stark-kicker-num">01</span>
              <span>UNIVERSE</span>
            </h4>
            <div className="stark-col__links">
              {FOOTER_NAV[0].links.map((l) => (
                <a href={l.href} className="stark-nav-link" key={l.href} data-cursor={l.label}>
                  <TextReveal text={l.label} />
                </a>
              ))}
            </div>
          </motion.nav>

          {/* Nav Column 02: SYSTEMS */}
          <motion.nav
            className="stark-col stark-col--nav"
            aria-label="SYSTEMS"
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.75, delay: 0.18, ease: EASE_EXPO }}
          >
            <h4 className="stark-col__heading">
              <span className="stark-kicker-num">02</span>
              <span>SYSTEMS</span>
            </h4>
            <div className="stark-col__links">
              {FOOTER_NAV[1].links.map((l) => (
                <a href={l.href} className="stark-nav-link" key={l.href} data-cursor={l.label}>
                  <TextReveal text={l.label} />
                </a>
              ))}
            </div>
          </motion.nav>

          {/* Nav Column 03: SIGNALS (Magnetic Socials) */}
          <motion.nav
            className="stark-col stark-col--signals"
            aria-label="SIGNALS"
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.75, delay: 0.26, ease: EASE_EXPO }}
          >
            <h4 className="stark-col__heading">
              <span className="stark-kicker-num">03</span>
              <span>SIGNALS</span>
            </h4>
            <div className="stark-signals-list">
              {SOCIALS.map((s) => (
                <MagneticSocialLink social={s} key={s.label} />
              ))}
            </div>
          </motion.nav>
        </div>

        {/* Sub-Ribbon / Legal & Controls */}
        <motion.div
          className="stark-ribbon"
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.65, delay: 0.3, ease: EASE_EXPO }}
        >
          <div className="stark-ribbon__meta">
            <span>© 2026 THE NEMOVERSE · CONCEPT PITCH DEMO</span>
            <span className="stark-ribbon__sep">·</span>
            <span>NEMOVERSE PROTOCOL v0.1.0</span>
            <span className="stark-ribbon__sep">·</span>
            <span className="stark-ribbon__void">MADE IN THE VOID</span>
          </div>
          <StarkRewindButton />
        </motion.div>
      </div>

      {/* Bottom Anchor — Massive Edge-to-Edge Kinetic Typography Lockup of "NEMO" */}
      <KineticNemoLockup />
    </footer>
  );
}
