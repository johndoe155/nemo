import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion, useMotionValue, useScroll, useTransform } from 'framer-motion';
import { LiquidButton, GlassButton, PortalMagnetic } from '../components/PortalButton';
import NemoParticleField from '../components/NemoParticleField';
import { DROP_LABEL, UNIVERSES, UNIVERSE_DROP_ISO, art, visibleUniverses } from '../lib/data';
import { useCountdown } from '../lib/hooks';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const portraitRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const t = useCountdown(UNIVERSE_DROP_ISO);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const contentY = useTransform(scrollYProgress, [0, 1], [0, -110]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.62], [1, 0]);
  const portraitY = useTransform(scrollYProgress, [0, 1], ['0%', '11%']);
  const portraitScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.18]);
  const particleScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.22]);
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const portraitX = useTransform(mx, [-1, 1], [8, -8]);
  const fieldX = useTransform(mx, [-1, 1], [-10, 10]);
  const fieldY = useTransform(my, [-1, 1], [-8, 8]);

  useEffect(() => {
    if (reduced) return;
    const move = (event: PointerEvent) => {
      mx.set((event.clientX / window.innerWidth - 0.5) * 2);
      my.set((event.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [mx, my, reduced]);

  /* The portrait is the hinge between Encounter and Archive: as the visitor
     leaves, its tall aperture shears shut while the title is drawn back to the
     central star. The rail appears to continue from that same cut. */
  useEffect(() => {
    if (reduced || !ref.current) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: 'top top',
          end: '75% top',
          scrub: 0.7,
        },
      });
      timeline
        .to('.hero__title--canon', { xPercent: -16, opacity: 0.1, ease: 'none' }, 0)
        .to('.hero__title--versions', { xPercent: 18, opacity: 0.08, ease: 'none' }, 0)
        .to(portraitRef.current, { clipPath: 'inset(7% 26% 10% 22%)', ease: 'none' }, 0);
    }, ref);
    return () => ctx.revert();
  }, [reduced]);

  const status = t.done
    ? 'U-007 / THE LAST AURORA / LIVE NOW'
    : `U-007 / THE LAST AURORA / ${t.d}D ${t.h}H ${t.m}M`;

  return (
    <header className="hero" ref={ref} id="top">
      <motion.div className="hero__bg" style={{ scale: particleScale, x: fieldX, y: fieldY }}>
        <NemoParticleField hostRef={ref} />
      </motion.div>
      <div className="hero__wash" aria-hidden="true" />
      <div className="hero__scanlines" aria-hidden="true" />

      <motion.figure
        className="hero__portrait"
        ref={portraitRef}
        style={{ y: portraitY, x: portraitX }}
        initial={reduced ? false : { opacity: 0, scale: 1.08, clipPath: 'inset(50% 8% 50% 8%)' }}
        animate={{ opacity: 1, scale: 1, clipPath: 'inset(0% 8% 0% 8%)' }}
        transition={{ duration: 1.6, delay: 0.15, ease: EASE }}
      >
        <motion.picture style={{ scale: portraitScale }}>
          <source
            type="image/avif"
            srcSet={`${art('hero-960.avif')} 960w, ${art('hero.avif')} 1440w`}
            sizes="(min-width: 900px) 42vw, 82vw"
          />
          <img src={art('hero.jpg')} alt="NEMO facing an endless sequence of illuminated archive doors" />
        </motion.picture>
        <span className="hero__portrait-light" aria-hidden="true" />
        <figcaption>
          <span>SUBJECT / NEMO</span>
          <span>LOCATION / TIMELINE ZERO</span>
        </figcaption>
      </motion.figure>

      <motion.div className="shell hero__content" style={{ y: contentY, opacity: contentOpacity }}>
        <motion.div
          className="hero__eyebrow"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        >
          <span>THE LIVING ARCHIVE</span>
          <i />
          <span>EST. 2026</span>
        </motion.div>

        <h1 className="hero__title" aria-label="One canon. Infinite versions.">
          <motion.span
            className="hero__title-line hero__title--canon"
            initial={reduced ? false : { opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.25, delay: 0.32, ease: EASE }}
          >
            <small>ONE</small>
            CANON<span className="hero__period">.</span>
          </motion.span>
          <motion.span
            className="hero__title-line hero__title--infinite"
            initial={reduced ? false : { opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 1.25, delay: 0.48, ease: EASE }}
          >
            INFINITE
          </motion.span>
          <motion.span
            className="hero__title-line hero__title--versions"
            initial={reduced ? false : { opacity: 0, x: 120 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.25, delay: 0.6, ease: EASE }}
          >
            VERSIONS<span className="hero__period">.</span>
          </motion.span>
        </h1>

        <motion.div
          className="hero__story"
          initial={reduced ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.78, ease: EASE }}
        >
          <p>
            One wanderer, redrawn across <em>{visibleUniverses.length} registered realities.</em>
            Every artist opens a new door. Every holder enters before the light changes.
          </p>
          <div className="hero__ctas">
            <PortalMagnetic><LiquidButton href="#nemoverse" /></PortalMagnetic>
            <PortalMagnetic><GlassButton href="#perks" /></PortalMagnetic>
          </div>
        </motion.div>
      </motion.div>

      <motion.aside className="hero__telemetry" style={{ opacity: contentOpacity }} aria-label="Archive status">
        <div><span>ARCHIVE</span><b>{String(UNIVERSES.length).padStart(2, '0')} OBJECTS</b></div>
        <div><span>NEXT SIGNAL</span><b>{status}</b></div>
      </motion.aside>

      <div className="hero__status" aria-hidden="true">
        <span className="pulse-dot" />
        <span>{status}</span>
        <i />
        <span>{DROP_LABEL} · HOLDERS CROSS FIRST</span>
      </div>
      <a className="hero__hint" href="#nemoverse">
        <span>SCROLL TO ENTER</span><i aria-hidden="true" />
      </a>
      <div className="hero__progress"><motion.i style={{ scaleX: progressScale }} /></div>
    </header>
  );
}
