import { useEffect, useState } from 'react';

/** Render an ETH price like "0.06" or "0.045" (no trailing zero noise). */
export function fmtEth(n: number): string {
  return String(parseFloat(n.toFixed(5)));
}

/** A price with the holder discount applied, rounded to 5 sig places in ETH. */
export function discount(n: number, pct: number): number {
  return parseFloat((n * (1 - pct)).toFixed(5));
}

/** Debounce an input value by `ms`. Returns the settled value. */
export function useDebounced<T>(value: T, ms = 220): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Human "claimed" progress percent 0..100. */
export function claimPct(minted: number, supply: number): number {
  if (!supply) return 0;
  return Math.min(100, Math.round((minted / supply) * 100));
}

export interface TimeLeft {
  d: string;
  h: string;
  m: string;
  s: string;
  done: boolean;
}
const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

/** Precise countdown to an ISO target. */
export function useCountdown(targetIso?: string): TimeLeft {
  const zero: TimeLeft = { d: '00', h: '00', m: '00', s: '00', done: true };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    if (Number.isNaN(target)) return;
    let timer = 0;
    const tick = () => {
      const diff = target - Date.now();
      setNow(Date.now());
      const delay = diff <= 0 ? 1000 : Math.max(250, Math.min(1000, (diff % 1000) || 1000));
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [targetIso]);

  if (!targetIso) return zero;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return zero;
  const diff = target - now;
  if (diff <= 0) return zero;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s), done: false };
}

/** Persisted state helper (survives refresh). Safe when storage is blocked. */
export function useStoredState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const set = (v: T | ((p: T) => T)) => {
    setState((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };
  return [state, set];
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
