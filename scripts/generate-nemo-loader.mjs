#!/usr/bin/env node
/**
 * generate-nemo-loader.mjs — emits src/lib/nemoLoaderData.ts
 *
 *   npm run generate:nemo-loader
 *
 * The launch loader ("the typographic morph") needs three things no runtime
 * should ever have to compute while a visitor is waiting:
 *
 *   1. THE NUMERALS.  The counter is not HTML text — it is the very path the
 *      morph animates — so the digits have to exist as vector data from frame
 *      one.  They are cut out of the site's own display face (PP Neue Machina
 *      Inktrap Ultrabold, the woff2 `--font-display` already ships),
 *      normalised to a 1,000-unit em with y flipped into SVG space, and
 *      emitted twice: as natural contours (the counter while it counts, placed
 *      per frame by src/lib/nemoMorph.ts) and as the morph's opening frame.
 *
 *   2. THE CHARACTER.  public/nemo.svg is 7 neon layers of thin, filled
 *      line-work: 3,823 cubics over 493 closed subpaths, 29 of which are holes
 *      (nonzero winding).  Cutting those loops apart would be a fill disaster —
 *      a chord across a thin band does not tile it, and a hole whose partner
 *      contour is cut elsewhere stops subtracting.  So nothing is cut.  Every
 *      subpath stays a closed loop and is refit *inside itself*: an adaptive
 *      least-squares cubic fit that splits wherever the deviation peaks, which
 *      keeps corners sharp and holds the silhouette within the tolerance.
 *      Topology, winding and therefore fill behaviour are untouched.
 *
 *      What that buys is the point budget MorphSVG actually animates.  The art
 *      as authored is ~23,000 coordinates per frame, which no loader should ask
 *      a browser to re-parse 60 times a second.  The fit brings it inside
 *      CURVE_BUDGET while the picture stays pixel-identical at loader scale,
 *      and the exact art resolves on top of it when the morph lands (the loader
 *      fetches the same nemo.svg the nav logo already loads).
 *
 *   3. THE PAIRING.  MorphSVG sorts a multi-subpath RawPath by segment count
 *      (`b.length - a.length`) before animating, so both arrays are emitted
 *      pre-sorted by that same key — the exact number of coordinates
 *      paths.js will produce for each subpath, closing segment included.
 *      Index i of DIGIT_MORPH_D therefore always becomes index i of
 *      CHAR_MORPH_D.  The numerals' 7 real contours take the 7 largest pieces
 *      of the character (the lines worth unspooling); every other piece departs
 *      from a degenerate point parked on the nearest stroke of the numerals, so
 *      the character assembles out of the number it was counted from.
 *      scripts/verify-nemo-loader.mjs replays the pair through the real plugin
 *      in Node and asserts the pairing survives.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG_IN = path.join(ROOT, 'public/nemo.svg');
const FONT_IN = path.join(
  ROOT,
  'src/assets/fonts/pp-neue-machina/pp-neue-machina-inktrap-ultrabold-normal.woff2',
);
const TS_OUT = path.join(ROOT, 'src/lib/nemoLoaderData.ts');

/* ---------------------------------------------------------------------------
   Tunables — design decisions, not implementation details.  Printed at the end
   of every run so the numbers stay visible.
--------------------------------------------------------------------------- */

const VIEWBOX = 1095; // nemo.svg's own coordinate system — the loader's world
const CURVE_BUDGET = 1300; // cubics the morph animates per frame (art side)
const SIMPLIFY_TOL = 0.55; // viewBox units of permitted deviation (~0.45px at
//                            the loader's largest size); raised automatically
//                            if the art cannot be squeezed into the budget
const DUST_MIN = 20; // subpaths shorter than this are dust: invisible at loader
//                      scale, and the exact art resolves them at the end anyway
const REAL_CONTOURS = 7; // numeral contours that unspool out of the numerals —
//                          the rest of the character departs from points
const CLOSED_EPS = 0.001; // paths.js decides "closed subpath" at 1e-3 per axis

