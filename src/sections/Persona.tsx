import { Component, Suspense, lazy, useEffect, useRef, type ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { Reveal } from '../components/ui';
import { RevealLine, RevealText } from '../components/reveal';
import NemoChat from '../components/NemoChat';
import { useMediaQuery } from '../lib/singularityGate';
import { useQuality } from '../lib/ChapterProvider';

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

/* ---------------------------------------------------------------------------
   useAttention — the persona notices you.

   Highly restrained by design: a few pixels of translate and a couple of
   degrees of yaw on the character's CONTAINER, spring-smoothed, capped hard,
   and disabled outright on coarse pointers, under reduced motion and on low
   tiers. It is a sense of being looked at, not a head-tracking demo — and it
   never becomes the reason the section exists.
--------------------------------------------------------------------------- */

const ATTENTION_MAX = 14; // px of travel
const ATTENTION_YAW = 2.4; // degrees

function useAttention(ref: React.RefObject<HTMLDivElement | null>) {
  const quality = useQuality();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!quality.liveCursor) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      /* -1..1 from the character's own centre, clamped so a cursor across
         the room cannot throw the pose. */
      tx = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / r.width) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - (r.top + r.height / 2)) / r.height) * 2));
    };

    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.setProperty('--att-x', (cx * ATTENTION_MAX).toFixed(2) + 'px');
      el.style.setProperty('--att-y', (cy * ATTENTION_MAX * 0.55).toFixed(2) + 'px');
      el.style.setProperty('--att-yaw', (cx * ATTENTION_YAW).toFixed(2) + 'deg');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      el.style.removeProperty('--att-x');
      el.style.removeProperty('--att-y');
      el.style.removeProperty('--att-yaw');
    };
  }, [ref, quality.liveCursor]);
}

function DesktopPersonaModel() {
  const isDesktop = useMediaQuery(PERSONA_DESKTOP_QUERY);
  const slotRef = useRef<HTMLDivElement>(null);
  const isNearViewport = useInView(slotRef, { once: true, margin: '500px 0px' });
  useAttention(slotRef);

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
      <div className="gridplane" />
      <div className="shell persona__layout">
        {/* 03 · VOICE. The section no longer explains the technology up
            front — it introduces a presence. The technical note is still
            there, but it sits under the encounter where it belongs. */}
        <div className="persona__head">
          <RevealLine at={0}>
            <span className="kicker">03 · VOICE — THE AI PERSONA</span>
          </RevealLine>
          <RevealText at={0.06}>
            <h2 className="display persona__title">
              The voice that <span className="txt-grad">teases</span> every universe
            </h2>
          </RevealText>
          <RevealText at={0.2}>
            <p className="persona__sub">
              It speaks as the OC — on X, in the archive, and here. The Nemoverse&rsquo;s drop
              schedule is its content calendar, and it has opinions about every version of
              itself.
            </p>
          </RevealText>
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
