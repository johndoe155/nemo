import { Component, Suspense, lazy, useRef, type ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { Reveal, SectionHead } from '../components/ui';
import NemoChat from '../components/NemoChat';
import { useMediaQuery } from '../lib/singularityGate';

const PersonaModelStage = lazy(() => import('../components/PersonaModelStage'));
const PERSONA_DESKTOP_QUERY = '(min-width: 981px)';

function ModelFallback() {
  return (
    <div className="persona-model persona-model--placeholder" aria-hidden="true">
      <span className="persona-model__loader" />
    </div>
  );
}

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
          <Suspense fallback={<ModelFallback />}>
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
      <div className="gridplane" />
      <div className="shell persona__layout">
        <div className="persona__head">
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
        </div>

        <div className="persona__interact">
          <DesktopPersonaModel />
          <div className="persona__chatwrap">
            <NemoChat />
          </div>
        </div>

        <div className="persona__support">
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
      </div>
    </section>
  );
}
