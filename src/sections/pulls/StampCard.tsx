/* ============================================================================
   StampCard — THE SHEET's eight stamp windows (IDENTITY-SPEC §2.2 beat 3).

   Was the "obsidian-etched ledger": chamfered telemetry pods with wireframe
   globes, static noise and a holographic mesh for the next slot — all retired
   space language, and a per-slot pointer-tracked 3D tilt that cost a spring
   pair per window.

   Now the sheet reads exactly like the object it is named after:

     empty slot  → a PERFORATED WINDOW: dashed cut line, its own serial in the
                   corner, "awaiting stamp".
     next slot   → the window the press is about to hit (solid rule, tinted).
     filled slot → an INK IMPRESSION: a rotated stamp frame with a ragged ink
                   edge (mask), the piece's art printed inside, stamped code
                   and name. The impression lands with the thud animation.

   The unlock contract is unchanged — a slot flips the moment its stamp is
   earned — and reduced motion simply shows the impression without the landing.
============================================================================ */

import { RARITY, SET_BONUS_AT, STAMP_SLOTS, UNIVERSES } from '../../lib/data';
import { RARITY_ACCENT } from './usePullEngine';
import CardImage from '../../components/CardImage';
import { serialDigits } from '../../lib/serials';

interface StampCardProps {
  stamps: number;
  distinct: Set<string>;
  latestUid: string | null;
  phase: 'idle' | 'spinning' | 'done';
  bonusReached: boolean;
  pulls: unknown[];
  onReset: () => void;
}

export default function StampCard({
  stamps,
  distinct,
  latestUid,
  phase,
  bonusReached,
  pulls,
  onReset,
}: StampCardProps) {
  const uids = Array.from(distinct);

  return (
    <div className="stampcard">
      <div className="stampcard__head">
        <span className="stampcard__kicker">STAMP CARD — PROOF OF PURCHASE</span>
        <button
          type="button"
          className="sheet__reset"
          onClick={onReset}
          disabled={phase === 'spinning' || pulls.length === 0}
        >
          ⟲ NEW SHEET
        </button>
      </div>

      <div className="stampcard__slots">
        {Array.from({ length: STAMP_SLOTS }, (_, i) => {
          const filled = i < stamps;
          const next = i === stamps;
          const uid = uids[i];
          const u = uid ? UNIVERSES.find((x) => String(x.id) === uid) : undefined;
          return (
            <StampSlot
              key={i}
              index={i}
              filled={filled}
              next={next}
              universe={u}
              isLatest={filled && uid === latestUid && phase === 'done'}
            />
          );
        })}
      </div>

      <div className="stampcard__progress">
        <div className="stampcard__progress-labels">
          <span>SET PROGRESS</span>
          <span>
            <b>{stamps}</b>/{STAMP_SLOTS}
          </span>
        </div>
        {/* A progressbar needs an accessible NAME, not just values — axe
            `aria-progressbar-name`. It reads against the visible tabular
            "n / 8" beside it, so the name states the same thing in words. */}
        <div
          className="stampcard__track"
          role="progressbar"
          aria-label={`Set progress — ${stamps} of ${STAMP_SLOTS} distinct universes collected`}
          aria-valuenow={stamps}
          aria-valuemin={0}
          aria-valuemax={STAMP_SLOTS}
        >
          <i style={{ ['--p' as string]: stamps / STAMP_SLOTS }} />
          <span className="stampcard__ticks" aria-hidden="true">
            {Array.from({ length: STAMP_SLOTS }, (_, i) => (
              <em key={i} data-on={i < stamps} />
            ))}
          </span>
        </div>
      </div>

      <div className={`stampcard__bonus ${bonusReached ? 'is-unlocked' : ''}`}>
        <span className="stampcard__bonus-seal" aria-hidden="true">
          {bonusReached ? 'OPEN' : 'SEALED'}
        </span>
        <div>
          <b>GOLDEN GATE SET BONUS</b>
          <p>
            {bonusReached
              ? 'You hold a piece from 6+ universes — the Golden Gate is open. (Demo: bonus is simulated.)'
              : `Collect a piece from ${SET_BONUS_AT}+ distinct universes to unlock the bonus reward — plus, the 8th stamp guarantees a RARE-or-better pull.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ single window ------------------------------ */

interface SlotProps {
  index: number;
  filled: boolean;
  next: boolean;
  universe?: { id: number; code: string; name: string; image: string; rarity: keyof typeof RARITY };
  isLatest: boolean;
}

/** Resting rotation per slot — stamps are never perfectly square. */
const ROT = [-6, 4, -3, 7, -5, 3, -7, 5];

function StampSlot({ index, filled, next, universe, isLatest }: SlotProps) {
  const accent = universe ? RARITY_ACCENT[universe.rarity] : null;

  const label = filled && universe
    ? `${universe.code} — ${universe.name} stamped`
    : next
      ? 'Next pull lands here'
      : `Empty stamp window ${index + 1}`;

  return (
    <div
      className={`slot ${filled ? 'is-filled' : ''} ${next ? 'is-next' : ''} ${isLatest ? 'is-latest' : ''}`}
      style={
        {
          '--ink-color': accent?.color ?? 'var(--ink)',
          '--rot': `${ROT[index % ROT.length]}deg`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={label}
      data-cursor={filled ? 'READ' : 'AWAITING'}
    >
      {filled && universe ? (
        <span className="slot__stamp">
          <span className="slot__impression" aria-hidden="true" />
          <span className="slot__art">
            <CardImage
              src={universe.image}
              alt={`${universe.code} — ${universe.name}`}
              sizes="140px"
            />
          </span>
          <span className="slot__code">{serialDigits(universe.code)}</span>
          <span className="slot__name">{universe.name}</span>
        </span>
      ) : (
        <>
          <span className="slot__wait">{next ? 'AWAITING\nSTAMP' : 'EMPTY\nWINDOW'}</span>
          <span className="slot__serial">№ {String(index + 1).padStart(2, '0')}</span>
        </>
      )}
    </div>
  );
}
