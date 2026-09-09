/* ============================================================================
   Sign-off lens — the DOM plumbing for the live gravitational lens.

   The math lives in `lib/spaghettification.ts` (`lensFieldAt` /
   `lensSourceAt` / `lensForwardAt` / `lensRegionAt` / `computeLensMap`), pure
   and unit-tested. This module owns the three DOM objects per flyer — the
   <svg> filter, its feImage displacement map and the feDisplacementMap scale —
   and the three pieces of care that keep them cheap and honest:

   · THE REGION MOVES WITH THE CONTENT. Each playhead the field's content
     hull (sheet-local px) is converted into the filter's objectBoundingBox
     region, snapped to whole px so a sub-pixel wobble never re-rasterises the
     element without re-baking anything.
   · THE MAP IS RE-BAKED, NOT RE-TIMED. Distortion strength is animated by
     re-baking the map from the field (the field's own gain/evolution), never
     by merely growing a static map's `scale` — a static map's curvature is a
     fixed function, so only a re-baked field can give the bow its non-linear
     arrival. The bake is skipped when the playhead has moved less than the
     bake granularity and nothing else changed.
   · THE SCALE IS THE MAP'S TRUE RANGE. `feDisplacementMap` displaces by
     `scale·(C − 0.5)` per channel; the map encodes the content range (the
     value `computeLensMap` returns) into the full 8-bit channel, so the
     quantisation bias stays a small, uniform translation of the whole warped
     image (≤ ~1.6px at the deepest live frame, half a pixel mid-flight) —
     never a wobble of one glyph against another, which is what continuity of
     the word lives on.
   ========================================================================== */

import {
  LENS_MAP_SIZE,
  computeLensMap,
  lensRegionAt,
  type LensField,
  type LensRect,
  type Point,
  type FlyerId,
} from './spaghettification';
import { FLYER_IDS } from './spaghettification';

/** Filter ids are fixed strings so the stylesheet and tests can rely on them. */
export const FLYER_LENS_ID: Record<FlyerId, string> = {
  invite: 'horizon-lens-invite',
  cta: 'horizon-lens-cta',
};

/** Re-bake granularity, in playhead units: below this the painted difference is
 * sub-pixel at the map's own resolution, and the scroll's energy is better
 * spent on the overlay's frames. */
export const LENS_BAKE_STEP = 0.004;

/** The scale attribute is re-written only when the map's range moved by more
 * than this many px: attribute churn on the filter is itself a raster. */
const SCALE_WRITE_EPSILON_PX = 0.5;

export interface FlyerLensChannel {
  filter: SVGFilterElement;
  image: SVGFEImageElement;
  displace: SVGFEDisplacementMapElement;
  /** The region currently written on the filter, as SNAPPED sheet px. */
  region: { x: number; y: number; width: number; height: number } | null;
  /** The scale last written on the displacement primitive. */
  scale: number;
  /** The playhead the current map was baked for. */
  bakedProgress: number;
  /** The raster/singularity the current map was baked against. */
  bakedRaster: LensRect | null;
  bakedSingularity: Point | null;
}

export interface FlyerLenses {
  svg: SVGSVGElement;
  canvas: HTMLCanvasElement;
  map: Float32Array;
  channels: Record<FlyerId, FlyerLensChannel>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Mount both flyer lenses into `host` (the sheet), replacing any previous
 * mount. The svg is a zero-size defs block; the filters' regions are set by
 * the first bake. Idempotent across StrictMode's double effects. */
export function mountFlyerLenses(host: HTMLElement): FlyerLenses {
  host.querySelectorAll('svg.horizon-lens-defs').forEach((node) => node.remove());
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('data-html2canvas-ignore', 'true');
  svg.classList.add('horizon-lens-defs');
  const channels = {} as Record<FlyerId, FlyerLensChannel>;
  for (const id of FLYER_IDS) {
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', FLYER_LENS_ID[id]);
    // The region comes from the content hull in the element's own box units;
    // the primitives (the displacement scale in particular) are painted in
    // element-local CSS px.
    filter.setAttribute('filterUnits', 'objectBoundingBox');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const image = document.createElementNS(SVG_NS, 'feImage');
    image.setAttribute('result', 'map');
    image.setAttribute('preserveAspectRatio', 'none');
    const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
    displace.setAttribute('in', 'SourceGraphic');
    displace.setAttribute('in2', 'map');
    displace.setAttribute('xChannelSelector', 'R');
    displace.setAttribute('yChannelSelector', 'G');
    displace.setAttribute('scale', '0');
    filter.append(image, displace);
    svg.appendChild(filter);
    channels[id] = {
      filter,
      image,
      displace,
      region: null,
      scale: 0,
      bakedProgress: -1,
      bakedRaster: null,
      bakedSingularity: null,
    };
  }
  host.prepend(svg);
  const canvas = document.createElement('canvas');
  canvas.width = LENS_MAP_SIZE;
  canvas.height = LENS_MAP_SIZE;
  return {
    svg,
    canvas,
    map: new Float32Array(LENS_MAP_SIZE * LENS_MAP_SIZE * 2),
    channels,
  };
}

/** The region the content currently occupies, in objectBoundingBox units of
 * the flyer's rest box: bbox-fraction geometry, with x/width fractions of the
 * box width and y/height fractions of its height (the spec's own asymmetry —
 * y-fractions must not be divided by the width). */
function regionUnits(region: LensRect, raster: LensRect): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: (region.x - raster.x) / raster.width,
    y: (region.y - raster.y) / raster.height,
    width: region.width / raster.width,
    height: region.height / raster.height,
  };
}

