import { Reveal, SectionHead } from '../components/ui';
import NemoChat from '../components/NemoChat';

/* ============================================================================
   04 · THE PERSONA — beat 4 (zone Z2 · MID-WATER)

   IDENTITY-SPEC §7 retired the 29.5 MB GLB + 1.5 MB HDR point-model stage and
   its r3f chunk. The beat keeps the two things that matter — the chat and the
   character's face — and presents the face the way the canon art does: the
   glass bust, framed as a printed plate with tape, a serial and a material
   caption. The glass material is rationed (SPEC §4.5): this is ration slot 1.

   The portrait asset is a placeholder in the repo's own convention
   (public/art/); the final commissioned bust swaps in at the same path.
============================================================================ */

export default function Persona() {
  return (
    <section className="section persona zone-water" id="persona">
      <div className="shell persona__layout">
        <div className="persona__head">
          <SectionHead
            num="03"
            kicker="03 · THE PERSONA"
            title={
              <>
                The voice that <span className="txt-grad">teases</span> every universe
              </>
            }
            sub={
              <>
                An AI-driven persona that speaks and interacts as the OC — active on X even when
                the creator isn't posting. The Nemoverse's drop schedule is its built-in content
                calendar.
              </>
            }
          />
        </div>

        <div className="persona__interact">
          {/* The glass plate — ration slot 1 (SPEC §4.5). */}
          <Reveal delay={0.08} blur={false} className="persona__platewrap">
            <figure className="persona__plate" data-cursor="THE GLASS BUST">
              <span className="tape tape--tl" aria-hidden="true" />
              <span className="tape tape--br" aria-hidden="true" />
              <div className="persona__plate-win">
                <img
                  src="./art/persona-glass.jpg"
                  alt="The NEMO persona rendered as a translucent glass bust: mint-green glass head, round spectacles, sky-blue glass hair, pink glass hoodie."
                  width={900}
                  height={1150}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption className="persona__plate-cap">
                <span className="persona__plate-serial">ED. 0001 · THE ORIGINAL</span>
                <span className="persona__plate-mat">CAST GLASS · ONE OF ONE</span>
              </figcaption>
            </figure>
          </Reveal>
          <div className="persona__chatwrap">
            <NemoChat />
          </div>
        </div>

        <div className="persona__support">
          <Reveal delay={0.1}>
            <p className="lede">
              <b>Teasers</b> hint at the next universe before it drops. <b>Banter</b> runs between
              the OC and its alternate selves. <b>Drafting</b> turns a topic into in-character
              posts for review. And this <b>chatbot</b> answers questions about specific
              universes, right here on the Hub.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="persona__cap">
              <span className="pulse-dot" />
              <span>
                <b>BUILT ON THE CLAUDE API</b> with a custom persona system prompt — voice,
                backstory and tone. Clear content guardrails keep the character on-brand.
                Rate-limited, no persistent memory required. <em>This demo runs on a canned
                in-canon brain; swap the reply engine for the real API.</em>
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
