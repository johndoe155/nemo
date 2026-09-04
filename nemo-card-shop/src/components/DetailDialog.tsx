import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CardImage from './CardImage';
import { cardAction, HOLDER_DISCOUNT, RARITY, STATUS_LABEL, type Universe } from '../lib/data';
import { claimPct, discount, fmtEth, useCountdown } from '../lib/util';

function useDialogFocus(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  // Keep the latest close handler in a ref so the keydown listener never
  // re-fires the mount effect (which would steal focus from an in-use control).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    // Focus the dialog on open.
    const first = focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && idx <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [ref]);
}

/** Inner panel — mounted/unmounted by AnimatePresence, so focus state resets. */
function DetailPanel({
  u,
  holder,
  onClose,
  onAdd,
}: {
  u: Universe;
  holder: boolean;
  onClose: () => void;
  onAdd: (u: Universe) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(rootRef, onClose);

  const accent = RARITY[u.rarity].color;
  const action = cardAction(u, holder);
  const acquirable = action.kind === 'add' || action.kind === 'hold';
  const pct = claimPct(u.minted, u.supply);

  return (
    <motion.div
      ref={rootRef}
      className="nshop-dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="nshop-dialog"
        style={{ ['--card-accent' as string]: accent }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nshop-dialog-title"
        initial={{ opacity: 0, y: 22, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <button type="button" className="nshop-dialog__close" onClick={onClose} aria-label="Close details">
          ✕
        </button>

        <div className="nshop-dialog__art">
          <div className="nshop-dialog__artbox">
            {u.image ? (
              <CardImage
                src={u.image}
                alt={`${u.name} key art by ${u.artist.name}`}
                sizes="(min-width: 820px) 42vw, 92vw"
                eager
              />
            ) : (
              <div className="nshop-card__lock" aria-hidden="true">
                <span className="nshop-card__lock-ring" />
                <span className="nshop-card__lock-q">▚▚▚</span>
                <span className="nshop-card__lock-p">SIGNED · SEALED</span>
              </div>
            )}
            <div className="nshop-dialog__scrim" />
            <span className="nshop-dialog__code">{u.code}</span>
          </div>
        </div>

        <div className="nshop-dialog__info">
          <div className="nshop-dialog__kickers">
            <span className="nshop-badge" style={{ '--c': accent } as React.CSSProperties}>
              {RARITY[u.rarity].label}
            </span>
            <span className="nshop-badge nshop-badge--status" data-status={u.status}>
              {STATUS_LABEL[u.status]}
            </span>
            {holder && (
              <span className="nshop-badge nshop-badge--holder">HOLDER −25%</span>
            )}
          </div>

          <h2 className="nshop-dialog__title" id="nshop-dialog-title">
            {u.name}
          </h2>
          <p className="nshop-dialog__world">{u.world}</p>

          <p className="nshop-dialog__lore">{u.lore}</p>

          <div className="nshop-dialog__meta">
            <div className="nshop-dialog__cell">
              <span>SUPPLY</span>
              <b>{u.supply}</b>
            </div>
            <div className="nshop-dialog__cell">
              <span>MINTED</span>
              <b>{u.minted}/{u.supply}</b>
            </div>
            <div className="nshop-dialog__cell">
              <span>RELEASE</span>
              <b>
                {new Date(u.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </b>
            </div>
            <div className="nshop-dialog__cell">
              <span>EDITION</span>
              <b>{RARITY[u.rarity].label}</b>
            </div>
          </div>

          {(u.status === 'live' || u.status === 'sold-out' || u.status === 'upcoming') && (
            <div
              className="nshop-dialog__progress"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% claimed`}
            >
              <span className="nshop-dialog__progresslabel">CLAIMED</span>
              <span className="nshop-dialog__bar">
                <i style={{ ['--nfill' as string]: pct }} />
              </span>
              <b className="nshop-dialog__pct">{pct}%</b>
            </div>
          )}

          <div className="nshop-dialog__artist">
            <span
              className="nshop-card__ava nshop-card__ava--lg"
              style={{ background: `linear-gradient(135deg, ${u.artist.hue[0]}, ${u.artist.hue[1]})` }}
            >
              {u.artist.initials}
            </span>
            <div>
              <p className="nshop-dialog__artist-name">{u.artist.name}</p>
              <p className="nshop-dialog__artist-handle">{u.artist.handle} · {u.style}</p>
              <p className="nshop-dialog__artist-quote">{u.artist.quote}</p>
            </div>
          </div>

          <div className="nshop-dialog__palette" aria-label="Palette swatches">
            {u.palette.map((c) => (
              <span key={c} className="nshop-swatch">
                <i className="nshop-swatch__chip" style={{ background: c }} />
                <code>{c}</code>
              </span>
            ))}
          </div>

          <div className="nshop-dialog__tags">
            {u.tags.map((t) => (
              <span key={t} className="nshop-tag">{t}</span>
            ))}
          </div>
          {u.variant && <p className="nshop-dialog__variant">VARIANT NOTE — {u.variant}</p>}

          <div className="nshop-dialog__buy">
            <Price u={u} holder={holder} acquirable={acquirable} />
            <button
              type="button"
              className="nshop-btn nshop-btn--lg nshop-btn--primary"
              disabled={!acquirable}
              onClick={() => onAdd(u)}
            >
              {action.kind === 'hold'
                ? 'CLAIM EARLY — HOLDER'
                : action.kind === 'add'
                  ? holder
                    ? 'SECURE THE PIECE'
                    : 'ADD TO CART'
                  : action.label}
            </button>
          </div>
          <p className="nshop-dialog__demohint">
            Demo checkout — no real payment is processed.
            {!holder && u.status === 'upcoming' && ' Connect as a holder to claim early.'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DetailDialog({
  u,
  holder,
  onClose,
  onAdd,
}: {
  u: Universe | null;
  holder: boolean;
  onClose: () => void;
  onAdd: (u: Universe) => void;
}) {
  return (
    <AnimatePresence>
      {u && <DetailPanel key={u.code} u={u} holder={holder} onClose={onClose} onAdd={onAdd} />}
    </AnimatePresence>
  );
}

function CountdownInline({ target }: { target: string }) {
  const t = useCountdown(target);
  return (
    <div className="nshop-dialog__countdown" role="timer" aria-label="Time until claims open">
      <span className="nshop-dialog__cdlabel">CLAIMS OPEN IN</span>
      <span className="nshop-dialog__cdcells">
        <b>{t.d}<em>D</em></b>
        <i>:</i>
        <b>{t.h}<em>H</em></b>
        <i>:</i>
        <b>{t.m}<em>M</em></b>
        <i>:</i>
        <b>{t.s}<em>S</em></b>
      </span>
    </div>
  );
}

function Price({
  u,
  holder,
  acquirable,
}: {
  u: Universe;
  holder: boolean;
  acquirable: boolean;
}) {
  const displayBase = u.price > 0;

  if (!acquirable) {
    if (u.status === 'upcoming' && !holder) return <CountdownInline target={u.released} />;
    if (u.status === 'sold-out') return <PriceStat label="FULLY MINTED" value={`${u.minted}/${u.supply}`} />;
    if (u.status === 'encrypted') return <PriceStat label="REGISTRY ENTRY" value="▚▚▚" />;
    if (u.status === 'secret') return <PriceStat label="UNLISTED" value="???" />;
  }

  const holderPriced =
    holder && displayBase && (u.status === 'live' || (u.status === 'upcoming' && acquirable));
  const real = holderPriced ? discount(u.price, HOLDER_DISCOUNT) : u.price;

  return (
    <div className="nshop-dialog__price">
      {holderPriced && <s className="nshop-dialog__strike">{fmtEth(u.price)}Ξ</s>}
      <span className="nshop-dialog__amount">
        {displayBase ? (
          <>
            <b>{fmtEth(real)}</b>Ξ
          </>
        ) : (
          <b>—</b>
        )}
      </span>
      {holderPriced && <span className="nshop-price__tag nshop-price__tag--lg">HOLDER −25%</span>}
      {!holder && u.status === 'live' && displayBase && (
        <span className="nshop-price__unit">ETH ON BASE</span>
      )}
    </div>
  );
}

function PriceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="nshop-dialog__price">
      <span className="nshop-dialog__amount">
        <b>{value}</b>
      </span>
      <span className="nshop-dialog__statlabel">{label}</span>
    </div>
  );
}
