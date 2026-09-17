import { Component, Suspense, lazy, useRef, type ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { Reveal } from '../components/ui';
import NemoChat from '../components/NemoChat';
import { useMediaQuery } from '../lib/singularityGate';

const PersonaModelStage = lazy(() => import('../components/PersonaModelStage'));
const PERSONA_DESKTOP_QUERY = '(min-width: 981px)';

class PersonaModelImportBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[persona-model] character module failed to load:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="persona-model">
          <div className="persona-model__error" role="status">
            <strong>The character could not materialise.</strong>
            <span>The NEMO chat remains available beside this display.</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function DesktopPersonaModel() {
  const isDesktop = useMediaQuery(PERSONA_DESKTOP_QUERY);
  const slotRef = useRef<HTMLDivElement>(null);
  const isNearViewport = useInView(slotRef, { once: true, margin: '500px 0px' });

  return (
    <div className="persona__modelslot" ref={slotRef}>
      {isDesktop && isNearViewport ? (
        <PersonaModelImportBoundary>
          <Suspense fallback={null}>
            <PersonaModelStage />
          </Suspense>
        </PersonaModelImportBoundary>
      ) : null}
    </div>
  );
}

export default function Persona() {
  return (
    <section className="section persona" id="persona">
      <div className="gridplane" aria-hidden="true" />
      <div className="persona__ghost" aria-hidden="true">VOICE</div>
      <div className="shell persona__layout">
        <header className="persona__head">
          <span className="kicker">III · THE SENTIENT SIGNAL</span>
          <h2>The archive<br /><em>answers back.</em></h2>
          <p>
            NEMO speaks between drops—teasing doors, remembering canon and noticing
            the person standing on the other side of the glass.
          </p>
        </header>

        <div className="persona__interact">
          <div className="persona__model-frame">
            <span className="persona__coord persona__coord--a">SUBJECT LOCK / N-00</span>
            <span className="persona__coord persona__coord--b">ATTENTION / ACTIVE</span>
            <DesktopPersonaModel />
          </div>
          <div className="persona__chatwrap">
            <span className="persona__transmission">LIVE TRANSMISSION · CANON ONLY</span>
            <NemoChat />
          </div>
        </div>

        <div className="persona__support">
          <Reveal delay={0.1}>
            <blockquote>
              “You found me. Most people never look past the first portal.”
              <cite>— NEMO / CURRENT SIGNAL</cite>
            </blockquote>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="persona__cap">
              <span className="pulse-dot" />
              <span>
                <b>PERSONA ENGINE / DEMO BRAIN</b> Teasers, banter and in-character answers are
                bounded by canon guardrails. The production reply engine can be connected without
                changing the transmission surface.
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
