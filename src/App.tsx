import { Component, useEffect, type CSSProperties, type ReactNode } from 'react';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
// ONE TAKE re-order — the film is character → canon → deal. The persona now
// opens the story (you meet the voice before the product); the canon (roster,
// drift, lore, hands) holds the middle; the commerce act (doors, ritual,
// artifacts) lands last. Statically imported like every other section — the
// pulls boundary below still guards its canvas.
import Persona from './sections/Persona';
import Nemoverse from './sections/Nemoverse';
import Gallery from './sections/Gallery';
import Lore from './sections/Lore';
import Artists from './sections/Artists';
import Perks from './sections/Perks';
import Pulls from './sections/pulls/Pulls';
import Store from './sections/Store';
import Singularity from './sections/Singularity';
import Footer from './sections/Footer';
import CrawlRise from './components/CrawlRise';
import Interlude from './components/Interlude';
import { Marquee, Starfield, ToastHost } from './components/ui';
import Ambience from './components/Ambience';
import FloorState from './components/FloorState';
// The boot sequence — the typographic morph. Renders above everything for one
// pass, then removes itself; see components/Loader.tsx.
import Loader from './components/Loader';
// ONE TAKE chrome: the single standing instrument (act marks + filament +
// sound) replaces the side rail, the scroll progress bar and the fixed
// sound pill. VelocityFX stays — it publishes --scroll-vel, which the
// credits crawl and the ghost-type rotate hooks still read.
import Console from './components/Console';
import VelocityFX from './components/VelocityFX';
import { CustomCursor } from './components/Cursor';
import { KineticButton, useCursorGlow } from './components/motion';
import { SingularityProvider, useMediaQuery } from './lib/singularityGate';
import { preloadPersonaPoints } from './lib/personaPoints';
import { settleParticleField } from './lib/particleGate';
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

  /* ONE TAKE — the hero's WebGL particle field was demoted from the poster
     to the codebase; the poster is a bitmap now (gated by heroArtGate).
     The particle boot gate is released immediately so it can never hold the
     loader for a field that no longer mounts. */
  useEffect(() => {
    settleParticleField();
  }, []);

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
      <CustomCursor />
      <Console />
      <VelocityFX />
      {/* The act transition — one light sweep per act boundary, fired by
          lib/chapters.ts. */}
      <div className="fog" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Starfield className="starfield" />
      <Ambience />
      <FloorState />

      <Nav />
      <main>
        {/* ============ ACT I — THE SIGNAL ============ */}
        {/* THE POSTER — the film opens on the key art, not a dashboard. */}
        <Hero />
        {/* THE VOICE — you meet the character before you meet the product. */}
        <Persona />

        {/* ============ ACT II — THE CANON ============ */}
        {/* THE REGISTRY — the pinned suspension roster (physics unchanged). */}
        <Nemoverse />
        {/* THE DRIFT — the same canon hung on a sphere you can spin; the
            museum light lands before the sphere starts to move. */}
        <Gallery />
        {/* THE CANON — the editorial spread + the drilling-rod timeline. The
            story is told BEFORE the deal, not after it. */}
        <Lore />
        {/* THE HANDS — the credit rod; the film becomes human here. */}
        <Artists />
        {/* INTERLUDE I — the film's first title card: the act's promise in
            one enormous line. Stillness zone (data-still). */}
        <Interlude
          id="interlude-canon"
          act="canon"
          actLabel="ACT II · THE CANON"
          ariaTitle="One canon. Infinite versions."
          lines={[
            <>
              ONE&nbsp;CANON<span className="interlude__period">.</span>
            </>,
            <>
              INFINITE&nbsp;VERSIONS<span className="interlude__period">.</span>
            </>,
          ]}
          sub="Every universe is a numbered, official branch of one character — drawn by a different hand, canonized, and minted as a limited run."
        />

        {/* ============ ACT III — THE DEAL ============ */}
        {/* FIRST DOORS — the access ladder; gold enters as the act's hue. */}
        <Perks />
        {/* THE RITUAL — the proof-of-purchase pull, staged as ceremony. */}
        <SectionBoundary>
          <Pulls />
        </SectionBoundary>
        {/* ARTIFACTS — the storefront, presented as a catalog, not a grid. */}
        <Store />
        {/* INTERLUDE II — the second title card: the whole promise in two
            words. Stillness zone. The end credits follow. */}
        <Interlude
          id="interlude-doors"
          act="doors"
          actLabel="ACT III · THE DEAL"
          ariaTitle="Holders cross first."
          lines={[
            <>HOLDERS</>,
            <>
              CROSS&nbsp;FIRST<span className="interlude__period">.</span>
            </>,
          ]}
          sub="Hold the canon and every door — drops, pricing, artifacts — opens before the rest of the world reaches it."
        />

        {/* ============ CODA — THE COLLAPSE ============ */}
        {/* The closing credit crawl — above the Singularity so it is
            completely unaffected by the event-horizon warping. Wrapped in
            the scrubbed clip-rise: the credits ascend out of the dark. */}
        <CrawlRise>
          <div className="signoff__crawl">
            <Marquee
              items={[
                `${UNIVERSES.length} UNIVERSES REGISTERED`,
                `${ARTISTS.length} ARTISTS CREDITED FOREVER`,
                'HOLDERS WALK IN FIRST',
                'EVERY MINT PULLS A PIECE',
                'ONE CANON · INFINITE VERSIONS',
              ]}
              speed="110s"
              variant="credits"
            />
          </div>
        </CrawlRise>
        {/* THE VOID — the breath before the collapse: 40vh of pure dark, a
            stillness zone observed by lib/chapters. The take holds its
            breath once, before the fastest moment of the film. */}
        <div className="void" id="void" aria-hidden="true" />
        {/* THE SINGULARITY — the live WebGPU black hole, last child of
            <main>: the seam itself. Statically imported; its graceful
            degradation (WebGPU detection, static frame, off-screen pause)
            lives in components/BlackHoleStage.tsx, the simulation in
            src/three/blackhole/ (vendored verbatim — untouched). */}
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
