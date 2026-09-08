import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLLAPSE_LEAD,
  INFALL_GAIN,
  INFALL_POLE,
  COLLAPSE_TAIL,
  CROSSING,
  EFFECTIVE_HORIZON_RADIUS_PX,
  FLYER_IDS,
  MIN_RELEASE_SLACK,
  MIX_END,
  SPACER_PAD,
  SWIRL_TURNS,
  TIDAL_CAP,
  TIDAL_FALLOFF,
  TIDAL_GAIN,
  clamp01,
  collapsibleHeight,
  collapseAt,
  coverRadius,
  curtainSlack,
  fallAt,
  flyerFrameAt,
  flyerTransform,
  framingHolds,
  horizonRadiusAtProgress,
  infallAt,
  overlayMixAt,
  phase,
  parkedFrameTop,
  parkedHem,
  sheetHeightAt,
  sheetStartOffset,
  spacerBoxAt,
  swirlAt,
  tidalAt,
  tidalGainAt,
  titleAir,
  triggerInset,
  TITLE_AIR_MAX,
  TITLE_AIR_MIN,
  type FlyerId,
  type Point,
} from '../../src/lib/spaghettification.ts';
import { MIN_SHEET_RUN, VEIL_MARGIN } from '../../src/lib/signoffHorizonGeometry.ts';

/* Sampled on a fine grid so the monotonicity claims below are real claims. */
const grid = (from: number, to: number, n = 400): number[] =>
  Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

const assertNonDecreasing = (xs: number[], f: (x: number) => number, what: string): void => {
  let previous = f(xs[0]);
  for (const x of xs.slice(1)) {
    const next = f(x);
    assert.ok(next >= previous - 1e-12, `${what} decreased at ${x}: ${next} < ${previous}`);
    previous = next;
  }
};

const assertNonIncreasing = (xs: number[], f: (x: number) => number, what: string): void => {
  let previous = f(xs[0]);
  for (const x of xs.slice(1)) {
    const next = f(x);
    assert.ok(next <= previous + 1e-12, `${what} increased at ${x}: ${next} > ${previous}`);
    previous = next;
  }
};

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/* A pinned scene at 1280×900, exactly as the reference framing builds it: a
 * 383px sheet whose hem parks 102px BELOW the fold (the CTA still off-screen at
 * the trigger), and whose singularity — the parked black hole's centre — lands
 * 430px ABOVE the sheet's own top edge. The fall is therefore upward, out of the
 * sheet and into the hole, and the veil is the headroom that buys. Flyer rest
 * positions are in the same space — the field is translation-invariant, so it
 * does not matter whether that space is the viewport or the sheet. */
const SCENE = {
  restHeight: 383,
  width: 1280,
  seam: 90,
  tail: 700,
  pinDistance: 440,
  /** The headline's inset above the fold at the trigger… */
  inset: 42,
  /** …and how far the sheet's hem sits below the headline's bottom edge. */
  belowTitle: 144,
  /** The hem's own inset: negative, i.e. parked below the fold. */
  hemInset: 42 - 144,
  anchorY: -430,
  veil: 430 + VEIL_MARGIN,
};
const EXTENT = {
  width: SCENE.width,
  height: SCENE.restHeight,
  anchorX: SCENE.width / 2,
  anchorY: SCENE.anchorY,
  veil: SCENE.veil,
  seam: SCENE.seam,
};
const SINGULARITY: Point = { x: EXTENT.anchorX, y: EXTENT.anchorY };
const FLYERS: Record<FlyerId | 'offAxis', Point> = {
  invite: { x: 640, y: 145 }, // on the pull axis, nearest the singularity
  cta: { x: 640, y: 300 }, // on the axis, the far side of it
  offAxis: { x: 400, y: 220 }, // off axis: exercises the swirl and the anisotropy
};
const IDS = [...FLYER_IDS, 'offAxis'] as const;

/* ---------------------------------------------------------------- fields -- */

test('clamp01 and phase are clamped ramps', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(9), 1);
  assert.equal(phase(0.1, 0.2, 0.4), 0);
  assert.ok(Math.abs(phase(0.3, 0.2, 0.4) - 0.5) < 1e-12);
  assert.equal(phase(0.9, 0.2, 0.4), 1);
  assert.ok(Number.isFinite(phase(0.5, 0.5, 0.5)), 'a zero-width phase must not be NaN');
});

