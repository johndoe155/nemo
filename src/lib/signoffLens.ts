/* ============================================================================
   Sign-off lens — the DOM plumbing for the live gravitational lens.

   The math lives in `lib/spaghettification.ts` (`lensFieldAt` /
   `lensRegionAt` / `computeLensMap` / `lensBakeStep`), pure and unit-tested.
   This module owns the DOM objects per flyer — the <svg> filter, its feImage
   displacement map and the feDisplacementMap scale — and, since V3.1, the one
   browser mechanic that decides whether any of it is visible at all:

   · feImage hrefs GO THROUGH THE ASYNC IMAGE PIPELINE. Re-assigning
     `image.href` to a fresh data URL does not take effect on the next paint:
     the document has to fetch (and decode) the image, and while that is
     pending the displacement input is TRANSPARENT BLACK. Transparent black
     reads as channel = 0, i.e. a displacement of `scale·(0 − 0.5) = −range` on
     BOTH axes — every output pixel sampling hundreds of px up-left of itself,
     i.e. the void, i.e. the flyer half-misplaced, streaking, or gone entirely.
     The first live build re-baked (and re-assigned) the map on essentially
     every scroll frame, so the whole consumption ran inside that fetch
     pipeline: random glitchy displacement under scroll, the block
     disappearing outright, and — whenever the pipeline won the race with a
     stale near-rest map — a flyer that never visibly moved toward the hole at
     all. THE FILMSTRIP is the fix: the fall is baked once as LENS_BAKE_STEPS
     stepping frames, every data URL is kept alive AND warm-decoded in the
     image cache by an <img> twin, and applying a frame only ever swaps in a
     URL the browser has already decoded.

   · TRIO, NEVER A MIX. A displacement map is only valid against the region
     and scale it was baked with. Region, feImage placement, scale and href
     are written atomically, and only when the playhead crosses onto a new
     filmstrip step — attribute churn on a filter re-rasterises the element.

   · THE REGION STILL TRACKS THE CONTENT. Each filmstrip frame's region is the
     hull of the rest box's forward image at that frame's playhead (`lensRegionAt`,
     snapped to whole px), so the map's 128² cells are spent where the content
     is, and the feImage is pinned exactly over that hull in element-local
     user space (explicit x/y/width/height — never the spec-default subregion).

   · THE SCALE IS THE MAP'S TRUE RANGE. `feDisplacementMap` displaces by
     `scale·(C − 0.5)` per channel; the map encodes the content range (the
     value `computeLensMap` returns) into the full 8-bit channel, so the
     quantisation bias stays a small, uniform translation of the whole warped
     image — never a wobble of one glyph against another, which is what the
     continuity of the word lives on.
   ========================================================================== */

import {
  LENS_BAKE_STEPS,
  LENS_MAP_SIZE,
  clamp01,
  computeLensMap,
  lensFieldAt,
  lensRegionAt,
  type HorizonExtent,
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

/** One baked filmstrip frame: the displacement map's data URL plus the region
 * and scale that are only valid together with it. */
interface LensBake {
  /** The snapped filter region, in sheet px (apply: convert to bbox units). */
  region: { x: number; y: number; width: number; height: number };
  /** The displacement scale = 2 × content range at this playhead. */
  scale: number;
  /** The PNG data URL. Kept warm by an <img> twin in `keepAlive`. */
  url: string;
}

export interface FlyerLensChannel {
  filter: SVGFilterElement;
  image: SVGFEImageElement;
  displace: SVGFEDisplacementMapElement;
  /** The filmstrip step index whose trio is currently written to the DOM, or
   * −1 (stand-down: scale 0 written, nothing else trusted). */
  applied: number;
  /** The raster/singularity/extent the cache below was baked for; a measured
   * layout change invalidates the whole strip. */
  signature: string;
  /** The filmstrip cache, indexed by step 0..LENS_BAKE_STEPS. */
  cache: Array<LensBake | null>;
}

export interface FlyerLenses {
  svg: SVGSVGElement;
  canvas: HTMLCanvasElement;
  map: Float32Array;
  channels: Record<FlyerId, FlyerLensChannel>;
  /** The decoded-image twins that pin every baked URL in the browser's image
   * cache (dropping these is what lets the feImage re-enter the async fetch
   * path). */
  keepAlive: Set<HTMLImageElement>;
  /** The inputs the background pre-baker is working through, per flyer. */
  pending: Record<FlyerId, { raster: LensRect; singularity: Point; extent: HorizonExtent } | null>;
  /** The rAF id of the background pre-baker, 0 when idle. */
  prebakeFrame: number;
  /** Round-robin cursor into the steps still to bake. */
  prebakeIndex: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Filmstrip index of a playhead. */
const stepIndexOf = (progress: number): number =>
  Math.round(clamp01(progress) * LENS_BAKE_STEPS);

/** Mount both flyer lenses into `host` (the sheet), replacing any previous
 * mount. The svg is a zero-size defs block; the filters' regions are set by
 * the first applied bake. Idempotent across StrictMode's double effects. */
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
    // the primitives (the displacement scale, the feImage's placement — see
    // `applyBake`) are painted in element-local CSS px.
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
      applied: -1,
      signature: '',
      cache: new Array<LensBake | null>(LENS_BAKE_STEPS + 1).fill(null),
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
    keepAlive: new Set(),
    pending: {
      invite: null,
      cta: null,
    } as Record<FlyerId, { raster: LensRect; singularity: Point; extent: HorizonExtent } | null>,
    prebakeFrame: 0,
    prebakeIndex: 0,
  };
}

