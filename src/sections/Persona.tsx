import { Component, Suspense, lazy, useRef, type ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { Reveal, SectionHead } from '../components/ui';
import NemoChat from '../components/NemoChat';
import { useMediaQuery } from '../lib/singularityGate';

// React.lazy does not invoke this import until its component is actually
// rendered. PersonaModelSlot only renders it above the existing two-column
// breakpoint, so the r3f/drei chunk cannot parse or request its 3D assets on
// mobile/tablet.
const PersonaModelStage = lazy(() => import('../components/PersonaModelStage'));
const PERSONA_DESKTOP_QUERY = '(min-width: 981px)';

function ModelPlaceholder({ failed = false }: { failed?: boolean }) {
  return (
    <div className="persona-model__placeholder" role={failed ? 'alert' : 'status'}>
      {failed ? 'Character display unavailable.' : 'Preparing character display…'}
    </div>
  );
}

/** Catches a rejected lazy chunk before PersonaModelStage itself can mount. */
class PersonaModelImportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[persona-model] stage module failed to load:', error);
  }

  render() {
    return this.state.failed ? <ModelPlaceholder failed /> : this.props.children;
  }
}

function PersonaModelSlot() {
  const isDesktop = useMediaQuery(PERSONA_DESKTOP_QUERY);
  const slotRef = useRef<HTMLDivElement>(null);
  // The visible stage reserves its exact box immediately, but the 29 MB model
  // and r3f module stay idle until the reader is approaching PILLAR 4.
  const nearViewport = useInView(slotRef, { once: true, margin: '240px 0px' });

  if (!isDesktop) return null;

  return (
    <div className="persona__model-slot" ref={slotRef}>
      {nearViewport ? (
        <PersonaModelImportBoundary>
          <Suspense fallback={<ModelPlaceholder />}>
            <PersonaModelStage />
          </Suspense>
        </PersonaModelImportBoundary>
      ) : (
        <ModelPlaceholder />
      )}
    </div>
  );
}

export default function Persona() {
  return (
    <section className="section persona" id="persona">
      <div className="gridplane" />
      <div className="shell persona__grid">
        <div className="persona__copy">
          <SectionHead
            num="02"
            kicker="02 · PILLAR 4 — THE AI PERSONA"
            title={
              <>
                The voice that <span className="txt-grad">teases</span> every universe
              </>
            }
            sub={
              <>
                An AI-driven persona that speaks and interacts as the OC — active on X even when the
                creator isn't posting. The Nemoverse's drop schedule is its built-in content
                calendar.
              </>
            }
          />
          <Reveal delay={0.1}>
            <p className="lede">
              <b>Teasers</b> hint at the next universe before it drops. <b>Banter</b> runs between
              the OC and its alternate selves. <b>Drafting</b> turns a topic into in-character posts
              for review. And this <b>chatbot</b> answers questions about specific universes, right
              here on the Hub.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="persona__cap">
              <span className="pulse-dot" />
              <span>
                <b>BUILT ON THE CLAUDE API</b> with a custom persona system prompt — voice, backstory
                and tone. Clear content guardrails keep the character on-brand. Rate-limited, no
                persistent memory required. <em>This demo runs on a canned in-canon brain; swap the
                reply engine for the real API.</em>
              </span>
            </div>
          </Reveal>
        </div>

        <div className="persona__chatwrap">
          <PersonaModelSlot />
          <NemoChat />
        </div>
      </div>
    </section>
  );
}
