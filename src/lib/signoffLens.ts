/* ============================================================================
   Sign-off lens — the DOM plumbing for the live gravitational lens.

   The math lives in `lib/spaghettification.ts` (`lensFieldAt` /
   `lensRegionAt` / `computeLensMap` / `lensBakeStep`), pure and unit-tested.
   This module owns the DOM objects per flyer — SVG displacement filters, their
   feImage maps and their feDisplacementMap scales — and the three browser
   mechanics that decide whether any of it is visible at all:

   · feImage hrefs GO THROUGH THE ASYNC IMAGE PIPELINE (V3.1's bug). Replacing
     `image.href` with a fresh data URL needs a fetch and a decode, and while
     that is pending the displacement input is transparent black — `scale·(0 −
     0.5) = −range` on both axes, every output pixel sampling the void. A scrub
     that re-bakes per frame lives inside that race: the first live build
     flickered, misplaced and outright lost the block. THE FILMSTRIP is the
     fix: the fall is baked once per flyer as LENS_BAKE_STEPS frames, each data
     URL pinned alive and pre-decoded by an <img> twin, so applying a frame is
     always an image-cache hit.

   · ATTRIBUTE MUTATION ON A REFERENCED FILTER IS NOT RELIABLY OBSERVED (the
     remaining V3.2 bug). Engines cache the instantiated filter chain of a
     element styled `filter: url(#x)`: with the client holding opacity/filter
     (`will-change`), attribute writes inside the referenced <filter> —
     feImage href, region, scale — can land without any repaint reaching the
     client, so the flyer stays painted with the first chain it ever got,
     which is the "completely non-motile" block. What CANNOT be cached through
     is a change of the style property itself: `url(#x-b)` is a different
     value from `url(#x-a)`. So every flyer mounts TWO filters and the
     paint PING-PONGS: each filmstrip step's trio is written into the
     inactive filter, and only then is the CSS reference flipped onto it.
     Style recalculation is the one invalidation path every engine honours.

   · TRIO, NEVER A MIX, AND ONE SPACE. A displacement map is only valid
     against the region and scale it was baked with. With filterUnits AND
     primitiveUnits both "userSpaceOnUse" the filter region, the feImage
     subregion, the map cells and the scale all share element-local CSS px —
     mixing bbox-fraction regions with px primitives is exactly where engines
     diverge on HTML elements, and a misinterpreted map is an invisible
     flyer. Trio + href are written atomically per step, into the filter the
     client is about to be pointed at, and only across a step boundary. And
     the flip itself is gated on the map's decode() having resolved (`decoded`
     below): one filmstrip step late is invisible; one void frame is "the
     text just disappeared". A measured re-layout rebuilds both the strip and
     the warm set.
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

/** Filter id BASES: the live pair per flyer is `<base>-a` and `<base>-b`
 * (see the ping-pong note in the header). Fixed strings so the stylesheet and
 * tests can rely on them. */
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

/** The three DOM nodes of one filter chain. */
interface LensChain {
  filter: SVGFilterElement;
  image: SVGFEImageElement;
  displace: SVGFEDisplacementMapElement;
}