const COUNTER = {
  fontSize: 330, // display size in viewBox units
  trackFrom: 0.19, // em tracking at 0%   (wide)
  trackTo: 0.012, // em tracking at 100% (tight — the tracking contracts as
  //                 the count climbs, then the morph departs from that frame)
  pctScale: 0.3, // the % rides at 30% of the numeral size
  pctGap: 0.075, // em gap between the numeral block and the %
  refString: '100', // layout reference: the counter's frame never jitters
  morphString: '100', // the string the morph departs from
};

const GLYPH_CHARS = '0123456789%';

/* ---------------------------------------------------------------------------
   Vector kit.  A cubic is [x0,y0, c1x,c1y, c2x,c2y, x1,y1]; a subpath is a
   contiguous array of them; a path is an array of subpaths.
--------------------------------------------------------------------------- */

const fmt = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function cubicAt(c, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  return [a * c[0] + b * c[2] + d * c[4] + e * c[6], a * c[1] + b * c[3] + d * c[5] + e * c[7]];
}

/** De Casteljau — split a cubic at t into its two halves. */
function splitCubic(c, t) {
  const p0 = [c[0], c[1]];
  const p1 = [c[2], c[3]];
  const p2 = [c[4], c[5]];
  const p3 = [c[6], c[7]];
  const p01 = add(p0, mul(sub(p1, p0), t));
  const p12 = add(p1, mul(sub(p2, p1), t));
  const p23 = add(p2, mul(sub(p3, p2), t));
  const p012 = add(p01, mul(sub(p12, p01), t));
  const p123 = add(p12, mul(sub(p23, p12), t));
  const mid = add(p012, mul(sub(p123, p012), t));
  return [
    [p0[0], p0[1], p01[0], p01[1], p012[0], p012[1], mid[0], mid[1]],
    [mid[0], mid[1], p123[0], p123[1], p23[0], p23[1], p3[0], p3[1]],
  ];
}

/** Chord-length estimate — cheap, monotone, plenty accurate for cutting. */
function cubicLength(c, samples = 12) {
  let l = 0;
  let prev = cubicAt(c, 0);
  for (let i = 1; i <= samples; i++) {
    const p = cubicAt(c, i / samples);
    l += dist(prev, p);
    prev = p;
  }
  return l;
}

const runLength = (segs) => segs.reduce((s, c) => s + cubicLength(c), 0);