test('infall rises from nothing to a finite, monotonic pull that ends in a point', () => {
  assert.equal(infallAt(0), 0);
  assertNonDecreasing(grid(0, 1), infallAt, 'infall');
  // The pole at 1/INFALL_POLE is what makes the fall accelerate: at p = 1 the
  // contraction is 1/(1 + gain/(1 - pole)), i.e. a few percent of rest size.
  assert.ok(
    Math.abs(infallAt(1) - INFALL_GAIN / (1 - INFALL_POLE)) < 1e-12,
    `infall(1) = ${infallAt(1)}`,
  );
  const contraction = 1 / (1 + infallAt(1));
  assert.ok(contraction < 0.1, `the sheet must contract into a point, not to ${contraction}`);
});

test('fall is the bounded infall displacement fraction', () => {
  assertNonDecreasing(grid(0, 1), fallAt, 'fall');
  for (const p of grid(0, 1, 80)) {
    const infall = infallAt(p);
    assert.ok(Math.abs(fallAt(p) - infall / (1 + infall)) < 1e-12);
    assert.ok(fallAt(p) >= 0 && fallAt(p) < 1, `fall(${p}) = ${fallAt(p)} escaped [0, 1)`);
  }
  assert.ok(fallAt(1) > 0.9, 'the pull has to all but reach the singularity');
  // The last few percent are the event horizon's job: whatever is left of the
  // distance is inside the capture radius, painted as void by the frozen frame.
  assert.ok(1 - fallAt(1) < 0.1);
});

test('the tidal term is a decaying radial gradient, capped inside the horizon', () => {
  assert.equal(tidalGainAt(0), 0, 'no gradient before the fall starts');
  assertNonDecreasing(grid(0, 1), tidalGainAt, 'tidal gain');
  const R = EFFECTIVE_HORIZON_RADIUS_PX;
  for (const p of [0.25, 0.5, 0.75, 1]) {
    const gain = tidalGainAt(p);
    assertNonIncreasing(grid(0.01, R * 4, 80), (r) => tidalAt(r, R, p), `tidal at p=${p}`);
    assert.ok(tidalAt(0.01, R, p) <= TIDAL_CAP + 1e-12, 'the cap keeps a fragment finite');
    assert.ok(
      Math.abs(tidalAt(R, R, p) - Math.min(TIDAL_CAP, gain)) < 1e-9,
      'at the horizon the term is exactly the uncapped gain',
    );
    assert.ok(
      tidalAt(R * 3, R, p) <= gain * (1 / 3) ** TIDAL_FALLOFF + 1e-12,
      'outside the horizon the term decays with the configured falloff',
    );
  }
  assert.ok(TIDAL_GAIN > 0 && TIDAL_FALLOFF > 1, 'a gradient needs gain and falloff');
  assert.ok(TIDAL_CAP < 1, 'a saturated tidal term must stay below unity');
});

test('frame dragging winds up to the configured turns, and never at rest', () => {
  assert.equal(swirlAt(0), 0);
  assertNonDecreasing(grid(0, 1), swirlAt, 'swirl');
  assert.ok(Math.abs(swirlAt(1) - SWIRL_TURNS) < 1e-12);
  assert.ok(SWIRL_TURNS < 0.5, 'less than half a turn keeps the type readable');
});

test('the collapse is held, then eased, then finished', () => {
  assert.equal(collapseAt(0), 0);
  assert.equal(collapseAt(COLLAPSE_LEAD), 0, 'the sheet holds its height while the warp takes hold');
  assert.equal(collapseAt(COLLAPSE_TAIL), 1);
  assert.equal(collapseAt(1), 1);
  assertNonDecreasing(grid(0, 1), collapseAt, 'collapse');
  assert.ok(collapseAt(0.5) > 0.3, 'the collapse must be well underway at the halfway playhead');
});

test('the sheet height tracks the collapse allowance, not the rest height', () => {
  assert.equal(sheetHeightAt(0, SCENE.restHeight), SCENE.restHeight);
  assert.equal(sheetHeightAt(1, SCENE.restHeight), 0);
  const capped = 300;
  assert.equal(sheetHeightAt(1, SCENE.restHeight, capped), SCENE.restHeight - capped);
  assert.equal(
    sheetHeightAt(0.5, SCENE.restHeight, capped),
    SCENE.restHeight - capped * collapseAt(0.5),
  );
  assertNonIncreasing(grid(0, 1, 120), (p) => sheetHeightAt(p, SCENE.restHeight), 'sheet height');
});

