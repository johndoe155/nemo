import { Component, useState, type CSSProperties, type ReactNode } from 'react';
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
import Singularity from './sections/Singularity';
import Footer from './sections/Footer';
import { Marquee, Starfield, ToastHost } from './components/ui';
import Ambience from './components/Ambience';
import ScrollProgress from './components/ScrollProgress';
import SideRail from './components/SideRail';
import SoundToggle from './components/SoundToggle';
import VelocityFX from './components/VelocityFX';
import { CustomCursor } from './components/Cursor';
import { KineticButton, useCursorGlow } from './components/motion';

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
          <KineticButton
            className="btn btn-primary"
            label="RETRY SECTION"
            spark={false}
            onClick={() => this.setState({ failed: false })}
          />
        </div>
      </section>
    );
  }
}

export default function App() {
  /* Delegated cursor→bloom tracking: writes --mx/--my onto whichever
     interactive control is hovered (buttons, chips, cards, sheen surfaces)
     so every glow layer is cursor-anchored. One passive listener, rAF-batched,
     no React state. */
  useCursorGlow();

  const [footerHeight, setFooterHeight] = useState<number>(0);

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
      <Starfield className="starfield" />
      <Ambience />

      <Nav />
      {/* The main canvas curtain sits above the fixed footer with z-index: 2
          and an opaque void background. As the user scrolls to the bottom of
          the WebGPU black hole, this container slides up like a physical
          curtain, unveiling the stark, blindingly bright footer underneath. */}
      <main className="app-main-curtain">
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
        {/* THE SINGULARITY — the live WebGPU black hole. Placed in the exact
            gap between the canon timeline above (Lore, whose drilling rod ends
            on the "U-007 — THE LAST AURORA" node) and the footer curtain reveal. */}
        <Singularity />
      </main>

      {/* Curtain reveal scroll spacer: reserves exact scroll height for the
          fixed footer beneath the main canvas curtain. */}
      <div
        className="footer-curtain-spacer"
        style={{ height: footerHeight > 0 ? `${footerHeight}px` : undefined }}
        aria-hidden="true"
      />

      {/* The Stark Inverse Footer — fixed to the bottom of the viewport
          with a negative/lower z-index beneath the dark canvas curtain. */}
      <Footer onHeightChange={setFooterHeight} />

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