/** The parameter t at which a cubic has consumed `target` units of ink. */
function tAtLength(c, target) {
  if (target <= 0) return 0;
  const total = cubicLength(c, 24);
  if (target >= total) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (cubicLength(splitCubic(c, mid)[0], 8) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The coordinate count paths.js will produce for one subpath — MorphSVG's own
    sort key.  Closed subpaths (start ≈ end) get no extra closing segment. */
const rawWeight = (segs) => {
  const first = segs[0];
  const last = segs[segs.length - 1];
  const closed =
    Math.abs(last[6] - first[0]) < CLOSED_EPS && Math.abs(last[7] - first[1]) < CLOSED_EPS;
  return 6 * segs.length + 2 + (closed ? 0 : 6);
};

/* ---------------------------------------------------------------------------
   Path data — nemo.svg is M/C/Z only (asserted below); the font adds L and Q,
   both converted to exact cubics so every downstream consumer sees one type.
--------------------------------------------------------------------------- */

function parsePathData(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const paths = [];
  let cur = [0, 0];
  let start = [0, 0];
  let segs = [];
  let i = 0;
  const num = () => parseFloat(toks[i++]);

  while (i < toks.length) {
    const cmd = toks[i];
    if (cmd === 'M' || cmd === 'm') {
      i++;
      if (segs.length) paths.push(segs);
      const p = [num(), num()];
      cur = cmd === 'm' ? add(cur, p) : p;
      start = cur;
      segs = [];
    } else if (cmd === 'C' || cmd === 'c') {
      i++;
      const c = [];
      for (let k = 0; k < 3; k++) {
        const p = [num(), num()];
        c.push(cmd === 'c' ? add(cur, p) : p);
      }
      segs.push([start[0], start[1], ...c[0], ...c[1], ...c[2]]);
      cur = c[2];
      start = cur;
    } else if (cmd === 'L' || cmd === 'l' || cmd === 'Q' || cmd === 'q') {
      i++;
      const quad = cmd === 'Q' || cmd === 'q';
      const rel = cmd === 'l' || cmd === 'q';
      const q = quad ? [num(), num()] : null;
      const end = [num(), num()];
      const a1 = q ? (rel ? add(cur, q) : q) : null;
      const a2 = rel ? add(cur, end) : end;
      const p0 = cur;
      const c1 = a1 ? add(p0, mul(sub(a1, p0), 2 / 3)) : add(p0, mul(sub(a2, p0), 1 / 3));
      const c2 = a1 ? add(a2, mul(sub(a1, a2), 2 / 3)) : add(p0, mul(sub(a2, p0), 2 / 3));
      segs.push([p0[0], p0[1], ...c1, ...c2, ...a2]);
      cur = a2;
      start = cur;
    } else if (cmd === 'Z' || cmd === 'z') {
      i++;
      if (segs.length) paths.push(segs);
      segs = [];
      cur = start;
    } else {
      throw new Error(`unsupported path command: ${cmd}`);
    }
  }
  if (segs.length) paths.push(segs);
  return paths;
}

function segsToD(segs, moveFirst = true) {
  let d = '';
  for (let i = 0; i < segs.length; i++) {
    const c = segs[i];
    if (moveFirst && i === 0) d += `M${fmt(c[0])} ${fmt(c[1])}`;
    d += `C${fmt(c[2])} ${fmt(c[3])} ${fmt(c[4])} ${fmt(c[5])} ${fmt(c[6])} ${fmt(c[7])}`;
  }
  return `${d}Z`;
}

/* ---------------------------------------------------------------------------
   Simplification — an adaptive, least-squares cubic fit *inside* a subpath.

   The subpath is flattened to a dense polyline carrying cumulative arc length.
   A cubic is fitted to a range of that polyline (endpoints pinned, the two
   control points solved in closed form), the worst deviation is measured, and
   the range is bisected there while the deviation exceeds the tolerance.
   Corners become segment boundaries automatically: the deviation peaks at a
   corner, so that is where the fit splits.
--------------------------------------------------------------------------- */

const SAMPLES_PER_CURVE = 12; // control points sampled per authored cubic
const DEVIATION_SAMPLES = 40; // points used to measure a candidate fit

/** Points along a run of cubics, in draw order, first point included. */
function sampleRun(segs, per = SAMPLES_PER_CURVE) {
  const out = [];
  for (const c of segs) {
    const steps = Math.max(4, Math.min(28, Math.round(cubicLength(c) / 2)));
    const n = Math.max(per, steps);
    for (let i = 0; i <= n; i++) {
      if (i === 0 && out.length) continue;
      out.push(cubicAt(c, i / n));
    }
  }
  return out;
}

/** Closed-form least-squares cubic through a sample list, endpoints pinned. */
function fitSamples(samples) {
  const p0 = samples[0];
  const p3 = samples[samples.length - 1];
  const arcs = [0];
  for (let i = 1; i < samples.length; i++) arcs.push(arcs[i - 1] + dist(samples[i - 1], samples[i]));
  const span = arcs[arcs.length - 1] || 1;
  let s11 = 0;
  let s12 = 0;
  let s22 = 0;
  let r1x = 0;
  let r2x = 0;
  let r1y = 0;
  let r2y = 0;
  for (let i = 0; i < samples.length; i++) {
    const u = arcs[i] / span;
    const mu = 1 - u;
    const b0 = mu * mu * mu;
    const b1 = 3 * mu * mu * u;
    const b2 = 3 * mu * u * u;
    const b3 = u * u * u;
    const rx = samples[i][0] - b0 * p0[0] - b3 * p3[0];
    const ry = samples[i][1] - b0 * p0[1] - b3 * p3[1];
    s11 += b1 * b1;
    s12 += b1 * b2;
    s22 += b2 * b2;
    r1x += b1 * rx;
    r2x += b2 * rx;
    r1y += b1 * ry;
    r2y += b2 * ry;
  }
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-12) {
    // Collinear: a straight cubic through the endpoints is exact.
    return [
      p0[0],
      p0[1],
      p0[0] + (p3[0] - p0[0]) / 3,
      p0[1] + (p3[1] - p0[1]) / 3,
      p0[0] + ((p3[0] - p0[0]) * 2) / 3,
      p0[1] + ((p3[1] - p0[1]) * 2) / 3,
      p3[0],
      p3[1],
    ];
  }
  return [
    p0[0],
    p0[1],
    (r1x * s22 - r2x * s12) / det,
    (r1y * s22 - r2y * s12) / det,
    (s11 * r2x - s12 * r1x) / det,
    (s11 * r2y - s12 * r1y) / det,
    p3[0],
    p3[1],
  ];
}

/** Worst distance from a sample list to a cubic (an upper bound on the miss). */
function sampleDeviation(samples, cubic, limit = Infinity) {
  const poly = [];
  for (let k = 0; k <= DEVIATION_SAMPLES; k++) poly.push(cubicAt(cubic, k / DEVIATION_SAMPLES));
  let worst = 0;
  for (const p of samples) {
    let best = Infinity;
    for (const q of poly) {
      const d = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
      if (d < best) best = d;
    }
    if (best > worst) {
      worst = best;
      if (worst > limit * limit) return Infinity; // fail fast
    }
  }
  return Math.sqrt(worst);
}

/**
 * Merge adjacent cubics while the merged curve stays within `tol` of every
 * authored sample it replaces.  Each merge is measured against the *original*
 * ink, not against the previous fit, so the returned chain carries a real
 * bound: no point of the simplified subpath is more than `tol` from the art.
 */
function simplifySubpath(segs, tol) {
  let list = segs.map((c) => ({ cubic: c, samples: sampleRun([c]) }));
  let worst = 0;
  for (let pass = 0; pass < 60; pass++) {
    const chosen = [];
    const consumed = new Set();
    const candidates = [];
    for (let i = 0; i + 1 < list.length; i++) {
      const samples = [...list[i].samples, ...list[i + 1].samples.slice(1)];
      const merged = fitSamples(samples);
      const err = sampleDeviation(samples, merged, tol);
      if (err <= tol) candidates.push({ i, err, merged });
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.err - b.err);
    for (const cand of candidates) {
      if (consumed.has(cand.i) || consumed.has(cand.i + 1)) continue;
      chosen.push(cand);
      consumed.add(cand.i);
      consumed.add(cand.i + 1);
    }
    if (!chosen.length) break;
    const byIndex = new Map(chosen.map((c) => [c.i, c]));
    const next = [];
    for (let i = 0; i < list.length; i++) {
      const cand = byIndex.get(i);
      if (cand) {
        next.push({
          cubic: cand.merged,
          samples: [...list[i].samples, ...list[i + 1].samples.slice(1)],
        });
        worst = Math.max(worst, cand.err);
        i++;
      } else {
        next.push(list[i]);
      }
    }
    list = next;
  }
  return { segs: list.map((entry) => entry.cubic), worst };
}

/** Plain sampling used where the fit is not involved (digit ink points). */
function densePoints(segs, per = SAMPLES_PER_CURVE) {
  return sampleRun(segs, per);
}

/* ---------------------------------------------------------------------------
   1 · Glyphs from the site's own display face.
--------------------------------------------------------------------------- */

const FONT_LETTER = {
  moveTo: 'M',
  lineTo: 'L',
  quadraticCurveTo: 'Q',
  bezierCurveTo: 'C',
  closePath: 'Z',
};

/** fontkit might hand back `args` arrays or named fields; normalise to args. */
function commandArgs(c) {
  if (Array.isArray(c.args)) return c.args;
  switch (c.command) {
    case 'moveTo':
    case 'lineTo':
      return [c.x, c.y];
    case 'quadraticCurveTo':
      return [c.x1, c.y1, c.x, c.y];
    case 'bezierCurveTo':
      return [c.x1, c.y1, c.x2, c.y2, c.x, c.y];
    case 'closePath':
      return [];
    default:
      return null;
  }
}

function fontPathData(glyph, scale) {
  let d = '';
  for (const c of glyph.path.commands) {
    const letter = FONT_LETTER[c.command];
    if (!letter) throw new Error(`unsupported font command: ${c.command}`);
    if (letter === 'Z') {
      d += 'Z';
      continue;
    }
    const args = commandArgs(c);
    if (!args || args.some((v) => !Number.isFinite(v))) {
      throw new Error(`font command ${c.command} carries no usable coordinates`);
    }
    d += letter;
    for (let i = 0; i < args.length; i += 2) {
      // font space is y-up, SVG is y-down
      d += `${fmt(args[i] * scale)} ${fmt(-args[i + 1] * scale)} `;
    }
  }
  return parsePathData(d);
}

function buildGlyphs() {
  const font = fontkit.openSync(FONT_IN);
  const scale = 1000 / font.unitsPerEm;
  const glyphs = {};
  for (const ch of GLYPH_CHARS) {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    glyphs[ch] = {
      advance: glyph.advanceWidth * scale,
      inkMinX: glyph.bbox.minX * scale,
      inkMaxX: glyph.bbox.maxX * scale,
      inkMinY: -glyph.bbox.maxY * scale,
      inkMaxY: -glyph.bbox.minY * scale,
      contours: fontPathData(glyph, scale),
    };
  }
  return { glyphs, capHeight: font.capHeight * scale, family: font.familyName };
}

/* ---------------------------------------------------------------------------
   2 · Layout.  One formula, mirrored by src/lib/nemoMorph.ts and asserted in
   tests/unit/nemoLoader.test.ts: for a string of length n, glyph i sits at

     x_i = penRight − Σ_{j≥i} advance_j − (n − 1 − i) · tracking

   i.e. the counter is right-anchored — it grows leftward and the % never moves.
--------------------------------------------------------------------------- */

function originsFor(glyphs, str, tracking, penRight, scale) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let x = penRight;
    for (let j = i; j < str.length; j++) x -= glyphs[str[j]].advance * scale;
    out.push(x - (str.length - 1 - i) * tracking);
  }
  return out;
}