export interface FlyerLensChannel {
  /** The ping-pong pair: [a, b]. `active` indexes the chain the client should
   * be pointing at; new bakes are written into the OTHER one. */
  chains: [LensChain, LensChain];
  /** Which chain is currently referenced by the client (−1: stand-down). */
  active: number;
  /** The filmstrip step index most recently WRITTEN (not necessarily the one
   * the client paints — the caller holds the CSS reference), or −1. */
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
  /** URLs whose decode() has RESOLVED. A ping-pong flip is gated on
   * membership: the client is only ever pointed at a map that provably exists
   * as pixels. Without the gate, the freshly swapped-in chain sits mid-fetch
   * rendering a transparent-black displacement (everything samples the void)
   * — the lag of one filmstrip step is always a smaller defect than a void. */
  decoded: Set<string>;
  /** The inputs the background pre-baker is working through, per flyer. */
  pending: Record<FlyerId, { raster: LensRect; singularity: Point; extent: HorizonExtent } | null>;
  /** The rAF id of the background pre-baker, 0 when idle. */
  prebakeFrame: number;
  /** Round-robin cursor into the steps still to bake. */
  prebakeIndex: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Filmstrip index of a playhead. */
const stepIndexOf = (progress: number): number =>
  Math.round(clamp01(progress) * LENS_BAKE_STEPS);

/** One displacement-filter chain: feImage → feDisplacementMap. ONE coordinate
 * space for everything: with `filterUnits="userSpaceOnUse"` (and primitives
 * likewise) the region AND the feImage placement are both element-local CSS
 * px. Mixing bbox-fraction regions with user-space primitives is precisely
 * where engines diverge on HTML elements, and a map pinned one interpretation
 * away from its content is an all-transparent flyer: the wrong displacement
 * input reads as transparent black, every output pixel samples the void, and
 * the block does not warp — it vanishes. */
function makeChain(id: string): LensChain {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
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
  return { filter, image, displace };
}

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
    const chains: [LensChain, LensChain] = [
      makeChain(`${FLYER_LENS_ID[id]}-a`),
      makeChain(`${FLYER_LENS_ID[id]}-b`),
    ];
    svg.append(chains[0].filter, chains[1].filter);
    channels[id] = {
      chains,
      active: -1,
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
    decoded: new Set(),
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
  // cache hit — no pending fetch, no transparent-black map, no flicker. And
  // the client is only ever POINTED at the url after the twin's decode has
  // proven the pixels exist (see `paintFlyerLens`): a step late, never void.
  const twin = new Image();
  lenses.keepAlive.add(twin);
  twin.src = url; // BEFORE decode(): decode() must belong to THIS load
  if (typeof twin.decode === 'function') {
    twin
      .decode()
      .then(() => lenses.decoded.add(url))
      .catch(() => lenses.decoded.add(url)); // a rejected decode must not deadlock the flip
  } else {
    // No decode API: trust the cache hit and do not gate.
    lenses.decoded.add(url);
  }
  return { region: snapped, scale: 2 * norm, url };
}

/** Write a baked frame's trio into the INACTIVE chain, then flip: the filter
 * the trio went into is — from the caller's next style write — the one the
 * client gets pointed at. Everything lands before the CSS reference moves,
 * so the engine never resolves a half-written chain. With filterUnits and
 * primitiveUnits BOTH "userSpaceOnUse", the filter region and the feImage's
 * subregion are the same rectangle in the same space (element-local px:
 * region − raster, since the raster's top-left is the element's own origin):
 * one interpretation, zero ambiguity. The scale is the map's true range; the
 * href is a PROVABLY DECODED url (the gate is in `paintFlyerLens`; the
 * xlink:href twin is belt-and-braces for engines that only honour the legacy
 * attribute on feImage — a silently unloaded map is an invisible flyer). */
function applyBake(
  channel: FlyerLensChannel,
  stepIndex: number,
  bake: LensBake,
  raster: LensRect,
): void {
  const next = channel.active === 0 ? 1 : 0;
  const chain = channel.chains[next];
  const { region } = bake;
  const x = (region.x - raster.x).toFixed(1);
  const y = (region.y - raster.y).toFixed(1);
  const width = region.width.toFixed(1);
  const height = region.height.toFixed(1);
  chain.filter.setAttribute('x', x);
  chain.filter.setAttribute('y', y);
  chain.filter.setAttribute('width', width);
  chain.filter.setAttribute('height', height);
  chain.image.setAttribute('x', x);
  chain.image.setAttribute('y', y);
  chain.image.setAttribute('width', width);
  chain.image.setAttribute('height', height);
  chain.displace.setAttribute('scale', bake.scale.toFixed(1));
  chain.image.setAttribute('href', bake.url);
  chain.image.setAttributeNS(XLINK_NS, 'xlink:href', bake.url);
  channel.active = next;
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

/** Paint one flyer's lens for one playhead and return the filter id the
 * client must reference (or null to stand the filter down). The playhead
 * quantises onto the filmstrip; the frame is baked on demand if the
 * background baker has not reached it yet. SAME STEP IN, NO WRITES OUT: the
 * trio, the ping-pong and the CSS property all stand still. */
export function paintFlyerLens(
  lenses: FlyerLenses,
  id: FlyerId,
  progress: number,
  raster: LensRect,
  singularity: Point,
  extent: HorizonExtent,
): string | null {
  const channel = lenses.channels[id];
  const signature = signatureOf(raster, singularity, extent);
  if (channel.signature !== signature) {
    // A measured layout change: every baked region/scale/url pair is about a
    // different sheet, and the decoded twins are dead weight. Clear both.
    channel.signature = signature;
    channel.applied = -1;
    channel.cache = new Array<LensBake | null>(LENS_BAKE_STEPS + 1).fill(null);
    lenses.keepAlive.clear();
    lenses.decoded.clear();
    lenses.pending[id] = { raster: { ...raster }, singularity: { ...singularity }, extent: { ...extent } };
    lenses.prebakeIndex = 0;
  } else if (!lenses.pending[id]) {
    lenses.pending[id] = { raster: { ...raster }, singularity: { ...singularity }, extent: { ...extent } };
  }
  const stepIndex = stepIndexOf(progress);
  if (channel.applied !== stepIndex) {
    let bake = channel.cache[stepIndex];
    if (!bake) {
      bake = bakeOne(lenses, stepIndex, raster, singularity, extent);
      if (!bake) return null;
      channel.cache[stepIndex] = bake;
    }
    // THE GATE: the flip is only ever made onto a chain whose map has
    // PROVABLY decoded. Pointing the client at a url that is still mid-fetch
    // paints a transparent-black displacement — every output pixel sampling
    // the void — which is exactly how "the text just disappears the moment
    // the animation starts" reads. One filmstrip step late is invisible; one
    // void frame is the whole bug. The next paint re-tries (a decode of a
    // data URL is microtasks, not frames), so the settle is immediate.
    if (lenses.decoded.has(bake.url)) applyBake(channel, stepIndex, bake, raster);
  }
  schedulePrebake(lenses);
  return channel.active < 0 ? null : `${FLYER_LENS_ID[id]}-${channel.active === 0 ? 'a' : 'b'}`;
}

/** Stand the lens down mid-scene: zero scales make both chains no-ops without
 * removing them (a removed filter re-triggering would paint the unwarped
 * element for a frame). The strips are kept: they only go when the measured
 * signature changes or the lenses are disposed. */
export function silenceFlyerLenses(lenses: FlyerLenses): void {
  for (const id of FLYER_IDS) {
    const channel = lenses.channels[id];
    for (const chain of channel.chains) chain.displace.setAttribute('scale', '0');
    channel.active = -1;
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
  lenses.decoded.clear();
  lenses.svg.remove();
  lenses.canvas.width = 0;
  lenses.canvas.height = 0;
  lenses.map = new Float32Array(0);
}