/** What a baked strip is valid against: a measured re-layout (a resize, a
 * refresh) changes it and the whole strip is re-baked. */
function signatureOf(raster: LensRect, singularity: Point, extent: HorizonExtent): string {
  return [
    raster.x, raster.y, raster.width, raster.height,
    singularity.x, singularity.y,
    extent.width, extent.height, extent.anchorX, extent.anchorY, extent.veil,
  ]
    .map((n) => n.toFixed(3))
    .join('|');
}

/** Bake one filmstrip frame: the field at the frame's own playhead (map,
 * region and scale mutually consistent — the trio rule), the map encoded to
 * a PNG data URL, and the URL pinned in the image cache. */
function bakeOne(
  lenses: FlyerLenses,
  step: number,
  raster: LensRect,
  singularity: Point,
  extent: HorizonExtent,
): LensBake | null {
  const field = lensFieldAt(step / LENS_BAKE_STEPS, extent);
  const region = lensRegionAt(raster, singularity, field);
  const snapped = {
    x: Math.round(region.x),
    y: Math.round(region.y),
    width: Math.max(1, Math.round(region.width)),
    height: Math.max(1, Math.round(region.height)),
  };
  const ctx = lenses.canvas.getContext('2d');
  if (!ctx) return null;
  const range = computeLensMap(snapped, raster, singularity, field, LENS_MAP_SIZE, lenses.map);
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
  const url = lenses.canvas.toDataURL('image/png');
  // The decode twin: an identical URL fetched through the normal HTML image
  // pipeline. The browser's image cache is keyed by the URL string, so once
  // the twin has decoded, assigning this string to the feImage's href is a
  // cache hit — no pending fetch, no transparent-black map, no flicker.
  const twin = new Image();
  twin.src = url;
  // decode() forces the decode ahead of first use rather than trusting the
  // fetch alone; it is fire-and-forget because the warm <img> is itself enough
  // on engines without it.
  twin.decode?.().catch(() => undefined);
  lenses.keepAlive.add(twin);
  return { region: snapped, scale: 2 * norm, url };
}

/** Write a baked frame's trio to the DOM, atomically and only when it differs:
 * the filter's region in bbox units, the feImage pinned over that exact
 * region in the element's local user space (NEVER the default subregion —
 * with primitiveUnits="userSpaceOnUse" an un-positioned feImage is a spec
 * interpretation away from reading the map off the wrong box), the scale, and
 * the href. Applied only at a step boundary: attribute churn re-rasterises
 * the element, and sub-step differences are below the map's own resolution. */
function applyBake(
  channel: FlyerLensChannel,
  stepIndex: number,
  bake: LensBake,
  raster: LensRect,
): void {
  if (channel.applied === stepIndex) return;
  const { region } = bake;
  channel.filter.setAttribute('x', ((region.x - raster.x) / raster.width).toFixed(4));
  channel.filter.setAttribute('y', ((region.y - raster.y) / raster.height).toFixed(4));
  channel.filter.setAttribute('width', (region.width / raster.width).toFixed(4));
  channel.filter.setAttribute('height', (region.height / raster.height).toFixed(4));
  channel.image.setAttribute('x', (region.x - raster.x).toFixed(1));
  channel.image.setAttribute('y', (region.y - raster.y).toFixed(1));
  channel.image.setAttribute('width', region.width.toFixed(1));
  channel.image.setAttribute('height', region.height.toFixed(1));
  channel.displace.setAttribute('scale', bake.scale.toFixed(1));
  channel.image.setAttribute('href', bake.url);
  channel.applied = stepIndex;
}