function inkBoxOf(glyphs, str, tracking, penRight, scale, baseline) {
  const origins = originsFor(glyphs, str, tracking, penRight, scale);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  str.split('').forEach((ch, i) => {
    const g = glyphs[ch];
    minX = Math.min(minX, origins[i] + g.inkMinX * scale);
    maxX = Math.max(maxX, origins[i] + g.inkMaxX * scale);
    minY = Math.min(minY, baseline + g.inkMinY * scale);
    maxY = Math.max(maxY, baseline + g.inkMaxY * scale);
  });
  return { minX, maxX, minY, maxY };
}

/* ---------------------------------------------------------------------------
   3 · The character: every subpath kept whole, refit inside itself.
--------------------------------------------------------------------------- */

function loadArt() {
  const svg = readFileSync(SVG_IN, 'utf8');
  const dAttrs = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!dAttrs.length) throw new Error('no <path d="..."> found in nemo.svg');
  const subpaths = [];
  for (const d of dAttrs) for (const segs of parsePathData(d)) subpaths.push(segs);
  return subpaths;
}

function buildCharacter(tol) {
  const all = loadArt();
  const kept = [];
  let dustPieces = 0;
  let dustInk = 0;
  for (const segs of all) {
    const l = runLength(segs);
    if (l < DUST_MIN) {
      dustPieces++;
      dustInk += l;
      continue;
    }
    kept.push({ segs, l });
  }
  const fitted = kept.map((piece) => {
    const { segs, worst } = simplifySubpath(piece.segs, tol);
    return { segs, original: piece.segs, l: piece.l, worst };
  });
  return {
    pieces: fitted,
    stats: {
      rawCurves: all.reduce((s, p) => s + p.length, 0),
      rawSubpaths: all.length,
      dustPieces,
      dustInk,
      keptInk: kept.reduce((s, p) => s + p.l, 0),
      fittedCurves: fitted.reduce((s, f) => s + f.segs.length, 0),
      worstDeviation: fitted.reduce((s, f) => Math.max(s, f.worst), 0),
    },
  };
}

