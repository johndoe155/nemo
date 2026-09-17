/* ============================================================================
   Sign-off mosaic — the live lensing warp, rendered as a subdivided triangle
   mesh with drawImage and NOTHING else.

   This is the renderer of the unarmed/fallback path, and it exists because the
   previous one — an SVG feDisplacementMap fed by feImage data URLs — provably
   does not work as displacement input for live HTML elements in the wild
   (user-verified: a map that vendored demos make work, this engine rendered as
   transparent black, i.e. −range displacement, i.e. "the text gradually
   disappears, without any spaghettification"). Three rounds of engine roulette
   (async fetch, attribute invalidation, href/xlink href) is enough: the warp
   now uses the one canvas API every browser implements identically.

   THE FIELD DID NOT CHANGE. `lensForwardAt` from lib/spaghettification.ts —
   the same radial-haul/tidal/frame-drag field the WebGL overlay shader
   integrates (the shader does it per-fragment; canvas 2D has no fragment
   stage, so this does it per-vertex) — is evaluated at the corners of a
   `cols × rows` subdivision of the flyer's rest box, and every cell is painted
   as TWO triangles, each affine-mapped from its source rectangle to its warped
   quad. Neighbouring cells share warped edges, so the geometry is CONTINUOUS:
   the word bends and elongates as one fluid sheet — no horizontal strips, no
   per-band slices, no disconnected bars.

     · the NON-UNIFORM STRETCH comes from the field's own derivative: the row
       junctions nearest the singularity are hauled further along the pull axis
       than the far ones, so the near side stretches while the far side trails —
       the spaghettification, exactly as the shader draws it;
     · the CURVILINEAR LENSING is the field's radial nonlinearity across the
       columns: the midline bows toward the disk, the outer edges wrap into
       curved field lines;
     · the COLLAPSE is every corner landing on the singularity as the capture
       radius swallows the grid — the mesh pinches to a point, nothing fades;
     · ONE OBJECT: the fall is of the frozen rest raster as a whole image —
       nothing is decomposed into letters, nothing can shatter.

   The frame drag is carried by `lensForwardAt` itself (it counter-rotates the
   forward image), so the swirl stays subordinate to the radial story by
   SWIRL_TURNS.
   ========================================================================== */

import {
  lensFieldAt,
  lensForwardAt,
  FLYER_IDS,
  clamp01,
  type HorizonExtent,
  type LensRect,
  type Point,
  type FlyerId,
} from './spaghettification';

/** The target cell side, in CSS px of the sheet. ~16px cells over a 700×115
 * headline is a 44×8 mesh — fine enough that the field's curvature reads as a
 * curve, and ~700 triangles per flyer, a few ms of 2D canvas per frame. */
export const MOSAIC_CELL_PX = 16;

/** Cells whose warped quad has collapsed below this many canvas px in BOTH
 * axes are already inside the horizon: they would paint as sub-pixel noise. */
const MIN_CELL_EXTENT_PX = 0.5;

/** One mesh cell: the source rectangle (canvas px) and the four warped corners
 * of its destination quad (canvas px), in TL → TR → BR → BL order. */
export interface MosaicCell {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
}

/** Compute the mesh cells for ONE flyer at one playhead, in CANVAS px.
 * `geometry`-free: `singularity` and `veil` are the sheet-local anchor and the
 * overlay's headroom, `sourceScale` maps sheet CSS px → canvas px. Output
 * coordinate system: overlay-box canvas px (overlay origin = veil above the
 * sheet top). Pure: given a field, returns exactly the cell list the painter
 * would draw. */
