import { Component, useEffect, type CSSProperties, type ReactNode } from 'react';

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
import CrawlRise from './components/CrawlRise';
import { Marquee, Starfield, ToastHost } from './components/ui';
import Ambience from './components/Ambience';
import VelocityFX from './components/VelocityFX';
import Atmosphere from './components/Atmosphere';
import FloorState from './components/FloorState';
// The boot sequence — the typographic morph. Renders above everything for one
// pass, then removes itself; see components/Loader.tsx.
import Loader from './components/Loader';
import ArchiveIndex from './components/ArchiveIndex';
import Dock from './components/Dock';
import { CustomCursor } from './components/Cursor';
import { ChapterSeam } from './components/reveal';
import { KineticButton, useCursorGlow } from './components/motion';
import { useMediaQuery } from './lib/singularityGate';
import { ChapterProvider } from './lib/ChapterProvider';
import { preloadPersonaPoints } from './lib/personaPoints';
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

/* ---------------------------------------------------------------------------
   THE JOURNEY — ten chapters, one sequence.

   The DOM order is unchanged (section order is load-bearing: the rotunda
   follows the registry, the singularity sits in the seam before the sign-off,
   and several subsystems measure distances across those neighbours). What
   changed is that the order is now SCORED: each seam is an authored pressure
   change between two chapters rather than an unspecified gap, and the marquee
   count dropped from five repeated strips to two narratively specific ones.
--------------------------------------------------------------------------- */

export default function App() {
  const hasDesktopPersona = useMediaQuery('(min-width: 981px)');

  // Start the lightweight silhouette request at app mount, well before Section
  // 02 approaches the viewport. The singleton guarantees the lazy stage reads
  // this same request; the desktop query guarantees mobile pays nothing.
  useEffect(() => {
    if (!hasDesktopPersona) return;
    void preloadPersonaPoints().catch((error: unknown) => {
      console.error('[persona-model] point preview failed to preload:', error);
    });
  }, [hasDesktopPersona]);

  /* Delegated cursor→bloom tracking: writes --mx/--my onto whichever
     interactive control is hovered (buttons, chips, cards, sheen surfaces)
     so every glow layer is cursor-anchored. One passive listener, rAF-batched,
     no React state. */
  useCursorGlow();

  return (
    <ChapterProvider>
      <Loader />
      <a className="skip-link" href="#nemoverse" style={skipStyle}>
        Skip to the Nemoverse
      </a>

      {/* The two atmospheric layers the chapter controller owns. */}
      <Atmosphere />
      <div className="grain" aria-hidden="true" />
      <Starfield className="starfield" />
      <Ambience />
      <FloorState />

      {/* The chrome: one archive index, one system dock. */}
      <ArchiveIndex />
      <Dock />
      <CustomCursor />
      <VelocityFX />

      <main>
        {/* 02 · ENCOUNTER */}
        <Hero />

        {/* The seam into the archive, then the ONE high-energy signal
            transmission of the page. */}
        <ChapterSeam from="var(--cyan)" to="var(--ultraviolet)" />
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

        {/* 03 · ARCHIVE — the registry and the rotunda are two rooms of the
            same chapter: the canon is read first, then seen. */}
        <Nemoverse />
        <Gallery />

        <ChapterSeam from="var(--cyan)" to="var(--persona-cool)" label="THE ARCHIVE NOTICES YOU" />

        {/* 04 · VOICE */}
        <Persona />

        {/* 05 · ACCESS */}
        <Perks />

        {/* 06 · COMMERCE */}
        <SectionBoundary>
          <Pulls />
        </SectionBoundary>
        <Store />

        <ChapterSeam from="var(--gold)" to="var(--bone)" label="WHO MADE THIS" />

        {/* 07 · AUTHORSHIP */}
        <Artists />

        {/* 08 · CANON */}
        <Lore />

        {/* 09 · COLLAPSE — the approach is empty on purpose. The chrome
            withdraws, the notation thins, and the simulation is entered
            rather than encountered. */}
        <div className="bh-approach" aria-hidden="true">
          <span className="bh-approach__label">THE ARCHIVE IS FOLDING · DO NOT LOOK AWAY</span>
        </div>
        {/* The closing credit crawl — kept above the Singularity so it is
            completely unaffected by the event-horizon warping effect. It is
            the page's one quiet archival notation, and it ascends out of the
            dark instead of just continuing the scroll (CrawlRise). */}
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
        <Singularity />
      </main>

      {/* 10 · RETURN */}
      <Footer />
      <ToastHost />
    </ChapterProvider>
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