test('the paint crossfade starts after the warp takes hold and finishes early', () => {
  assert.equal(overlayMixAt(0), 0);
  assert.equal(overlayMixAt(1), 1);
  assertNonDecreasing(grid(0, 1), overlayMixAt, 'overlay mix');
  assert.ok(MIX_END < CROSSING, 'the live paint must be gone before anything crosses');
  assert.equal(overlayMixAt(CROSSING), 1);
});

/* ------------------------------------------------------------- the field -- */

test('the frozen frame is the identity at rest — no jump at the handoff', () => {
  for (const id of IDS) {
    const frame = flyerFrameAt(0, FLYERS[id], SINGULARITY, 0);
    assert.ok(Math.abs(frame.x) < 1e-12, `${id}: translated at rest`);
    assert.ok(Math.abs(frame.y) < 1e-12, `${id}: translated at rest`);
    assert.equal(frame.fall, 0);
    assert.ok(Math.abs(frame.along - 1) < 1e-12, `${id}: stretched at rest`);
    assert.ok(Math.abs(frame.across - 1) < 1e-12, `${id}: squeezed at rest`);
    assert.equal(frame.opacity, 1);
    assert.equal(frame.consumed, false);
    // The axis rotation is a rigid alignment of the pull direction, not a warp:
    // an isotropic scale at rest is invisible under any rotation.
    assert.ok(Number.isFinite(frame.rotation));
  }
});

test('every flyer translates toward the singularity while it is warped', () => {
  for (const id of IDS) {
    const rest = FLYERS[id];
    const pull = { x: SINGULARITY.x - rest.x, y: SINGULARITY.y - rest.y };
    let previous = distance(rest, SINGULARITY);
    for (const p of grid(0.01, 1, 150)) {
      const frame = flyerFrameAt(p, rest, SINGULARITY, horizonRadiusAtProgress(p, EXTENT));
      const at: Point = { x: rest.x + frame.x, y: rest.y + frame.y };
      if (frame.fall > 1e-6) {
        assert.ok(
          frame.x * pull.x + frame.y * pull.y > 0,
          `${id}: the displacement is not toward the singularity at p=${p}`,
        );
      }
      assert.ok(
        distance(at, SINGULARITY) <= previous + 1e-9,
        `${id}: moved away from the singularity at p=${p}`,
      );
      previous = distance(at, SINGULARITY);
      assert.ok(frame.along >= frame.across - 1e-12, `${id}: compressed along the pull axis`);
      assert.ok(frame.across > 0 && frame.along > 0, `${id}: non-positive scale at p=${p}`);
    }
    // The infall contracts to a fixed fraction of the rest distance; the
    // remainder is inside the horizon by then, so the frozen frame paints it.
    const restRadius = distance(rest, SINGULARITY);
    assert.ok(
      Math.abs(previous - restRadius * (1 - fallAt(1))) < 1e-6,
      `${id}: ended ${previous}px from the singularity, expected ${restRadius * (1 - fallAt(1))}`,
    );
    assert.ok(previous < restRadius * 0.1, `${id}: left ${previous}px of ${restRadius}px`);
  }
});

test('the magnifications are the numeric Jacobian of the same remap the shader uses', () => {
  // The shader sends an image point at radius r to source radius
  //     f(r) = r · (1 + infall + tidal(r)),
  // so its radial magnification is 1/f'(r) and its tangential magnification is
  // r/f(r). The element is warped by exactly those two numbers, which is what
  // keeps the live DOM and the frozen frame agreeing at the handoff. Both are
  // derived numerically here from the exported primitives.
  for (const p of [0.2, 0.45, 0.7, 0.9]) {
    const infall = infallAt(p);
    const R = horizonRadiusAtProgress(p, EXTENT);
    const f = (r: number): number => r * (1 + infall + tidalAt(r, R, p));
    for (const id of IDS) {
      const restRadius = distance(FLYERS[id], SINGULARITY) || 1;
      const radius = Math.max(restRadius / (1 + infall), 1e-4);
      const frame = flyerFrameAt(p, FLYERS[id], SINGULARITY, R);
      const h = Math.max(radius * 1e-4, 1e-4);
      const slope = (f(radius + h) - f(radius - h)) / (2 * h);
      const tangential = radius / f(radius);
      assert.ok(
        Math.abs(frame.across - tangential) < 1e-6,
        `${id} p=${p}: across ${frame.across} != r/f(r) ${tangential}`,
      );
      if (slope > 0.05) {
        assert.ok(
          Math.abs(frame.along - 1 / slope) < 1e-4,
          `${id} p=${p}: along ${frame.along} != 1/f'(r) ${1 / slope}`,
        );
      } else {
        assert.ok(frame.along >= 1 / 0.05 - 1e-6, `${id}: a degenerate slope must be clamped, not blown up`);
      }
      assert.ok(frame.along >= frame.across, `${id}: the pull axis must be the stretched one`);
    }
  }
});

