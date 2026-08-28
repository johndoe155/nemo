import { Component, type CSSProperties, type ReactNode } from 'react';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Nemoverse from './sections/Nemoverse';
import Gallery from './sections/Gallery';
import Persona from './sections/Persona';
import Perks from './sections/Perks';
// 04 · PILLAR 3 is statically imported like every other section. It was
// previously lazy-loaded, but a failed or stalled dynamic import on reload
// (notably on mobile after leaving and reopening the browser) left the
// Suspense fallback in place forever — a permanent blank gap between
// sections 03 and 05. A static import puts the section in the critical
// bundle so it always mounts; the boundary below is a second safety net for
// any runtime render error.
import Pulls from './sections/pulls/Pulls';
import Store from './sections/Store';
import Artists from './sections/Artists';
import Lore from './sections/Lore';
import Loop from './sections/Loop';
import Footer from './sections/Footer';
import { Marquee, Starfield, ToastHost } from './components/ui';
import Ambience from './components/Ambience';
import ScrollProgress from './components/ScrollProgress';
import SideRail from './components/SideRail';
import SoundToggle from './components/SoundToggle';
import VelocityFX from './components/VelocityFX';
import { CustomCursor } from './components/Cursor';
import FilmGrain from './components/FilmGrain';

/* ---------------------------------------------------------------------------
   SectionBoundary — guarantees a section can never blank itself out. If the
   Pulls canvas throws during render, a retry shell renders in its place
   instead of a dead gap between sections 03 and 05.
--------------------------------------------------------------------------- */
class SectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[nemoverse] section 04 failed to render:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="section npx" id="pulls">
        <div className="shell" style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              marginBottom: '1.2rem',
            }}
          >
            THE ARCHIVE FAILED TO MATERIALISE
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ failed: false })}
          >
            RETRY SECTION
          </button>
        </div>
      </section>
    );
  }
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#nemoverse" style={skipStyle}>
        Skip to the Nemoverse
      </a>
      <ScrollProgress />
      <CustomCursor />
      <SideRail />
      <VelocityFX />
      <SoundToggle />
      <div className="grain" aria-hidden="true" />
      <FilmGrain />
      <Starfield className="starfield" />
      <Ambience />

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
        <Nemoverse />
        {/* 3D rotunda — the same canon as the roster above, hung as a room you
            can walk around. Placed here so the registry (specs) is read first
            and the art (plates) lands immediately after. */}
        <Gallery />
        <Persona />
        <Perks />
        <SectionBoundary>
          <Pulls />
        </SectionBoundary>
        <Store />
        <Artists />
        <Lore />
        <Loop />
      </main>
      <Footer />
      <ToastHost />
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
