import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MOSAIC_ROWS,
  MOSAIC_STRIP_PX,
  mosaicSlicesForFlyer,
  type MosaicSlice,
} from '../../src/lib/signoffMosaic.ts';
import { lensFieldAt } from '../../src/lib/spaghettification.ts';

/** The fixture geometry: invite 700×115 with singularity ~353px above its
 * centre — the same scene the field suite calibrates against. */
const RASTER = { x: 290, y: 30, width: 700, height: 115 };
const S = { x: 640, y: -353.5 };
const EXTENT = { width: 1280, height: 700, anchorX: 640, anchorY: -353.5, veil: 400 };

const slicesAt = (p: number): MosaicSlice[] => {
  const out: MosaicSlice[] = [];
  const count = mosaicSlicesForFlyer(
    RASTER,
    S,
    lensFieldAt(p, EXTENT),
    2, // sourceScale: 2x snapshot
    400,
    out,
  );
  return out.slice(0, count);
};

/** Group slices into columns (keyed by their source x). */
const byColumns = (slices: MosaicSlice[]): Map<number, MosaicSlice[]> => {
  const cols = new Map<number, MosaicSlice[]>();
  for (const s of slices) {
    const arr = cols.get(s.sx) ?? [];
    arr.push(s);
    cols.set(s.sx, arr);
  }
  for (const arr of cols.values()) arr.sort((a, b) => a.sy - b.sy);
  return cols;
};

test('the rest frame paints the raster exactly where it is (subsume identity)', () => {
  const slices = slicesAt(0);
  // At p = 0 the field is the identity: every column × row slice of the
  // rest box is drawn, destination == source (× sourceScale, + veil on dy).
  const expected = Math.ceil(RASTER.width / MOSAIC_STRIP_PX) * MOSAIC_ROWS;
  assert.equal(slices.length, expected);
  for (const s of slices) {
    assert.ok(Math.abs(s.dx - s.sx) < 0.6, `rest x drift: ${s.dx} vs ${s.sx}`);
    assert.ok(Math.abs(s.dy - (s.sy + 400 * 2)) < 0.6, `rest y drift: ${s.dy} vs ${s.sy}`);
    assert.ok(Math.abs(s.dWidth - s.sWidth) < 0.6, 'rest w drift');
    assert.ok(Math.abs(s.dHeight - s.sHeight) < 0.6, 'rest h drift');
  }
});

test('mid-fall: the midline arches concentrically and the near edge leads the tide', () => {
  // p=0.25: every column intact (nothing captured yet), arch is the honest
  // quadratic second-difference of the column centres.
  const slices = slicesAt(0.25);
  const cols = byColumns(slices);
  assert.ok([...cols.values()].some((arr) => arr.length === MOSAIC_ROWS));
  const byX = [...cols.entries()].sort((a, b) => a[0] - b[0]);
  const meanY = (arr: MosaicSlice[]) => arr.reduce((n, s) => n + s.dy, 0) / arr.length;
  const mid = meanY(byX[Math.floor(byX.length / 2)][1]);
  const edges = (meanY(byX[0][1]) + meanY(byX[byX.length - 1][1])) / 2;
  assert.ok(
    edges - mid > 20,
    `midline arch ${(edges - mid).toFixed(1)}px @p=0.25, canvas units: the bow is the design's word`,
  );
  // The near/far differential at p=0.3 (strongest intact-column tide):
  // row 0 — the side nearest the horizon — must lose LESS of its destination
  // height than the bottom row: it is the exponentially harder-stretched
  // side, not a side that lost the same fraction as its opposite.
  const near = byColumns(slicesAt(0.3));
  const centreKey = [...near.keys()].reduce((a, b) =>
    Math.abs(a + 1.5 - S.x * 2) < Math.abs(b + 1.5 - S.x * 2) ? a : b,
  );
  const col = near.get(centreKey)!;
  assert.ok(col && col.length === MOSAIC_ROWS);
  const topRatio = col[0].dHeight / col[0].sHeight;
  const bottomRatio = col[col.length - 1].dHeight / col[col.length - 1].sHeight;
  assert.ok(
    topRatio > bottomRatio * 1.03,
    `tide differential washed out: top ${topRatio.toFixed(2)} vs bottom ${bottomRatio.toFixed(2)}`,
  );
  // And everything draws strictly toward the anchor (never a stray bloom):
  // radii in the destination canvas are all inside their sources' — the
  // swirl rotation moves slices sideways but cannot move them outward.
  const ds = { x: S.x * 2, y: (S.y + 400) * 2 };
  for (const s of slices) {
    const sr = Math.hypot(s.sx + s.sWidth / 2 - S.x * 2, s.sy + s.sHeight / 2 - S.y * 2);
    const dr = Math.hypot(s.dx + s.dWidth / 2 - ds.x, s.dy + s.dHeight / 2 - ds.y);
    assert.ok(dr <= sr + 1, `slice bloomed outward: ${dr.toFixed(1)} > ${sr.toFixed(1)}`);
  }
});

test('late fall: the slices collapse onto the singularity and there is no image left to draw', () => {
  const slices = slicesAt(0.98);
  const full = Math.ceil(RASTER.width / MOSAIC_STRIP_PX) * MOSAIC_ROWS;
  // Nearly everything has pinched off: surviving slices are few and thin,
  // and every destination sits at the anchor.
  assert.ok(
    slices.length < full * 0.25,
    `still ${slices.length} of ${full} slices at p=0.98`,
  );
  let longest = 0;
  for (const s of slices) {
    longest = Math.max(longest, s.dHeight);
    const cx = s.dx + s.dWidth / 2;
    assert.ok(Math.abs(cx - S.x * 2) < RASTER.width * 2 * 0.2, `late slice wandered to ${cx}`);
  }
  assert.ok(longest < 40, `a ${longest}px slice survives at the horizon`);
});