test('the transform string is rotate · scale · rotate⁻¹ about the flyer centre', () => {
  const p = 0.6;
  const frame = flyerFrameAt(p, FLYERS.offAxis, SINGULARITY, horizonRadiusAtProgress(p, EXTENT));
  const css = flyerTransform(frame);
  const grab = (re: RegExp, what: string): RegExpMatchArray => {
    const match = css.match(re);
    assert.ok(match, `"${css}" has no ${what}`);
    return match;
  };
  const translate = grab(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)/, 'translate3d');
  const rotateIn = grab(/rotate\(([-\d.]+)deg\)\s*scale/, 'the first rotate');
  const scale = grab(/scale\(([-\d.]+),\s*([-\d.]+)\)/, 'scale');
  const rotateOut = grab(/scale\([^)]*\)\s*rotate\(([-\d.]+)deg\)/, 'the second rotate');
  assert.ok(Math.abs(Number(translate[1]) - frame.x) < 1e-3, 'the translation is the pull');
  assert.ok(Math.abs(Number(translate[2]) - frame.y) < 1e-3);
  assert.ok(Math.abs(Number(rotateIn[1]) - frame.rotation) < 1e-2, 'the first rotate aligns the pull axis');
  assert.ok(Math.abs(Number(rotateOut[1]) + frame.rotation) < 1e-2, 'the second rotate must undo the first');
  assert.ok(Math.abs(Number(scale[1]) - frame.along) < 1e-4);
  assert.ok(Math.abs(Number(scale[2]) - frame.across) < 1e-4);

  // Compose the matrix and check what it does to the flyer's own axes. CSS
  // rotate(θ) is [cos −sin; sin cos], and the pull axis is aligned to the
  // element's local Y by construction (axis = atan2 + 90°).
  const rad = (d: number): number => (d * Math.PI) / 180;
  const rot = (d: number): [number, number, number, number] => [
    Math.cos(rad(d)), -Math.sin(rad(d)), Math.sin(rad(d)), Math.cos(rad(d)),
  ];
  const mul = (
    a: [number, number, number, number],
    b: [number, number, number, number],
  ): [number, number, number, number] => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  ];
  const map = mul(rot(Number(rotateIn[1])), mul([Number(scale[1]), 0, 0, Number(scale[2])], rot(Number(rotateOut[1]))));
  const apply = (vx: number, vy: number): Point => ({
    x: map[0] * vx + map[1] * vy,
    y: map[2] * vx + map[3] * vy,
  });
  // `rotate(θ) · scale(along, across) · rotate(−θ)` is an anisotropic scale
  // whose eigenvectors are the direction at θ and its perpendicular: the pull
  // axis is stretched by `along`, the axis across it squeezed by `across`. That
  // is the spaghettification, expressed as one CSS transform.
  const pull = { x: SINGULARITY.x - FLYERS.offAxis.x, y: SINGULARITY.y - FLYERS.offAxis.y };
  const theta = rad(frame.rotation);
  const alongAxis = { x: Math.cos(theta), y: Math.sin(theta) };
  const acrossAxis = { x: -Math.sin(theta), y: Math.cos(theta) };
  const stretched = apply(alongAxis.x, alongAxis.y);
  const squeezed = apply(acrossAxis.x, acrossAxis.y);
  assert.ok(
    Math.abs(distance(stretched, { x: 0, y: 0 }) - frame.along) < 1e-4,
    `the pull axis stretched by ${distance(stretched, { x: 0, y: 0 })}, not ${frame.along}`,
  );
  assert.ok(
    Math.abs(distance(squeezed, { x: 0, y: 0 }) - frame.across) < 1e-4,
    `the cross axis squeezed by ${distance(squeezed, { x: 0, y: 0 })}, not ${frame.across}`,
  );
  // The stretched direction must point at the singularity, up to the frame
  // dragging that the shader applies to the same fragment.
  const pullAngle = Math.atan2(pull.y, pull.x);
  const drag = (theta - pullAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  assert.ok(Math.abs(drag) < Math.PI / 2, `the pull axis is off by ${drag} rad`);
  assert.ok(frame.along > frame.across, 'the pull axis must be the stretched one');
});

