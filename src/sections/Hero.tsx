import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { Reveal } from '../components/ui';
import { LiquidButton, GlassButton, PortalMagnetic } from '../components/PortalButton';
import { art, UNIVERSES, UNIVERSE_DROP_ISO } from '../lib/data';
import { useCountdown } from '../lib/hooks';

const EASE = [0.16, 1, 0.3, 1] as const;

/* Scroll-bound entrance for the three hero title lines (ONE CANON. / INFINITE /
   VERSIONS.): Line 1 slides in from the left, Line 2 fades/scales in, Line 3
   enters from the right. Fires once as the hero scrolls into view — since it's
   the first section, that happens on load. */
const HERO_VIEWPORT = { once: true, amount: 0.3 } as const;

const totalSupply = UNIVERSES.reduce((s, u) => s + u.supply, 0);
const totalMinted = UNIVERSES.reduce((s, u) => s + u.minted, 0);

/* Geometric ASCII separator — dual-frequency interference + sliding window.
   Run lengths continuously morph (e.g. --==++==-- ↔ +=----===+) while the
   window scrolls horizontally. Fixed output width keeps the flex row stable. */
const GEOM_GLYPHS = ['-', '=', '+', '=', '-'] as const;
const GEOM_WIDTH = 14;

function buildGeomPattern(t: number): string {
  let buf = '';
  for (let i = 0; i < GEOM_GLYPHS.length; i++) {
    const n = 1 + Math.round(2 + 1.85 * Math.sin(t * 0.95 + i * ((Math.PI * 2) / GEOM_GLYPHS.length)));
    buf += GEOM_GLYPHS[i].repeat(Math.max(1, n));
  }
  // Secondary high-frequency ripple occasionally inserts a + so the sequence
  // doesn't stay a perfect palindrome — closer to +=----===+ style frames.
  if (Math.sin(t * 1.7) > 0.55) {
    buf = '+' + buf.slice(1, -1) + '+';
  }
  const len = buf.length || 1;
  const shift = ((Math.floor(t * 8) % len) + len) % len;
  return (buf + buf).slice(shift, shift + GEOM_WIDTH);
}