/* ---------------------------------------------------------------------------
   Run.
--------------------------------------------------------------------------- */

let tol = SIMPLIFY_TOL;
let character = buildCharacter(tol);
while (character.stats.fittedCurves > CURVE_BUDGET && tol < 8) {
  tol = Math.round((tol * 1.25 + 0.05) * 100) / 100;
  character = buildCharacter(tol);
}

const { glyphs, capHeight, family } = buildGlyphs();
const scale = COUNTER.fontSize / 1000;
const trackingEnd = COUNTER.trackTo * COUNTER.fontSize;
const trackingStart = COUNTER.trackFrom * COUNTER.fontSize;
const ref = COUNTER.refString;

// Art-space centre: the ink bbox of the whole art, dust included.
const artBBox = (() => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const segs of loadArt()) {
    for (const c of segs) {
      for (let k = 0; k < 8; k += 2) {
        minX = Math.min(minX, c[k]);
        maxX = Math.max(maxX, c[k]);
        minY = Math.min(minY, c[k + 1]);
        maxY = Math.max(maxY, c[k + 1]);
      }
    }
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
})();
const artShiftX = VIEWBOX / 2 - artBBox.cx;
const artShiftY = VIEWBOX / 2 - artBBox.cy;

// Reference frame: glyph origins around a provisional pen of 0, then one shift
// that centres the whole group (numerals + gap + %) on the art's centre.
const rawOrigins = originsFor(glyphs, ref, trackingEnd, 0, scale);
const rawPenRight = rawOrigins[rawOrigins.length - 1] + glyphs[ref[ref.length - 1]].advance * scale;
const rawInk = inkBoxOf(glyphs, ref, trackingEnd, 0, scale, 0);
const pctW = (glyphs['%'].inkMaxX - glyphs['%'].inkMinX) * scale * COUNTER.pctScale;
const gap = COUNTER.pctGap * COUNTER.fontSize;
const shiftX = artBBox.cx - (rawInk.minX + rawInk.maxX + gap + pctW) / 2;
const shiftY = artBBox.cy - (rawInk.minY + rawInk.maxY) / 2;

