/* ============================================================================
   usePullEngine — the cinematic state machine behind Section 04 · PILLAR 3.

   Owns the proof-of-purchase pull flow (idle → spinning → done), the stamp
   ledger persisted to localStorage, the pity / golden-gate logic and the
   live odds pool. Both panels of the split canvas — the sticky control rail
   (Pull Simulator) and the perspective 3D canvas (Stamp Card + reveal plate)
   — consume this single source of truth.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { nearMissGliss, pullWhoosh, stampThud } from '../../lib/sound';
import { haptic, HAPTIC } from '../../lib/haptics';
import { useMockWallet } from '../../components/ui';
import type { EditionTier, Universe } from '../../lib/data';
import {
  TIERS,
  SET_BONUS_AT,
  STAMP_SLOTS,
  UNIVERSES,
  pullOdds,
  rollTier,
  universeForPull,
} from '../../lib/data';

export interface StoredPull {
  uid: string;
  ts: number;
  tier: EditionTier;
}

export type PullPhase = 'idle' | 'spinning' | 'done';

export interface PullResult {
  u: Universe;
  r: EditionTier;
  mintNo: string;
}

const STORAGE_KEY = 'ocu-pulls-v1';

export const spinPool = UNIVERSES.filter(
  (u) => u.image && u.status !== 'secret' && u.status !== 'encrypted' && u.status !== 'upcoming',
);

function loadPulls(): StoredPull[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPull[];
    if (!Array.isArray(parsed)) return [];
    // Sanitise persisted state: every entry must reference a real universe
    // with a known tier tier, otherwise stale/corrupt data can produce
    // broken renders after a reload.
    return parsed.filter(
      (p) =>
        p &&
        typeof p.uid === 'string' &&
        p.uid.length > 0 &&
        typeof p.tier === 'string' &&
        p.tier in TIERS &&
        UNIVERSES.some((u) => String(u.id) === p.uid),
    );
  } catch {
    return [];
  }
}

/* IDENTITY-SPEC §6 — the seal inks, straight from src/lib/palette.ts. `color`
   is the ink a tier's stamp prints in; `glow` is the ink pad's halo, built
   with color-mix so it stays a token expression rather than a literal. */
export const TIER_ACCENT: Record<EditionTier, { color: string; glow: string }> = {
  common: { color: 'var(--ink)', glow: 'color-mix(in srgb, var(--ink) 32%, transparent)' },
  rare: { color: 'var(--water-ink)', glow: 'color-mix(in srgb, var(--water) 34%, transparent)' },
  epic: { color: 'var(--pink-ink)', glow: 'color-mix(in srgb, var(--pink) 34%, transparent)' },
  legendary: { color: 'var(--stamp)', glow: 'color-mix(in srgb, var(--stamp) 32%, transparent)' },
  secret: { color: 'var(--deep)', glow: 'color-mix(in srgb, var(--deep) 40%, transparent)' },
};

export function usePullEngine() {
  const wallet = useMockWallet();
  const [pulls, setPulls] = useState<StoredPull[]>(loadPulls);
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [phase, setPhase] = useState<PullPhase>('idle');
  const [spinIdx, setSpinIdx] = useState(0);
  const [result, setResult] = useState<PullResult | null>(null);
  const [flash, setFlash] = useState(0); // increments to trigger a stage light-leak
  const timers = useRef<number[]>([]);

  const distinct = useMemo(() => new Set(pulls.map((p) => p.uid)), [pulls]);
  const stamps = distinct.size;
  const pityActive = stamps >= STAMP_SLOTS - 1;
  const bonusReached = stamps >= SET_BONUS_AT;
  const latestUid = pulls.length ? pulls[pulls.length - 1].uid : null;
  const best = bestTier(pulls);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pulls));
    } catch {
      /* storage unavailable */
    }
  }, [pulls]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const odds = useMemo(
    () => pullOdds({ stamps, secretUnlocked, holderBonus: wallet.connected }),
    [stamps, secretUnlocked, wallet.connected],
  );

  /** Normalised real pull probability per tier (weight / pool total). */
  const oddsNorm = useMemo(() => {
    const total = odds.reduce((s, p) => s + p.weight, 0);
    return odds.map((p) => ({
      ...p,
      pct: total > 0 ? (p.weight / total) * 100 : 0,
    }));
  }, [odds]);

  const doPull = () => {
    if (phase === 'spinning') return;
    setPhase('spinning');
    setResult(null);
    /* P4.15 (audit 3.4): audio belongs to the ENGINE's phase transitions,
       not the components' effect charts — whoosh as the reel starts, thud
       at `result` BEFORE the reveal frame, so the ear gets the event one
       beat early and the body gets it as haptics (3.5). */
    pullWhoosh();

    const spin = window.setInterval(() => setSpinIdx((i) => (i + 1) % spinPool.length), 80);
    const finish = window.setTimeout(() => {
      window.clearInterval(spin);
      const r = rollTier(odds);
      const u = universeForPull(r);
      const mintNo = String(Math.floor(Math.random() * Math.max(1, u.supply)) + 1).padStart(3, '0');
      const reveal = () => {
        setResult({ u, r, mintNo });
        setPhase('done');
        setPulls((p) => [...p, { uid: String(u.id), ts: Date.now(), tier: r }]);
        if (r === 'secret') setSecretUnlocked(true);
        setFlash((f) => f + 1);
      };
      /* The casino cue: an unguaranteed secret/legendary — landed ONE slot
         before pity would have handed it over. 2-frame hesitation (the reel
         almost stops short) + the rising glissando under it. */
      const nearMiss =
        (r === 'secret' || r === 'legendary') && stamps === STAMP_SLOTS - 2;
      stampThud();
      haptic(HAPTIC.stamp);
      if (r === 'legendary' || r === 'secret') haptic([...HAPTIC.reveal]);
      if (nearMiss) {
        nearMissGliss();
        requestAnimationFrame(() => requestAnimationFrame(reveal));
      } else {
        reveal();
      }
    }, 1900);
    timers.current.push(finish);
  };

  const reset = () => {
    if (phase === 'spinning') return;
    setPulls([]);
    setResult(null);
    setPhase('idle');
    setSecretUnlocked(false);
  };

  return {
    pulls,
    stamps,
    distinct,
    phase,
    spinIdx,
    result,
    odds: oddsNorm,
    latestUid,
    best,
    pityActive,
    bonusReached,
    secretUnlocked,
    holderBonus: wallet.connected,
    flash,
    doPull,
    reset,
    done: () => setPhase('idle'),
  };
}

/* ------------------------------- helpers ------------------------------- */

function bestTier(pulls: StoredPull[]): EditionTier {
  const tier = Math.max(...pulls.map((p) => TIERS[p.tier].tier), 0);
  const r = (Object.keys(TIERS) as EditionTier[]).find((k) => TIERS[k].tier === tier);
  return r ?? 'common';
}
