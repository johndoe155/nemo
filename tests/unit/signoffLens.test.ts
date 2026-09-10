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

test('the lens mounts a ping-pong PAIR per flyer and paints steps by flipping the reference', () => {
  const restore = installFakeDom();
  try {
    const host = HOST();
    const lenses = mountFlyerLenses(host as never);
    // One svg, two chains per flyer, ids fixed and paired.
    const invite = lenses.channels.invite.chains;
    assert.equal((invite[0].filter as never as StubNode).attrs.id, `${FLYER_LENS_ID.invite}-a`);
    assert.equal((invite[1].filter as never as StubNode).attrs.id, `${FLYER_LENS_ID.invite}-b`);
    assert.equal(host.svg!.children.length, 4);

    // First paint at a stepped playhead: writes the trio into chain A and
    // returns its id for the CSS flip.
    const first = paintFlyerLens(lenses, 'invite', 0.2, RASTER, SINGULARITY, EXTENT);
    assert.equal(first, `${FLYER_LENS_ID.invite}-a`);
    const aFilter = invite[0].filter as never as StubNode;
    assert.ok(aFilter.attrWrites > 0, 'region never written');
    const scale = parseFloat((invite[0].displace as never as StubNode).attrs.scale);
    assert.ok(scale > 0, `scale ${scale} should be positive mid-fall`);
    assert.match((invite[0].image as never as StubNode).attrs.href, /^data:image\/png/);
    // feImage placement is ELEMENT-LOCAL px: image.x = region.x − raster.x,
    // while the filter's bbox x is (region.x − raster.x)/width — the two must
    // agree through the raster width (px rounding aside).
    const bboxX = parseFloat(aFilter.attrs.x);
    const imageX = parseFloat((invite[0].image as never as StubNode).attrs.x);
    assert.ok(Math.abs(imageX - bboxX * RASTER.width) < 2, `map placement ${imageX} vs region ${bboxX}·w`);

    // Same step again: NO writes at all, same id — sub-step churn is how the
    // old build flickered.
    const writesA = (invite[0].filter as never as StubNode).attrWrites;
    const writesB = (invite[1].filter as never as StubNode).attrWrites;
    for (const p of [0.2, 0.201, 0.207]) {
      assert.equal(paintFlyerLens(lenses, 'invite', p, RASTER, SINGULARITY, EXTENT), first);
    }
    assert.equal((invite[0].filter as never as StubNode).attrWrites, writesA);
    assert.equal((invite[1].filter as never as StubNode).attrWrites, writesB);

    // New step: the trio goes into chain B and the id FLIPS — the engine sees
    // a different url() value, which is the invalidation that cannot be
    // cached through.
    const later = paintFlyerLens(lenses, 'invite', 0.35, RASTER, SINGULARITY, EXTENT);
    assert.equal(later, `${FLYER_LENS_ID.invite}-b`);
    assert.ok((invite[1].filter as never as StubNode).attrWrites > 0);
    const laterScale = parseFloat((invite[1].displace as never as StubNode).attrs.scale);
    assert.ok(laterScale > scale, `tide should grow: ${scale} -> ${laterScale}`);
    assert.notEqual((invite[1].image as never as StubNode).attrs.href, (invite[0].image as never as StubNode).attrs.href);

    // The background pre-baker eventually fills the strip.
    flush();
    const baked = lenses.channels.invite.cache.filter(Boolean).length;
    assert.equal(baked, LENS_BAKE_STEPS + 1);

    silenceFlyerLenses(lenses);
    assert.equal((invite[0].displace as never as StubNode).attrs.scale, '0');
    // After a stand-down the next paint re-arms a chain cleanly.
    assert.match(String(paintFlyerLens(lenses, 'invite', 0.35, RASTER, SINGULARITY, EXTENT)), /horizon-lens-invite-[ab]/);

    disposeFlyerLenses(lenses);
  } finally {
    restore();
  }
});

test('a measured layout change rebuilds the strip and resets the ping-pong', () => {
  const restore = installFakeDom();
  try {
    const lenses = mountFlyerLenses(HOST() as never);
    const first = paintFlyerLens(lenses, 'cta', 0.2, RASTER, SINGULARITY, EXTENT);
    assert.equal(first, `${FLYER_LENS_ID.cta}-a`);
    flush();
    assert.equal(lenses.channels.cta.cache.filter(Boolean).length, LENS_BAKE_STEPS + 1);
    // New raster: every cached frame is invalid, and the VERY FIRST repaint
    // must still FLIP the reference — if the id the client already points at
    // returned unchanged, the fresh trio would depend on attribute mutation
    // being observed, which is exactly the failure mode the ping-pong exists
    // because of.
    const moved = { ...RASTER, y: RASTER.y + 4 };
    const flipped = paintFlyerLens(lenses, 'cta', 0.2, moved, SINGULARITY, EXTENT);
    assert.equal(flipped, `${FLYER_LENS_ID.cta}-b`);
    assert.notEqual(flipped, first);
    assert.equal(lenses.channels.cta.cache.filter(Boolean).length, 1);
  } finally {
    restore();
  }
});
