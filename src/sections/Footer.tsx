import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Marquee, toast } from '../components/ui';
import { Magnetic } from '../components/motion/Magnetic';
import { KineticLabel } from '../components/motion/KineticLabel';
import { ARTISTS, FOOTER_NAV, SOCIALS, UNIVERSES } from '../lib/data';
import { LOGO_SRC } from '../lib/assets';

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const prefersReduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CRAWL_ITEMS = [
  `${UNIVERSES.length} UNIVERSES REGISTERED`,
  `${ARTISTS.length} ARTISTS CREDITED FOREVER`,
  'HOLDERS WALK IN FIRST',
  'EVERY MINT PULLS A PIECE',
  'ONE CANON · INFINITE VERSIONS',
  'NEMOVERSE PROTOCOL v0.1.0',
];

function MaskedLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} className="footer-mask-link">
      <span className="footer-mask-link__viewport" aria-hidden="true">
        <span className="footer-mask-link__stack">
          <span>{children}</span>
          <span>{children}</span>
        </span>
      </span>
      <span className="vh">{children}</span>
    </a>
  );
}

function StarEasterEgg() {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      toast('you made it to the end. i always knew you would.');
    }, 1200);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setHolding(false);
  };

  useEffect(() => () => cancel(), []);

  return (
    <div
      className={`footer__brand ${holding ? 'is-holding' : ''}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => event.preventDefault()}
      data-cursor="NEMO SEES YOU"
      role="img"
      aria-label="The Nemoverse logo — hold to hear from NEMO"
    >
      <img src={LOGO_SRC} alt="" width={48} height={48} loading="lazy" />
      <span>NEMO<b>VERSE</b></span>
    </div>
  );
}

function SocialLink({ label, href, handle }: { label: string; href: string; handle: string }) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (prefersReduced || !window.matchMedia('(pointer: fine)').matches) return;
    const link = ref.current;
    if (!link) return;
    let frame = 0;
    const release = () => {
      cancelAnimationFrame(frame);
      link.style.setProperty('--social-x', '0px');
      link.style.setProperty('--social-y', '0px');
      setActive(false);
    };
    const move = (event: PointerEvent) => {
      const rect = link.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const radius = Math.max(rect.width, rect.height) * 2.2 + 42;
      if (distance > radius) {
        release();
        return;
      }
      const pull = Math.pow(1 - distance / radius, 2);
      const x = Math.max(-18, Math.min(18, dx * 0.22 * pull));
      const y = Math.max(-12, Math.min(12, dy * 0.22 * pull));
      setActive(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        link.style.setProperty('--social-x', `${x}px`);
        link.style.setProperty('--social-y', `${y}px`);
      });
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', release);
    link.addEventListener('pointerleave', release);
    return () => {
      release();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', release);
      link.removeEventListener('pointerleave', release);
    };
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      className={`footer-social ${active ? 'is-magnetic' : ''}`}
      aria-label={`${label} ${handle}`}
    >
      <span className="footer-social__label">{label}</span>
      <span className="footer-social__handle" aria-hidden="true">{handle}</span>
    </a>
  );
}

function ClosingSignoff() {
  return (
    <footer className="footer signoff" aria-label="Closing invitation">
      <div className="signoff__crawl">
        <Marquee items={CRAWL_ITEMS} speed="110s" variant="credits" />
      </div>
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
          <a href="#nemoverse" className="btn btn-primary" data-cursor="ENTER">
            <span className="btn-spark" aria-hidden="true" />
            <KineticLabel label="EXPLORE THE UNIVERSES" swap="ENTER THE VOID" open={false} />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Footer() {
  return (
    <>
      <ClosingSignoff />
      <footer className="footer curtain-footer" id="connect">
      <div className="curtain-footer__topline" aria-hidden="true">
        <span>THE BASE / 06</span>
        <span>THE END IS ANOTHER THRESHOLD</span>
      </div>

      <div className="shell curtain-footer__intro">
        <div>
          <p className="curtain-footer__eyebrow">NEMOVERSE PROTOCOL · SIGN-OFF</p>
          <h2 className="curtain-footer__heading">
            <span>STEP OUT</span>
            <span>OF THE VOID.</span>
          </h2>
        </div>
        <div className="curtain-footer__statement">
          <p>One canon character. Infinite versions. A living archive for the people who keep looking.</p>
          <a className="curtain-footer__cta" href="#nemoverse">
            <KineticLabel label="EXPLORE THE UNIVERSES" swap="ENTER THE VOID" open={false} />
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div className="shell curtain-footer__grid">
        <motion.div
          className="curtain-footer__identity"
          initial={prefersReduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
          <StarEasterEgg />
          <p className="curtain-footer__prose">Built for nemo · pitched by Skippy Rizzo · July 2026.</p>
          <p className="curtain-footer__meta">{UNIVERSES.length} UNIVERSES · {ARTISTS.length} ARTISTS · BASE / POLYGON</p>
        </motion.div>

        {FOOTER_NAV.map((group, index) => (
          <motion.nav
            className="curtain-footer__column"
            aria-label={group.label}
            key={group.label}
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.8, delay: 0.08 + index * 0.1, ease: EASE_EXPO }}
          >
            <p className="curtain-footer__label"><span>0{index + 1}</span>{group.label}</p>
            {group.links.map((link) => (
              <MaskedLink href={link.href} key={link.href}>{link.label}</MaskedLink>
            ))}
          </motion.nav>
        ))}

        <motion.nav
          className="curtain-footer__column curtain-footer__column--signals"
          aria-label="SIGNALS"
          initial={prefersReduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, delay: 0.28, ease: EASE_EXPO }}
        >
          <p className="curtain-footer__label"><span>03</span>SIGNALS</p>
          {SOCIALS.map((social) => <SocialLink key={social.label} {...social} />)}
        </motion.nav>
      </div>

      <div className="curtain-footer__wordmark" aria-label="NEMO">NEMO</div>

      <div className="curtain-footer__ribbon">
        <span>© 2026 THE NEMOVERSE · CONCEPT PITCH DEMO</span>
        <span>NEMOVERSE PROTOCOL v0.1.0</span>
        <Magnetic preset="pill" radius={100} strength={0.18} max={14}>
          <a href="#top" className="curtain-footer__rewind" onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}>BACK TO TOP ↑</a>
        </Magnetic>
      </div>
      </footer>
    </>
  );
}
