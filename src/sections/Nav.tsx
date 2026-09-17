import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WalletButton, useMockWallet } from '../components/ui';
import { Magnetic, RollText } from '../components/motion';
import { useFocusTrap, useScrollspy } from '../lib/hooks';
import { lockPage, unlockPage } from '../lib/scroll';
import { LOGO_SRC } from '../lib/assets';

const LINKS = [
  { n: 'I', label: 'ARCHIVE', note: 'The numbered universes', href: '#nemoverse' },
  { n: 'II', label: 'ROTUNDA', note: 'The physical archive', href: '#rotunda' },
  { n: 'III', label: 'VOICE', note: 'NEMO answers', href: '#persona' },
  { n: 'IV', label: 'ACCESS', note: 'Holder ceremony', href: '#perks' },
  { n: 'V', label: 'RITUAL', note: 'Proof-of-purchase pulls', href: '#pulls' },
  { n: 'VI', label: 'ARTIFACTS', note: 'The editorial catalog', href: '#store' },
  { n: 'VII', label: 'AUTHORSHIP', note: 'Permanent artist credits', href: '#artists' },
  { n: 'VIII', label: 'CANON', note: 'The story so far', href: '#lore' },
];

const PRIMARY_LINKS = LINKS.filter((_, index) => [0, 2, 5, 7].includes(index));
const SECTION_IDS = LINKS.map((link) => link.href.slice(1));

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastY = useRef(0);
  const wallet = useMockWallet();
  const active = useScrollspy(SECTION_IDS);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 28);
      setHidden(y > 220 && y > lastY.current + 4);
      if (y < lastY.current - 8) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (open) {
      setHidden(false);
      lockPage('menu');
    } else {
      unlockPage('menu');
    }
    return () => unlockPage('menu');
  }, [open]);
  useFocusTrap(open, menuRef, { onEscape: () => setOpen(false) });

  return (
    <>
      <nav
        className={`nav ${scrolled ? 'nav--scrolled' : ''} ${hidden ? 'nav--hidden' : ''}`}
        aria-label="Primary"
      >
        <div className="shell nav__inner">
          <a className="nav__brand" href="#top" aria-label="The Nemoverse home">
            <span className="nav__sigil">
              <img className="nav__logo" src={LOGO_SRC} alt="" width={26} height={26} />
            </span>
            <span>NEMO<b>VERSE</b></span>
            <em>THE LIVING ARCHIVE</em>
          </a>

          <div className="nav__links">
            {PRIMARY_LINKS.map((link) => {
              const isActive = active === link.href.slice(1);
              return (
                <a
                  className={`nav__link ${isActive ? 'active' : ''}`}
                  href={link.href}
                  key={link.href}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="num">{link.n}</span>
                  <RollText text={link.label} />
                  {isActive && (
                    <motion.span
                      layoutId="nav-marker"
                      className="nav__marker"
                      aria-hidden="true"
                      transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
                    />
                  )}
                </a>
              );
            })}
          </div>

          <div className="nav__actions">
            <div className="nav__cta-desktop">
              <WalletButton
                connected={wallet.connected}
                onConnect={wallet.connect}
                onReset={wallet.disconnect}
                compact
              />
            </div>
            <Magnetic preset="chrome" className="nav__burger-mag">
              <motion.button
                className="nav__burger"
                aria-expanded={open}
                aria-label={open ? 'Close archive index' : 'Open archive index'}
                onClick={() => setOpen((value) => !value)}
                whileTap={{ scale: 0.92 }}
              >
                <span />
                <span />
                <span />
              </motion.button>
            </Magnetic>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mmenu"
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Archive index"
            initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
            exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mmenu__mast">
              <span>ARCHIVE INDEX</span>
              <b>Choose a<br />chapter.</b>
              <small>NEMOVERSE PROTOCOL · 2026</small>
            </div>
            <div className="mmenu__chapters">
              {LINKS.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={active === link.href.slice(1) ? 'active' : ''}
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.045, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="num">{link.n}</span>
                  <strong>{link.label}</strong>
                  <em>{link.note}</em>
                  <i aria-hidden="true">↗</i>
                </motion.a>
              ))}
            </div>
            <div className="mmenu__foot">
              <WalletButton connected={wallet.connected} onConnect={wallet.connect} onReset={wallet.disconnect} />
              <span>ONE CANON · INFINITE VERSIONS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
