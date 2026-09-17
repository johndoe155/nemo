import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WalletButton, useMockWallet } from '../components/ui';
import { Magnetic, RollText } from '../components/motion';
import { useFocusTrap, useScrollspy } from '../lib/hooks';
import { lockPage, unlockPage } from '../lib/scroll';
import { LOGO_SRC } from '../lib/assets';

/* ONE TAKE — the index follows the film's new order: the voice opens the
   story, the canon holds the middle, the deal lands last. Seven links; the
   remaining destinations (store, the drift's plates) stay one anchor tap
   away through the footer and the console. */
const LINKS = [
  { n: '01', label: 'THE VOICE', href: '#persona' },
  { n: '02', label: 'THE REGISTRY', href: '#nemoverse' },
  { n: '03', label: 'THE DRIFT', href: '#rotunda' },
  { n: '04', label: 'THE CANON', href: '#lore' },
  { n: '05', label: 'THE HANDS', href: '#artists' },
  { n: '06', label: 'FIRST DOORS', href: '#perks' },
  { n: '07', label: 'THE RITUAL', href: '#pulls' },
];

const SECTION_IDS = LINKS.map((l) => l.href.slice(1));

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const wallet = useMockWallet();
  const active = useScrollspy(SECTION_IDS);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* P0.3 — the menu now holds real dialog behavior (shared useFocusTrap:
     Tab cycling, Escape-to-close, focus returned to the burger on exit) and
     locks the page through lib/scroll, so Lenis freezes with the viewport
     instead of banking wheel deltas behind the overlay. The old direct
     body-overflow toggle also popped the layout ~scrollbar-width on open;
     `scrollbar-gutter: stable` on html removes that class of jump for the
     menu and the dialog in one stroke. */
  useEffect(() => {
    if (open) lockPage('menu');
    else unlockPage('menu');
    return () => unlockPage('menu');
  }, [open]);
  useFocusTrap(open, menuRef, { onEscape: () => setOpen(false) });

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`} aria-label="Primary">
        <div className="shell nav__inner">
          <a className="nav__brand" href="#top" aria-label="The Nemoverse home">
            <img className="nav__logo" src={LOGO_SRC} alt="Logo" width={26} height={26} />
            <span>
              NEMO<b>VERSE</b>
            </span>
          </a>

          <div className="nav__links">
            {LINKS.map((l) => (
              <a
                className={`nav__link ${active === l.href.slice(1) ? 'active' : ''}`}
                href={l.href}
                key={l.href}
                aria-current={active === l.href.slice(1) ? 'true' : undefined}
              >
                <span className="num">{l.n}</span>
                <RollText text={l.label} />
                {/* P2.11 (audit 3.6) — the scrollspy `active` is a class swap
                    where it can be a MOVEMENT: one hairline with a shared
                    layoutId slides between links as sections cross the fold. */}
                {active === l.href.slice(1) && (
                  <motion.span
                    layoutId="nav-marker"
                    className="nav__marker"
                    aria-hidden="true"
                    transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
                  />
                )}
              </a>
            ))}
          </div>

          <div className="nav__cta-desktop">
            <WalletButton connected={wallet.connected} onConnect={wallet.connect} onReset={wallet.disconnect} compact />
          </div>

          <Magnetic preset="chrome" className="nav__burger-mag">
            <motion.button
              className="nav__burger"
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
              /* gentle spring squash on press — serves touch too, where
                 magnetism is disabled; hover brightness stays in CSS so
                 framer's inline styles never fight the :hover rule */
              whileTap={{ scale: 0.92, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
            >
              <span />
              <span />
              <span />
            </motion.button>
          </Magnetic>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mmenu"
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {LINKS.map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="num">{l.n}</span> <RollText text={l.label} />
              </motion.a>
            ))}
            <div className="mmenu__foot" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <WalletButton connected={wallet.connected} onConnect={wallet.connect} onReset={wallet.disconnect} />
              <span>ONE CANON · INFINITE VERSIONS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
