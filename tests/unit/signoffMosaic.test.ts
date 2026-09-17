import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MOSAIC_CELL_PX,
  mosaicCellsForFlyer,
  type MosaicCell,
} from '../../src/lib/signoffMosaic.ts';
import { lensFieldAt } from '../../src/lib/spaghettification.ts';

/** The fixture geometry: invite 700×115 with singularity ~353px above its
 * centre — the same scene the field suite calibrates against. */
const RASTER = { x: 290, y: 30, width: 700, height: 115 };
const S = { x: 640, y: -353.5 };
const EXTENT = { width: 1280, height: 700, anchorX: 640, anchorY: -353.5, veil: 400 };

const COLS = Math.ceil(RASTER.width / MOSAIC_CELL_PX);
const ROWS = Math.ceil(RASTER.height / MOSAIC_CELL_PX);

const cellsAt = (p: number): MosaicCell[] => {
  const out: MosaicCell[] = [];
  const count = mosaicCellsForFlyer(RASTER, S, lensFieldAt(p, EXTENT), 2, 400, out);
  return out.slice(0, count);
};

/** The mesh is row-major: cell index = row * COLS + col. */
const byColRow = (cells: MosaicCell[]) => (col: number, row: number) => cells[row * COLS + col];

const midY = (cell: MosaicCell) => (cell.y0 + cell.y1 + cell.y2 + cell.y3) / 4;
const midX = (cell: MosaicCell) => (cell.x0 + cell.x1 + cell.x2 + cell.x3) / 4;
const cellHeight = (cell: MosaicCell) => (cell.y2 + cell.y3) / 2 - (cell.y0 + cell.y1) / 2;

test('the rest frame tiles the raster exactly, and the mesh is continuous (shared edges)', () => {
  const cells = cellsAt(0);
  assert.equal(cells.length, COLS * ROWS);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = byColRow(cells)(col, row);
      // Destination == source (× sourceScale, + veil on y): the identity at
      // p = 0 is exact, so the lift has no seam.
      assert.ok(Math.abs(cell.x0 - cell.sx) < 0.6, `rest x drift ${cell.x0} vs ${cell.sx}`);
      assert.ok(Math.abs(cell.y0 - (cell.sy + 800)) < 0.6, `rest y drift ${cell.y0} vs ${cell.sy}`);
      assert.ok(Math.abs(cell.x2 - (cell.sx + cell.sWidth)) < 0.6, 'rest right-edge drift');
      assert.ok(Math.abs(cell.y2 - (cell.sy + cell.sHeight + 800)) < 0.6, 'rest bottom-edge drift');
      // Adjacent cells share their warped edge EXACTLY — the same source
      // junction maps to the same destination point, so the mesh reads as one
      // continuous sheet, never disconnected strips.
      if (col < COLS - 1) {
        const right = byColRow(cells)(col + 1, row);
        assert.equal(cell.x1, right.x0, `torn vertical seam at col ${col}`);
        assert.equal(cell.y1, right.y0, `torn vertical seam at col ${col}`);
      }
      if (row < ROWS - 1) {
        const below = byColRow(cells)(col, row + 1);
        assert.equal(cell.x3, below.x0, `torn horizontal seam at row ${row}`);
        assert.equal(cell.y3, below.y0, `torn horizontal seam at row ${row}`);
      }
    }
  }
});

test('mid-fall: the midline arches toward the hole and the near edge stretches harder', () => {
  // p=0.25: the midline (nearest the singularity) bows toward it — its cells
  // land HIGHER (smaller y, the hole is above) than the columns at the edges.
  const cells = cellsAt(0.25);
  const meanY = (col: number) => {
    let sum = 0;
    for (let row = 0; row < ROWS; row += 1) sum += midY(byColRow(cells)(col, row));
    return sum / ROWS;
  };
  const mid = Math.floor(COLS / 2);
  const edges = (meanY(0) + meanY(COLS - 1)) / 2;
  assert.ok(
    edges - mid > 20,
    `midline arch ${(edges - mid).toFixed(1)}px @p=0.25, canvas units: the bow is the design's word`,
  );

  // p=0.3, the centre column: the top cell (nearer the horizon) keeps MORE of
  // its height than the bottom cell — the near side is exponentially harder
  // stretched, which is the spaghettification a flat affine cannot express.
  const strong = cellsAt(0.3);
  const centre = Math.floor(COLS / 2);
  const top = cellHeight(byColRow(strong)(centre, 0));
  const bottom = cellHeight(byColRow(strong)(centre, ROWS - 1));
  assert.ok(
    top > bottom * 1.03,
    `tide differential washed out: top ${top.toFixed(2)} vs bottom ${bottom.toFixed(2)}`,
  );

  // And everything draws strictly toward the anchor (never a stray bloom):
  // the warped centre of every cell sits at or inside its source radius.
  const ds = { x: S.x * 2, y: (S.y + 400) * 2 };
  for (const cell of cells) {
    const sr = Math.hypot((cell.sx + cell.sWidth / 2) - S.x * 2, (cell.sy + cell.sHeight / 2) - S.y * 2);
    const dr = Math.hypot(midX(cell) - ds.x, midY(cell) - ds.y);
    assert.ok(dr <= sr + 1, `cell bloomed outward: ${dr.toFixed(1)} > ${sr.toFixed(1)}`);
  }
});

test('late fall: the mesh collapses onto the singularity and there is no image left to draw', () => {
  const cells = cellsAt(0.98);
  // The grid has pinched toward the anchor: every surviving cell sits at the
  // singularity and each is a thin sliver of the rest box.
  let longest = 0;
  for (const cell of cells) {
    const height = cellHeight(cell);
    const width = (cell.x1 + cell.x2) / 2 - (cell.x0 + cell.x3) / 2;
    longest = Math.max(longest, height, width);
    assert.ok(Math.abs(midX(cell) - S.x * 2) < RASTER.width * 2 * 0.2, `late cell wandered to ${midX(cell)}`);
  }
  assert.ok(longest < 40, `a ${longest}px cell survives at the horizon`);

  // Full consumption is geometric: at p = 1 every vertex has been captured,
  // so no cell survives — nothing left to draw, never an opacity fade.
  assert.equal(cellsAt(1).length, 0, 'cells survived the horizon at p = 1');
});