test('a flyer crosses once, stays crossed, and stops painting when it does', () => {
  const crossingOrder: Array<{ id: string; at: number; rest: number }> = [];
  for (const id of IDS) {
    const rest = FLYERS[id];
    let crossedAt: number | null = null;
    for (const p of grid(0, 1, 250)) {
      const R = horizonRadiusAtProgress(p, EXTENT);
      const frame = flyerFrameAt(p, rest, SINGULARITY, R);
      const at: Point = { x: rest.x + frame.x, y: rest.y + frame.y };
      const radius = distance(at, SINGULARITY);
      assert.ok(
        Math.abs(frame.opacity - (1 - overlayMixAt(p))) < 1e-12,
        `${id}: the live paint must follow the crossfade exactly`,
      );
      if (frame.consumed) {
        assert.ok(radius <= R * CROSSING + 1e-6, `${id}: consumed at radius ${radius}, horizon ${R}`);
        assert.equal(frame.opacity, 0, `${id}: consumed but still painted`);
        if (crossedAt === null) crossedAt = p;
      } else {
        assert.ok(crossedAt === null, `${id}: un-consumed again at p=${p} after crossing`);
        assert.ok(radius > R * CROSSING - 1e-9, `${id}: inside the horizon but not consumed`);
      }
    }
    assert.ok(crossedAt !== null, `${id}: never consumed`);
    // The live paint is exchanged for the frozen frame at MIX_END; retiring a
    // flyer before that would blink a live glyph out from under the reader.
    assert.ok(crossedAt! >= MIX_END, `${id}: retired at ${crossedAt}, before the paint handoff`);
    assert.equal(
      flyerFrameAt(1, rest, SINGULARITY, horizonRadiusAtProgress(1, EXTENT)).consumed,
      true,
      `${id}: still painting at the end of the fall`,
    );
    crossingOrder.push({ id, at: crossedAt!, rest: distance(rest, SINGULARITY) });
  }
  // No stagger exists: the differentiation is purely geometric, so the crossing
  // order is the rest-radius order. Nearer bodies fall in first.
  const byRadius = [...crossingOrder].sort((a, b) => a.rest - b.rest);
  const byCrossing = [...crossingOrder].sort((a, b) => a.at - b.at);
  assert.deepEqual(
    byCrossing.map((f) => f.id),
    byRadius.map((f) => f.id),
    'flyers must cross in order of their distance from the singularity',
  );
});

test('the horizon grows from a seed to every corner of the overlay', () => {
  assert.equal(horizonRadiusAtProgress(0, EXTENT), 0, 'no horizon at rest');
  assertNonDecreasing(grid(0, 1), (p) => horizonRadiusAtProgress(p, EXTENT), 'horizon radius');
  const cover = coverRadius(EXTENT);
  const farthest = Math.max(
    distance({ x: 0, y: EXTENT.veil }, { x: EXTENT.anchorX, y: EXTENT.anchorY + EXTENT.veil }),
    distance({ x: EXTENT.width, y: EXTENT.veil }, { x: EXTENT.anchorX, y: EXTENT.anchorY + EXTENT.veil }),
    distance({ x: 0, y: EXTENT.height + EXTENT.veil }, { x: EXTENT.anchorX, y: EXTENT.anchorY + EXTENT.veil }),
    distance(
      { x: EXTENT.width, y: EXTENT.height + EXTENT.veil },
      { x: EXTENT.anchorX, y: EXTENT.anchorY + EXTENT.veil },
    ),
  );
  assert.ok(cover >= farthest - 1e-9, `cover ${cover} misses a corner at ${farthest}`);
  assert.ok(
    Math.abs(horizonRadiusAtProgress(1, EXTENT) - cover) < 1e-9,
    'the last playhead must consume every texel',
  );
  assert.ok(cover >= SCENE.width / 2, 'a sheet-wide sheet needs a sheet-wide horizon');
  // The veil is headroom above the sheet for a strand that overshoots its top
  // edge: the margin alone while the singularity is inside the sheet, and the
  // margin plus however far the singularity sits above it otherwise — which is
  // the reference framing's case, and why the fall has room to travel upward.
  assert.equal(SCENE.veil, Math.max(0, -SCENE.anchorY) + VEIL_MARGIN);
  assert.ok(SCENE.veil > SCENE.restHeight * 0.5, 'the strands need room above the sheet');
  assert.ok(MIN_SHEET_RUN > 0, 'the fall needs a minimum run to read as a fall');
  // Every flyer's own radius is covered once the horizon has finished growing.
  for (const id of IDS) {
    const frame = flyerFrameAt(0.5, FLYERS[id], SINGULARITY, horizonRadiusAtProgress(0.5, EXTENT));
    const at: Point = { x: FLYERS[id].x + frame.x, y: FLYERS[id].y + frame.y };
    assert.ok(distance(at, SINGULARITY) <= cover, 'every flyer stays inside the overlay box');
  }
});

