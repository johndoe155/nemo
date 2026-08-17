import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WalletButton, useMockWallet } from '../components/ui';
import { useScrollspy } from '../lib/hooks';

const LINKS = [
  { n: '01', label: 'MULTIVERSE', href: '#multiverse' },
  { n: '02', label: 'THE PERSONA', href: '#persona' },
  { n: '03', label: 'HOLDER PERKS', href: '#perks' },
  { n: '04', label: 'POP PULLS', href: '#pulls' },
  { n: '05', label: 'STORE', href: '#store' },
  { n: '06', label: 'ARTISTS', href: '#artists' },
];

const SECTION_IDS = LINKS.map((l) => l.href.slice(1));

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const wallet = useMockWallet();
  const active = useScrollspy(SECTION_IDS);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`} aria-label="Primary">
        <div className="shell nav__inner">
          <a className="nav__brand" href="#top" aria-label="The OC Universe home">
            <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
              <defs>
                <linearGradient id="nbg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#8A4DFF" />
                  <stop offset="0.5" stopColor="#3FE8FF" />
                  <stop offset="1" stopColor="#FF3D9A" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="14" fill="rgba(255,255,255,0.04)" />
              <circle cx="32" cy="32" r="21" fill="none" stroke="url(#nbg)" strokeWidth="3" />
              <circle cx="32" cy="32" r="9" fill="url(#nbg)" />
              <circle cx="53" cy="32" r="4" fill="#FFC857" />
            </svg>
            <span>
              OC<b>UNIVERSE</b>
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
                {l.label}
              </a>
            ))}
          </div>

          <div className="nav__cta-desktop">
            <WalletButton connected={wallet.connected} onConnect={wallet.connect} compact />
          </div>

          <button
            className="nav__burger"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mmenu"
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
                <span className="num">{l.n}</span> {l.label}
              </motion.a>
            ))}
            <div className="mmenu__foot" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <WalletButton connected={wallet.connected} onConnect={wallet.connect} />
              <span>ONE CANON · INFINITE VERSIONS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