/** Bake this playhead's displacement map into one flyer's filter, moving the
 * region to the content hull first. Returns true when the map was re-baked.
 * Cheap when nothing moved: a skipped bake is the whole point of keeping the
 * last inputs around. */
export function paintFlyerLens(
  lenses: FlyerLenses,
  id: FlyerId,
  progress: number,
  raster: LensRect,
  singularity: Point,
  field: LensField,
): boolean {
  const channel = lenses.channels[id];
  const region = lensRegionAt(raster, singularity, field);
  // Snap to whole sheet px: a fractional region is real (the hull is
  // fractional), but writing it would re-rasterise the element for differences
  // far below the map's own cell size, and the bake decides from the snapped
  // value — the map and the region must always describe the same rectangle.
  const snapped = {
    x: Math.round(region.x),
    y: Math.round(region.y),
    width: Math.max(1, Math.round(region.width)),
    height: Math.max(1, Math.round(region.height)),
  };
  const regionMoved =
    !channel.region ||
    channel.region.x !== snapped.x ||
    channel.region.y !== snapped.y ||
    channel.region.width !== snapped.width ||
    channel.region.height !== snapped.height;
  const rasterMoved =
    !channel.bakedRaster ||
    channel.bakedRaster.x !== raster.x ||
    channel.bakedRaster.y !== raster.y ||
    channel.bakedRaster.width !== raster.width ||
    channel.bakedRaster.height !== raster.height ||
    !channel.bakedSingularity ||
    channel.bakedSingularity.x !== singularity.x ||
    channel.bakedSingularity.y !== singularity.y;
  if (
    !regionMoved &&
    !rasterMoved &&
    channel.bakedProgress >= 0 &&
    Math.abs(channel.bakedProgress - progress) < LENS_BAKE_STEP
  ) {
    return false;
  }
  const unfolded = { ...region, width: snapped.width, height: snapped.height, x: snapped.x, y: snapped.y };
  const ctx = lenses.canvas.getContext('2d');
  if (!ctx) return false;
  const range = computeLensMap(unfolded, raster, singularity, field, LENS_MAP_SIZE, lenses.map);
  const img = ctx.createImageData(LENS_MAP_SIZE, LENS_MAP_SIZE);
  const norm = range > 0 ? range : 1;
  for (let k = 0, j = 0; k < lenses.map.length; k += 2, j += 4) {
    // 128 is the channel's rest code: symmetric displacement range, dx in R,
    // dy in G, matching the feDisplacementMap channel selectors below.
    img.data[j] = Math.max(0, Math.min(255, Math.round(128 + (lenses.map[k] / norm) * 127)));
    img.data[j + 1] = Math.max(0, Math.min(255, Math.round(128 + (lenses.map[k + 1] / norm) * 127)));
    img.data[j + 2] = 128;
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (regionMoved) {
    const units = regionUnits(snapped, raster);
    channel.filter.setAttribute('x', units.x.toFixed(4));
    channel.filter.setAttribute('y', units.y.toFixed(4));
    channel.filter.setAttribute('width', units.width.toFixed(4));
    channel.filter.setAttribute('height', units.height.toFixed(4));
    channel.region = snapped;
  }
  const scale = 2 * norm;
  if (Math.abs(channel.scale - scale) > SCALE_WRITE_EPSILON_PX) {
    channel.displace.setAttribute('scale', scale.toFixed(1));
    channel.scale = scale;
  }
  channel.image.setAttribute('href', lenses.canvas.toDataURL('image/png'));
  channel.bakedProgress = progress;
  channel.bakedRaster = { ...raster };
  channel.bakedSingularity = { x: singularity.x, y: singularity.y };
  return true;
}

/** Stand the lens down mid-scene: a zero scale makes the filter a no-op
 * without removing it (a removed filter re-triggering would paint the unwarped
 * element for a frame). */
export function silenceFlyerLenses(lenses: FlyerLenses): void {
  for (const id of FLYER_IDS) {
    const channel = lenses.channels[id];
    channel.displace.setAttribute('scale', '0');
    channel.scale = 0;
    channel.bakedProgress = -1;
    channel.bakedRaster = null;
    channel.bakedSingularity = null;
    channel.region = null;
  }
}

/** Give everything back: the svg is not React's, and neither is its raster. */
export function disposeFlyerLenses(lenses: FlyerLenses): void {
  lenses.svg.remove();
  lenses.canvas.width = 0;
  lenses.canvas.height = 0;
  lenses.map = new Float32Array(0);
}
