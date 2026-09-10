import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLYER_LENS_ID,
  disposeFlyerLenses,
  mountFlyerLenses,
  paintFlyerLens,
  silenceFlyerLenses,
} from '../../src/lib/signoffLens.ts';
import { LENS_BAKE_STEPS } from '../../src/lib/spaghettification.ts';

/* A minimal DOM for the lens plumbing: enough structure for setAttribute to
 * be observed (the whole point of the filmstrip/ping-pong rules is WHICH
 * attributes move and when), a canvas that returns distinguishable data URLs,
 * and an rAF queue the test can flush. */
interface StubNode {
  tag: string;
  attrs: Record<string, string>;
  attrWrites: number;
  children: StubNode[];
  classList: { add: (c: string) => void };
  setAttribute: (k: string, v: string) => void;
  setAttributeNS: (ns: string, k: string, v: string) => void;
  append: (...nodes: StubNode[]) => void;
  remove: () => void;
}

const mkNode = (tag: string): StubNode => {
  const node: StubNode = {
    tag,
    attrs: {},
    attrWrites: 0,
    children: [],
    classList: { add: () => undefined },
    setAttribute(k, v) {
      node.attrs[k] = v;
      node.attrWrites += 1;
    },
    setAttributeNS(_ns, k, v) {
      node.attrs[k] = v;
      node.attrWrites += 1;
    },
    append(...nodes) {
      node.children.push(...nodes);
    },
    remove: () => undefined,
  };
  return node;
};

let urlCounter = 0;

const canvasOf = () => ({
  width: 0,
  height: 0,
  getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => undefined,
  }),
  toDataURL: () => `data:image/png;base64,bake-${++urlCounter}`,
});

function installFakeDom(): () => void {
  const rafQueue: Array<() => void> = [];
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    Image: (globalThis as Record<string, unknown>).Image,
    requestAnimationFrame: (globalThis as Record<string, unknown>).requestAnimationFrame,
    cancelAnimationFrame: (globalThis as Record<string, unknown>).cancelAnimationFrame,
  };
  (globalThis as Record<string, unknown>).document = {
    createElementNS: (_ns: string, tag: string) => mkNode(tag),
    createElement: (tag: string) => (tag === 'canvas' ? canvasOf() : mkNode(tag)),
  };
  (globalThis as Record<string, unknown>).Image = class {
    src = '';
    async decode(): Promise<void> {
      return undefined;
    }
  };
  (globalThis as Record<string, unknown>).requestAnimationFrame = (fn: () => void): number => {
    rafQueue.push(fn);
    return rafQueue.length;
  };
  (globalThis as Record<string, unknown>).cancelAnimationFrame = () => undefined;
  const flush = () => {
    let guard = 0;
    while (rafQueue.length && guard < 400) {
      guard += 1;
      rafQueue.shift()!();
    }
  };
  (globalThis as Record<string, unknown>).__flushRaf = flush;
  return () => {
    (globalThis as Record<string, unknown>).document = saved.document;
    (globalThis as Record<string, unknown>).Image = saved.Image;
    (globalThis as Record<string, unknown>).requestAnimationFrame = saved.requestAnimationFrame;
    (globalThis as Record<string, unknown>).cancelAnimationFrame = saved.cancelAnimationFrame;
    delete (globalThis as Record<string, unknown>).__flushRaf;
  };
}

const flush = () => ((globalThis as Record<string, () => void>).__flushRaf ?? (() => undefined))();

const HOST = () => ({
  svg: null as StubNode | null,
  querySelectorAll: () => [] as StubNode[],
  prepend(node: StubNode) {
    this.svg = node;
  },
});

/** Small-scene geometry: flyer 100×20 just below a singularity 60px above it. */
const RASTER = { x: 0, y: 0, width: 100, height: 20 };
const SINGULARITY = { x: 50, y: -60 };
const EXTENT = { width: 200, height: 100, anchorX: 50, anchorY: -60, veil: 80 };

/** Let pending twin decode()s resolve (microtasks past the async boundary). */
const settled = async (times = 3) => {
  for (let i = 0; i < times; i += 1) await new Promise((r) => setImmediate(r));
};

