/* ============================================================================
   StampCard — the obsidian-etched proof-of-purchase ledger.

   · 2×4 grid of tactile 3D slots. Each card tilts in a perspective(800px)
     space, rotateX/rotateY tracked from the mouse relative to the card.
   · Inactive cards read as encrypted telemetry pods in a powered-down cold
     slate: sharp 45° chamfered housing with a soft white top-edge specular
     (15%), technical corner reticles, a dim wireframe sphere over a
     low-opacity dark grid with static noise and a scrambled silhouette,
     and a crisp serial-number pill badge.
   · NEXT slot: holographic mesh + liquid sheen in the site accent, pulsing
     wireframe border.
   · Unlock: an explosive 3D flip (react-spring config tension 320 /
     friction 18 — same spring ODE, driven through framer-motion) with a
     spark burst. No rotating beams.
   ========================================================================== */

import { useId, useRef } from 'react';
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
      : 'Encrypted archive pod';

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
          {/* encrypted pod / holographic face (visible while empty) */}
          <div className="npx__slot-face npx__slot-back">
            {next ? (
              <>
                <span className="npx__slot-holo" aria-hidden="true" />
                <span className="npx__slot-holowire" aria-hidden="true" />
                <span className="npx__slot-nextlabel">
                  NEXT PULL
                  <em>LANDS HERE</em>
                </span>
              </>
            ) : (
              <TelemetryPod serial={`U-00${index + 1}`} />
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
    </div>
  );
}

/* ------------------------- encrypted telemetry pod ------------------------- */

function TelemetryPod({ serial }: { serial: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <>
      <span className="npx__pod" aria-hidden="true">
        <svg className="npx__pod-frame" viewBox="0 0 120 160" preserveAspectRatio="none">
          {/* 45° chamfered housing outline */}
          <path
            d="M14 0 H106 L120 14 V146 L106 160 H14 L0 146 V14 Z"
            fill="none"
            stroke="rgba(147, 168, 196, 0.38)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {/* soft white top-edge specular — 15% */}
          <path
            d="M14 0.5 H106 L119.5 14"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {/* technical corner reticles */}
          <g fill="none" stroke="rgba(147, 168, 196, 0.55)" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <path d="M19 2 V9 H12" />
            <path d="M101 2 V9 H108" />
            <path d="M19 158 V151 H12" />
            <path d="M101 158 V151 H108" />
          </g>
        </svg>

        <span className="npx__pod-grid" />

        {/* scrambled silhouette — the only centre graphic, perfectly centred
            in the pod (viewBox 120×160 → centre y=80; figure spans 56..104) */}
        <svg className="npx__pod-silhouette" viewBox="0 0 120 160" preserveAspectRatio="none">
          <defs>
            <clipPath id={`podscramble-${id}`}>
              <rect x="0" y="0" width="120" height="56" />
              <rect x="-4" y="56" width="120" height="16" />
              <rect x="4" y="72" width="120" height="16" />
              <rect x="-3" y="88" width="120" height="16" />
              <rect x="3" y="104" width="120" height="56" />
            </clipPath>
          </defs>
          <g clipPath={`url(#podscramble-${id})`} fill="rgba(190, 210, 230, 0.09)">
            <circle cx="60" cy="64" r="8" />
            <path d="M46 104 C46 88 52 78 60 78 C68 78 74 88 74 104 Z" />
          </g>
        </svg>

        <span className="npx__pod-noise" />
      </span>
      <span className="npx__pod-serial">{serial}</span>
    </>
  );
}