/** The background pre-baker: a few frames per rAF, low steps first (the fall
 * opens at step 0), until both flyers' strips are complete. A paint that
 * arrives ahead of the baker bakes its own step synchronously instead, so the
 * reader never waits on this loop for a visible frame. */
function schedulePrebake(lenses: FlyerLenses): void {
  if (lenses.prebakeFrame) return;
  lenses.prebakeFrame = requestAnimationFrame(() => {
    lenses.prebakeFrame = 0;
    let done = 0;
    // Up to 3 bakes per frame: a bake is a 128² map plus a PNG encode, a few
    // ms apiece; the strip completes inside a second of hold time.
    for (
      let cursor = lenses.prebakeIndex;
      cursor < (LENS_BAKE_STEPS + 1) * FLYER_IDS.length && done < 3;
      cursor = (lenses.prebakeIndex = cursor + 1)
    ) {
      const id = FLYER_IDS[cursor % FLYER_IDS.length];
      const step = Math.floor(cursor / FLYER_IDS.length);
      const inputs = lenses.pending[id];
      const channel = lenses.channels[id];
      if (!inputs || channel.cache[step]) continue;
      const bake = bakeOne(lenses, step, inputs.raster, inputs.singularity, inputs.extent);
      if (bake) channel.cache[step] = bake;
      done += 1;
    }
    if (lenses.prebakeIndex < (LENS_BAKE_STEPS + 1) * FLYER_IDS.length) {
      schedulePrebake(lenses);
    }
  });
}

/** Paint one flyer's lens for one playhead. The playhead quantises onto the
 * filmstrip (`lensBakeStep` is the pure form of the same rule); the frame is
 * baked on demand if the background baker has not reached it yet. */
export function paintFlyerLens(
  lenses: FlyerLenses,
  id: FlyerId,
  progress: number,
  raster: LensRect,
  singularity: Point,
  extent: HorizonExtent,
): boolean {
  const channel = lenses.channels[id];
  const signature = signatureOf(raster, singularity, extent);
  if (channel.signature !== signature) {
    // A measured layout change: every baked region/scale/url pair is about a
    // different sheet, and the decoded twins are dead weight. Clear both.
    channel.signature = signature;
    channel.applied = -1;
    channel.cache = new Array<LensBake | null>(LENS_BAKE_STEPS + 1).fill(null);
    lenses.keepAlive.clear();
    lenses.pending[id] = { raster: { ...raster }, singularity: { ...singularity }, extent: { ...extent } };
    lenses.prebakeIndex = 0;
  } else if (!lenses.pending[id]) {
    lenses.pending[id] = { raster: { ...raster }, singularity: { ...singularity }, extent: { ...extent } };
  }
  const stepIndex = stepIndexOf(progress);
  let bake = channel.cache[stepIndex];
  if (!bake) {
    bake = bakeOne(lenses, stepIndex, raster, singularity, extent);
    if (!bake) return false;
    channel.cache[stepIndex] = bake;
  }
  applyBake(channel, stepIndex, bake, raster);
  schedulePrebake(lenses);
  return true;
}

/** Stand the lens down mid-scene: a zero scale makes the filter a no-op
 * without removing it (a removed filter re-triggering would paint the unwarped
 * element for a frame). The strips are kept: they only go when the measured
 * signature changes or the lenses are disposed. */
export function silenceFlyerLenses(lenses: FlyerLenses): void {
  for (const id of FLYER_IDS) {
    const channel = lenses.channels[id];
    if (channel.applied >= 0) channel.displace.setAttribute('scale', '0');
    channel.applied = -1;
  }
}

/** Give everything back: the svg is not React's, and neither is its raster,
 * nor the dozens of decoded frames pinned in the image cache. */
export function disposeFlyerLenses(lenses: FlyerLenses): void {
  if (lenses.prebakeFrame) {
    cancelAnimationFrame(lenses.prebakeFrame);
    lenses.prebakeFrame = 0;
  }
  for (const id of FLYER_IDS) lenses.pending[id] = null;
  lenses.keepAlive.clear();
  lenses.svg.remove();
  lenses.canvas.width = 0;
  lenses.canvas.height = 0;
  lenses.map = new Float32Array(0);
}