test('the lens mounts a ping-pong PAIR per flyer and paints steps by flipping the reference — only after decode', async () => {
  const restore = installFakeDom();
  try {
    const host = HOST();
    const lenses = mountFlyerLenses(host as never);
    // One svg, two chains per flyer, ids fixed and paired.
    const invite = lenses.channels.invite.chains;
    assert.equal((invite[0].filter as never as StubNode).attrs.id, `${FLYER_LENS_ID.invite}-a`);
    assert.equal((invite[1].filter as never as StubNode).attrs.id, `${FLYER_LENS_ID.invite}-b`);
    assert.equal(host.svg!.children.length, 4);

    // THE GATE: the first paint bakes the frame but its twin is still
    // decoding, so the client is NOT flipped onto a void chain — no id, no
    // writes beyond what the mount itself set — and the element keeps its
    // (visible) unfiltered paint.
    const mountWritesA = (invite[0].filter as never as StubNode).attrWrites;
    const mountWritesB = (invite[1].filter as never as StubNode).attrWrites;
    assert.equal(paintFlyerLens(lenses, 'invite', 0.2, RASTER, SINGULARITY, EXTENT), null);
    assert.equal((invite[0].filter as never as StubNode).attrWrites, mountWritesA);
    assert.equal((invite[1].filter as never as StubNode).attrWrites, mountWritesB);

    // Decode settled: the SAME paint now writes the trio into chain A and
    // hands back its id for the CSS flip.
    await settled();
    const first = paintFlyerLens(lenses, 'invite', 0.2, RASTER, SINGULARITY, EXTENT);
    assert.equal(first, `${FLYER_LENS_ID.invite}-a`);
    const aFilter = invite[0].filter as never as StubNode;
    assert.ok(aFilter.attrWrites > 0, 'region never written');
    const scale = parseFloat((invite[0].displace as never as StubNode).attrs.scale);
    assert.ok(scale > 0, `scale ${scale} should be positive mid-fall`);
    assert.match((invite[0].image as never as StubNode).attrs.href, /^data:image\/png/);
    assert.equal((invite[0].image as never as StubNode).attrs['xlink:href'], (invite[0].image as never as StubNode).attrs.href);

    // ONE SPACE: with filterUnits=primitiveUnits=userSpaceOnUse the filter's
    // region and the feImage's subregion are the same rectangle in the same
    // element-local px — a mixed-space misread is how maps silently void out.
    assert.equal((invite[0].image as never as StubNode).attrs.x, aFilter.attrs.x);
    assert.equal((invite[0].image as never as StubNode).attrs.y, aFilter.attrs.y);
    assert.equal((invite[0].image as never as StubNode).attrs.width, aFilter.attrs.width);
    assert.equal((invite[0].image as never as StubNode).attrs.height, aFilter.attrs.height);

    // Same step again: NO writes at all, same id — sub-step churn is how the
    // old build flickered.
    const writesA = (invite[0].filter as never as StubNode).attrWrites;
    const writesB = (invite[1].filter as never as StubNode).attrWrites;
    for (const p of [0.2, 0.201, 0.207]) {
      assert.equal(paintFlyerLens(lenses, 'invite', p, RASTER, SINGULARITY, EXTENT), first);
    }
    assert.equal((invite[0].filter as never as StubNode).attrWrites, writesA);
    assert.equal((invite[1].filter as never as StubNode).attrWrites, writesB);

    // New step whose twin is still decoding: still the OLD id — a lagged
    // valid frame, never a void one.
    assert.equal(paintFlyerLens(lenses, 'invite', 0.35, RASTER, SINGULARITY, EXTENT), first);
    assert.equal((invite[1].filter as never as StubNode).attrWrites, mountWritesB);

    // Decoded now: the trio goes into chain B and the id FLIPS — the engine
    // sees a different url() value, the invalidation that cannot be cached
    // through.
    await settled();
    const later = paintFlyerLens(lenses, 'invite', 0.35, RASTER, SINGULARITY, EXTENT);
    assert.equal(later, `${FLYER_LENS_ID.invite}-b`);
    assert.ok((invite[1].filter as never as StubNode).attrWrites > 0);
    const laterScale = parseFloat((invite[1].displace as never as StubNode).attrs.scale);
    assert.ok(laterScale > scale, `tide should grow: ${scale} -> ${laterScale}`);
    assert.notEqual((invite[1].image as never as StubNode).attrs.href, (invite[0].image as never as StubNode).attrs.href);

    // The background pre-baker eventually fills the strip.
    flush();
    await settled();
    const baked = lenses.channels.invite.cache.filter(Boolean).length;
    assert.equal(baked, LENS_BAKE_STEPS + 1);

    silenceFlyerLenses(lenses);
    assert.equal((invite[0].displace as never as StubNode).attrs.scale, '0');
    // After a stand-down the next paint re-arms a decoded chain immediately.
    assert.match(String(paintFlyerLens(lenses, 'invite', 0.35, RASTER, SINGULARITY, EXTENT)), /horizon-lens-invite-[ab]/);

    disposeFlyerLenses(lenses);
  } finally {
    restore();
  }
});

test('a measured layout change rebuilds the strip and still never flips mid-decode', async () => {
  const restore = installFakeDom();
  try {
    const lenses = mountFlyerLenses(HOST() as never);
    paintFlyerLens(lenses, 'cta', 0.2, RASTER, SINGULARITY, EXTENT); // decodes…
    await settled();
    const first = paintFlyerLens(lenses, 'cta', 0.2, RASTER, SINGULARITY, EXTENT);
    assert.equal(first, `${FLYER_LENS_ID.cta}-a`);
    flush();
    await settled();
    assert.equal(lenses.channels.cta.cache.filter(Boolean).length, LENS_BAKE_STEPS + 1);
    // New raster: the strip, the warm set and the decode proofs are all
    // invalid. The first repaint bakes the step's frame but is NOT allowed to
    // flip onto it before its decode lands — the client keeps the last VALID
    // chain, which is exactly how "text disappears mid-animation" stays dead.
    const moved = { ...RASTER, y: RASTER.y + 4 };
    const held = paintFlyerLens(lenses, 'cta', 0.2, moved, SINGULARITY, EXTENT);
    assert.equal(held, first);
    await settled();
    const flipped = paintFlyerLens(lenses, 'cta', 0.2, moved, SINGULARITY, EXTENT);
    assert.equal(flipped, `${FLYER_LENS_ID.cta}-b`);
    assert.notEqual(flipped, held);
    assert.equal(lenses.channels.cta.cache.filter(Boolean).length, 1);
    disposeFlyerLenses(lenses);
  } finally {
    restore();
  }
});
