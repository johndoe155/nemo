import { motion } from 'framer-motion';
import CardImage from './CardImage';
import { cardAction, RARITY, STATUS_LABEL, type Universe } from '../lib/data';
import { HOLDER_DISCOUNT } from '../lib/data';
import { claimPct, discount, fmtEth, useCountdown } from '../lib/util';
import { useTilt } from '../lib/tilt';

function CountdownChip({ target }: { target: string }) {
  const t = useCountdown(target);
  return (
    <span className="nshop-chip nshop-chip--count">
      <span className="nshop-chip__dot" aria-hidden="true" />
      CLAIMS IN {t.d}:{t.h}:{t.m}
    </span>
  );
}

function PriceBlock({ u, holder }: { u: Universe; holder: boolean }) {
  if (u.status === 'sold-out')
    return (
      <span className="nshop-price nshop-price--meta">
        MINTED <b>{u.minted}/{u.supply}</b>
      </span>
    );
  if (u.status === 'encrypted')
    return <span className="nshop-price nshop-price--meta nshop-price--sealed">▚▚▚ · SEALED</span>;
  if (u.status === 'secret')
    return <span className="nshop-price nshop-price--meta nshop-price--sealed">??? · UNLISTED</span>;

  const isLive = u.status === 'live';

  if (isLive) {
    if (holder) {
      return (
        <span className="nshop-price">
          <s className="nshop-price__strike">{fmtEth(u.price)}Ξ</s>
          <b>{fmtEth(discount(u.price, HOLDER_DISCOUNT))}Ξ</b>
          <em className="nshop-price__tag">HOLDER −25%</em>
        </span>
      );
    }
    return (
      <span className="nshop-price">
        <b>{fmtEth(u.price)}Ξ</b>
        <em className="nshop-price__unit">BASE</em>
      </span>
    );
  }
  // upcoming
  if (holder) {
    return (
      <span className="nshop-price">
        <s className="nshop-price__strike">{fmtEth(u.price)}Ξ</s>
        <b>{fmtEth(discount(u.price, HOLDER_DISCOUNT))}Ξ</b>
        <em className="nshop-price__tag">HOLDER −25%</em>
      </span>
    );
  }
  return (
    <span className="nshop-price nshop-price--meta nshop-price--soon">
      {fmtEth(u.price)}Ξ <em>AT DROP</em>
    </span>
  );
}

export default function CardCard({
  u,
  holder,
  index,
  onOpen,
  onQuickAdd,
}: {
  u: Universe;
  holder: boolean;
  index: number;
  onOpen: (u: Universe) => void;
  onQuickAdd: (u: Universe) => void;
}) {
  const rarity = RARITY[u.rarity];
  const accent = rarity.color;
  const action = cardAction(u, holder);
  const acquirable = action.kind === 'add' || action.kind === 'hold';
  const soldPct = claimPct(u.minted, u.supply);
  const tilt = useTilt(2.2, -6, 4);

  const showUpcoming = u.status === 'upcoming';
  const showLock = u.status === 'encrypted';

  return (
    <motion.article
      ref={tilt.ref}
      className="nshop-card"
      style={{ '--card-accent': accent, ...tilt.style } as unknown as React.CSSProperties}
      {...tilt.handlers}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Media — the "open details" trigger (a sibling of ADD, never nested). */}
      <div
        className="nshop-card__media"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`View ${u.code} ${u.name} details`}
        onClick={() => onOpen(u)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(u);
          }
        }}
      >
        <div
          className="nshop-card__skeleton"
          style={{ background: `radial-gradient(80% 70% at 50% 40%, ${accent}16, transparent 72%)` }}
          aria-hidden="true"
        />
        <motion.div className="nshop-card__layer" style={tilt.layer}>
          {u.image ? (
            <CardImage
              src={u.image}
              alt=""
              eager={index < 3}
              sizes="(min-width: 1180px) 20vw, (min-width: 900px) 26vw, (min-width: 560px) 44vw, 92vw"
              onLoaded={(img) => {
                const sk = img
                  .closest('.nshop-card__media')
                  ?.querySelector<HTMLElement>('.nshop-card__skeleton');
                if (sk) sk.style.opacity = '0';
              }}
            />
          ) : (
            <div className="nshop-card__lock" aria-hidden="true">
              <span className="nshop-card__lock-ring" />
              <span className="nshop-card__lock-q">▚▚▚</span>
              <span className="nshop-card__lock-p">ART SEALED UNTIL REVEAL</span>
            </div>
          )}
        </motion.div>

        {u.image && (
          <>
            <div className="nshop-card__scrim-top" aria-hidden="true" />
            <div className="nshop-card__scrim" aria-hidden="true" />
          </>
        )}

        <span className="nshop-card__code">{u.code}</span>
        <div className="nshop-card__badges" aria-hidden="true">
          <span className="nshop-badge" style={{ '--c': accent } as React.CSSProperties}>
            {rarity.label}
          </span>
          {u.status === 'live' && <span className="nshop-badge nshop-badge--live">LIVE</span>}
          {showUpcoming && (
            <span className="nshop-badge" style={{ '--c': 'var(--cyan)' } as React.CSSProperties}>
              NEXT DROP
            </span>
          )}
          {showLock && (
            <span className="nshop-badge" style={{ '--c': 'var(--iris)' } as React.CSSProperties}>
              ENCRYPTED
            </span>
          )}
        </div>

        {showUpcoming && <CountdownChip target={u.released} />}
        {u.status === 'sold-out' && (
          <span className="nshop-card__sold" aria-hidden="true">
            SOLD OUT · {u.minted}/{u.supply}
          </span>
        )}
        <span className="nshop-card__viewhint" aria-hidden="true">
          VIEW
        </span>
      </div>

      <div className="nshop-card__body">
        <h3 className="nshop-card__name">{u.name}</h3>
        <p className="nshop-card__world">{u.world}</p>
        <p className="nshop-card__lore">{u.lore}</p>

        <div className="nshop-card__row">
          <PriceBlock u={u} holder={holder} />

          <button
            type="button"
            className={`nshop-btn nshop-btn--sm ${
              acquirable ? 'nshop-btn--primary' : 'nshop-btn--ghost'
            } ${!acquirable ? 'is-disabled' : ''}`}
            disabled={!acquirable}
            onClick={() => onQuickAdd(u)}
            aria-label={
              acquirable ? `Add ${u.code} ${u.name} to cart` : `${u.code} ${u.name} is not acquirable`
            }
          >
            {action.kind === 'hold' ? (
              <span className="nshop-card__cta-txt">
                CLAIM EARLY<small>HOLDER</small>
              </span>
            ) : action.kind === 'add' ? (
              'ADD'
            ) : action.kind === 'soon' ? (
              <span className="nshop-card__cta-txt">
                {STATUS_LABEL[u.status]}
                <small>HOLDERS FIRST</small>
              </span>
            ) : (
              action.label
            )}
          </button>
        </div>

        {(u.status === 'live' || u.status === 'sold-out') && (
          <div
            className="nshop-card__progress"
            role="progressbar"
            aria-valuenow={soldPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${soldPct}% claimed`}
          >
            <i style={{ ['--nfill' as string]: soldPct }} />
          </div>
        )}

        <div className="nshop-card__artist">
          <span
            className="nshop-card__ava"
            style={{ background: `linear-gradient(135deg, ${u.artist.hue[0]}, ${u.artist.hue[1]})` }}
          >
            {u.artist.initials}
          </span>
          <span className="nshop-card__who">
            {u.artist.name} <em>· {u.style}</em>
          </span>
        </div>
      </div>
    </motion.article>
  );
}
