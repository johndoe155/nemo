import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Reveal } from '../components/ui';
import { art, UNIVERSE_DROP_ISO } from '../lib/data';
import { useCountdown } from '../lib/hooks';

const EASE = [0.16, 1, 0.3, 1] as const;

const TITLE_LINES = [
  <>
    ONE <span className="txt-grad">CANON.</span>
  </>,
  <>
    INFINITE <span className="txt-grad">VERSIONS.</span>
  </>,
];

export default function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 20, mass: 0.4 });

  // Scroll-bound cinematic movement
  const bgScale = useTransform(smooth, [0, 1], [1.12, 1.3]);
  const bgY = useTransform(smooth, [0, 1], ['0%', '18%']);
  const contentY = useTransform(smooth, [0, 1], [0, -90]);
  const contentOpacity = useTransform(smooth, [0, 0.72], [1, 0]);
  const orbitY = useTransform(smooth, [0, 1], [0, -160]);
  const progressScale = useTransform(smooth, [0, 1], [0, 1]);

  const t = useCountdown(UNIVERSE_DROP_ISO);

  return (
    <header className="hero" ref={ref} id="top">
      {/* Backdrop art + washes + scanlines */}
      <motion.div className="hero__bg" style={{ scale: bgScale, y: bgY }}>
        <img src={art('hero.jpg')} alt="" />
      </motion.div>
      <div className="hero__wash" />
      <div className="hero__scanlines" />

      {/* Orbiting ring system behind the copy */}
      <motion.div className="hero__orbit orbit spin" style={{ width: 620, height: 620, right: '-8%', top: '-12%', y: orbitY }} />
      <motion.div className="hero__orbit orbit spin-rev" style={{ width: 420, height: 420, right: '6%', top: '4%', y: orbitY }} />

      <motion.div className="shell hero__content" style={{ y: contentY, opacity: contentOpacity }}>
        <Reveal delay={0.05}>
          <span className="hero__badge">
            <span className="pulse-dot" />
            EST. 2026 · THE MULTIVERSE IS LIVE · U-007 DROPS IN {t.d}D {t.h}H
          </span>
        </Reveal>

        <h1 className="display hero__title" aria-label="One canon. Infinite versions.">
          {TITLE_LINES.map((line, i) => (
            <span className="line" key={i}>
              <motion.span
                style={{ display: 'inline-block' }}
                initial={{ y: '112%', rotate: 2.4 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: 1.1, delay: 0.18 + i * 0.14, ease: EASE }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <Reveal delay={0.5}>
          <p className="hero__sub">
            THE OC UNIVERSE <span className="sep">◆</span> A CONNECTED WEB3 ECOSYSTEM
          </p>
        </Reveal>

        <Reveal delay={0.62}>
          <p className="hero__lede">
            One character. <em>Seven registered universes</em> — each commissioned from a different
            artist, numbered, canonized, and minted as a limited run. Holders enter new universes
            first. Every purchase pulls a piece from the Multiverse. The persona keeps it alive
            between drops.
          </p>
        </Reveal>

        <Reveal delay={0.74}>
          <div className="hero__ctas">
            <a href="#multiverse" className="btn btn-primary">
              <span className="btn-spark" />
              ENTER THE MULTIVERSE
            </a>
            <a href="#perks" className="btn btn-ghost">
              HOLDER PERKS ▸
            </a>
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
