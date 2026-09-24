import { useReducedMotion, useTransform } from 'framer-motion';
import { motion } from 'framer-motion';
import { useTilt } from './motion';
import CardImage from './CardImage';
import type { Universe } from '../lib/data';
import { RARITY } from '../lib/data';
import { plateSerial } from '../lib/serials';

/* ------------------------- Universe card -------------------------

   THE SPECIMEN PLATE (IDENTITY-SPEC §2.2 beat 2, §6).

   The card is a museum field-guide plate for one timeline: an ink-ruled
   specimen window holding the artwork, a catalogue strip that leads with the
   EDITION SERIAL (never a rarity gem — §6.1), and a printed data band. The
   tier is expressed as a seal and a treatment, not a colour.

   Depth model (2.5D, deliberately NOT preserve-3d — overflow:hidden on the
   card would flatten it, so depth is authored as layered counter-motion):
     · card          — useTilt springs (rotateX/Y ±2.5°, lift −8, press .985)
     · media-inner   — art counter-moves ±5px against the tilt (parallax)
     · seal/window tags — counter-move ±8px (nearest plane, moves the most)
     · catalogue strip/body — hold still (the stationary reference plane)

   Motion authority: framer owns `transform` on this element; rail rhythm
   (zig-zag) and the ghost numeral use the independent `translate`/`rotate`
   properties so they compose instead of compete. */

