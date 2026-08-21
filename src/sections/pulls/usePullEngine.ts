/* ============================================================================
   usePullEngine — the cinematic state machine behind Section 04 · PILLAR 3.

   Owns the proof-of-purchase pull flow (idle → spinning → done), the stamp
   ledger persisted to localStorage, the pity / golden-gate logic and the
   live odds pool. Both panels of the split canvas — the sticky control rail
   (Pull Simulator) and the perspective 3D canvas (Stamp Card + reveal plate)
   — consume this single source of truth.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMockWallet } from '../../components/ui';
import type { Rarity, Universe } from '../../lib/data';
import {
  RARITY,
  SET_BONUS_AT,
  STAMP_SLOTS,
  UNIVERSES,
  pullOdds,
  rollRarity,
  universeForPull,
} from '../../lib/data';

export interface StoredPull {
  uid: string;
  ts: number;
  rarity: Rarity;
}

export type PullPhase = 'idle' | 'spinning' | 'done';

export interface PullResult {
  u: Universe;
  r: Rarity;
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
    return Array.isArray(parsed) ? parsed.filter((p) => p && p.uid) : [];
  } catch {
    return [];
  }
}

/** Rarity accents synced to the primary site theme (no custom bold hues). */
export const RARITY_ACCENT: Record<Rarity, { color: string; glow: string }> = {
  common: { color: '#c8cfe0', glow: 'rgba(200, 207, 224, 0.4)' },
  rare: { color: '#3fe8ff', glow: 'rgba(63, 232, 255, 0.45)' },
  epic: { color: '#8a4dff', glow: 'rgba(138, 77, 255, 0.45)' },
  legendary: { color: '#ffc857', glow: 'rgba(255, 200, 87, 0.4)' },
  secret: { color: '#ff3d9a', glow: 'rgba(255, 61, 154, 0.45)' },
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
  const best = bestRarity(pulls);

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

  /** Normalised real pull probability per rarity (weight / pool total). */
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

    const spin = window.setInterval(() => setSpinIdx((i) => (i + 1) % spinPool.length), 80);
    const finish = window.setTimeout(() => {
      window.clearInterval(spin);
      const r = rollRarity(odds);
      const u = universeForPull(r);
      const mintNo = String(Math.floor(Math.random() * Math.max(1, u.supply)) + 1).padStart(3, '0');
      setResult({ u, r, mintNo });
      setPhase('done');
      setPulls((p) => [...p, { uid: String(u.id), ts: Date.now(), rarity: r }]);
      if (r === 'secret') setSecretUnlocked(true);
      setFlash((f) => f + 1);
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

function bestRarity(pulls: StoredPull[]): Rarity {
  const tier = Math.max(...pulls.map((p) => RARITY[p.rarity].tier), 0);
  const r = (Object.keys(RARITY) as Rarity[]).find((k) => RARITY[k].tier === tier);
  return r ?? 'common';
}
