/* ============================================================================
   Sign-off mosaic — the live lensing warp, rendered with drawImage and NOTHING
   else.

   This is the renderer of the unarmed/fallback path, and it exists because the
   previous one — an SVG feDisplacementMap fed by feImage data URLs — provably
   does not work as displacement input for live HTML elements in the wild
   (user-verified: a map that vendored demos make work, this engine rendered as
   transparent black, i.e. −range displacement, i.e. "the text gradually
   disappears, without any spaghettification"). Three rounds of engine roulette
   (async fetch, attribute invalidation, href/xlink href) is enough: the warp
   now uses the one canvas API every browser implements identically.

   THE FIELD DID NOT CHANGE. `lensFieldAt` / `lensForwardAt` from
   lib/spaghettification.ts — the same radial-haul/tidal/frame-drag field the
   WebGL overlay shader integrates — are evaluated at a GRID of control points
   over the flyer's rest box (3 px columns × 8 rows), and each cell is painted
   with one drawImage slice from the rest-pose snapshot:

     · the ARCH (baseline bows toward the disk) comes from column-to-column
       differences: the middle of the word is closer to the singularity, so
       its control points land nearer it — one continuous raster, the global
       gradient intact, mid-air curvature no affine transform could draw;
     · the EXPONENTIAL near-edge stretch lives in the row segmentation: a
       cell adjacent to the horizon stretches by its own tidal radius, so the
       top of the type strands by (R/Δ)^1.35 exactly as the shader would draw
       it, and thins out across the pull axis;
     · the FUNNEL and the pinch-off are the destination x converging on the
       anchor and the slice heights collapsing to nothing at the horizon;
     · ONE OBJECT: the fall is of the frozen rest raster as a whole image —
       nothing is decomposed into letters, nothing can shatter.

   Rotation from the frame drag is approximated per slice by a destination-x
   shift (drawImage is axis-aligned rect→rect); the drag is kept subordinate
   to the arch by SWIRL_TURNS, so what the eye reads is the radial story.
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

/** The rest column pitch, in CSS px of the sheet. 3 px balances per-slice
 * field fidelity (the arch is sampled 233 times across the 700 px headline)
 * against a frame's draw-call budget (~2.3k drawImages at the deepest
 * unfurled frame, a few ms of 2D canvas). */
export const MOSAIC_STRIP_PX = 3;

/** Row subdivisions per column. The exponential near/far differential lives
 * here: 8 slices over a 115 px headline puts a control point every ~14 px of
 * fall, fine enough that the (R/Δ)^1.35 curvature reads as a curve, not a
 * fan. */
export const MOSAIC_ROWS = 8;

/** Slices whose destination height collapses below this many canvas px are
 * skipped: already inside the horizon, they would paint as sub-pixel noise. */
const MIN_SLICE_HEIGHT_PX = 0.5;

/** What one drawImage gets told (kept public for the unit tests' sake: the
 * renderer is asserted BY the calls it would make). */
export interface MosaicSlice {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
}

/** Compute the drawImage slices for ONE flyer at one playhead, in CANVAS px.
 * `geometry` is the sheet's extent; `veil` is the overlay's headroom above the
 * sheet top; `sourceScale` maps sheet CSS px → canvas px (the snapshot's own
 * rasterisation scale). Output coordinate system: overlay-box canvas px
 * (overlay origin = veil above the sheet top). Pure: given a field, returns
 * exactly the slice list the painter would draw. */
export function mosaicSlicesForFlyer(
  raster: LensRect,
  singularity: Point,
  field: ReturnType<typeof lensFieldAt>,
  sourceScale: number,
  veil: number,
  out: MosaicSlice[],
): number {
  const { width, height } = raster;
  if (!(width > 0) || !(height > 0) || !(sourceScale > 0)) return 0;
  const columns = Math.max(1, Math.ceil(width / MOSAIC_STRIP_PX));
  let count = 0;
  for (let c = 0; c < columns; c += 1) {
    const sx = raster.x + MOSAIC_STRIP_PX * c;
    const sWidth = Math.min(MOSAIC_STRIP_PX, raster.x + width - sx);
    // The centre of the actual sub-strip (the last column is partial).
    const cx = sx + sWidth / 2;
    // Control points down the column: the FORWARD image of each row junction.
    const destY = new Float64Array(MOSAIC_ROWS + 1);
    const destX = new Float64Array(MOSAIC_ROWS + 1);
    for (let j = 0; j <= MOSAIC_ROWS; j += 1) {
      const py = raster.y + (height * j) / MOSAIC_ROWS;
      const fwd = lensForwardAt(cx - singularity.x, py - singularity.y, field);
      destX[j] = singularity.x + fwd.x;
      destY[j] = singularity.y + fwd.y;
    }
    for (let j = 0; j < MOSAIC_ROWS; j += 1) {
      const dy0 = destY[j];
      const dy1 = destY[j + 1];
      const span = Math.abs(dy1 - dy0) * sourceScale;
      if (!(span >= MIN_SLICE_HEIGHT_PX)) continue;
      const dx = (destX[j] + destX[j + 1]) / 2;
      const dy = Math.min(dy0, dy1);
      const slice: MosaicSlice = out[count] ?? (out[count] = {
        sx: 0, sy: 0, sWidth: 0, sHeight: 0, dx: 0, dy: 0, dWidth: 0, dHeight: 0,
      });
      slice.sx = sx * sourceScale;
      slice.sy = (raster.y + (height * j) / MOSAIC_ROWS) * sourceScale;
      slice.sWidth = sWidth * sourceScale;
      slice.sHeight = (height / MOSAIC_ROWS) * sourceScale;
      slice.dx = (dx - sWidth / 2) * sourceScale;
      slice.dy = (dy + veil) * sourceScale;
      slice.dWidth = sWidth * sourceScale;
      slice.dHeight = span;
      count += 1;
    }
  }
  return count;
}

/** The smallest canvas-2d surface the renderer needs — also the exact shape
 * the unit tests stub. */
export interface MosaicPainter {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  drawImage: (
    image: CanvasImageSource,
    sx: number, sy: number, sWidth: number, sHeight: number,
    dx: number, dy: number, dWidth: number, dHeight: number,
  ) => void;
}

/** Paint one flyer's fall onto a 2D context. `canvasWidth/Height` bound the
 * target so hundred-of-px-longfall slices that DID land off-canvas aren't
 * even issued. */
export function renderLensMosaic(
  painter: MosaicPainter,
  source: CanvasImageSource,
  raster: LensRect,
  singularity: Point,
  field: ReturnType<typeof lensFieldAt>,
  sourceScale: number,
  veil: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const slices: MosaicSlice[] = [];
  const count = mosaicSlicesForFlyer(raster, singularity, field, sourceScale, veil, slices);
  let painted = 0;
  for (let i = 0; i < count; i += 1) {
    const s = slices[i];
    if (s.dx > canvasWidth || s.dy > canvasHeight) continue;
    if (s.dx + s.dWidth < 0 || s.dy + s.dHeight < 0) continue;
    painter.drawImage(source, s.sx, s.sy, s.sWidth, s.sHeight, s.dx, s.dy, s.dWidth, s.dHeight);
    painted += 1;
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
    for (const id of FLYER_IDS) {
      const box = flyers[id];
      if (!box) continue;
      const raster = {
        x: box.x - box.width / 2,
        y: box.y - box.height / 2,
        width: box.width,
        height: box.height,
      };
      renderLensMosaic(
        ctx,
        snapshot,
        raster,
        singularity,
        field,
        sourceScale,
        geometry.veil,
        canvas.width,
        canvas.height,
      );
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
