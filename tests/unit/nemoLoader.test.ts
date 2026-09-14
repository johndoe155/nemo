import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAR_MORPH_D,
  COUNTER,
  DIGIT_MORPH_D,
  GLYPHS,
  MORPH_PAIRING,
} from '../../src/lib/nemoLoaderData.ts';
import {
  GLYPH_SCALE,
  TRACK_FROM,
  TRACK_TO,
  counterLabel,
  glyphPath,
  layoutCounter,
  trackingAt,
} from '../../src/lib/nemoMorph.ts';

/* ---------------------------------------------------------------------------
   The loader's load-bearing claim is that the counter the visitor watches and
   the path MorphSVG departs from are the *same ink*: the runtime layout has to
   reproduce the frames scripts/generate-nemo-loader.mjs baked. These tests hold
   that claim down numerically, so a nudge to the type metrics or to the layout
   formula fails here instead of turning the snap into a jump.
--------------------------------------------------------------------------- */

/** M/C/Z → flat [x0,y0, c1x,c1y, c2x,c2y, x,y, …] per subpath (absolute). */
function subpaths(d: string): number[][] {
  const toks = d.match(/[MCZ]|[-+]?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi) ?? [];
  const out: number[][] = [];
  let cur: number[] | null = null;
  let i = 0;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (t === 'M') {
      i += 1;
      cur = [num(), num()];
      out.push(cur);
    } else if (t === 'C') {
      i += 1;
      assert.ok(cur, 'C without M');
      for (let k = 0; k < 3; k += 1) cur.push(num(), num());
    } else if (t === 'Z') {
      i += 1;
      cur = null;
    } else {
      throw new Error(`unexpected token ${t}`);
    }
  }
  return out;
}

/** The counter's outlines as *drawn*: contours, placed and scaled. */
function drawNumerals(label: string, frame: ReturnType<typeof layoutCounter>): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < label.length; i += 1) {
    for (const contour of GLYPHS[label[i]].contours) {
      const sub = subpaths(contour)[0].map((v, k) =>
        k % 2 === 0 ? v * GLYPH_SCALE + frame.origins[i] : v * GLYPH_SCALE + COUNTER.baseline,
      );
      out.push(sub);
    }
  }
  return out;
}

const distance = (a: number[], b: number[]) => {
  let sum = 0;
  for (let k = 0; k < Math.min(a.length, b.length); k += 2) {
    sum += Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]);
  }
  return sum;
};

test('every counter glyph is a complete outline set in em space', () => {
  const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '%'];
  for (const ch of chars) {
    const glyph = GLYPHS[ch];
    assert.ok(glyph, `${ch} missing`);
    assert.ok(glyph.advance > 0, `${ch} advance`);
    assert.ok(glyph.contours.length > 0, `${ch} contours`);
    for (const contour of glyph.contours) {
      assert.match(contour, /^M[-\d.]/, `${ch} contour starts with M`);
      assert.match(contour, /Z$/, `${ch} contour closes`);
      assert.ok(contour.length > 8, `${ch} contour carries geometry`);
      assert.equal((subpaths(contour)[0].length - 2) % 6, 0, `${ch} cubics only`);
    }
    // The stored ink box agrees with the outlines it describes.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const contour of glyph.contours) {
      for (const sub of subpaths(contour)) {
        for (let k = 0; k < sub.length; k += 2) {
          xs.push(sub[k]);
          ys.push(sub[k + 1]);
        }
      }
    }
    assert.ok(Math.abs(Math.min(...xs) - glyph.inkMinX) < 1.5, `${ch} inkMinX`);
    assert.ok(Math.abs(Math.max(...xs) - glyph.inkMaxX) < 1.5, `${ch} inkMaxX`);
    assert.ok(Math.abs(Math.min(...ys) - glyph.inkMinY) < 1.5, `${ch} inkMinY`);
    assert.ok(Math.abs(Math.max(...ys) - glyph.inkMaxY) < 1.5, `${ch} inkMaxY`);
  }
  assert.equal(GLYPH_SCALE, 0.33, 'the counter is set at 330u in a 1,000-unit em');
});

test('the count is clamped, integral and always fits the loader’s slots', () => {
  assert.equal(counterLabel(0), '0');
  assert.equal(counterLabel(-3), '0');
  assert.equal(counterLabel(0.004), '0');
  assert.equal(counterLabel(0.006), '1');
  assert.equal(counterLabel(0.999), '100');
  assert.equal(counterLabel(1), '100');
  assert.equal(counterLabel(4), '100');
  let previous = -1;
  for (let p = 0; p <= 1.0001; p += 1 / 240) {
    const n = Number(counterLabel(p));
    assert.ok(n >= previous, 'monotonic');
    assert.ok(counterLabel(p).length <= 3, 'fits three slots');
    previous = n;
  }
});

test('tracking expands across the climb', () => {
  assert.ok(TRACK_FROM > 0 && TRACK_TO > TRACK_FROM);
  assert.equal(trackingAt(0), TRACK_FROM);
  assert.equal(trackingAt(1), TRACK_TO);
  const width = (tracking: number) => {
    const frame = layoutCounter('100', tracking);
    return frame.inkMaxX - frame.inkMinX;
  };
  assert.ok(width(TRACK_TO) > width(TRACK_FROM) + 100, 'the block widens visibly');
});