export default function UniverseCard({
  u,
  onClick,
  index,
  lifted = false,
}: {
  u: Universe;
  onClick: (u: Universe) => void;
  index?: number;
  /** True while this card's own dialog is open: the media plate surrenders
   *  its layoutId to the panel (P3.13 — see the media wrapper). */
  lifted?: boolean;
}) {
  const rarity = RARITY[u.rarity];
  const accent = rarity.color;
  const soldPct = u.supply ? Math.round((u.minted / u.supply) * 100) : 0;
  const reduce = useReducedMotion();
  const tilt = useTilt<HTMLElement>({ maxDeg: 2.5, lift: -8, parallax: 5 });

  // The seal sits on the nearest plane: derive a stronger counter-move from
  // the same smoothed tilt springs (±8px at full throw).
  const badgeX = useTransform(tilt.springs.ry, [-5, 5], [8, -8]);
  const badgeY = useTransform(tilt.springs.rx, [-5, 5], [-8, 8]);

  const nameId = `ucard-name-${u.id}`;
  const actId = `ucard-act-${u.id}`;
  const serial = plateSerial(u.code);

  return (
    <motion.article
      ref={tilt.ref}
      className={`ucard plate plate--${u.rarity}`}
      data-tier={u.rarity}
      style={{
        '--card-accent': accent,
        '--a1': u.artist.hue[0],
        '--a2': u.artist.hue[1],
        ...tilt.style,
      }}
      {...tilt.handlers}
      onClick={() => onClick(u)}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      data-cursor="OPEN"
      aria-labelledby={`${nameId} ${actId}`}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(u);
        }
      }}
      /* Rail reflow (filter/sort) animates through AnimatePresence popLayout
         in Nemoverse.tsx — spring layout in, quick exit out. Layout springs
         collapse to plain fades under prefers-reduced-motion. */
      layout={!reduce}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.2 } }
          : { opacity: 0, transition: { duration: 0.28, ease: [0.76, 0, 0.24, 1] } }
      }
      transition={{ layout: { type: 'spring', stiffness: 240, damping: 26 } }}
    >
      <span id={actId} className="vh">Open universe details</span>

      {/* ---- catalogue strip: the serial is the card's identity (§6.1) ---- */}
      <header className="ucard__catalogue">
        <span className="ucard__serial">{serial}</span>
        <span className="ucard__catalogue-rule" aria-hidden="true" />
        <span className="ucard__tier">{rarity.label}</span>
      </header>

      {/* P3.13 (audit 2.5) — the media plate is the SHARED ELEMENT: while the
          card's own dialog is open it surrenders its layoutId (`plate-<id>`)
          to the dialog panel, and framer's layout projection carries the one
          image across the two DOM trees on a single 0.6 s expo-spring. The
          card "becomes" the dialog instead of the dialog appearing beside a
          copy. Reduce collapses it back to two plain renders. */}
      <motion.div
        className="ucard__media"
        style={{ position: 'relative' }}
        layoutId={lifted || reduce ? undefined : `plate-${u.id}`}
        transition={{ layout: { type: 'spring', stiffness: 190, damping: 27, mass: 0.9 } }}
      >
        {/* Parallax plane: skeleton + bitmap. The window rule stays outside it. */}
        <motion.div className="ucard__media-inner" style={{ x: tilt.layer.x, y: tilt.layer.y }}>
          <div
            className="ucard-skeleton"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              background: `radial-gradient(80% 70% at 50% 40%, color-mix(in srgb, ${accent} 14%, transparent), transparent 72%)`,
              opacity: 1,
              transition: 'opacity 0.6s ease',
            }}
            aria-hidden="true"
          />
          {u.image ? (
            <CardImage
              src={u.image}
              alt={`${u.name} — ${u.artist.name}`}
              eager={index === undefined || index <= 2}
              sizes="(min-width: 861px) 26vw, (min-width: 401px) 45vw, calc(100vw - 3.4rem)"
              onLoaded={(img) => {
                const sk = img.closest('.ucard__media-inner')?.querySelector<HTMLElement>('.ucard-skeleton');
                if (sk) sk.style.opacity = '0';
              }}
            />
          ) : (
            <div className="ucard__lock">
              <div className="ring orbit spin" style={{ width: 74, height: 74 }} />
              <div className="q">▚▚▚</div>
              <p>ART SEALED UNTIL DROP</p>
            </div>
          )}
        </motion.div>

        {/* window furniture: corner ticks read as a specimen frame */}
        <span className="ucard__tick ucard__tick--tl" aria-hidden="true" />
        <span className="ucard__tick ucard__tick--tr" aria-hidden="true" />
        <span className="ucard__tick ucard__tick--bl" aria-hidden="true" />
        <span className="ucard__tick ucard__tick--br" aria-hidden="true" />

        <span className="ucard__code">{u.code}</span>

        {/* the seal — a stamp impression, not a glowing badge */}
        <motion.div className="ucard__seal" style={{ x: badgeX, y: badgeY }}>
          <span className="seal" data-tier={u.rarity}>
            <span className="seal__ring" aria-hidden="true" />
            <span className="seal__label">{rarity.label}</span>
            {u.status === 'upcoming' && <span className="seal__sub">NEXT DROP</span>}
          </span>
        </motion.div>

        {u.status === 'sold-out' && (
          <span className="ucard__sold">SOLD OUT · {u.minted}/{u.supply}</span>
        )}
      </motion.div>

      <div className="ucard__body">
        <h3 className="ucard__name" id={nameId}>{u.name}</h3>
        <p className="ucard__world">{u.world}</p>
        <p className="ucard__lore">{u.lore}</p>

        {/* printed data band — labels over tabular values */}
        <dl className="ucard__data">
          <div>
            <dt>SUPPLY</dt>
            <dd>{u.supply}</dd>
          </div>
          <div>
            <dt>{u.status === 'sold-out' ? 'MINTED' : 'CLAIMED'}</dt>
            <dd>
              {u.minted}
              <em>/{u.supply}</em>
            </dd>
          </div>
          <div>
            <dt>PRICE</dt>
            <dd>{u.price > 0 ? `${u.price}Ξ` : '—'}</dd>
          </div>
        </dl>

        {u.status === 'live' && (
          <div
            className="ucard__claim"
            role="progressbar"
            aria-label={`${soldPct}% claimed`}
            aria-valuenow={soldPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ ['--p' as string]: soldPct / 100 }} />
            <span className="ucard__claim-ticks" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <em key={i} data-on={i < Math.round(soldPct / 10)} />
              ))}
            </span>
          </div>
        )}

        <footer className="ucard__sign">
          <span className="ucard__sign-stamp" aria-hidden="true">{u.artist.initials}</span>
          <span className="ucard__sign-name">
            <b>{u.artist.name}</b>
            <em>{u.artist.handle}</em>
          </span>
          <span className="ucard__sign-style">{u.style}</span>
        </footer>
      </div>
    </motion.article>
  );
}
