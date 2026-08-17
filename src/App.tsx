import type { CSSProperties } from 'react';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Multiverse from './sections/Multiverse';
import Persona from './sections/Persona';
import Perks from './sections/Perks';
import Pulls from './sections/Pulls';
import Store from './sections/Store';
import Artists from './sections/Artists';
import Lore from './sections/Lore';
import Loop from './sections/Loop';
import Footer from './sections/Footer';
import { Marquee, Starfield } from './components/ui';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#multiverse" style={skipStyle}>
        Skip to the Multiverse
      </a>
      <div className="grain" aria-hidden="true" />
      <Starfield className="starfield" />

      <Nav />
      <main>
        <Hero />
        <Marquee
          items={[
            'U-007 — THE LAST AURORA — AUG 22',
            'HOLDERS ENTER FIRST',
            'U-005 · EPIC · 71/100 CLAIMED',
            'EVERY PURCHASE PULLS A PIECE',
            'THE PERSONA IS ALWAYS TEASING',
          ]}
          speed="38s"
        />
        <Multiverse />
        <Persona />
        <Perks />
        <Pulls />
        <Store />
        <Artists />
        <Lore />
        <Loop />
      </main>
      <Footer />
    </>
  );
}

const skipStyle: CSSProperties = {
  position: 'fixed',
  top: '-100px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 999,
  background: 'var(--cyan)',
  color: '#02121a',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  padding: '0.8rem 1.4rem',
  borderRadius: '8px',
};
