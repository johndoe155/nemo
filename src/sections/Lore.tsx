import { Reveal, SectionHead } from '../components/ui';
import { LORE_STATS, LORE_TIMELINE } from '../lib/data';

export default function Lore() {
  return (
    <section className="section lore" id="lore">
      <div className="shell lore__grid">
        <div className="lore__copy">
          <SectionHead
            kicker="THE CORE IDENTITY"
            title={
              <>
                Who is <span className="txt-grad">NEMO</span>?
              </>
            }
          />
          <Reveal delay={0.08}>
            <p>
              <b>NEMO is one canon character</b> — a wanderer between timelines whose face is a
              small, radiant star. He is not a hero and not quite a ghost: he is the{' '}
              <span className="hl">constant</span> that every timeline keeps re-discovering, and
              the variable that every artist keeps re-drawing.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <p>
              Every commissioned artwork is not fan art — it is an <span className="hl">official,
              numbered universe</span>: its own timeline, world, and lore blurb, tied back to the
              character's existing story. The artist gets a permanent canon credit and a{' '}
              <span className="hl-gold">60/40 revenue split</span> on every minted edition.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p>
              New universes release on a set cadence — <span className="hl">one every few weeks</span> —
              instead of whenever a commission happens to wrap. Fans anticipate drops. Holders enter
              first. Every purchase pulls a piece back out. The Multiverse{' '}
              <span className="hl-gold">funds its own growth</span>.
            </p>
          </Reveal>

          <div className="lore__stats">
            {LORE_STATS.map((s, i) => (
              <Reveal key={s.label} delay={0.08 + i * 0.05} y={22}>
                <div className="lorestat">
                  <b>
                    {s.value}
                    {s.suffix}
                  </b>
                  <span>{s.label}</span>
                  <em>{s.note}</em>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div>
          <SectionHead kicker="CANON TIMELINE" title={<>The story so far</>} />
          <div className="timeline">
            {LORE_TIMELINE.map((t, i) => (
              <Reveal key={t.when} delay={0.06 + i * 0.07} y={24}>
                <div className="tlitem">
                  <time>{t.when}</time>
                  <b>{t.title}</b>
                  <p>{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
