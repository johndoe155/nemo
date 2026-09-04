import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Magnetic, CurtainLink } from '../components/motion';
import { FOOTER_NAV, SOCIALS } from '../lib/data';
import { useCurtainReveal } from './footer/useCurtainReveal';

// Keep the three community channels together with the existing email signal;
// the same quiet magnetic field makes the whole Signals column feel physical.
const SOCIAL_LINKS = SOCIALS;

function ColumnHeading({
  id,
  index,
  label,
}: {
  id: string;
  index: number;
  label: string;
}) {
  return (
    <h3 className="curtain-footer__heading" id={id}>
      <span aria-hidden="true">{String(index).padStart(2, '0')}</span>
      {label}
    </h3>
  );
}

function FooterColumn({
  index,
  label,
  links,
}: {
  index: number;
  label: string;
  links: Array<{ label: string; href: string }>;
}) {
  const headingId = `footer-${label.toLowerCase()}-heading`;

  return (
    <nav className="curtain-footer__column" aria-labelledby={headingId}>
      <ColumnHeading id={headingId} index={index} label={label} />
      <div className="curtain-footer__links">
        {links.map((link) => (
          <CurtainLink
            className="curtain-footer__link"
            href={link.href}
            key={link.href}
            label={link.label}
          />
        ))}
      </div>
    </nav>
  );
}

function SignalsColumn() {
  return (
    <nav className="curtain-footer__column" aria-labelledby="footer-signals-heading">
      <ColumnHeading id="footer-signals-heading" index={3} label="SIGNALS" />
      <div className="curtain-footer__links curtain-footer__links--signals">
        {SOCIAL_LINKS.map((social) => (
          <Magnetic
            block
            className="curtain-footer__magnetic"
            key={social.label}
            preset="pill"
            radius={88}
            strength={0.32}
            max={14}
          >
            <CurtainLink
              className="curtain-footer__link curtain-footer__link--social"
              href={social.href}
              label={social.label}
              meta={social.handle}
              screenReaderLabel={`${social.label}, ${social.handle}`}
            />
          </Magnetic>
        ))}
      </div>
    </nav>
  );
}

export default function Footer() {
  const footerRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  useCurtainReveal(footerRef);

  return (
    <footer
      className="curtain-footer"
      id="connect"
      ref={footerRef}
      aria-labelledby="curtain-footer-title"
    >
      <motion.div
        className="curtain-footer__surface"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="vh" id="curtain-footer-title">
          The Nemoverse footer
        </h2>

        <div className="curtain-footer__topbar">
          <p className="curtain-footer__eyebrow">
            <span className="curtain-footer__signal" aria-hidden="true" />
            CURTAIN / END OF TRANSMISSION
          </p>
          <p className="curtain-footer__protocol">NEMOVERSE PROTOCOL / 2026</p>
          <CurtainLink
            className="curtain-footer__back"
            data-cursor="TOP"
            href="#top"
            label="BACK TO SURFACE"
          />
        </div>

        <div className="curtain-footer__grid">
          <div className="curtain-footer__intro">
            <p className="curtain-footer__index">07 — THE THRESHOLD</p>
            <p className="curtain-footer__statement">
              One canon.
              <br />
              <em>Infinite versions.</em>
            </p>
            <p className="curtain-footer__note">
              The light stays on for the character, the collectors, and the store.
            </p>
          </div>

          {FOOTER_NAV.map((group, index) => (
            <FooterColumn
              index={index + 1}
              key={group.label}
              label={group.label}
              links={group.links}
            />
          ))}
          <SignalsColumn />
        </div>

        <div className="curtain-footer__base">
          <span>© 2026 THE NEMOVERSE</span>
          <span>BASE / POLYGON</span>
          <span>MADE IN THE VOID</span>
        </div>

        <div className="curtain-footer__lockup">
          <motion.a
            className="curtain-footer__wordmark"
            data-cursor="TOP"
            href="#top"
            aria-label="Back to surface — NEMO"
            whileTap={{ scale: 0.985 }}
          >
            <span className="curtain-footer__word-mask" aria-hidden="true">
              <span className="curtain-footer__word">NEMO</span>
              <span className="curtain-footer__word curtain-footer__word--duplicate">NEMO</span>
            </span>
            <span className="vh">Back to surface — NEMO</span>
          </motion.a>
        </div>
      </motion.div>
    </footer>
  );
}
