import { useState } from 'react';
import type { Universe } from '../lib/data';
import { RARITY } from '../lib/data';

/* ------------------------- Universe card ------------------------- */

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
  const [loaded, setLoaded] = useState(false);

  return (
    <article
      className="ucard sheen"
      style={
        {
          '--card-accent': accent,
          '--a1': u.artist.hue[0],
          '--a2': u.artist.hue[1],
        }
      }
      onClick={() => onClick(u)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${u.code} — ${u.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(u);
        }
      }}
    >
      <div className="ucard__index" aria-hidden="true">{u.code}</div>
      <div className="ucard__media" style={{ position: 'relative' }}>
        {/* Shimmer skeleton placeholder — accent-colored ambient wash */}
        <div
          className="ucard-skeleton"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: `radial-gradient(80% 70% at 50% 40%, ${accent}18, transparent 72%)`,
            opacity: loaded ? 0 : 1,
            transition: 'opacity 0.6s ease',
          }}
          aria-hidden="true"
        />
        {u.image ? (
          <>
            <div className="scrim-top" />
            <img
              src={u.image}
              alt={`${u.name} — ${u.artist.name}`}
              loading={index !== undefined && index > 2 ? 'lazy' : 'eager'}
              onLoad={() => setLoaded(true)}
              style={{
                opacity: loaded ? 1 : 0.2,
                transition: 'opacity 0.8s ease',
                position: 'relative',
                zIndex: 1,
              }}
            />
            <div className="scrim" />
          </>
        ) : (
          <div className="ucard__lock">
            <div className="ring orbit spin" style={{ width: 74, height: 74 }} />
            <div className="q">▚▚▚</div>
            <p>ART SEALED UNTIL DROP</p>
          </div>
        )}
        <span className="ucard__code">{u.code}</span>
        <div className="ucard__badges">
          <span className="badge" style={{ '--c': accent }}>
            {rarity.label}
          </span>
          {u.status === 'upcoming' && (
            <span className="badge" style={{ '--c': '#3fe8ff' }}>
              NEXT DROP
            </span>
          )}
        </div>
        {u.status === 'sold-out' && <span className="ucard__sold">SOLD OUT · {u.minted}/{u.supply}</span>}
      </div>

      <div className="ucard__body">
        <h3 className="ucard__name">{u.name}</h3>
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
            PRICE <b style={{ color: '#ffc857' }}>{u.price > 0 ? `${u.price}Ξ` : '—'}</b>
          </span>
        </div>
        {u.status === 'live' && (
          <div className="progress" style={{ marginTop: 10 }} aria-label={`${soldPct}% claimed`}>
            <i style={{ width: `${soldPct}%` }} />
          </div>
        )}
        <div className="ucard__artist">
          <span className="ava">{u.artist.initials}</span>
          <span>
            {u.artist.name} <em>· {u.style}</em>
          </span>
        </div>
      </div>
    </article>
  );
}