const penRight = rawPenRight + shiftX;
const baseline = shiftY;
const pctX = rawInk.maxX + gap + shiftX;
const pctS = scale * COUNTER.pctScale;
const pctY = artBBox.cy - ((glyphs['%'].inkMinY + glyphs['%'].inkMaxY) / 2) * pctS;
const refBox = inkBoxOf(glyphs, ref, trackingEnd, penRight, scale, baseline);

// ---- the numerals, placed for the morph's opening frame -------------------
const morphOrigins = originsFor(glyphs, COUNTER.morphString, trackingEnd, penRight, scale);
const contourPieces = [];
COUNTER.morphString.split('').forEach((ch, gi) => {
  for (const contour of glyphs[ch].contours) {
    contourPieces.push({
      gi,
      segs: contour.map((c) => {
        const out = c.slice();
        for (let k = 0; k < 8; k += 2) {
          out[k] = out[k] * scale + morphOrigins[gi];
          out[k + 1] = out[k + 1] * scale + baseline;
        }
        return out;
      }),
    });
  }
});
contourPieces.sort((a, b) => rawWeight(b.segs) - rawWeight(a.segs));

// Points along the numerals' strokes — where the character's remaining pieces
// depart from.  Two out of every three dense samples is plenty of resolution.
const digitInkPoints = [];
for (const piece of contourPieces) {
  const pts = densePoints(piece.segs);
  for (let i = 0; i < pts.length; i += 2) digitInkPoints.push(pts[i]);
}

// Both sides, sorted by MorphSVG's own key (coordinate count, descending), so
// its normaliser's sort is a stable no-op and i ↔ i survives the whole tween.
const charPieces = [...character.pieces].sort(
  (a, b) => rawWeight(b.segs) - rawWeight(a.segs),
);
const realCount = Math.min(REAL_CONTOURS, contourPieces.length, charPieces.length);