function GeomSep({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = '--==++==--';
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      el.textContent = buildGeomPattern((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <span className="hero__sub-sep" aria-hidden="true" ref={ref}>
      --==++==--
    </span>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 20, mass: 0.4 });

  const bgScale = useTransform(smooth, [0, 1], [1.12, 1.3]);
  const contentY = useTransform(smooth, [0, 1], [0, -90]);
  const contentOpacity = useTransform(smooth, [0, 0.72], [1, 0]);
  const orbitY = useTransform(smooth, [0, 1], [0, -160]);
  const progressScale = useTransform(smooth, [0, 1], [0, 1]);

  const t = useCountdown(UNIVERSE_DROP_ISO);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const [marqueePaused, setMarqueePaused] = useState(false);

  useEffect(() => {
    if (prefersReduced || typeof window === 'undefined') return;
    const handleMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      const x = (e.clientX / w - 0.5) * 2; // -1..1
      const y = (e.clientY / h - 0.5) * 2;
      mx.set(x);
      my.set(y);
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [prefersReduced, mx, my]);

  /* Background image drifts down on scroll and nudges a few px opposite the
     cursor for a subtle tilt. Both effects share the same x/y transform, so
     they're combined into one motion value each rather than two style keys. */
  const bgX = useTransform(mx, (v) => `${v * -12}px`);
  const bgY = useTransform([smooth, my], (latest) => {
    const [s, m] = latest as [number, number];
    return `calc(${s * 18}% + ${m * -12}px)`;
  });

  /* Staggered scroll entrance for one title line.
     - x:      travel distance (negative = from the left, positive = from the right)
     - scale:  1 = plain fade-slide, <1 = fade + scale-in (used by INFINITE)
     - delay:  cascades Line 1 -> Line 2 -> Line 3 */
  function titleEntrance(x: number, scale: number, delay: number) {
    if (prefersReduced) {
      return { initial: { opacity: 1 }, whileInView: { opacity: 1 } };
    }
    return {
      initial: { opacity: 0, x, scale },
      whileInView: { opacity: 1, x: 0, scale: 1 },
      transition: { duration: 1.05, delay, ease: EASE },
      viewport: HERO_VIEWPORT,
    };
  }

  const statusLine = t.done
    ? 'THE NEMOVERSE IS LIVE · U-007 IS IN THE REGISTRY'
    : `EST. 2026 · THE NEMOVERSE IS LIVE · U-007 DROPS IN ${t.d}D ${t.h}H`;
  const ticker = `${statusLine}   ·   `;

  return (
    <header className="hero" ref={ref} id="top">
      <motion.div
        className="hero__bg"
        style={{ scale: bgScale, y: bgY, x: bgX }}
      >
        <img src={art('hero.jpg')} alt="" />
      </motion.div>
      <div className="hero__wash" />
      <div className="hero__scanlines" />
      <div className="hero__watermark ghost-num ghost-num--huge" aria-hidden="true">NEMO</div>

      <motion.div className="hero__orbit orbit spin" style={{ width: 620, height: 620, right: '-8%', top: '-12%', y: orbitY }} />
      <motion.div className="hero__orbit orbit spin-rev" style={{ width: 420, height: 420, right: '6%', top: '4%', y: orbitY }} />

      <motion.div
        className="hero__telemetry"
        style={{ y: orbitY, opacity: contentOpacity }}
        aria-hidden="true"
      >
        <span>UNIVERSE REGISTRY</span>
        <span>
          REGISTERED <b>{UNIVERSES.length}</b>
        </span>
        <span>
          SUPPLY <b>{totalSupply}</b>
        </span>
        <span>
          MINTED <b>{totalMinted}</b>
        </span>
        <span>
          NEXT <b>{t.done ? 'LIVE' : `D-${t.d}`}</b>
        </span>
      </motion.div>

      <motion.div className="shell hero__content" style={{ y: contentY, opacity: contentOpacity }}>
        <Reveal delay={0.05}>
          <span
            className={`hero__badge hero__marquee${t.done ? ' live-pill' : ''}${marqueePaused ? ' is-paused' : ''}`}
            role="status"
            aria-live="polite"
            aria-label={statusLine}
            tabIndex={0}
            onPointerDown={() => setMarqueePaused(true)}
            onPointerUp={() => setMarqueePaused(false)}
            onPointerLeave={() => setMarqueePaused(false)}
            onPointerCancel={() => setMarqueePaused(false)}
          >
            <span className="pulse-dot" />
            <span className="hero__marquee-viewport">
              <span className="hero__marquee-track">
                <span className="hero__marquee-copy">{ticker}</span>
                <span className="hero__marquee-copy" aria-hidden="true">
                  {ticker}
                </span>
              </span>
            </span>
          </span>
        </Reveal>

        <h1 className="display hero__title" aria-label="One canon. Infinite versions.">
          {/* Line 1 — solid ONE + extended gradient CANON + pulsing dot */}
          <motion.span
            className="hero__line hero__line--1"
            {...titleEntrance(-90, 1, 0.15)}
          >
            <span className="hero__one">ONE</span>{' '}
            <span className="hero__wide hero__grad">CANON</span>
            <span className="hero__dot" aria-hidden="true" />
          </motion.span>

          {/* Line 2 — hollow, white-outlined INFINITE */}
          <motion.span
            className="hero__line hero__line--2"
            {...titleEntrance(0, 0.82, 0.4)}
          >
            <span className="hero__hollow">INFINITE</span>
          </motion.span>

          {/* Line 3 — extended gradient VERSIONS + pulsing dot + hover glitch */}
          <motion.span
            className="hero__line hero__line--3"
            {...titleEntrance(90, 1, 0.62)}
          >
            <span className="hero__wide hero__grad hero__vers" data-text="VERSIONS">
              VERSIONS
            </span>
            <span className="hero__dot hero__dot--2" aria-hidden="true" />
          </motion.span>
        </h1>

        <Reveal delay={0.5}>
          <p className="hero__subblock">
            <span className="hero__sub-brand">THE NEMOVERSE</span>
            <GeomSep reduced={prefersReduced} />
            <span className="hero__sub-desc">A CONNECTED WEB3 ECOSYSTEM</span>
          </p>
        </Reveal>

        <Reveal delay={0.62}>
          <p className="hero__lede">
            One character. <em>Seven registered universes</em> — each commissioned from a different
            artist, numbered, canonized, and minted as a limited run. Holders enter new universes
            first. Every purchase pulls a piece from the Nemoverse. The persona keeps it alive
            between drops.
          </p>
        </Reveal>

        <Reveal delay={0.74}>
          <div className="hero__ctas">
            <PortalMagnetic>
              <LiquidButton href="#nemoverse" />
            </PortalMagnetic>
            <PortalMagnetic>
              <GlassButton href="#perks" />
            </PortalMagnetic>
          </div>
        </Reveal>

        <Reveal delay={0.86}>
          <div className="hero__hint">
            <span className="arr">▼</span> SCROLL TO CROSS UNIVERSES
          </div>
        </Reveal>
      </motion.div>

      <div className="hero__progress">
        <motion.i style={{ scaleX: progressScale }} />
      </div>
    </header>
  );
}
