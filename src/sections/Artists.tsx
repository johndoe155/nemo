import { Reveal, SectionHead } from '../components/ui';
import { ARTISTS, UNIVERSES } from '../lib/data';

export default function Artists() {
  return (
    <section className="section artists" id="artists">
      <div className="shell">
        <SectionHead
          num="06"
          kicker="06 · PERMANENT PUBLIC CREDITS"
          kickerGold
          title={
            <>
              Every universe, <span className="txt-gold">credited forever</span>
            </>
          }
          sub={
            <>
              The artists behind the Multiverse are credited publicly on the Hub and in each
              piece's own metadata. The spotlight is tied directly to Multiverse credits — the
              collection is only as strong as its canon.
            </>
          }
        />

        <div className="artists__grid artists__grid--masonry">
          {ARTISTS.map((a, i) => {
            const credited = UNIVERSES.filter((u) => u.artist.name === a.name);
            return (
              <Reveal key={a.name} delay={i * 0.06} y={30}>
                <div
                  className="card artistcard"
                  style={{ '--ac': a.hue[0], '--a1': a.hue[0], '--a2': a.hue[1] }}
                >
                  <span className="artistcard__ava">{a.initials}</span>
                  <div className="artistcard__body">
                    <b>{a.name}</b>
                    <span className="handle">{a.handle}</span>
                    <span className="credit">
                      CANON CREDIT · {credited.map((u) => u.code).join(' · ') || 'UPCOMING'}
                    </span>
                    <p className="quote">{a.quote}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
