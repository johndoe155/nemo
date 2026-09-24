import { Component, type CSSProperties, type ReactNode } from 'react';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Nemoverse from './sections/Nemoverse';
import Persona from './sections/Persona';
// 04 · PILLAR 3 is statically imported like every other section. It was
// previously lazy-loaded, but a failed or stalled dynamic import on reload
// (notably on mobile after leaving and reopening the browser) left the
// Suspense fallback in place forever — a permanent blank gap between
// sections 03 and 05. A static import puts the section in the critical
// bundle so it always mounts; the boundary below is a second safety net for
// any runtime render error.
import Pulls from './sections/pulls/Pulls';
import Holder from './sections/Holder';
import Canon from './sections/Canon';
import Singularity from './sections/Singularity';
import Footer from './sections/Footer';
import CrawlRise from './components/CrawlRise';
import { Marquee, ToastHost } from './components/ui';
import Ambience from './components/Ambience';
import FloorState from './components/FloorState';
// The boot sequence — the typographic morph. Renders above everything for one
// pass, then removes itself; see components/Loader.tsx.
import Loader from './components/Loader';
import ScrollProgress from './components/ScrollProgress';
import SideRail from './components/SideRail';
import SoundToggle from './components/SoundToggle';
import { CustomCursor } from './components/Cursor';
import { KineticButton, useCursorGlow } from './components/motion';
import { SingularityProvider } from './lib/singularityGate';
import { UNIVERSES, ARTISTS } from './lib/data';

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

  return (
    <SingularityProvider>
      <Loader />
      <a className="skip-link" href="#nemoverse" style={skipStyle}>
        Skip to the Nemoverse
      </a>
      <ScrollProgress />
      <CustomCursor />
      <SideRail />
      <SoundToggle />
      <div className="grain" aria-hidden="true" />
      <Ambience />
      <FloorState />

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
        <Persona />
        <SectionBoundary>
          <Pulls />
        </SectionBoundary>
        <Holder />
        <Canon />
        {/* BEAT 6 → 7 · the credit flash-wall hands the page to the trench.
            CrawlRise (IDENTITY-SPEC §7: kept, reskinned) is the scrubbed
            clip-rise that carries the credits up out of the canon beat; the
            marquee inside it is the credits' own type band. */}
        <CrawlRise>
        <div className="signoff__crawl">
          <Marquee
            items={[
              `${UNIVERSES.length} UNIVERSES REGISTERED`,
              `${ARTISTS.length} ARTISTS CREDITED FOREVER`,
              'HOLDERS WALK IN FIRST',
              'EVERY MINT PULLS A PIECE',
              'ONE CANON · INFINITE VERSIONS',
              'NEMOVERSE PROTOCOL v0.1.0',
            ]}
            speed="110s"
            variant="credits"
          />
        </div>
        </CrawlRise>
        {/* BEAT 7 · THE TRENCH — the finale, and the only dark ground on the
            page (IDENTITY-SPEC §2.1 Z3). Placed in the exact gap between the
            canon beat above and the sign-off below: it is the last child of
            <main> because <Footer /> is a sibling of <main>, so this is the
            seam itself — nothing else sits between them. Statically imported
            like every other section: a beat this deep must always mount.
            The renderer is components/VortexStage.tsx (dependency-free WebGL2
            water vortex); its graceful degradation — context feature check, a
            painted CSS trench, off-screen pausing, a static frame under
            reduced motion — lives there and in styles/trench.css. The scroll
            mechanic above it (the .bh-hold reservation and the sign-off
            consumption) is unchanged and lives in lib/spaghettification.ts. */}
        <Singularity />
      </main>
      <Footer />
      <ToastHost />
    </SingularityProvider>
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
