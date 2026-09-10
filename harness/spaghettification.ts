/* ============================================================================
   SPAGHETTIFICATION HARNESS — the production lens field, driven by a slider.

   V4: everything that matters here is imported from src/lib — the field
   (`lensFieldAt`), the forward hull (`lensRegionAt`), and the 2D mosaic
   renderer (`createSignoffMosaic`) — and wired the way SignoffHorizon.tsx
   wires the UNARMED/late path: a one-shot rest-pose raster, an overlay
   canvas at the sheet's box, `draw(p, geometry, flyers)` per playhead, the
   live DOM crossfaded out on `--horizon-mix`. The differences are the point
   of a harness: no scroll pin (a range input is the playhead), no html2canvas
   (the "snapshot" is painted procedurally with the probe's own computed
   font — the textures the real capture would contain), and the filter-region
   audit survived as the dashed overlay so the fall is watchable against the
   hull the shader would ask for.

   NO SVG FILTER appears anywhere in this page: that substrate is retired —
   engines sampled its feImage data-URL maps as transparent black, so the
   site renders the SAME field out of `drawImage` slices now, which is the
   point of dragging the slider here: what you see is what the fallback
   renderer will paint on engines where the shader never starts.
   ========================================================================== */

import {
  clamp01,
  lensFieldAt,
  lensForwardAt,
  lensRegionAt,
  type HorizonExtent,
  type Point,
} from '../src/lib/spaghettification.ts';
import { createSignoffMosaic, type SignoffOverlay } from '../src/lib/signoffMosaic.ts';

const probe = document.getElementById('probe') as HTMLElement;
const stage = document.getElementById('stage') as HTMLElement;
const regionEl = document.createElement('div');
regionEl.id = 'region';
stage.appendChild(regionEl);
const slider = document.getElementById('playhead') as HTMLInputElement;
const readout = document.getElementById('readout') as HTMLOutputElement;

/** Headroom above the probe the strands are allowed to climb into — the
 * `.signoff-horizon` veil, miniaturised. The overlay canvas sticks out of the
 * probe's box by exactly this much, upward, as production's does. */
const VEIL = 320;

/** The probe's rest box and the singularity, in the probe's own local
 * space — the production component's sheet-local space, miniaturised. */
interface Scene {
  width: number;
  height: number;
  /** Stage-local position of the probe box (for mounting overlay canvases). */
  left: number;
  top: number;
  singularity: Point;
  extent: HorizonExtent;
}

function measure(): Scene {
  const box = probe.getBoundingClientRect();
  const hole = document.getElementById('hole')!.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  const singularity = {
    x: hole.left + hole.width / 2 - box.left,
    y: hole.top + hole.height / 2 - box.top,
  };
  const left = box.left - stageBox.left;
  const top = box.top - stageBox.top;
  return {
    width: box.width,
    height: box.height,
    left,
    top,
    singularity,
    extent: {
      // The overlay's frame spans the stage so its coordinate frame matches
      // production's sheet-wide canvas (the probe's raster sits inside it,
      // exactly as the invite's does inside the footer).
      width: stageBox.width,
      height: stageBox.height,
      anchorX: left + singularity.x,
      anchorY: top + singularity.y,
      veil: 0,
    },
  };
}

/** The probe's box in extent space (extent = stage-local). */
function probeRaster(scene: Scene) {
  return {
    x: scene.left,
    y: scene.top,
    width: scene.width,
    height: scene.height,
  };
}

/** A procedural stand-in for `captureSignoff`: paint the probe's gradient
 * headline into an offscreen canvas at 2× with the COMPUTED font, so a font
 * swap or a failing webfont is visible rather than silently baked. Painted
 * per measure (rest), never per playhead. */