const digitPieces = [];
for (let i = 0; i < realCount; i++) digitPieces.push({ kind: 'contour', i });
const pointPlacements = [];
for (let i = realCount; i < charPieces.length; i++) {
  const target = [charPieces[i].segs[0][0], charPieces[i].segs[0][1]];
  let best = digitInkPoints[0];
  let bestD = Infinity;
  for (const q of digitInkPoints) {
    const d = dist(target, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  pointPlacements.push({ at: best, travel: bestD });
  digitPieces.push({ kind: 'point', at: best });
}

const morphDigits = digitPieces.map((piece) => {
  if (piece.kind === 'contour') return segsToD(contourPieces[piece.i].segs);
  const [x, y] = piece.at;
  return segsToD([[x, y, x, y, x, y, x, y]]);
});
const morphChar = charPieces.map((p) => segsToD(p.segs));

if (morphDigits.length !== morphChar.length) {
  throw new Error(`morph sides disagree: ${morphDigits.length} vs ${morphChar.length}`);
}
// The plugin must not fabricate anything: the pairing is complete and ordered.
const weights = (arr) => arr.map((d) => rawWeight(parsePathData(d)[0]));
const digitWeights = weights(morphDigits);
const charWeights = weights(morphChar);
const sortedDesc = (arr) => arr.every((w, i) => i === 0 || arr[i - 1] >= w);
if (!sortedDesc(digitWeights) || !sortedDesc(charWeights)) {
  throw new Error('morph sides are not sorted by MorphSVG’s segment-count key');
}

/* ---------------------------------------------------------------------------
   Emit.
--------------------------------------------------------------------------- */

const stats = character.stats;
const travels = pointPlacements.map((p) => p.travel);
const travelMean = travels.reduce((s, t) => s + t, 0) / (travels.length || 1);
const travelMax = travels.reduce((s, t) => Math.max(s, t), 0);
const morphBytes = morphChar.reduce((s, d) => s + d.length, 0);

let body = '';
body += `/**
 * GENERATED FILE — do not edit by hand.
 *
 *   npm run generate:nemo-loader   # rebuild from public/nemo.svg + the
 *                                  # PP Neue Machina Inktrap Ultrabold woff2
 *   npm run verify:nemo-loader     # replay the morph pairing through the real
 *                                  # MorphSVG normaliser in Node
 *
 * Measured from the artwork and the typeface by
 * scripts/generate-nemo-loader.mjs:
 *
 *   · art: ${stats.rawCurves} cubics in ${stats.rawSubpaths} subpaths → ${stats.fittedCurves} fitted cubics in
 *     ${morphChar.length} subpaths at ${tol}u tolerance (worst measured miss ${stats.worstDeviation.toFixed(2)}u)
 *   · dust: ${stats.dustPieces} subpaths under ${DUST_MIN}u (${Math.round(stats.dustInk)}u of ink) are not
 *     animated at all — the exact art resolves them when the morph lands
 *   · morph: ${morphChar.length} pieces per side — ${realCount} numeral contours unspool into
 *     the character's largest lines, ${morphChar.length - realCount} pieces depart from points
 *     parked on the numerals' strokes (travel mean ${travelMean.toFixed(1)}u / max ${travelMax.toFixed(1)}u)
 *   · counter: ${COUNTER.fontSize}u ${family}, tracking ${COUNTER.trackFrom}em → ${COUNTER.trackTo}em,
 *     cap ${(capHeight * scale).toFixed(1)}u, optical centre (${artBBox.cx.toFixed(1)}, ${artBBox.cy.toFixed(1)})
 *   · payload: ${(morphBytes / 1024).toFixed(1)} kB of path data per side
 */

export interface LoaderGlyph {
  /** Advance width in 1,000-unit em space. */
  advance: number;
  /** Ink extents in the same space (y already flipped for SVG). */
  inkMinX: number;
  inkMaxX: number;
  inkMinY: number;
  inkMaxY: number;
  /** Complete closed subpaths ('M…Z') in glyph-local em space: baseline at
   *  y = 0, y pointing down.  Place a glyph with
   *  translate(x, baseline) scale(FONT_SIZE / 1000). */
  contours: string[];
}

export const VIEWBOX = ${VIEWBOX};
export const FONT_SIZE = ${fmt(COUNTER.fontSize)};

export const COUNTER = {
  /** Em tracking at 0% and at 100% — the counter's tightening: the climb
   *  starts wide and contracts to this frame before the morph departs. */
  trackFrom: ${COUNTER.trackFrom},
  trackTo: ${COUNTER.trackTo},
  /** The string the layout is anchored to, and the string the morph departs
   *  from: the numerals' frame never jitters while the counter counts. */
  refString: '${COUNTER.refString}',
  morphString: '${COUNTER.morphString}',
  /** Pen x after the reference string's final glyph, at the 100% frame. */
  penRight: ${fmt(penRight)},
  /** Numeral baseline, art space. */
  baseline: ${fmt(baseline)},
  /** Cap height in viewBox units. */
  capHeight: ${fmt(capHeight * scale)},
  /** The % marker: baked position, absolute scale, its own baseline. */
  pctX: ${fmt(pctX)},
  pctY: ${fmt(pctY)},
  pctScale: ${Number(pctS.toFixed(5))},
  /** Reference ink box of '${ref}' at the 100% frame (art space): the frame the
   *  runtime layout has to reproduce — asserted in the unit tests. */
  refInk: {
    minX: ${fmt(refBox.minX)},
    maxX: ${fmt(refBox.maxX)},
    minY: ${fmt(refBox.minY)},
    maxY: ${fmt(refBox.maxY)},
  },
  /** translate() taking art space to the canvas centre. */
  artShiftX: ${fmt(artShiftX)},
  artShiftY: ${fmt(artShiftY)},
  /** Art-space ink centre, for reference. */
  centerX: ${fmt(artBBox.cx)},
  centerY: ${fmt(artBBox.cy)},
} as const;

/** Glyph data for the counter (digits + %). */
export const GLYPHS: Record<string, LoaderGlyph> = {\n`;

for (const ch of GLYPH_CHARS) {
  const g = glyphs[ch];
  body += `  '${ch}': {\n`;
  body += `    advance: ${fmt(g.advance)},\n`;
  body += `    inkMinX: ${fmt(g.inkMinX)},\n    inkMaxX: ${fmt(g.inkMaxX)},\n`;
  body += `    inkMinY: ${fmt(g.inkMinY)},\n    inkMaxY: ${fmt(g.inkMaxY)},\n`;
  body += `    contours: [\n`;
  for (const c of g.contours) body += `      '${segsToD(c)}',\n`;
  body += `    ],\n  },\n`;
}
body += `};\n\n`;

body += `/**
 * The two sides of the morph, in pairing order: index i of DIGIT_MORPH_D
 * becomes index i of CHAR_MORPH_D.  Both sides are sorted by coordinate count
 * (biggest first) — exactly the key MorphSVG's own normaliser sorts by — so its
 * sort is a stable no-op and the pairing holds for the entire tween.
 */
export const MORPH_PAIRING = {
  pieces: ${morphChar.length},
  contours: ${realCount},
  points: ${morphChar.length - realCount},
} as const;

/** Opening frame: the numerals at the 100% frame — tight tracking, ${realCount} real
 *  contours plus one degenerate point per remaining piece, each parked on the
 *  nearest stroke. */
export const DIGIT_MORPH_D = ${JSON.stringify(morphDigits.join(''))};

/** Closing frame: the character, every subpath kept whole and refit inside
 *  itself at ${tol}u tolerance (art space; translate by artShift). */
export const CHAR_MORPH_D = ${JSON.stringify(morphChar.join(''))};
`;

writeFileSync(TS_OUT, body);

console.log(`[nemo-loader] wrote ${path.relative(ROOT, TS_OUT)} (${(body.length / 1024).toFixed(1)} kB)`);
console.log(
  `[nemo-loader] art ${stats.rawCurves} → ${stats.fittedCurves} cubics at tol ${tol}u ` +
    `(${morphChar.length} subpaths, worst miss ${stats.worstDeviation.toFixed(2)}u)`,
);
console.log(
  `[nemo-loader] dust: ${stats.dustPieces} pieces < ${DUST_MIN}u (${Math.round(stats.dustInk)}u) left to the exact art`,
);
console.log(
  `[nemo-loader] morph: ${morphChar.length} pieces/side — ${realCount} contours + ${
    morphChar.length - realCount
  } points (travel mean ${travelMean.toFixed(1)}u, max ${travelMax.toFixed(1)}u)`,
);
console.log(
  `[nemo-loader] counter: ${COUNTER.fontSize}u in ${family}, cap ${(capHeight * scale).toFixed(1)}u, ` +
    `penRight ${penRight.toFixed(1)}, baseline ${baseline.toFixed(1)}, shift (${artShiftX.toFixed(
      1,
    )}, ${artShiftY.toFixed(1)})`,
);
console.log(`[nemo-loader] per-frame payload: ${(morphBytes / 1024).toFixed(1)} kB of path data`);
void trackingStart;
void tAtLength;
