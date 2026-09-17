/* ============================================================================
   StatRoll — oversized editorial numerals with continuous roll-up physics.

   Whenever `value` changes, the displayed number rolls from its previous
   value to the new one on a smoothed exponential curve (rAF-driven, no CSS
   transition jitter), with a single spring overshoot at the landing frame —
   the "counter slam" used by high-end dashboards. Honours reduced motion.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

interface StatRollProps {
  value: number;
  pad?: number;
  /** accent for the glow halo behind the numeral */
  color?: string;
  className?: string;
}

export function StatRoll({ value, pad = 0, color, className = '' }: StatRollProps) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef(0);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    if (reduce.current) {
      setDisplay(to);
      return;
    }
    const dur = Math.min(1400, 450 + Math.abs(to - from) * 90);
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      // easeOutExpo with a subtle back overshoot on landing
      const eased =
        p >= 1 ? 1 : p < 0.92 ? 1 - Math.pow(2, -10 * p) : overshoot((p - 0.92) / 0.08);
      const v = from + (to - from) * eased;
      setDisplay(Math.round(v));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <span
      className={`npx__roll ${className}`}
      style={color ? { ['--roll-glow' as string]: color } : undefined}
      aria-label={String(value)}
    >
      {String(display).padStart(pad, '0')}
    </span>
  );
}

/** landing overshoot: 0 → 1 → ~1.04 → 1 */
function overshoot(p: number) {
  return 1 + Math.sin(p * Math.PI) * 0.045 * (1 - p);
}