function paintSnapshot(scene: Scene): HTMLCanvasElement {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(scene.extent.width * scale);
  canvas.height = Math.round(scene.extent.height * scale);
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  const style = getComputedStyle(probe);
  g.font = `${style.fontWeight} ${parseFloat(style.fontSize)}px ${style.fontFamily.split(',')[0]}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const grad = g.createLinearGradient(scene.left, 0, scene.left + scene.width, 0);
  grad.addColorStop(0.1, '#ffffff');
  grad.addColorStop(0.42, '#ff9c6b');
  grad.addColorStop(0.72, '#ff4136');
  g.fillStyle = grad;
  g.fillText(
    probe.textContent ?? 'NEMOVERSE',
    scene.left + scene.width / 2,
    scene.top + scene.height / 2 + parseFloat(style.fontSize) * 0.04,
  );
  return canvas;
}

/** The quadratic read-out: sample the forward image of three points along the
 * probe's baseline and report the mid-point's rise beyond the edges' mean —
 * the "concentric arching, not a list" invariant, in probe px. Coordinates
 * are PROBE-local (the extent's anchor is also probe-local, so the frame is
 * one frame; the old harness passed probe-local coordinates as singularity-
 * relative ones and read a nonsense arch). */
function baselineArch(scene: Scene, p: number): { arch: number; top: number } {
  const field = lensFieldAt(p, {
    ...scene.extent,
    anchorX: scene.singularity.x,
    anchorY: scene.singularity.y,
    width: scene.width,
    height: scene.height + VEIL,
    veil: VEIL,
  });
  const baseline = scene.height;
  const left = lensForwardAt(10, baseline, field);
  const mid = lensForwardAt(scene.width / 2, baseline, field);
  const right = lensForwardAt(scene.width - 10, baseline, field);
  const arch = mid.y - (left.y + right.y) / 2;
  // Near-edge (top-of-cap-height) infall: how far the top centre has flown.
  const top = lensForwardAt(scene.width / 2, 0, field).y;
  return { arch, top };
}

let scene = measure();
let overlay: SignoffOverlay | null = null;
let mixEl: HTMLCanvasElement | null = null;
let raf = 0;

/** (Re)build the one-shot raster + overlay against the CURRENT rest box —
 * production's `arm`, minus the async capture. */
function arm(): void {
  overlay?.dispose();
  const snapshot = paintSnapshot(scene);
  overlay = createSignoffMosaic(snapshot);
  mixEl = overlay.canvas;
  mixEl.style.position = 'absolute';
  mixEl.style.left = '0';
  mixEl.style.top = '0';
  mixEl.style.pointerEvents = 'none';
  // The overlay canvas is LARGER than the extent's veil-0 box would allow:
  // mount it over the stage (its backing is the whole stage box, exactly like
  // the sheet-mounted production canvas across sheet+veil).
  stage.appendChild(mixEl);
}

function paint(): void {
  raf = 0;
  const p = clamp01(parseFloat(slider.value));
  // The probe-local extent for the math probes; the stage-wide one for the
  // overlay draw (its anchor must land where the hole is, in stage coords).
  const probeExtent: HorizonExtent = {
    width: scene.width,
    height: scene.height + VEIL,
    anchorX: scene.singularity.x,
    anchorY: scene.singularity.y,
    veil: VEIL,
  };

  if (!overlay) arm();
  // The overlay in production draws the probe box from its own flyer list;
  // here the probe IS the (single) flyer, positioned in stage coords.
  const raster = probeRaster(scene);
  overlay!.draw(p, scene.extent, {
    invite: {
      x: raster.x + raster.width / 2,
      y: raster.y + raster.height / 2,
      width: raster.width,
      height: raster.height,
    },
    cta: { x: 0, y: 0, width: 0, height: 0 },
  });

  // The production exchange, scalar and mix-driven: she who fades in owns the
  // paint. At rest the mosaic is a verified identity, so the live probe may
  // stand down through the middle of the hand-off.
  const mix = p <= 0 ? 0 : Math.min(1, p / 0.18);
  mixEl!.style.opacity = mix.toFixed(3);
  probe.style.opacity = (1 - mix).toFixed(3);

  if (p > 0) {
    const field = lensFieldAt(p, probeExtent);
    const region = lensRegionAt(
      { x: 0, y: 0, width: scene.width, height: scene.height },
      scene.singularity,
      field,
    );
    regionEl.style.left = `${scene.left + Math.round(region.x)}px`;
    regionEl.style.top = `${scene.top + Math.round(region.y)}px`;
    regionEl.style.width = `${Math.max(1, Math.round(region.width))}px`;
    regionEl.style.height = `${Math.max(1, Math.round(region.height))}px`;
    regionEl.style.display = 'block';
    const { arch, top } = baselineArch(scene, p);
    readout.value =
      `p = ${p.toFixed(3)} · R ${field.horizon.toFixed(1)}px · arch ${arch.toFixed(1)}px` +
      ` · top flew ${(0 - top).toFixed(0)}px toward S · mosaic 3×8, drawImage only`;
  } else {
    regionEl.style.display = 'none';
    readout.value = 'p = 0.000 · rest (identity mosaic verified, live DOM shown)';
  }
}

function request(): void {
  if (raf) return;
  raf = requestAnimationFrame(paint);
}

slider.addEventListener('input', request);
for (const event of ['resize', 'scroll'] as const) {
  window.addEventListener(event, () => {
    // The blocks reposition: the singularity re-anchors against the rest box
    // exactly as the component re-measures on layout change, and the frozen
    // raster is refreshed — production re-captures on the same trigger.
    scene = measure();
    arm();
    request();
  });
}

arm();
paint();
