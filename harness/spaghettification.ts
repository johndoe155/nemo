/* ============================================================================
   SPAGHETTIFICATION HARNESS — the production lens field, driven by a slider.

   Everything that matters here is imported from src/lib: the field
   (`lensFieldAt`), the map (`computeLensMap` via `paintFlyerLens`), the region
   (`lensRegionAt`), and the plumbing (`mountFlyerLenses`). The markup wires
   them the way SignoffHorizon.tsx wires the invite flyer: one flyer, one
   filter (#horizon-lens-invite from FLYER_LENS_ID), a sheet-local raster, a
   sheet-local singularity, the field baked per playhead. The differences are
   the point of a harness: no scroll pin (a range input is the playhead), no
   frozen frame (this is the production UNARMED fallback path — the live
   raster carries the lens all the way to the horizon), and the filter region
   is drawn as a dashed overlay so the tracking is watchable.
   ========================================================================== */

import {
  LENS_MAP_SIZE,
  lensFieldAt,
  lensForwardAt,
  lensRegionAt,
  type HorizonExtent,
  type Point,
} from '../src/lib/spaghettification.ts';
import {
  FLYER_LENS_ID,
  mountFlyerLenses,
  paintFlyerLens,
  silenceFlyerLenses,
} from '../src/lib/signoffLens.ts';

const probe = document.getElementById('probe') as HTMLElement;
const regionEl = document.createElement('div');
regionEl.id = 'region';
document.getElementById('stage')!.appendChild(regionEl);
const slider = document.getElementById('playhead') as HTMLInputElement;
const readout = document.getElementById('readout') as HTMLOutputElement;

/** One lenses mount for one flyer. Production mounts both flyer channels on
 * the sheet; here the invite channel is re-used for the probe — the filter id
 * is FLYER_LENS_ID.invite, exactly what the live page paints for the headline. */
const lenses = mountFlyerLenses(document.getElementById('stage') as HTMLElement);

/** The probe's rest box and the singularity, in the probe's own local space —
 * the production component's sheet-local space, miniaturised. `box` is read
 * once per reflow (resize), never per playhead: the rest box is a constant of
 * the layout, as the component's rest capture is. */
interface Scene {
  width: number;
  height: number;
  /** The probe box on screen (for the region overlay). */
  left: number;
  top: number;
  singularity: Point;
  extent: HorizonExtent;
}

function measure(): Scene {
  const box = probe.getBoundingClientRect();
  const hole = document.getElementById('hole')!.getBoundingClientRect();
  const singularity = {
    x: hole.left + hole.width / 2 - box.left,
    y: hole.top + hole.height / 2 - box.top,
  };
  return {
    width: box.width,
    height: box.height,
    left: box.left,
    top: box.top,
    singularity,
    extent: {
      width: box.width,
      height: box.height,
      anchorX: singularity.x,
      anchorY: singularity.y,
      veil: 0,
    },
  };
}

/** The quadratic read-out: sample the forward image of eight points along the
 * probe's baseline and report the mid-point's rise beyond the edges' mean.
 * That number is the "concentric arching, not a list" invariant, in px: it is
 * ~0 at rest, grows quadratically, and it is the proof that the frame-drag
 * swirl is the subordinate term (a swirling LIST would show up here as the
 * edges rising about as much as the middle). */
function baselineArch(scene: Scene, p: number): { arch: number; top: number } {
  const field = lensFieldAt(p, scene.extent);
  const baseline = scene.height;
  const left = lensForwardAt(10, baseline, field, 3);
  const mid = lensForwardAt(scene.width / 2, baseline, field, 3);
  const right = lensForwardAt(scene.width - 10, baseline, field, 3);
  const arch = (mid.y - baseline) - ((left.y + right.y) / 2 - baseline);
  // Near-edge (top-of-cap-height) infall: how far the top centre has flown.
  const top = lensForwardAt(scene.width / 2, 0, field, 3).y;
  return { arch, top };
}

let scene = measure();
let raf = 0;

function paint(): void {
  raf = 0;
  const p = parseFloat(slider.value);
  const field = lensFieldAt(p, scene.extent);
  const raster = { x: 0, y: 0, width: scene.width, height: scene.height };

  if (p > 0) {
    // The component's exact dance: engage the filter, let paintFlyerLens own
    // the region/scale/map (its own quantization keeps repeated scrubs from
    // re-baking below the visible step).
    probe.style.filter = `url(#${FLYER_LENS_ID.invite})`;
    // Same signature the component drives: the field is evaluated INSIDE the
    // painter (quantised onto the filmstrip step); the harness's own `field`
    // above is just the read-out's probe.
    paintFlyerLens(lenses, 'invite', p, raster, scene.singularity, scene.extent);
    // The region overlay: the SAME rounding paintFlyerLens writes, so what
    // is drawn is what is applied. The bbox-units conversion is inside the
    // map; the overlay reads the sheet-px rect straight from lensRegionAt.
    const region = lensRegionAt(raster, scene.singularity, field);
    regionEl.style.left = `${scene.left + Math.round(region.x)}px`;
    regionEl.style.top = `${scene.top + Math.round(region.y)}px`;
    regionEl.style.width = `${Math.max(1, Math.round(region.width))}px`;
    regionEl.style.height = `${Math.max(1, Math.round(region.height))}px`;
    regionEl.style.display = 'block';
    const { arch, top } = baselineArch(scene, p);
    readout.value =
      `p = ${p.toFixed(3)} · R ${field.horizon.toFixed(1)}px · arch ${arch.toFixed(1)}px` +
      ` · top flew ${top.toFixed(0)}px · map ${LENS_MAP_SIZE}², scale 2×range`;
  } else {
    // Rest: the component writes no filter at all so the prose is painted
    // identically to the un-lensed page — a displacement filter is never a
    // rest state.
    probe.style.filter = '';
    silenceFlyerLenses(lenses);
    regionEl.style.display = 'none';
    readout.value = 'p = 0.000 · rest (identity map, scale 0, filter off)';
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
    // exactly as the component re-measures on layout change — the rest box
    // itself is re-captured, the map re-bakes.
    scene = measure();
    request();
  });
}

paint();
