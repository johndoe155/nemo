import { motion } from 'framer-motion';
import { Reveal, SectionHead } from '../components/ui';
import { useTilt } from '../components/motion';
import { ARTISTS, UNIVERSES } from '../lib/data';

/* Artist cards share the tilt family at reduced throw (see Perks). */
function ArtistCard({ a, i }: { a: (typeof ARTISTS)[number]; i: number }) {
  const tilt = useTilt<HTMLDivElement>({ maxDeg: 1.6, lift: -4 });
  const credited = UNIVERSES.filter((u) => u.artist.name === a.name);
  const credit = `CANON CREDIT · ${credited.map((u) => u.code).join(' · ') || 'UPCOMING'}`;
  return (
    <Reveal className="artists__grid-item" delay={i * 0.06} y={30} blur={false}>
      <motion.div
        ref={tilt.ref}
        className="card artistcard sheen"
        style={{ '--card-accent': a.hue[0], '--ac': a.hue[0], '--a1': a.hue[0], '--a2': a.hue[1], ...tilt.style }}
        {...tilt.handlers}
      >
        <span className="artistcard__ava">{a.initials}</span>
        <div className="artistcard__body">
          <b>{a.name}</b>
          <span className="handle">{a.handle}</span>
          <span className="credit" title={credit}>{credit}</span>
          <p className="quote">{a.quote}</p>
        </div>
      </motion.div>
    </Reveal>
  );
}

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
              The artists behind the Nemoverse are credited publicly on the Hub and in each
              piece's own metadata. The spotlight is tied directly to Nemoverse credits — the
              collection is only as strong as its canon.
            </>
          }
        />

        <div className="artists__grid artists__grid--masonry">
          {ARTISTS.map((a, i) => (
            <ArtistCard key={a.name} a={a} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