/* ------------ requirement 4: the curtain compensation, as a document model -- */

/** Everything above the sheet's pin-spacer: the rest of the site plus whatever
 * the black hole's own pin has parked. It cancels out of the invariant — which
 * is the point: the budget must not depend on how tall the rest of the site is. */
const ABOVE = 5200;
const VIEWPORT = 900;

const slackAt = (
  p: number,
  raw: number,
  scene: {
    restHeight: number;
    tail: number;
    inset: number;
    belowTitle: number;
    pinDistance: number;
    collapsible: number;
  },
): number => {
  const spacer = spacerBoxAt(p, raw, scene.restHeight, scene.pinDistance, scene.collapsible);
  const docHeight = ABOVE + spacer.height + scene.tail;
  // The pin engages on the shared trigger line: the headline's bottom edge
  // `inset` above the fold, i.e. `belowTitle` above the sheet's hem.
  const start = ABOVE + scene.restHeight - scene.belowTitle - (VIEWPORT - scene.inset);
  return docHeight - VIEWPORT - (start + scene.pinDistance * raw);
};

test('the curtain slack is the tail, adjusted for where the hem parks, plus a pixel of pad', () => {
  assert.equal(SPACER_PAD, 1);
  assert.equal(curtainSlack(SCENE.tail, SCENE.hemInset), SCENE.tail - SCENE.hemInset + SPACER_PAD);
  // The reference framing parks the hem BELOW the fold (the CTA still
  // off-screen at the trigger), which is scroll the curtain gets for free.
  assert.ok(SCENE.hemInset < 0);
  assert.ok(curtainSlack(SCENE.tail, SCENE.hemInset) > SCENE.tail + SPACER_PAD);
  assert.ok(MIN_RELEASE_SLACK > 0);
});

test('the collapse allowance never exceeds what the document can pay back', () => {
  assert.equal(
    collapsibleHeight(SCENE.restHeight, SCENE.tail, SCENE.hemInset),
    SCENE.restHeight,
    'a hem below the fold pays for the whole fall',
  );
  // A hem parked ABOVE the fold spends scroll instead, and the allowance has to
  // shrink with it — all the way down to refusing the effect outright.
  const aboveFold = 120;
  const capped = collapsibleHeight(
    SCENE.restHeight,
    aboveFold + MIN_RELEASE_SLACK + 200,
    aboveFold,
  );
  assert.ok(capped > 0 && capped < SCENE.restHeight, `expected a capped allowance, got ${capped}`);
  assert.equal(
    collapsibleHeight(SCENE.restHeight, aboveFold + MIN_RELEASE_SLACK - 1, aboveFold),
    0,
    'an unaffordable curtain must refuse the effect entirely',
  );
  for (const hemInset of [aboveFold, SCENE.seam, 0, SCENE.hemInset]) {
    for (const tail of grid(0, 2000, 60)) {
      const collapsible = collapsibleHeight(SCENE.restHeight, tail, hemInset);
      assert.ok(collapsible >= 0 && collapsible <= SCENE.restHeight);
      // Zero means the effect is refused outright (nothing is removed, nothing
      // has to be paid back). Anything else must leave the release slack intact.
      assert.ok(
        collapsible === 0 ||
          curtainSlack(tail, hemInset) - collapsible >= MIN_RELEASE_SLACK - 1e-9,
        `tail ${tail} hemInset ${hemInset}: only ${curtainSlack(tail, hemInset) - collapsible}px of scroll would survive`,
      );
    }
  }
});

test('the clip window tracks the sheet hem by exactly one pixel, at any scrub lag', () => {
  const collapsible = collapsibleHeight(SCENE.restHeight, SCENE.tail, SCENE.hemInset);
  for (const raw of [0, 0.2, 0.5, 0.999, 1]) {
    for (const p of grid(0, 1, 80)) {
      const spacer = spacerBoxAt(p, raw, SCENE.restHeight, SCENE.pinDistance, collapsible);
      // The floor's paint window opens at the spacer's top plus its height; the
      // sheet's hem is the spacer's top plus the parked pin distance plus the
      // sheet's own height. Their difference is the pad — and it must not
      // depend on the lag between the scroll (`raw`) and the playhead (`p`).
      const windowTop = spacer.height;
      const hem = SCENE.pinDistance * clamp01(raw) + sheetHeightAt(p, SCENE.restHeight, collapsible);
      assert.ok(
        Math.abs(windowTop - hem - SPACER_PAD) < 1e-6,
        `p=${p.toFixed(3)} raw=${raw}: window ${windowTop}, hem ${hem}`,
      );
      assert.ok(spacer.padding <= SCENE.pinDistance + 1e-9);
      assert.ok(
        spacer.height - spacer.padding >= sheetHeightAt(p, SCENE.restHeight, collapsible) - 1e-9,
        `p=${p.toFixed(3)}: the sheet does not fit its spacer content box`,
      );
    }
  }
});

