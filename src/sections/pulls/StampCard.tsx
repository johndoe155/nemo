/* ============================================================================
   StampCard — the obsidian-etched proof-of-purchase ledger.

   · 2×4 grid of tactile 3D slots. Each card tilts in a perspective(800px)
     space, rotateX/rotateY tracked from the mouse relative to the card.
   · Empty slots: semi-translucent dithered glass with an etched metallic
     ring and a ghosted universe watermark.
   · NEXT slot: gold-leaf holographic mesh — liquid sheen sweep, pulsing
     wireframe border.
   · Unlock: an explosive 3D flip (react-spring config tension 320 /
     friction 18 — same spring ODE, driven through framer-motion) with a
     spark burst and a rotating light leak.
   ========================================================================== */

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { RARITY, SET_BONUS_AT, STAMP_SLOTS, UNIVERSES } from '../../lib/data';
import { RARITY_ACCENT, type StoredPull } from './usePullEngine';

interface StampCardProps {
  stamps: number;
  distinct: Set<string>;
  latestUid: string | null;
  phase: 'idle' | 'spinning' | 'done';
  bonusReached: boolean;
  pulls: StoredPull[];
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
    <div className="npx__stampcard">
      <div className="npx__stampcard-head">
        <span className="npx__plate-kicker">
          <i aria-hidden="true" /> STAMP CARD — PROOF OF PURCHASE
        </span>
        <button
          type="button"
          className="npx__ghostbtn"
          onClick={onReset}
          disabled={phase === 'spinning' || pulls.length === 0}
        >
          ⟲ RESET ARCHIVE
        </button>
      </div>

      <div className="npx__slots">
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

      <div className="npx__progress">
        <div className="npx__progress-labels">
          <span>SET PROGRESS</span>
          <span>
            <b>{stamps}</b>/{STAMP_SLOTS}
          </span>
        </div>
        <div className="npx__progress-track" role="progressbar" aria-valuenow={stamps} aria-valuemax={STAMP_SLOTS}>
          <i style={{ width: `${(stamps / STAMP_SLOTS) * 100}%` }} />
          <span className="npx__progress-ticks" aria-hidden="true">
            {Array.from({ length: STAMP_SLOTS }, (_, i) => (
              <em key={i} data-on={i < stamps} />
            ))}
          </span>
        </div>
      </div>

      <div className={`npx__bonus ${bonusReached ? 'is-unlocked' : ''}`}>
        <span className="npx__bonus-ic" aria-hidden="true">
          ✦
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

/* ------------------------------ single slot ------------------------------ */

interface SlotProps {
  index: number;
  filled: boolean;
  next: boolean;
  universe?: { id: number; code: string; name: string; image: string; rarity: keyof typeof RARITY };
  isLatest: boolean;
}

const FLIP_SPRING = {
  type: 'spring' as const,
  stiffness: 320, // react-spring tension 320
  damping: 18, // react-spring friction 18 (same spring ODE)
  mass: 1,
};

function StampSlot({ index, filled, next, universe, isLatest }: SlotProps) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 240, damping: 18, mass: 0.6 });
  const sry = useSpring(ry, { stiffness: 240, damping: 18, mass: 0.6 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  const accent = universe ? RARITY_ACCENT[universe.rarity] : null;

  const tilt = (e: React.PointerEvent) => {
    if (reduce) return;
    const el = cardRef.current;
    if (!el) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const r = el.getBoundingClientRect();
    const px = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
    const py = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
    ry.set(px * 26);
    rx.set(-py * 22);
  };
  const untilt = () => {
    rx.set(0);
    ry.set(0);
  };

  const label = filled && universe
    ? `${universe.code} — ${universe.name} stamped`
    : next
      ? 'Next pull lands here'
      : 'Empty stamp slot';

  return (
    <div
      className={`npx__slot ${filled ? 'is-filled' : ''} ${next ? 'is-next' : ''} ${isLatest ? 'is-latest' : ''}`}
      style={
        {
          '--sr': accent?.color,
          '--srg': accent?.glow,
          '--i': index,
        } as React.CSSProperties
      }
      onPointerMove={tilt}
      onPointerLeave={untilt}
      role="img"
      aria-label={label}
    >
      {/* tilt layer (mouse-tracked springs) — kept separate from the flip
          layer so the two rotateY animations never fight each other */}
      <motion.div
        className="npx__slot-tilt"
        ref={cardRef}
        style={{ rotateX: srx, rotateY: sry, transformPerspective: 800 }}
      >
        <motion.div
          className="npx__slot-card"
          initial={{ rotateY: filled ? 0 : 180, scale: filled ? 1 : 0.94 }}
          animate={{ rotateY: filled ? 0 : 180, scale: filled ? 1 : 0.94 }}
          transition={FLIP_SPRING}
        >
          {/* stamped face */}
          <div className="npx__slot-face npx__slot-front">
            {universe && (
              <>
                <img src={universe.image} alt={`${universe.code} — ${universe.name}`} loading="lazy" />
                <span className="npx__slot-veil" aria-hidden="true" />
                <span className="npx__slot-code">{universe.code}</span>
                <span className="npx__slot-name">{universe.name}</span>
                <span className="npx__slot-rim" aria-hidden="true" />
              </>
            )}
          </div>
          {/* etched / holographic face (visible while empty) */}
          <div className="npx__slot-face npx__slot-back">
            {next ? (
              <>
                <span className="npx__slot-holo" aria-hidden="true" />
                <span className="npx__slot-holowire" aria-hidden="true" />
                <span className="npx__slot-nextlabel">
                  <i aria-hidden="true">✦</i> NEXT PULL
                  <em>LANDS HERE</em>
                </span>
              </>
            ) : (
              <>
                <span className="npx__slot-ring" aria-hidden="true" />
                <span className="npx__slot-ghostcode" aria-hidden="true">
                  {`U-00${index + 1}`}
                </span>
                <span className="npx__slot-empty">○</span>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>

      {isLatest && (
        <span className="npx__slot-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ ['--b' as string]: i }} />
          ))}
        </span>
      )}
      {isLatest && <span className="npx__slot-leak" aria-hidden="true" />}
    </div>
  );
}