test('the runtime layout reproduces the generator’s reference frame', () => {
  const frame = layoutCounter(COUNTER.refString, TRACK_TO);
  assert.ok(Math.abs(frame.inkMinX - COUNTER.refInk.minX) < 0.05, `minX ${frame.inkMinX}`);
  assert.ok(Math.abs(frame.inkMaxX - COUNTER.refInk.maxX) < 0.05, `maxX ${frame.inkMaxX}`);
  assert.ok(Math.abs(frame.pctX - COUNTER.pctX) < 0.05, `pctX ${frame.pctX}`);
  // Vertically the block is centred on the artwork's optical centre.
  assert.ok(
    Math.abs((COUNTER.refInk.minY + COUNTER.refInk.maxY) / 2 - COUNTER.centerY) < 0.01,
    'refInk centred on centerY',
  );
  const pctInk = (GLYPHS['%'].inkMaxX - GLYPHS['%'].inkMinX) * COUNTER.pctScale;
  const blockMin = frame.inkMinX;
  const blockMax = frame.inkMaxX + (COUNTER.pctX - COUNTER.refInk.maxX) + pctInk;
  assert.ok(Math.abs((blockMin + blockMax) / 2 - COUNTER.centerX) < 0.1, 'block centred on centerX');
  assert.ok(Math.abs(frame.pctX - COUNTER.pctX) < 0.05, 'the % keeps its baked x');
});

test('the counter at 100% is the morph’s opening ink, contour for contour', () => {
  const frame = layoutCounter(COUNTER.morphString, TRACK_TO);
  const drawn = drawNumerals(COUNTER.morphString, frame);
  assert.equal(drawn.length, MORPH_PAIRING.contours, 'runtime contour count');

  // The baked opening frame: real contours carry geometry, the rest are the
  // degenerate departure points parked on the strokes.
  const baked = subpaths(DIGIT_MORPH_D);
  assert.equal(baked.length, MORPH_PAIRING.pieces, 'pieces');
  const real = baked.filter((sub) => sub.length > 8);
  assert.equal(real.length, MORPH_PAIRING.contours, 'real contours among the pieces');
  assert.equal(baked.length - real.length, MORPH_PAIRING.points, 'departure points');

  // Pair by geometry, then compare anchor for anchor (the data file rounds to
  // two decimals, so allow a hundredth of a unit).
  const used = new Set<number>();
  for (const target of real) {
    let bestIndex = -1;
    let best = Infinity;
    for (let i = 0; i < drawn.length; i += 1) {
      if (used.has(i)) continue;
      const d = distance(drawn[i], target);
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    assert.ok(bestIndex >= 0, 'every baked contour has a runtime twin');
    used.add(bestIndex);
    const sub = drawn[bestIndex];
    assert.equal(sub.length, target.length, 'same segment count');
    for (let k = 0; k < target.length; k += 2) {
      assert.ok(Math.abs(sub[k] - target[k]) < 0.05, `x ${sub[k]} vs ${target[k]}`);
      assert.ok(Math.abs(sub[k + 1] - target[k + 1]) < 0.05, `y ${sub[k + 1]} vs ${target[k + 1]}`);
    }
  }
});

test('the closing frame is the character: whole subpaths, one per morph piece', () => {
  const pieces = subpaths(CHAR_MORPH_D);
  assert.equal(pieces.length, MORPH_PAIRING.pieces);
  for (const piece of pieces) {
    assert.ok(piece.length >= 8, 'a subpath, never a fragment');
    assert.equal((piece.length - 2) % 6, 0, 'cubics only');
  }
});

test('no frame of the climb is degenerate', () => {
  for (let p = 0; p <= 1.0001; p += 1 / 240) {
    const label = counterLabel(p);
    const frame = layoutCounter(label, trackingAt(p));
    assert.equal(frame.origins.length, label.length);
    for (let i = 0; i < frame.origins.length; i += 1) {
      assert.ok(Number.isFinite(frame.origins[i]), 'finite origin');
      if (i > 0) assert.ok(frame.origins[i] > frame.origins[i - 1], 'origins ordered');
    }
    assert.ok(Number.isFinite(frame.pctX), 'finite %');
    assert.ok(Number.isFinite(frame.inkMinX) && Number.isFinite(frame.inkMaxX), 'finite ink');
    assert.ok(frame.inkMaxX < frame.pctX, 'the % trail never collides with the numerals');
  }
  assert.deepEqual(layoutCounter('', TRACK_TO).origins, [], 'the empty label is harmless');
});

test('glyph paths are cached, complete and empty for unknown characters', () => {
  assert.equal(glyphPath('7'), glyphPath('7'));
  assert.equal(glyphPath('7'), GLYPHS['7'].contours.join(' '));
  assert.equal(glyphPath('x'), '');
  assert.match(glyphPath('%'), /^M.*Z$/);
});