export function mosaicCellsForFlyer(
  raster: LensRect,
  singularity: Point,
  field: ReturnType<typeof lensFieldAt>,
  sourceScale: number,
  veil: number,
  out: MosaicCell[],
): number {
  const { width, height } = raster;
  if (!(width > 0) || !(height > 0) || !(sourceScale > 0)) return 0;
  const cols = Math.max(1, Math.ceil(width / MOSAIC_CELL_PX));
  const rows = Math.max(1, Math.ceil(height / MOSAIC_CELL_PX));
  let count = 0;
  for (let j = 0; j < rows; j += 1) {
    const py0 = raster.y + (height * j) / rows;
    const py1 = raster.y + (height * (j + 1)) / rows;
    for (let i = 0; i < cols; i += 1) {
      const px0 = raster.x + (width * i) / cols;
      const px1 = raster.x + (width * (i + 1)) / cols;
      // The four corners' true forward images. A corner captured by the
      // horizon maps to the singularity itself — the geometric pinch.
      const c0 = lensForwardAt(px0 - singularity.x, py0 - singularity.y, field);
      const c1 = lensForwardAt(px1 - singularity.x, py0 - singularity.y, field);
      const c2 = lensForwardAt(px1 - singularity.x, py1 - singularity.y, field);
      const c3 = lensForwardAt(px0 - singularity.x, py1 - singularity.y, field);
      const mapX = (qx: number) => (singularity.x + qx) * sourceScale;
      const mapY = (qy: number) => (singularity.y + qy + veil) * sourceScale;
      const x0 = mapX(c0.x);
      const y0 = mapY(c0.y);
      const x1 = mapX(c1.x);
      const y1 = mapY(c1.y);
      const x2 = mapX(c2.x);
      const y2 = mapY(c2.y);
      const x3 = mapX(c3.x);
      const y3 = mapY(c3.y);
      // Inside the horizon: the whole quad has pinched to the point.
      const extent = Math.max(
        Math.abs(x0 - x2) + Math.abs(y0 - y2),
        Math.abs(x1 - x3) + Math.abs(y1 - y3),
      );
      if (extent < MIN_CELL_EXTENT_PX) continue;
      const cell: MosaicCell = out[count] ?? (out[count] = {
        sx: 0, sy: 0, sWidth: 0, sHeight: 0,
        x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0,
      });
      cell.sx = px0 * sourceScale;
      cell.sy = py0 * sourceScale;
      cell.sWidth = (px1 - px0) * sourceScale;
      cell.sHeight = (py1 - py0) * sourceScale;
      cell.x0 = x0;
      cell.y0 = y0;
      cell.x1 = x1;
      cell.y1 = y1;
      cell.x2 = x2;
      cell.y2 = y2;
      cell.x3 = x3;
      cell.y3 = y3;
      count += 1;
    }
  }
  return count;
}

/** The smallest canvas-2d surface the renderer needs — also the exact shape
 * the unit tests stub. */
export interface MosaicPainter {
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  clip: () => void;
  setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  drawImage: (
    image: CanvasImageSource,
    sx: number, sy: number, sWidth: number, sHeight: number,
    dx: number, dy: number, dWidth: number, dHeight: number,
  ) => void;
}

/** The affine that maps the source sub-rectangle's local frame to one warped
 * triangle, as a canvas 2D transform (a, b, c, d, e, f). The source triangle's
 * vertices in local (u, v) space are supplied; the destination vertices are in
 * canvas px. Solving two 2×2 systems per triangle keeps the texture mapping
 * exact, so adjacent triangles meet without tearing. */
function triangleTransform(
  uA: number, vA: number, ax: number, ay: number,
  uB: number, vB: number, bx: number, by: number,
  uC: number, vC: number, cx: number, cy: number,
): [number, number, number, number, number, number] | null {
  const e1x = uB - uA;
  const e1y = vB - vA;
  const e2x = uC - uA;
  const e2y = vC - vA;
  const det = e1x * e2y - e1y * e2x;
  if (Math.abs(det) < 1e-9) return null; // degenerate source triangle
  const f1x = bx - ax;
  const f1y = by - ay;
  const f2x = cx - ax;
  const f2y = cy - ay;
  const a = (f1x * e2y - f2x * e1y) / det;
  const c = (f2x * e1x - f1x * e2x) / det;
  const b = (f1y * e2y - f2y * e1y) / det;
  const d = (f2y * e1x - f1y * e2x) / det;
  const e = ax - (a * uA + c * vA);
  const f = ay - (b * uA + d * vA);
  return [a, b, c, d, e, f];
}

/** Paint one warped triangle from the source rectangle: clip to the triangle
 * in device space, then draw the source rect through the affine that carries
 * its corners onto the triangle's corners. */
function paintTriangle(
  painter: MosaicPainter,
  source: CanvasImageSource,
  cell: MosaicCell,
  ia: number, ib: number, ic: number,
): boolean {
  const u = [0, cell.sWidth, cell.sWidth, 0];
  const v = [0, 0, cell.sHeight, cell.sHeight];
  const x = [cell.x0, cell.x1, cell.x2, cell.x3];
  const y = [cell.y0, cell.y1, cell.y2, cell.y3];
  const m = triangleTransform(
    u[ia], v[ia], x[ia], y[ia],
    u[ib], v[ib], x[ib], y[ib],
    u[ic], v[ic], x[ic], y[ic],
  );
  if (!m) return false;
  painter.save();
  painter.beginPath();
  painter.moveTo(x[ia], y[ia]);
  painter.lineTo(x[ib], y[ib]);
  painter.lineTo(x[ic], y[ic]);
  painter.closePath();
  painter.clip();
  painter.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  painter.drawImage(source, cell.sx, cell.sy, cell.sWidth, cell.sHeight, 0, 0, cell.sWidth, cell.sHeight);
  painter.restore();
  return true;
}

