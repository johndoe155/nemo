import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { Reveal, SectionHead } from '../components/ui';
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
  const sectionRef = useRef<HTMLElement | null>(null);
  /* ONE TAKE — the museum light lands when the section enters (CSS
     transition on .persona.in-view, see styles/chapters.css). */
  const inView = useInView(sectionRef, { once: true, margin: '-12% 0px' });
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (inView) setEntered(true);
  }, [inView]);

  return (
    <section
      className={`section persona${entered ? ' in-view' : ''}`}
      id="persona"
      ref={sectionRef}
    >
      <div className="gridplane" />
      <div className="shell persona__layout">
        <div className="persona__head">
          <SectionHead
            num="01"
            kicker="THE VOICE"
            title={
              <>
                The voice that <span className="hl-act">teases</span> every universe
              </>
            }
            sub={
              <>
                NEMO speaks for himself — on the Hub, on X, between drops and after them.
                This is a live transmission; he notices you are here.
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
