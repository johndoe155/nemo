/**
 * nemoMorph — the runtime half of the loader's typographic morph.
 *
 * scripts/generate-nemo-loader.mjs bakes the two frames (the numerals at full
 * tracking, the character refit inside itself) together with the type metrics
 * they share. This module turns those metrics back into live layout, mirroring
 * the generator's formula exactly:
 *
 *   x_i = penRight − Σ_{j≥i} advance_j · s − (n − 1 − i) · tracking
 *
 * with one addition the generator's reference frame also obeys: the block —
 * numerals, gap, % — is recentred on the artwork's optical centre every frame,
 * so the counter stays dead centre while it grows. At 100% that reproduces the
 * generator's reference ink box, which is exactly what lets the counter hand
 * its ink to MorphSVG without a seam (asserted in tests/unit/nemoLoader.test.ts).
 *
 * Glyph contours arrive as complete closed subpaths in glyph-local em space
 * (baseline at y = 0, y down), so nothing here re-serialises a number: a glyph
 * is placed with `translate(x, baseline) scale(GLYPH_SCALE)`, which keeps the
 * counter's per-frame work to three transform attributes.
 */

import { COUNTER, FONT_SIZE, GLYPHS } from './nemoLoaderData';

/** Em → viewBox units at the counter's display size. */
export const GLYPH_SCALE = FONT_SIZE / 1000;

/** The counter's tracking range, in viewBox units. */
export const TRACK_FROM = COUNTER.trackFrom * FONT_SIZE;
export const TRACK_TO = COUNTER.trackTo * FONT_SIZE;

/** Distance between the numerals' right ink edge and the % marker. */
const PCT_GAP = COUNTER.pctX - COUNTER.refInk.maxX;

/** Ink width of the % at its own (much smaller) scale. */
const PCT_INK = (GLYPHS['%'].inkMaxX - GLYPHS['%'].inkMinX) * COUNTER.pctScale;

const glyphCache = new Map<string, string>();

/** One glyph's ink as a single path: 'M…Z' subpaths, glyph-local em space. */
export function glyphPath(ch: string): string {
  const hit = glyphCache.get(ch);
  if (hit !== undefined) return hit;
  const d = GLYPHS[ch] ? GLYPHS[ch].contours.join(' ') : '';
  glyphCache.set(ch, d);
  return d;
}

/** The counter's displayed number: 0 → 100, never off the ends. */
export function counterLabel(progress: number): string {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return String(Math.round(p * 100));
}

/** Em tracking → viewBox units across the counter's climb. */
export function trackingAt(progress: number): number {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return TRACK_FROM + (TRACK_TO - TRACK_FROM) * p;
}

export interface CounterFrame {
  /** x origin per character of the label, viewBox units. */
  origins: number[];
  /** where the % ink starts (its own scale is applied by the caller) */
  pctX: number;
  /** ink extents of the numerals alone, viewBox units */
  inkMinX: number;
  inkMaxX: number;
}

/**
 * Places `label` at `tracking`, right-anchored and recentred on the artwork's
 * optical centre. The empty string is degenerate but harmless: it puts the %
 * where the reference frame puts it.
 */
export function layoutCounter(label: string, tracking: number): CounterFrame {
  const n = label.length;
  if (n === 0) {
    return { origins: [], pctX: COUNTER.pctX, inkMinX: 0, inkMaxX: 0 };
  }

  const origins: number[] = new Array(n);
  let inkMinX = Infinity;
  let inkMaxX = -Infinity;

  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let j = i; j < n; j++) x -= GLYPHS[label[j]].advance * GLYPH_SCALE;
    x -= (n - 1 - i) * tracking;
    origins[i] = x;
    inkMinX = Math.min(inkMinX, x + GLYPHS[label[i]].inkMinX * GLYPH_SCALE);
    inkMaxX = Math.max(inkMaxX, x + GLYPHS[label[i]].inkMaxX * GLYPH_SCALE);
  }

  // One shift centres numerals + gap + % on the art's ink centre — the same
  // constraint the generator's penRight/baseline encode.
  const shift = COUNTER.centerX - (inkMinX + inkMaxX + PCT_GAP + PCT_INK) / 2;
  for (let i = 0; i < n; i++) origins[i] += shift;

  return {
    origins,
    pctX: inkMaxX + shift + PCT_GAP,
    inkMinX: inkMinX + shift,
    inkMaxX: inkMaxX + shift,
  };
}