/** Paint one flyer's fall onto a 2D context. `canvasWidth/Height` bound the
 * target so cells whose quad landed entirely off-canvas are never issued. */
export function renderLensMosaic(
  painter: MosaicPainter,
  source: CanvasImageSource,
  cells: MosaicCell[],
  count: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  let painted = 0;
  for (let i = 0; i < count; i += 1) {
    const cell = cells[i];
    const minX = Math.min(cell.x0, cell.x1, cell.x2, cell.x3);
    const maxX = Math.max(cell.x0, cell.x1, cell.x2, cell.x3);
    const minY = Math.min(cell.y0, cell.y1, cell.y2, cell.y3);
    const maxY = Math.max(cell.y0, cell.y1, cell.y2, cell.y3);
    if (maxX < 0 || maxY < 0 || minX > canvasWidth || minY > canvasHeight) continue;
    if (paintTriangle(painter, source, cell, 0, 1, 2)) painted += 1;
    if (paintTriangle(painter, source, cell, 0, 2, 3)) painted += 1;
  }
  return painted;
}

/** The overlay-renderer contract shared by the WebGL frozen frame
 * (`createEventHorizonWarp`) and by this mosaic: the component owns ONE of
 * these and treats them identically — canvas appended to the sheet,
 * `draw(p, geometry, flyers)` per playhead, `dispose()` on release. */
export interface SignoffOverlay {
  canvas: HTMLCanvasElement;
  /** Method syntax on purpose: the WebGL overlay's `draw` only needs the two
   * scalars it consumes, and method-bivariance is what lets that narrower
   * signature stand in for this one structurally. */
  draw(
    p: number,
    geometry: HorizonExtent,
    flyers: Record<FlyerId, { x: number; y: number; width: number; height: number }>,
  ): void;
  dispose(): void;
}

/** Build the 2D mosaic overlay from the rest-pose sheet snapshot — the SAME
 * snapshot the WebGL warp would have consumed, at the SAME position the warp
 * puts its canvas (`top: −veil`, overlay = sheet + veil). When this exists,
 * the live flyer DOM is just the crossfade's other side: its opacity is owned
 * by the same mix the shader path uses, so the handoff arithmetic never
 * forks. */
export function createSignoffMosaic(snapshot: HTMLCanvasElement): SignoffOverlay {
  const canvas = document.createElement('canvas');
  canvas.className = 'signoff-horizon__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-html2canvas-ignore', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  let sizedWidth = '';
  canvas.width = 1;
  canvas.height = 1;

  const draw: SignoffOverlay['draw'] = (p, geometry, flyers) => {
    const sourceScale = snapshot.width / Math.max(1, geometry.width);
    if (!(sourceScale > 0)) return;
    const cssW = geometry.width;
    const cssH = geometry.height + geometry.veil;
    const sig = `${cssW}x${cssH}@${sourceScale.toFixed(5)}`;
    if (sizedWidth !== sig) {
      sizedWidth = sig;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.style.top = `${-geometry.veil}px`;
      canvas.width = Math.max(1, Math.round(cssW * sourceScale));
      canvas.height = Math.max(1, Math.round(cssH * sourceScale));
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!(p > 0)) return;
    const field = lensFieldAt(clamp01(p), geometry);
    const singularity = { x: geometry.anchorX, y: geometry.anchorY };
    const cells: MosaicCell[] = [];
    for (const id of FLYER_IDS) {
      const box = flyers[id];
      if (!box) continue;
      const raster = {
        x: box.x - box.width / 2,
        y: box.y - box.height / 2,
        width: box.width,
        height: box.height,
      };
      const count = mosaicCellsForFlyer(raster, singularity, field, sourceScale, geometry.veil, cells);
      renderLensMosaic(ctx, snapshot, cells, count, canvas.width, canvas.height);
    }
  };

  return {
    canvas,
    draw,
    dispose() {
      canvas.remove();
      canvas.width = canvas.height = 0;
    },
  };
}
