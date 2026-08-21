import { Reveal, SectionHead } from '../components/ui';
import NemoChat from '../components/NemoChat';

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
          <NemoChat />
        </div>
      </div>
    </section>
  );
}
