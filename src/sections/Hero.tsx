import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion';
import CardImage from '../components/CardImage';
import { Reveal } from '../components/ui';
import { LiquidButton, PortalMagnetic } from '../components/PortalButton';
import { settleHeroArt } from '../lib/heroArtGate';
import { art, UNIVERSE_DROP_ISO, visibleUniverses } from '../lib/data';
import { useCountdown } from '../lib/hooks';

const EASE = [0.16, 1, 0.3, 1] as const;

/* ============================================================================
   THE POSTER — hero, ONE TAKE.

   The film opens on its key art: the wanderer before the ring of portals,
   full-bleed. Five elements, no more: the title, one line of lede, one
   portal, a single data line, a hint. Everything else the old hero carried
   — the badge ticker, the ASCII sub-block, the telemetry row, the orbit
   rings, the ghost watermark, the progress bar, the particle field — is
   gone from the first impression. The particle field still exists in the
   codebase (its boot gate is released by App on mount, see heroArtGate).

   Depth is three planes:
     · the key art — slow Ken Burns + scroll parallax (it recedes and dims
       as the film moves on)
     · the vignette — cinematic edge darkening, the bottom fading into the
       void so the next act rises out of it
     · the type — bottom-left, the loudest thing in the frame, scattering
       on the first 40vh of scroll (GSAP scrub, unchanged authority split:
       framer owns the entrance, GSAP owns the exit)
============================================================================ */

/* Per-letter hover glitch for VERSIONS — carried over from the old hero,
   it is the one piece of play allowed in the title. */
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

const HERO_VIEWPORT = { once: true, amount: 0.3 } as const;

export default function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  /* Lenis owns scroll inertia (lib/scroll.ts) — the progress arrives
     continuous by construction, so it is consumed raw. */
  const smooth = scrollYProgress;

  /* Poster depth — the art breathes (Ken Burns 1.08 → 1.24 across the
     first viewport) and recedes (y drift + dim) while the type lifts out
     of it. Cursor nudge: a few px against the pointer, composed with the
     scroll drift in one calc() so the two authorities never fight. */
  const bgScale = useTransform(smooth, [0, 1], [1.08, 1.24]);
  const contentY = useTransform(smooth, [0, 1], [0, -140]);
  const contentOpacity = useTransform(smooth, [0, 0.55], [1, 0]);
  const artFade = useTransform(smooth, [0, 1], [1, 0.3]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const handleMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      mx.set((e.clientX / w - 0.5) * 2);
      my.set((e.clientY / h - 0.5) * 2);
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [mx, my]);

  const bgX = useTransform(mx, (v) => `${v * -10}px`);
  const bgY = useTransform([smooth, my], (latest) => {
    const [s, m] = latest as [number, number];
    return `calc(${s * 13}% + ${m * -8}px)`;
  });

  /* Scroll-bound exit: the title scatters — line 1 leaves left, line 2
     right, both rising, scrubbed across the first 40vh. GSAP writes the
     standalone `translate` properties so the framer entrance transforms
     are never touched. Reduced motion vetoes; the framer fade remains. */
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: ref.current,
          start: 'top top',
          end: '+=40vh',
          scrub: 0.6,
        },
      });
      tl.to('.hero__line--1', { translateX: '-12vw', translateY: '2.5vh', opacity: 0 }, 0).to(
        '.hero__line--2',
        { translateX: '12vw', translateY: '3vh', opacity: 0 },
        0,
      );
    }, el);
    return () => ctx.revert();
    // ref is the stable hero section container; it never swaps identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCountdown(UNIVERSE_DROP_ISO);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Staggered scroll entrance for one title line. */
  function titleEntrance(x: number, delay: number) {
    if (prefersReduced) {
      return { initial: { opacity: 1 }, whileInView: { opacity: 1 } };
    }
    return {
      initial: { opacity: 0, x },
      whileInView: { opacity: 1, x: 0 },
      transition: { duration: 1.15, delay, ease: EASE },
      viewport: HERO_VIEWPORT,
    };
  }

  const statusLine = t.done
    ? 'The Nemoverse is live. Universe U-007 is in the registry.'
    : `The Nemoverse is live. Next drop: U-007.`;

  return (
    <header className="hero hero--poster" ref={ref} id="top">
      {/* Plane 1 — the key art. */}
      <motion.div className="hero__bg" style={{ scale: bgScale, y: bgY, x: bgX, opacity: artFade }}>
        <CardImage
          src={art('hero.jpg')}
          alt="NEMO — the canon character, standing before the ring of universe portals"
          eager
          sizes="100vw"
          fetchpriority="high"
          onLoaded={() => settleHeroArt()}
        />
      </motion.div>

      {/* Plane 2 — the cinematic vignette. */}
      <div className="hero__vignette" aria-hidden="true" />

      {/* The one data line — the hero's only telemetry, top-right. */}
      <div className="hero__dataline" aria-hidden="true">
        <span>EST. 2026</span>
        <span>{visibleUniverses.length} UNIVERSES</span>
        <span className="hero__dataline-live">{t.done ? 'U-007 LIVE' : `NEXT DROP · D-${t.d}`}</span>
      </div>

      {/* Plane 3 — the type. */}
      <motion.div
        className="shell hero__content"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <h1
          className="display hero__title"
          aria-label="One canon. Infinite versions."
          ref={titleRef}
        >
          <motion.span className="hero__line hero__line--1" {...titleEntrance(-70, 0.15)}>
            <span className="hero__one">ONE </span>
            <span className="hero__grad hero__wide">CANON</span>
            <span className="hero__period">.</span>
          </motion.span>
          <motion.span className="hero__line hero__line--2" {...titleEntrance(70, 0.38)}>
            <span className="hero__hollow">INFINITE </span>
            <span className="hero__grad hero__wide hero__vers">
              <GlitchLetters word="VERSIONS" />
            </span>
            <span className="hero__period">.</span>
          </motion.span>
        </h1>

        <Reveal delay={0.55}>
          <p className="hero__lede">
            One character. {visibleUniverses.length} registered universes — each commissioned from a
            different artist, numbered, and minted as a limited run.
          </p>
        </Reveal>

        <Reveal delay={0.68}>
          <div className="hero__ctas">
            <PortalMagnetic>
              <LiquidButton href="#nemoverse" />
            </PortalMagnetic>
          </div>
        </Reveal>

        <Reveal delay={0.82}>
          <div className="hero__hint">
            <span className="arr">▼</span> CROSS THE THRESHOLD
          </div>
        </Reveal>

        {/* P0.4 — the live status is a separate, polite line; the visible
            data line is decoration (aria-hidden). */}
        <span className="vh" role="status">
          {statusLine}
        </span>
      </motion.div>
    </header>
  );
}