test('the document never runs short while the sheet is consumed', () => {
  for (const tail of [SCENE.tail, 620, MIN_RELEASE_SLACK + 40]) {
    const collapsible = collapsibleHeight(SCENE.restHeight, tail, SCENE.hemInset);
    const scene = { ...SCENE, tail, collapsible };
    let worst = Infinity;
    let worstAt = '';
    // `raw` is the scroll, `p` the smoothed playhead. A fling puts raw ahead of
    // p; a scrub reversal puts it behind. Both must stay scrollable.
    for (const raw of grid(0, 1, 40)) {
      for (const lag of [-0.4, -0.1, 0, 0.1, 0.4]) {
        const p = clamp01(raw + lag);
        const slack = slackAt(p, raw, scene);
        const closed = SPACER_PAD + tail - SCENE.hemInset - collapsible * collapseAt(p);
        assert.ok(
          Math.abs(slack - closed) < 1e-6,
          `tail=${tail} p=${p.toFixed(3)} raw=${raw.toFixed(3)}: slack ${slack} != ${closed}`,
        );
        if (slack < worst) {
          worst = slack;
          worstAt = `tail=${tail} p=${p.toFixed(3)} raw=${raw.toFixed(3)}`;
        }
      }
    }
    assert.ok(
      worst >= MIN_RELEASE_SLACK - 1e-6,
      `${worstAt}: only ${worst}px of scroll left — the release would clamp`,
    );
  }
});

test('after the fall the spacer parks only the pin distance', () => {
  const collapsible = collapsibleHeight(SCENE.restHeight, SCENE.tail, SCENE.hemInset);
  const spacer = spacerBoxAt(1, 1, SCENE.restHeight, SCENE.pinDistance, collapsible);
  assert.ok(
    Math.abs(spacer.height - (SCENE.pinDistance + SPACER_PAD)) < 1e-6,
    `expected the parked pin distance plus a pixel, got ${spacer.height}`,
  );
  assert.equal(spacer.padding, SCENE.pinDistance);
  const atRelease = slackAt(1, 1, { ...SCENE, collapsible });
  assert.equal(atRelease, SPACER_PAD + SCENE.tail - SCENE.hemInset - collapsible);
  assert.ok(atRelease > 0, 'the pin must not end on a clamped document');
});

/* ==========================================================================
   The reference framing — where the hold begins, and what it puts on screen.

   The pin is art-directed off one composition: the black hole at the top of the
   viewport, the whole "ENTER THE NEMOVERSE" headline at the bottom, the CTA
   still below the fold. These are the numbers that composition is made of.
   ======================================================================== */

test('the air under the headline is the reference 40px, and never lifts the CTA into view', () => {
  assert.equal(titleAir(720), 40); // the reference framing, measured off a 720px viewport
  assert.equal(titleAir(900), TITLE_AIR_MAX);
  assert.equal(titleAir(2160), TITLE_AIR_MAX);
  assert.equal(titleAir(320), TITLE_AIR_MIN);
  assert.equal(titleAir(NaN), TITLE_AIR_MIN);
  assert.equal(titleAir(0), TITLE_AIR_MIN);
  for (const viewport of grid(120, 2400, 300)) {
    const air = titleAir(viewport);
    assert.ok(air >= TITLE_AIR_MIN && air <= TITLE_AIR_MAX, `air out of range at ${viewport}`);
    assert.ok(Number.isInteger(air), `air is not a whole pixel at ${viewport}`);
    // The invitation's top margin is 2.6rem = 41.6px, so at the cap the CTA's
    // top edge lands on the fold or below it — never in view at the trigger.
    assert.ok(air <= 42, 'the CTA would be on screen when the hold begins');
  }
  assertNonDecreasing(grid(120, 2400, 300), titleAir, 'titleAir');
});

