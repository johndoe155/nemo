import { useReducedMotion, useTransform } from 'framer-motion';
import { motion } from 'framer-motion';
import { useTilt } from './motion';
import CardImage from './CardImage';
import type { Universe } from '../lib/data';
import { RARITY } from '../lib/data';

/* ------------------------- Universe card -------------------------

   Depth model (2.5D, deliberately NOT preserve-3d — overflow:hidden on the
   card would flatten it, so depth is authored as layered counter-motion):
     · card          — useTilt springs (rotateX/Y ±2.5°, lift −8, press .985)
     · media-inner   — art counter-moves ±5px against the tilt (parallax)
     · badges        — counter-move ±8px (nearest plane, moves the most)
     · scrims/body   — hold still (the stationary reference plane)
   The ::before bloom + cursor sheen (useCursorGlow) add light on top.

   Motion authority: framer owns `transform` on this element; rail rhythm
   (zig-zag) and the ghost numeral use the independent `translate`/`rotate`
   properties so they compose instead of compete. */

export default function UniverseCard({
  u,
  onClick,
  index,
}: {
  u: Universe;
  onClick: (u: Universe) => void;
  index?: number;
}) {
  const rarity = RARITY[u.rarity];
  const accent = rarity.color;
  const soldPct = u.supply ? Math.round((u.minted / u.supply) * 100) : 0;
  const reduce = useReducedMotion();
  const tilt = useTilt<HTMLElement>({ maxDeg: 2.5, lift: -8, parallax: 5 });

  // Badges sit on the nearest plane: derive a stronger counter-move from the
  // same smoothed tilt springs (±8px at full throw).
  const badgeX = useTransform(tilt.springs.ry, [-5, 5], [8, -8]);
  const badgeY = useTransform(tilt.springs.rx, [-5, 5], [-8, 8]);

  const nameId = `ucard-name-${u.id}`;
  const actId = `ucard-act-${u.id}`;

  return (
    <motion.article
      ref={tilt.ref}
      className="ucard sheen"
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
      onKeyDown={(e) => {
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
      <div className="ucard__index" aria-hidden="true">{u.code}</div>
      <span id={actId} className="vh">Open universe details</span>
      <div className="ucard__media" style={{ position: 'relative' }}>
        {/* Parallax plane: skeleton + bitmap. Scrims stay outside it. */}
        <motion.div className="ucard__media-inner" style={{ x: tilt.layer.x, y: tilt.layer.y }}>
          <div
            className="ucard-skeleton"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              background: `radial-gradient(80% 70% at 50% 40%, ${accent}18, transparent 72%)`,
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
        {u.image && (
          <>
            <div className="scrim-top" />
            <div className="scrim" />
          </>
        )}
        <span className="ucard__code">{u.code}</span>
        <motion.div className="ucard__badges" style={{ x: badgeX, y: badgeY }}>
          <span className="badge" style={{ '--c': accent }}>
            {rarity.label}
          </span>
          {u.status === 'upcoming' && (
            <span className="badge" style={{ '--c': 'var(--cyan)' }}>
              NEXT DROP
            </span>
          )}
        </motion.div>
        {u.status === 'sold-out' && <span className="ucard__sold">SOLD OUT · {u.minted}/{u.supply}</span>}
      </div>

      <div className="ucard__body">
        <h3 className="ucard__name" id={nameId}>{u.name}</h3>
        <p className="ucard__world">{u.world}</p>
        <p className="ucard__lore">{u.lore}</p>
        <div className="ucard__meta">
          <span>
            SUPPLY <b>{u.supply}</b>
          </span>
          <span>
            {u.status === 'sold-out' ? 'MINTED' : 'CLAIMED'} <b>{u.minted}/{u.supply}</b>
          </span>
          <span>
            PRICE <b style={{ color: 'var(--gold)' }}>{u.price > 0 ? `${u.price}Ξ` : '—'}</b>
          </span>
        </div>
        {u.status === 'live' && (
          <div className="progress" style={{ marginTop: 10 }} aria-label={`${soldPct}% claimed`}>
            <i style={{ ['--p' as string]: soldPct / 100 }} />
          </div>
        )}
        <div className="ucard__artist">
          <span className="ava">{u.artist.initials}</span>
          <span>
            {u.artist.name} <em>· {u.style}</em>
          </span>
        </div>
      </div>
    </motion.article>
  );
}