test('the framing degrades to hole-first only when the hole cannot be shown at all', () => {
  assert.ok(framingHolds(900, 42, 327)); // the fixture's real composition
  assert.ok(framingHolds(720, 40, 312)); // the reference framing's own viewport
  assert.ok(framingHolds(667, 37, 176)); // a phone
  assert.ok(!framingHolds(420, 24, 420), 'the invitation block alone eats the viewport');
  assert.ok(!framingHolds(900, 42, 858), 'the hole is off the top before the headline arrives');
  assert.ok(!framingHolds(900, 42, 0), 'nothing between the hole and the headline to measure');
  assert.ok(!framingHolds(NaN, 42, 327));

  // The inset is expressed on the headline in BOTH framings, so one trigger
  // element and one screen line drive both pins.
  assert.equal(triggerInset({ degraded: false, air: 42, seam: 90, rise: 327 }), 42);
  assert.equal(triggerInset({ degraded: true, air: 42, seam: 90, rise: 327 }), 90 - 327);
  // Hole-first puts the frame's bottom one seam above the fold, which is the
  // same line stated on the headline: negative, because the headline has not
  // arrived yet.
  const degraded = triggerInset({ degraded: true, air: 42, seam: 90, rise: 327 });
  assert.ok(degraded < 0);
});

test('the parked composition is the reference framing: hole above, whole headline below', () => {
  const viewport = 900;
  const rise = 327;
  const frameHeight = 684;
  const belowTitle = 144;
  const sheetHeight = 383;
  const seam = 90;
  const air = titleAir(viewport);
  const inset = triggerInset({ degraded: false, air, seam, rise });
  const frameTop = parkedFrameTop(viewport, inset, frameHeight, rise);
  const hem = parkedHem(viewport, inset, belowTitle);

  // The trigger line: the headline's bottom edge exactly `air` above the fold.
  assert.equal(hem - belowTitle, viewport - inset);
  // The frame hangs one composition above that line, so the hole and the
  // headline are on screen together and the hole's centre is in the upper third.
  assert.equal(frameTop + frameHeight + rise, viewport - inset);
  assert.ok(frameTop + frameHeight / 2 < viewport / 2, 'the singularity is not above the middle');
  // The hole never overlaps the sheet: the seam gradient between them is the
  // only thing painted in the gap.
  const sheetTop = hem - sheetHeight;
  assert.ok(sheetTop > frameTop + frameHeight, 'the frame overlaps the pinned sheet');
  assert.ok(sheetTop - (frameTop + frameHeight) <= seam + 24, 'the gap is wider than the seam can cover');
  // The hem parks below the fold, so the CTA is still off-screen at the trigger.
  assert.ok(hem > viewport);
  // And the fall goes UP into the hole: the singularity is above the sheet.
  assert.ok(frameTop + frameHeight / 2 < sheetTop);
});

test('the degraded framing parks the hole fully in view instead', () => {
  const viewport = 420;
  const rise = 400;
  const frameHeight = 500;
  const seam = 56;
  const air = titleAir(viewport);
  assert.ok(!framingHolds(viewport, air, rise));
  const inset = triggerInset({ degraded: true, air, seam, rise });
  const frameTop = parkedFrameTop(viewport, inset, frameHeight, rise);
  // Hole-first: the frame's bottom edge one seam above the fold.
  assert.equal(frameTop + frameHeight, viewport - seam);
});

test('the two pins are one hold: the same line, the same distance, the same release', () => {
  const viewport = 900;
  const inset = 42;
  const reserved = 440; // the hole's pin distance, reserved above the sheet
  const inviteBottomRest = 5000;
  const offset = sheetStartOffset(inset, reserved);
  assert.equal(offset, inset - reserved);
  assert.ok(offset < 0, 'the compensation must pull the sheet\'s line earlier');

  // Modelled exactly as GSAP measures it: the hole's trigger is read on the
  // reverted (rest) document, the sheet's is read after the hole's spacer has
  // reserved `reserved` px above it.
  const holeStart = inviteBottomRest - (viewport - inset);
  const sheetStart = inviteBottomRest + reserved - (viewport - offset);
  assert.equal(sheetStart, holeStart, 'the pins do not engage on the same scroll pixel');
  assert.equal(holeStart + reserved, sheetStart + reserved, 'the pins do not let go together');

  // Without the compensation the sheet would pin one whole reservation late —
  // the hole letting go at the exact moment the sheet took hold.
  const uncompensated = inviteBottomRest + reserved - (viewport - inset);
  assert.equal(uncompensated - holeStart, reserved);
});
