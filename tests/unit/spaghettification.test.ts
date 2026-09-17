import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BITE_CENTRES,
  BITE_WIDTH,
  COLLAPSE_LEAD,
  COLLAPSE_TAIL,
  CROSSING,
  DOPPLER_BITE,
  EFFECTIVE_HORIZON_RADIUS_PX,
  FLYER_IDS,
  HARD_FRAME_FLOOR,
  INFALL_EASE,
  INFALL_GAIN,
  MAX_ALONG,
  MAX_GL_INFALL,
  MIN_FRAME_HEIGHT,
  MIN_RELEASE_SLACK,
  MIN_RISE,
  MIN_SHEET_RUN,
  MIX_END,
  MIX_START,
  PLAYHEAD_SMOOTH_FRAME,
  PLAYHEAD_SMOOTH_PX,
  SETTLE_FACTOR,
  SETTLE_MIN,
  SHEET_RUN_RATIO,
  SLOPE_FLOOR,
  SPACER_PAD,
  LENSING_BITE,
  MASS_BITE,
  ROTATION_BITE,
  SWIRL_TURNS,
  TIDAL_CAP,
  TIDAL_FALLOFF,
  TIDAL_GAIN,
  TITLE_AIR_MAX,
  TITLE_AIR_MIN,
  biteHoldAt,
  bitePulseAt,
  clamp01,
  consumptionResponseAt,
  collapsibleHeight,
  collapseAt,
  consumptionTarget,
  contractionAt,
  coverRadius,
  curtainSlack,
  fallAt,
  followPlayhead,
  flyerFrameAt,
  flyerTransform,
  frameBudget,
  framingHolds,
  horizonRadiusAtProgress,
  infallAt,
  computeLensMap,
  lensFieldAt,
  lensForwardAt,
  lensRegionAt,
  lensSourceAt,
  lensBakeStep,
  LENS_BAKE_STEPS,
  LENS_MAP_SIZE,
  overlayMixAt,
  parkedFrameTop,
  parkedHem,
  phase,
  pinSpan,
  runDistance,
  shaderInfallAt,
  sheetHeightAt,
  holdActiveAt,
  holdBudgetAt,
  holdDistanceAt,
  settleDistance,
  solveFraming,
  swirlAt,
  tidalAt,
  tidalGainAt,
  titleAir,
  vacatedHeightAt,
  fluidVertexTransforms,
  FLUID_GRID_COLS,
  FLUID_GRID_ROWS,
  type FlyerId,
  type Point,
} from '../../src/lib/spaghettification.ts';
import { VEIL_MARGIN } from '../../src/lib/signoffHorizonGeometry.ts';

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

/* ==========================================================================
   The reference scene, built the way the component builds it.

   Every number below is either measured off the fixture at 1280×900 or solved
   from those measurements by the exported primitives — nothing is asserted
   against a hand-copied constant, so the tests fail when the composition moves
   rather than when a literal does.

   The measured inputs: a 383px sign-off sheet whose headline bottom sits 327px
   below the black hole container's bottom edge and 144px above its own hem, a
   container whose responsive height is 684px, a 90px seam and a 700px curtain.
   The solved outputs: the container is budgeted down to 531px so that ONE
   scroll position holds both boxes whole (hole flush with the top of the
   viewport, headline flush with the bottom), and both pins share a 575px span —
   the 440px consumption run plus the 135px release margin.
   ========================================================================== */
const MEASURED = {
  viewport: 900,
  width: 1280,
  restHeight: 383,
  seam: 90,
  tail: 700,
  /** Frame bottom edge → headline bottom edge, in the document. */
  rise: 327,
  /** Headline bottom edge → sheet hem. */
  belowTitle: 144,
  /** The container's own responsive height, before the composition budgets it. */
  naturalFrameHeight: 684,
};

const AIR = titleAir(MEASURED.viewport);
const FRAMING = solveFraming({
  viewport: MEASURED.viewport,
  air: AIR,
  seam: MEASURED.seam,
  rise: MEASURED.rise,
  natural: MEASURED.naturalFrameHeight,
});
const SPAN = pinSpan(MEASURED.restHeight);

const FRAME_TOP = parkedFrameTop(
  MEASURED.viewport,
  FRAMING.inset,
  FRAMING.frameHeight,
  MEASURED.rise,
);
const HEM = parkedHem(MEASURED.viewport, FRAMING.inset, MEASURED.belowTitle);
const PINNED_TOP = HEM - MEASURED.restHeight;
const SINGULARITY: Point = {
  x: MEASURED.width / 2,
  y: FRAME_TOP + FRAMING.frameHeight / 2,
};

const SCENE = {
  restHeight: MEASURED.restHeight,
  width: MEASURED.width,
  seam: MEASURED.seam,
  tail: MEASURED.tail,
  rise: MEASURED.rise,
  belowTitle: MEASURED.belowTitle,
  /** The shared trigger line, as the headline's inset above the fold. */
  inset: FRAMING.inset,
  frameHeight: FRAMING.frameHeight,
  frameTop: FRAME_TOP,
  pinnedTop: PINNED_TOP,
  anchorX: SINGULARITY.x,
  anchorY: SINGULARITY.y - PINNED_TOP,
  veil: Math.max(0, PINNED_TOP - SINGULARITY.y) + VEIL_MARGIN,
  /** The hem's inset above the fold while pinned: negative, i.e. below it. */
  hemInset: FRAMING.inset - MEASURED.belowTitle,
  run: SPAN.run,
  settle: SPAN.settle,
  pinDistance: SPAN.total,
  share: SPAN.share,
  collapsible: collapsibleHeight(
    MEASURED.restHeight,
    MEASURED.tail,
    FRAMING.inset - MEASURED.belowTitle,
  ),
};
const EXTENT = {
  width: SCENE.width,
  height: SCENE.restHeight,
  anchorX: SCENE.anchorX,
  anchorY: SCENE.anchorY,
  veil: SCENE.veil,
};

/* Flyer rest centres in sheet-local space. The field is translation-invariant,
 * so it does not matter whether that space is the viewport or the sheet. */
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

/* ==========================================================================
   Requirement 1 — the hold begins on the reference composition, and on nothing
   else: the black hole whole at the top of the viewport, the whole "ENTER THE
   NEMOVERSE" headline at the bottom of it, on ONE scroll pixel.
   ========================================================================== */

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

test('the container height is the composition\'s one free variable, and it is spent', () => {
  assert.equal(frameBudget(900, 42, 327), 900 - 42 - 327);
  assert.equal(FRAMING.degraded, false, 'the reference framing fits at 1280×900');
  assert.equal(FRAMING.inset, AIR, 'the trigger line is stated on the headline');
  // The responsive container is 684px; the composition leaves 531px. The budget
  // is spent, because a cropped hole is not the reference framing.
  assert.equal(FRAMING.frameHeight, frameBudget(MEASURED.viewport, AIR, MEASURED.rise));
  assert.ok(
    FRAMING.frameHeight < MEASURED.naturalFrameHeight,
    'the fixture container must actually be cut down for the composition to hold',
  );
  assert.ok(FRAMING.frameHeight >= MIN_FRAME_HEIGHT, 'the hole must stay a hole');

  // Never GROW the stage: the budget is a ceiling, not a target.
  const short = solveFraming({ ...MEASURED, natural: 400, air: AIR });
  assert.equal(short.frameHeight, 400);
  assert.equal(short.degraded, false);
  const exact = solveFraming({ ...MEASURED, natural: FRAMING.frameHeight, air: AIR });
  assert.equal(exact.frameHeight, FRAMING.frameHeight);
  assert.equal(exact.degraded, false);

  // Whole pixels: both pins are driven off the solved numbers, and a
  // fractional container height would make the two disagree by a sub-pixel.
  for (const viewport of grid(320, 2160, 120)) {
    for (const rise of [MIN_RISE, 120, 327, 600]) {
      const solved = solveFraming({
        viewport,
        air: titleAir(viewport),
        seam: MEASURED.seam,
        rise,
        natural: MEASURED.naturalFrameHeight,
      });
      assert.ok(Number.isInteger(solved.inset), `inset ${solved.inset} at ${viewport}/${rise}`);
      assert.ok(
        Number.isInteger(solved.frameHeight),
        `frameHeight ${solved.frameHeight} at ${viewport}/${rise}`,
      );
    }
  }
});

test('framing holds only when BOTH boxes are whole on the one scroll pixel', () => {
  // The predicate takes the container's height: that is the half an earlier
  // version left out. Stated on the headline alone it reported "holds" for the
  // fixture's own composition, whose 684px container put the hole's crown 153px
  // above the top of the screen at the exact moment the hold began.
  assert.equal(framingHolds(900, AIR, MEASURED.rise, MEASURED.naturalFrameHeight), false);
  assert.equal(framingHolds(900, AIR, MEASURED.rise, FRAMING.frameHeight), true);
  assert.equal(parkedFrameTop(900, AIR, MEASURED.naturalFrameHeight, MEASURED.rise), -153);
  assert.equal(parkedFrameTop(900, AIR, FRAMING.frameHeight, MEASURED.rise), 0);

  assert.ok(framingHolds(720, 40, 312, 344), 'the reference framing\'s own viewport');
  assert.ok(!framingHolds(900, AIR, MEASURED.rise, 0), 'no container, no composition');
  assert.ok(!framingHolds(900, AIR, MIN_RISE - 1, 300), 'nothing between the pins to measure');
  assert.ok(!framingHolds(NaN, AIR, MEASURED.rise, 300));
  assert.ok(!framingHolds(900, AIR, NaN, 300));

  // After solving, holding is a theorem, not a hope — over the whole sweep.
  for (const viewport of grid(360, 2160, 90)) {
    const air = titleAir(viewport);
    for (const rise of [MIN_RISE, 60, 180, 327, 520]) {
      const solved = solveFraming({
        viewport,
        air,
        seam: MEASURED.seam,
        rise,
        natural: MEASURED.naturalFrameHeight,
      });
      if (solved.degraded) continue;
      assert.ok(
        framingHolds(viewport, air, rise, solved.frameHeight),
        `solved framing does not hold at ${viewport}/${rise}: ${solved.frameHeight}`,
      );
      assert.ok(
        parkedFrameTop(viewport, solved.inset, solved.frameHeight, rise) >= 0,
        `the hole's crown is off the top of the screen at ${viewport}/${rise}`,
      );
    }
  }
});

test('the composition degrades to hole-first only when the hole cannot be shown at all', () => {
  // A viewport the invitation block alone eats: no scroll position can hold both
  // boxes, so the hold starts on the container instead — its bottom edge one
  // seam above the fold, which is the SAME line stated on the headline, hence a
  // negative inset (the headline has not arrived yet).
  const tight = solveFraming({
    viewport: 420,
    air: titleAir(420),
    seam: 56,
    rise: 400,
    natural: 500,
  });
  assert.equal(tight.degraded, true);
  assert.equal(tight.inset, 56 - 400);
  assert.ok(tight.inset < 0);
  assert.equal(tight.frameHeight, Math.max(HARD_FRAME_FLOOR, Math.min(500, 420 - 56)));
  // The container is still shown whole: its bottom edge one seam above the fold.
  assert.equal(
    parkedFrameTop(420, tight.inset, tight.frameHeight, 400) + tight.frameHeight,
    420 - 56,
  );

  // So short that even MIN_FRAME_HEIGHT does not fit: the container is cut to
  // whatever the viewport can hold of it, and `framingHolds` says the
  // composition did not hold instead of pretending it did.
  const tiny = solveFraming({ viewport: 260, air: 24, seam: 40, rise: 200, natural: 500 });
  assert.equal(tiny.degraded, true);
  assert.equal(tiny.frameHeight, Math.max(HARD_FRAME_FLOOR, Math.min(500, 260 - 40)));
  assert.ok(tiny.frameHeight < MIN_FRAME_HEIGHT);
  // Shorter still, and the absolute floor is what keeps the hole a hole.
  const sliver = solveFraming({ viewport: 200, air: 24, seam: 40, rise: 200, natural: 500 });
  assert.equal(sliver.frameHeight, HARD_FRAME_FLOOR);
  assert.equal(sliver.degraded, true);

  // Unmeasurable input moves nothing and reports the degradation, so a scene
  // that cannot be read never builds a composition out of guesses.
  for (const bad of [
    { viewport: NaN, air: AIR, seam: 90, rise: 327, natural: 684 },
    { viewport: 0, air: AIR, seam: 90, rise: 327, natural: 684 },
    { viewport: 900, air: AIR, seam: 90, rise: MIN_RISE - 1, natural: 684 },
    { viewport: 900, air: AIR, seam: 90, rise: 327, natural: NaN },
  ]) {
    const solved = solveFraming(bad);
    assert.equal(solved.degraded, true, `${JSON.stringify(bad)} must not invent a composition`);
    if (Number.isFinite(bad.natural)) {
      assert.equal(solved.frameHeight, bad.natural, 'an unmeasurable scene must not resize the stage');
    } else {
      assert.ok(Number.isNaN(solved.frameHeight));
    }
  }
});

test('the parked composition is the reference framing: hole above, whole headline below', () => {
  const { viewport, belowTitle, restHeight } = MEASURED;
  const { inset, frameHeight } = FRAMING;

  // The trigger line: the headline's bottom edge exactly `air` above the fold.
  assert.equal(HEM - belowTitle, viewport - inset);
  // The frame hangs one composition above that line.
  assert.equal(FRAME_TOP + frameHeight + MEASURED.rise, viewport - inset);
  // …and the budget binds, so the hole is flush with the TOP of the screen:
  // both boxes whole, on the one pixel the hold begins on.
  assert.equal(FRAME_TOP, 0);
  assert.ok(
    framingHolds(viewport, AIR, MEASURED.rise, frameHeight),
    'the composition the scene was built from must be the one on screen',
  );
  assert.ok(FRAME_TOP + frameHeight / 2 < viewport / 2, 'the singularity is not above the middle');

  // The hole never overlaps the sheet: the seam gradient between them is the
  // only thing painted in the gap.
  assert.ok(PINNED_TOP > FRAME_TOP + frameHeight, 'the frame overlaps the pinned sheet');
  assert.ok(
    PINNED_TOP - (FRAME_TOP + frameHeight) <= MEASURED.seam + 24,
    'the gap is wider than the seam can cover',
  );
  // The hem parks below the fold, so the CTA is still off-screen at the trigger.
  assert.ok(HEM > viewport);
  assert.ok(SCENE.hemInset < 0);
  // And the fall goes UP into the hole: the singularity is above the sheet.
  assert.ok(SINGULARITY.y < PINNED_TOP);
  assert.ok(SCENE.anchorY < 0, 'the singularity sits above the pinned sheet');
  assert.equal(SCENE.veil, Math.max(0, -SCENE.anchorY) + VEIL_MARGIN);
  assert.equal(SCENE.veil, -SCENE.anchorY + VEIL_MARGIN);
  assert.equal(restHeight, SCENE.restHeight);
});

/* ==========================================================================
   Requirement 2 — one hold, two pins: the container is the pinned element, the
   hole stays anchored on screen, and neither pin lets go before the
   consumption has finished.
   ========================================================================== */

test('both pins span the consumption run plus a release margin that outlives the smoothing', () => {
  assert.equal(runDistance(0), MIN_SHEET_RUN);
  assert.equal(runDistance(200), MIN_SHEET_RUN, 'a short sheet still needs a run that reads as a fall');
  assert.equal(runDistance(MEASURED.restHeight), Math.round(MEASURED.restHeight * SHEET_RUN_RATIO));
  assertNonDecreasing(grid(0, 2000, 60), runDistance, 'run');

  assert.equal(settleDistance(), Math.round(PLAYHEAD_SMOOTH_PX * SETTLE_FACTOR));
  assert.ok(settleDistance() >= SETTLE_MIN);
  // THE guarantee, stated as an inequality: the release margin is longer than
  // the playhead's smoothing distance, so the playhead cannot still be in
  // flight when either pin lets go. An earlier version scrubbed the consumption
  // in TIME (`scrub: 0.6`), which needed up to 600ms of wall clock to arrive
  // while the pin released on a scroll pixel.
  assert.ok(settleDistance() > PLAYHEAD_SMOOTH_PX);

  assert.equal(SPAN.run, SCENE.run);
  assert.equal(SPAN.total, SPAN.run + SPAN.settle);
  assert.ok(Math.abs(SPAN.share - SPAN.run / SPAN.total) < 1e-12);
  assert.ok(SPAN.share < 1, 'the consumption must finish BEFORE the pins release');
  assert.ok(SPAN.share > 0.5, 'and the settle margin must not eat the fall');
  // At the reference scene: 440px of fall, 135px of margin, 575px of pin.
  assert.deepEqual(
    { run: SCENE.run, settle: SCENE.settle, total: SCENE.pinDistance },
    { run: 440, settle: 135, total: 575 },
  );
  for (const height of grid(0, 2000, 40)) {
    const span = pinSpan(height);
    assert.ok(span.run >= MIN_SHEET_RUN);
    assert.ok(span.settle > PLAYHEAD_SMOOTH_PX);
    assert.equal(span.total, span.run + span.settle);
    assert.ok(span.share > 0 && span.share < 1);
  }
});

test('the hold is one trigger: one line, one span, no handover', () => {
  const inviteBottomRest = 5000;
  // Modelled as GSAP measures it: a trigger's start is the trigger element's
  // document position minus the viewport offset it is asked to engage at. The
  // composition's two boxes — the hole's container and the sheet — are held by
  // the SAME reservation, so the line the hole engages on and the line the sheet
  // engages on are the same number by construction. There is no offset to apply
  // to either one, which is the whole point: `sheetStartOffset` existed to undo
  // what the hole's pin-spacer had done to the sheet, and there is no spacer.
  const line = (bottom: number) => bottom - (MEASURED.viewport - FRAMING.inset);
  const holeTop = inviteBottomRest - SCENE.rise - SCENE.frameHeight;
  const held = (scroll: number) => holdDistanceAt(scroll, line(inviteBottomRest), SCENE.pinDistance) - SPACER_PAD;
  const engaged = (rest: number, scroll: number) => rest + held(scroll) - scroll;

  const start = line(inviteBottomRest);
  for (const raw of grid(0, 1, 61)) {
    const scroll = start + SCENE.pinDistance * raw;
    assert.ok(
      Math.abs(enginedDiff(holeTop, inviteBottomRest, scroll)) < 1e-9,
      `raw=${raw}: the two boxes are not rigidly joined`,
    );
  }
  function enginedDiff(hole: number, sheet: number, scroll: number): number {
    // The distance between the two held boxes must not change with the scroll:
    // each has been pushed by the same reservation.
    return engaged(hole, scroll) - engaged(sheet, scroll) - (hole - sheet);
  }

  // Both let go on the same pixel, because there is one span and one trigger.
  assert.equal(SCENE.pinDistance, SCENE.run + SCENE.settle);
  assert.ok(
    Math.abs(held(start + SCENE.pinDistance) - SCENE.pinDistance) < 1e-9,
    'the reservation is exactly the pin distance at the release',
  );
  assert.ok(
    Math.abs(held(start + SCENE.pinDistance * 4) - SCENE.pinDistance) < 1e-9,
    'and frozen afterwards — no handover, no second trigger, no jump',
  );
});

test('the consumption target reaches 1 inside the pin, and stays there', () => {
  assert.equal(consumptionTarget(0, SCENE.share), 0);
  assert.equal(consumptionTarget(SCENE.share, SCENE.share), 1);
  assert.equal(consumptionTarget(1, SCENE.share), 1);
  assert.equal(consumptionTarget(9, SCENE.share), 1);
  assert.equal(consumptionTarget(-2, SCENE.share), 0);
  assertNonDecreasing(grid(0, 1), (x) => consumptionTarget(x, SCENE.share), 'consumption target');
  // Held at 1 across the whole settle margin: the screen is locked, and the
  // last frame of the fall is the frame the reader watches it release from.
  for (const progress of grid(SCENE.share, 1, 60)) {
    assert.equal(
      consumptionTarget(progress, SCENE.share),
      1,
      `the target dropped back to ${consumptionTarget(progress, SCENE.share)} at ${progress}`,
    );
  }
  // A degenerate share falls back to the trigger's own progress rather than
  // dividing by zero.
  assert.equal(consumptionTarget(0.4, 0), 0.4);
  assert.ok(Number.isFinite(consumptionTarget(0.4, NaN)));
});

/* ---------------------------------------------------------- the playhead -- */

test('the playhead is rate-limited in scrolled pixels, and lands exactly on a jump', () => {
  // One frame of a slow wheel: the step is the scroll moved, in smoothing
  // distances.
  assert.ok(Math.abs(followPlayhead(0, 1, PLAYHEAD_SMOOTH_PX) - 1) < 1e-12);
  assert.ok(Math.abs(followPlayhead(0, 1, PLAYHEAD_SMOOTH_PX / 2) - 0.5) < 1e-12);
  // A jump further than the smoothing distance is deterministic, not animated:
  // a scrollbar drag or a PageDown paints the frame the scroll position asks
  // for, instead of catching up to it over half a second.
  assert.equal(followPlayhead(0, 1, 4000), 1);
  assert.equal(followPlayhead(0, 0.25, 900), 0.25);
  assert.equal(followPlayhead(0.9, 0, 900), 0);
  // With the scroll stopped the time-domain tail takes over, and it is
  // rate-limited rather than exponential: it lands exactly, and it stops.
  let head = 0.4;
  for (let i = 0; i < 12; i += 1) head = followPlayhead(head, 1, 0);
  assert.equal(head, 1, 'the tail must converge on its own');
  assert.ok(Math.abs(PLAYHEAD_SMOOTH_FRAME - 1 / 12) < 1e-12);
  assert.ok(Number.isFinite(followPlayhead(0, 1, NaN)), 'a NaN delta must not poison the playhead');
  assert.ok(Number.isFinite(followPlayhead(0, 1, Infinity)) || followPlayhead(0, 1, Infinity) === 1);

  for (const [from, to] of [[0, 1], [1, 0], [0.3, 0.9], [0.9, 0.3], [0.5, 0.5]] as const) {
    let head2 = from;
    let previous = from;
    for (let i = 0; i < 400; i += 1) {
      head2 = followPlayhead(head2, to, 12);
      assert.ok(head2 >= 0 && head2 <= 1, 'the playhead left [0, 1]');
      // Never overshoots, and always makes progress while the scroll moves.
      assert.ok(
        to >= from ? head2 >= previous - 1e-12 : head2 <= previous + 1e-12,
        `the playhead moved away from its target at step ${i}`,
      );
      assert.ok(Math.abs(head2 - to) <= Math.abs(previous - to) + 1e-12, 'the playhead diverged');
      previous = head2;
    }
    assert.equal(head2, to, 'the playhead must land exactly, not asymptotically');
  }
  assert.equal(followPlayhead(0.4, 0.4, 0), 0.4, 'a settled playhead stays settled');
});

/** Walk the whole pin span at a constant scroll speed and report the progress
 * at which the written playhead first reaches 1 — and whether it ever failed
 * to be there once the consumption's own end (`share`) had been passed. */
const walkSpan = (
  total: number,
  share: number,
  perFrame: number,
): { arrival: number; trailing: number[]; final: number } => {
  let head = 0;
  let scroll = 0;
  let arrival = Infinity;
  const trailing: number[] = [];
  while (scroll < total - 1e-9) {
    scroll = Math.min(total, scroll + perFrame);
    const progress = scroll / total;
    head = followPlayhead(head, consumptionTarget(progress, share), perFrame);
    if (head === 1 && arrival === Infinity) arrival = progress;
    if (progress >= share && head !== 1) trailing.push(progress);
  }
  return { arrival, trailing, final: head };
};

test('the pins let go after the consumption is complete, at every scroll speed', () => {
  // Requirement 2, as a property of the geometry rather than of the reader's
  // hand: from one pixel per frame to a 4000px teleport, the playhead is 1 on
  // every frame whose progress has passed the consumption's own end, and both
  // pins are still holding the screen on all of them.
  const speeds = [1, 2, 3, 7, 13, 45, 89, 90, 91, 134, 135, 440, 575, 1200, 4000];
  for (const perFrame of speeds) {
    const { arrival, trailing, final } = walkSpan(SCENE.pinDistance, SCENE.share, perFrame);
    assert.equal(final, 1, `${perFrame}px/frame: the fall ended at ${final}`);
    assert.deepEqual(trailing, [], `${perFrame}px/frame: the playhead trailed into the release`);
    // The consumption is complete no later than one sampled frame after its own
    // end — and the settle margin is what makes those frames still belong to
    // the pin, however coarse the sampling is.
    assert.ok(
      arrival <= SCENE.share + perFrame / SCENE.pinDistance + 1e-9,
      `${perFrame}px/frame: the consumption finished at progress ${arrival}, past ${SCENE.share}`,
    );
  }

  // And the structural reasons, so the property cannot be broken quietly: the
  // target's own increment (1/run) is always slower than the follower's step
  // (1/PLAYHEAD_SMOOTH_PX), so a constant-rate scroll never accumulates a
  // residual at all, and the settle margin pays for whatever a variable one did.
  assert.ok(1 / SCENE.run < 1 / PLAYHEAD_SMOOTH_PX);
  assert.ok(SCENE.settle > PLAYHEAD_SMOOTH_PX);

  // Variable speeds: a deterministic walk over the whole span, from a crawl to
  // a fling, changing speed every frame.
  // A Lehmer generator: exact in double precision, and the same walk every run.
  let seed = 20260908;
  const next = (): number => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  let head = 0;
  let scroll = 0;
  let trailing = 0;
  while (scroll < SCENE.pinDistance - 1e-9) {
    const delta = 1 + next() * 900;
    scroll = Math.min(SCENE.pinDistance, scroll + delta);
    const progress = scroll / SCENE.pinDistance;
    head = followPlayhead(head, consumptionTarget(progress, SCENE.share), delta);
    if (progress >= SCENE.share && head !== 1) trailing += 1;
  }
  assert.equal(head, 1, 'a variable-speed scroll left the fall unfinished');
  assert.equal(trailing, 0, 'a variable-speed scroll trailed into the release');
});

/* ==========================================================================
   Requirement 3 — the field. No fades, no bloating: a contraction that is
   exactly zero at the horizon, a translation that lands on the singularity,
   and a stretch along the pull axis with a squeeze across it.
   ========================================================================== */

test('the contraction is exact at both ends, and has no pole in between', () => {
  assert.equal(contractionAt(0), 1, 'a fragment keeps its whole rest distance at rest');
  assert.equal(contractionAt(1), 0, 'at the horizon the fragment is at the singularity');
  assert.equal(contractionAt(-1), 1);
  assert.equal(contractionAt(2), 0);
  assertNonIncreasing(grid(0, 1), contractionAt, 'contraction');
  for (const p of grid(0, 1, 200)) {
    const c = contractionAt(p);
    assert.ok(Number.isFinite(c), `contraction(${p}) is not finite`);
    assert.ok(c >= 0 && c <= 1, `contraction(${p}) = ${c} escaped [0, 1]`);
    // The pull, expressed as the shader's term: finite everywhere on [0, 1).
    const infall = infallAt(p);
    if (p < 1) {
      assert.ok(Number.isFinite(infall), `infall(${p}) has a pole before the horizon`);
      assert.ok(Math.abs(infall - (1 / c - 1)) < 1e-9, `infall(${p}) is not 1/c − 1`);
    }
    assert.ok(Math.abs(fallAt(p) - (1 - c)) < 1e-12);
  }
  // An earlier version put the pole at 1/0.9, which bottomed out at 92% of the
  // distance and 8% of the size: the fall never actually crossed the horizon.
  assert.equal(infallAt(1), Infinity, 'the pull does diverge at the horizon — honestly');
  assert.equal(fallAt(1), 1, 'the flyer must land ON the singularity');
  assert.ok(contractionAt(0.9) < 0.12, 'the last of the fall must be inside the capture radius');
  assertNonDecreasing(grid(0, 1), fallAt, 'fall');
  assert.ok(INFALL_GAIN > 0 && INFALL_EASE > 1, 'the fall has to accelerate');
});

test('the GPU is handed the same term, floored — never an infinity', () => {
  for (const p of grid(0, 1, 300)) {
    const value = shaderInfallAt(p);
    assert.ok(Number.isFinite(value), `shaderInfallAt(${p}) is not finite`);
    assert.ok(value >= 0 && value <= MAX_GL_INFALL);
    if (infallAt(p) <= MAX_GL_INFALL) {
      assert.equal(value, infallAt(p), 'the floor must not touch the art direction');
    }
  }
  assert.equal(shaderInfallAt(1), MAX_GL_INFALL);
  assertNonDecreasing(grid(0, 1), shaderInfallAt, 'shader infall');
  // The floor is a numeric guard, not a look: it is 1e-6 of a contraction, i.e.
  // two ten-thousandths of a pixel on a 200px headline.
  assert.equal(MAX_GL_INFALL, 1e6);
  assert.ok(1 / (1 + MAX_GL_INFALL) < 1e-5);
});

test('the tidal term is a decaying radial gradient, capped inside the horizon', () => {
  assert.equal(tidalGainAt(0), 0, 'no gradient before the fall starts');
  assertNonDecreasing(grid(0, 1), tidalGainAt, 'tidal gain');
  const R = EFFECTIVE_HORIZON_RADIUS_PX;
  for (const p of [0.25, 0.5, 0.75, 1]) {
    const gain = tidalGainAt(p);
    assertNonIncreasing(grid(0.01, R * 4, 80), (r) => tidalAt(r, R, p), `tidal at p=${p}`);
    assert.ok(tidalAt(0.01, R, p) <= TIDAL_CAP + 1e-12, 'the cap keeps a fragment finite');
    assert.equal(tidalAt(0, R, p), 0, 'the singularity itself has no gradient');
    assert.equal(tidalAt(R, 0, p), 0);
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
  assert.equal(collapseAt(1), 1, 'the void is gone before the pins let go');
  assertNonDecreasing(grid(0, 1), collapseAt, 'collapse');
  assert.ok(collapseAt(0.5) > 0.3, 'the collapse must be well underway at the halfway playhead');
  assert.ok(COLLAPSE_TAIL < 1, 'the collapse finishes before the fall does');
});

test('the paint crossfade is an exchange, and only ever an exchange', () => {
  assert.equal(overlayMixAt(0), 0);
  assert.equal(overlayMixAt(1), 1);
  assert.equal(overlayMixAt(MIX_START), 0);
  assertNonDecreasing(grid(0, 1), overlayMixAt, 'overlay mix');
  assert.ok(MIX_END < CROSSING, 'the live paint must be gone before anything crosses');
  assert.equal(overlayMixAt(MIX_END), 1);
  // The exchange completes early, while the two layers still agree to within a
  // few pixels: the live flyer is still recognisably a flyer when its paint
  // hands over, so the mix is invisible.
  const atHandoff = flyerFrameAt(MIX_END, FLYERS.invite, SINGULARITY, horizonRadiusAtProgress(MIX_END, EXTENT));
  assert.ok(atHandoff.along > 0.15 && atHandoff.across > 0.05, 'the handoff happens after the live strand is already thin');
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

test('every flyer translates onto the singularity, and ends exactly on it', () => {
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
      // The displacement is the pull vector scaled by the fall: the flyer is on
      // the straight line to the hole's centre for the whole of the fall, on
      // both axes (the pull here is vertical, but nothing assumes that).
      assert.ok(Math.abs(frame.x - pull.x * frame.fall) < 1e-9, `${id}: x is not the pull`);
      assert.ok(Math.abs(frame.y - pull.y * frame.fall) < 1e-9, `${id}: y is not the pull`);
    }
    // Requirement 3's event-horizon crossing: the centre lands on the
    // singularity's coordinates, exactly, on the same frame the scale hits
    // zero. An earlier version bottomed out 8% of the distance short and
    // removed the elements with an opacity fade instead.
    const end = flyerFrameAt(1, rest, SINGULARITY, horizonRadiusAtProgress(1, EXTENT));
    assert.equal(end.fall, 1);
    assert.equal(end.x, pull.x);
    assert.equal(end.y, pull.y);
    assert.equal(distance({ x: rest.x + end.x, y: rest.y + end.y }, SINGULARITY), 0);
    assert.equal(previous, 0, `${id}: ended ${previous}px short of the singularity`);
  }
});

test('the stretch is along the pull axis and the squeeze is across it — never a bloom', () => {
  for (const id of IDS) {
    let previousArea = 1;
    for (const p of grid(0, 1, 250)) {
      const frame = flyerFrameAt(p, FLYERS[id], SINGULARITY, horizonRadiusAtProgress(p, EXTENT));
      const area = frame.along * frame.across;
      assert.ok(frame.along >= frame.across - 1e-12, `${id}: compressed ALONG the pull axis at p=${p}`);
      // No uniform bloating, in either axis: the pull axis never exceeds its
      // guard and the cross axis never grows past its rest size. An earlier
      // version's degenerate branch multiplied the element by 50 on both.
      assert.ok(frame.along <= MAX_ALONG + 1e-12, `${id}: along ${frame.along} at p=${p}`);
      assert.ok(frame.across <= 1 + 1e-12, `${id}: across ${frame.across} at p=${p}`);
      assert.ok(frame.along >= 0 && frame.across >= 0, `${id}: negative scale at p=${p}`);
      assert.ok(Number.isFinite(frame.along) && Number.isFinite(frame.across));
      // The painted area only ever shrinks: the element is consumed, not blown
      // up, at every point of the fall.
      assert.ok(area <= 1 + 1e-12, `${id}: the flyer bloated to ${area}× its rest area at p=${p}`);
      assert.ok(area <= previousArea + 1e-12, `${id}: the area grew at p=${p}`);
      previousArea = area;
      if (p > 0 && p < 1) {
        assert.ok(frame.along > 0 && frame.across > 0, `${id}: non-positive scale at p=${p}`);
      }
    }
    // And the crossing is a point, not a fade: both scales are EXACTLY zero.
    const end = flyerFrameAt(1, FLYERS[id], SINGULARITY, horizonRadiusAtProgress(1, EXTENT));
    assert.equal(end.along, 0, `${id}: the flyer still has ${end.along} of its length at the horizon`);
    assert.equal(end.across, 0, `${id}: the flyer still has ${end.across} of its width at the horizon`);
    assert.equal(end.along * end.across, 0);
    assert.equal(previousArea, 0, `${id}: the last painted area was ${previousArea}`);
    assert.ok(
      MAX_ALONG > 1 && SLOPE_FLOOR === 1 / MAX_ALONG,
      'the strand guard and the degenerate-slope floor are the same number',
    );
  }
});

test('the magnifications are the numeric Jacobian of the same remap the shader uses', () => {
  // The shader sends an image point at radius r to source radius
  //     f(r) = r · (1 + infall + tidal(r)),
  // so its radial magnification is 1/f'(r) and its tangential magnification is
  // r/f(r). The element is warped by exactly those two numbers, which is what
  // keeps the live DOM and the frozen frame agreeing at the handoff. Both are
  // derived numerically here from the exported primitives.
  let unsaturated = 0;
  let saturated = 0;
  for (const p of grid(0.02, 0.98, 60)) {
    const infall = infallAt(p);
    const R = horizonRadiusAtProgress(p, EXTENT);
    const f = (r: number): number => r * (1 + infall + tidalAt(r, R, p));
    for (const id of IDS) {
      const restRadius = distance(FLYERS[id], SINGULARITY) || 1;
      const radius = Math.max(restRadius / (1 + infall), 1e-4);
      const frame = flyerFrameAt(p, FLYERS[id], SINGULARITY, R);
      const h = Math.max(radius * 1e-5, 1e-6);
      const slope = (f(radius + h) - f(radius - h)) / (2 * h);
      const tangential = radius / f(radius);
      // The tangential magnification is exact everywhere: `across` is written in
      // terms of the capped tidal term, which is the same term the shader uses.
      assert.ok(
        Math.abs(frame.across - tangential) < 1e-6,
        `${id} p=${p.toFixed(3)}: across ${frame.across} != r/f(r) ${tangential}`,
      );
      const raw = tidalGainAt(p) * (R / radius) ** TIDAL_FALLOFF;
      if (raw < TIDAL_CAP * 0.98) {
        // Unsaturated: T ∝ r^−k, so the analytic slope is the numeric one and
        // the radial magnification is exact too.
        unsaturated += 1;
        assert.ok(
          Math.abs(frame.along - 1 / slope) < 1e-4,
          `${id} p=${p.toFixed(3)}: along ${frame.along} != 1/f'(r) ${1 / slope}`,
        );
      } else {
        // Saturated: the shader's term is constant there, so its own radial
        // magnification relaxes to the tangential one. The element keeps the
        // unsaturated slope on purpose — a strand does not stop being a strand
        // at the horizon — which makes `along` an upper bound, never a smaller
        // stretch than the frozen frame paints.
        saturated += 1;
        assert.ok(
          frame.along >= 1 / slope - 1e-6,
          `${id} p=${p.toFixed(3)}: along ${frame.along} < 1/f'(r) ${1 / slope}`,
        );
        assert.ok(frame.along > frame.across, `${id}: a saturated strand must still be a strand`);
      }
      assert.ok(frame.along >= frame.across, `${id}: the pull axis must be the stretched one`);
    }
  }
  assert.ok(unsaturated > 20, `the unsaturated regime was never sampled (${unsaturated})`);
  assert.ok(saturated > 20, `the saturated regime was never sampled (${saturated})`);
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
  // rotate(θ) is [cos −sin; sin cos].
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
  // The stretched direction IS the pull direction, up to the frame dragging that
  // the shader applies to the same fragment.
  const pullAngle = Math.atan2(pull.y, pull.x);
  const drag = (theta - pullAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  assert.ok(Math.abs(drag) < Math.PI / 2, `the pull axis is off by ${drag} rad`);
  assert.ok(frame.along > frame.across, 'the pull axis must be the stretched one');

  // The last frame of the fall is the degenerate matrix it is meant to be: a
  // zero scale written as a zero, not as a rounding artefact.
  const end = flyerFrameAt(1, FLYERS.offAxis, SINGULARITY, horizonRadiusAtProgress(1, EXTENT));
  const endCss = flyerTransform(end);
  assert.ok(/scale\(0\.00000, 0\.00000\)/.test(endCss), `the horizon frame is "${endCss}"`);
  assert.ok(
    /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)/.test(endCss),
    'the crossing frame still translates onto the singularity',
  );
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
      // The radius the horizon is measured against is the contracted one: the
      // flyer falls in because the horizon grows AND because it shrinks.
      assert.ok(
        Math.abs(radius - distance(rest, SINGULARITY) * contractionAt(p)) < 1e-6,
        `${id}: the radius is not the rest radius times the contraction at p=${p}`,
      );
      if (frame.consumed) {
        assert.ok(radius <= R * CROSSING + 1e-6, `${id}: consumed at radius ${radius}, horizon ${R}`);
        if (p >= MIX_END) assert.equal(frame.opacity, 0, `${id}: consumed but still painted`);
        if (crossedAt === null) crossedAt = p;
      } else {
        assert.ok(crossedAt === null, `${id}: un-consumed again at p=${p} after crossing`);
        assert.ok(radius > R * CROSSING - 1e-9, `${id}: inside the horizon but not consumed`);
      }
    }
    assert.ok(crossedAt !== null, `${id}: never consumed`);
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

test('the consumption needs no alpha channel: geometry alone crosses the horizon', () => {
  // The overlay may never arm — the capture can fail, the WebGL context can be
  // lost, a mobile reader can skip it — and the sequence must still consume the
  // elements. This is the unarmed path: no opacity is written at all, and the
  // fall is carried entirely by translation and scale.
  for (const id of IDS) {
    const rest = FLYERS[id];
    let previousArea = 1;
    for (const p of grid(0, 1, 200)) {
      const frame = flyerFrameAt(p, rest, SINGULARITY, horizonRadiusAtProgress(p, EXTENT));
      const at: Point = { x: rest.x + frame.x, y: rest.y + frame.y };
      const area = frame.along * frame.across;
      assert.ok(area <= previousArea + 1e-12, `${id}: the flyer grew while unarmed`);
      previousArea = area;
      // Well before the paint handoff the geometry is already most of the fall.
      if (p >= MIX_END) {
        assert.ok(frame.fall > 0.3, `${id}: only ${frame.fall} of the fall at the handoff`);
        assert.ok(area < 0.5, `${id}: still ${area}× its rest area at the handoff`);
      }
      assert.ok(distance(at, SINGULARITY) <= coverRadius(EXTENT), `${id}: fell outside the overlay`);
    }
    assert.equal(previousArea, 0, `${id}: an unarmed flyer never reached zero area`);
  }
});

test('the horizon grows from a seed to every corner of the overlay', () => {
  assert.equal(horizonRadiusAtProgress(0, EXTENT), 0, 'no horizon at rest');
  assertNonDecreasing(grid(0, 1), (p) => horizonRadiusAtProgress(p, EXTENT), 'horizon radius');
  const cover = coverRadius(EXTENT);
  const centre = { x: EXTENT.anchorX, y: EXTENT.anchorY + EXTENT.veil };
  const farthest = Math.max(
    distance({ x: 0, y: EXTENT.veil }, centre),
    distance({ x: EXTENT.width, y: EXTENT.veil }, centre),
    distance({ x: 0, y: EXTENT.height + EXTENT.veil }, centre),
    distance({ x: EXTENT.width, y: EXTENT.height + EXTENT.veil }, centre),
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
  assert.ok(SCENE.veil > SCENE.restHeight * 0.5, 'the strands need room above the sheet');
  assert.ok(MIN_SHEET_RUN > 0, 'the fall needs a minimum run to read as a fall');
  // Every flyer's own radius is covered once the horizon has finished growing.
  for (const id of IDS) {
    const frame = flyerFrameAt(0.5, FLYERS[id], SINGULARITY, horizonRadiusAtProgress(0.5, EXTENT));
    const at: Point = { x: FLYERS[id].x + frame.x, y: FLYERS[id].y + frame.y };
    assert.ok(distance(at, SINGULARITY) <= cover, 'every flyer stays inside the overlay box');
  }
});

/* ---------------------------------------------------------------------------
   The physical response — the black hole reacting to what it eats. These are
   pure functions of the SAME playhead that drives the warp, so they hold even
   when nothing is mounted: a unit test can prove the excursions are zero at
   both ends, small throughout, and bite at the two crossings.
--------------------------------------------------------------------------- */

test('a bite is a single eased pulse: zero at both edges, one at its centre', () => {
  const centre = BITE_CENTRES[0];
  // The edges of the pulse's own window are exactly zero — no plateau that would
  // make the two bites, or either bite and the rest, run together.
  assert.equal(bitePulseAt(centre - BITE_WIDTH, centre), 0);
  assert.equal(bitePulseAt(centre + BITE_WIDTH, centre), 0);
  assert.ok(Math.abs(bitePulseAt(centre, centre) - 1) < 1e-12, 'a bite peaks at its centre');
  // Outside the window it is zero everywhere, so the two bites never overlap a
  // flyer that has not crossed or has already been eaten.
  assert.equal(bitePulseAt(centre - BITE_WIDTH * 2, centre), 0);
  assert.equal(bitePulseAt(centre + BITE_WIDTH * 2, centre), 0);
  // It never goes negative, and it is finite.
  for (const p of grid(0, 1, 200)) {
    const value = bitePulseAt(p, centre);
    assert.ok(Number.isFinite(value), `bitePulseAt(${p}) is not finite`);
    assert.ok(value >= -1e-12 && value <= 1 + 1e-12, `bitePulseAt(${p}) = ${value} escaped [0, 1]`);
  }
});

test('the physical response is small, eased, and held after the swallows', () => {
  const rest = consumptionResponseAt(0);
  assert.equal(rest.mass, 0, 'mass at rest');
  assert.equal(rest.lensing, 0, 'lensing at rest');
  assert.equal(rest.doppler, 0, 'doppler at rest');
  assert.equal(rest.rotation, 0, 'rotation at rest');
  const end = consumptionResponseAt(1);
  assert.ok(end.mass > MASS_BITE * 0.9, `agitated mass at p=1 was ${end.mass}`);
  assert.ok(end.lensing > LENSING_BITE * 0.9, `agitated lensing at p=1 was ${end.lensing}`);
  assert.ok(end.doppler > DOPPLER_BITE * 0.9, `agitated doppler at p=1 was ${end.doppler}`);
  assert.ok(end.rotation > ROTATION_BITE * 0.9, `agitated rotation at p=1 was ${end.rotation}`);
  for (const p of grid(0, 1, 200)) {
    const r = consumptionResponseAt(p);
    assert.ok(Number.isFinite(r.mass), `mass(${p}) is not finite`);
    assert.ok(r.mass >= 0 && r.mass <= MASS_BITE + 1e-12, `mass(${p}) = ${r.mass}`);
    assert.ok(r.lensing >= 0 && r.lensing <= LENSING_BITE + 1e-12, `lensing(${p}) = ${r.lensing}`);
    assert.ok(r.doppler >= 0 && r.doppler <= DOPPLER_BITE + 1e-12, `doppler(${p}) = ${r.doppler}`);
    assert.ok(r.rotation >= 0 && r.rotation <= ROTATION_BITE + 1e-12, `rotation(${p}) = ${r.rotation}`);
  }
  for (const p of grid(0, 1, 200)) {
    const r = consumptionResponseAt(p);
    const envelope = Math.min(
      1,
      biteHoldAt(p, BITE_CENTRES[0]) * 0.55 + biteHoldAt(p, BITE_CENTRES[1]) * 0.45,
    );
    const expected = MASS_BITE * envelope;
    assert.ok(
      Math.abs(r.mass - expected) < 1e-12,
      `mass(${p}) = ${r.mass}, expected ${expected} — the channels must not diverge`,
    );
  }
});

test('the hole bites once per swallow, nearest first, and stays agitated', () => {
  assert.ok(BITE_CENTRES[0] < BITE_CENTRES[1], 'the nearest body must bite first');
  assert.ok(biteHoldAt(BITE_CENTRES[0], BITE_CENTRES[0]) > 0.99);
  assert.ok(biteHoldAt(BITE_CENTRES[1], BITE_CENTRES[1]) > 0.99);
  assert.equal(biteHoldAt(0, BITE_CENTRES[0]), 0);
  assert.equal(biteHoldAt(1, BITE_CENTRES[1]), 1);
  const afterFirst = (BITE_CENTRES[0] + BITE_CENTRES[1]) / 2;
  assert.ok(
    biteHoldAt(afterFirst, BITE_CENTRES[0]) > 0.99,
    'the first swallow must still be held when the second arrives',
  );
});

/* ==========================================================================
   Requirement 4 — the curtain footer rises into exactly the space the
   consumption vacates, on the consumption's own clock, and the gap never
   collapses by itself.

   With the hold, this is a statement about ONE box: the sheet is never taken out
   of the flow, so its collapse is the flow's own payback, and the reservation
   above the composition is a separate quantity that depends on the scroll alone.
   `holdBudgetAt` puts the two side by side precisely so this section can assert
   that they never mix.
   ========================================================================== */

/** Everything above the reservation: the rest of the site, and the composition's
 * own height. It cancels out of the invariant — which is the point: the budget
 * must not depend on how tall the rest of the site is. */
const ABOVE = 5200;

/** The document's scroll room left at the top of the span, at a given scroll and
 * playhead: `docHeight − viewport − scroll`. */
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
  // The hold engages on the reference framing: the headline's bottom edge
  // `inset` above the fold, i.e. `belowTitle` above the sheet's hem.
  const start = ABOVE + scene.restHeight - scene.belowTitle - (MEASURED.viewport - scene.inset);
  const scroll = start + scene.pinDistance * raw;
  const { documentGrowth } = holdBudgetAt(
    scroll,
    start,
    scene.pinDistance,
    p,
    scene.restHeight,
    scene.collapsible,
  );
  // `holdBudgetAt` deliberately reports the reservation without the pad (it is
  // the scroll, not the document, that the identity is about); the box on screen
  // is one pixel taller still, and that pixel is what makes the slack below
  // round in the safe direction.
  const docHeight = ABOVE + scene.restHeight + scene.tail + documentGrowth + SPACER_PAD;
  return docHeight - MEASURED.viewport - scroll;
};

test('the hold pays for itself as it is spent, and never comes up short', () => {
  const start = 5000;
  const span = SCENE.pinDistance;
  // Before the line: nothing has been spent, and the box still carries the pixel
  // of pad that keeps a rounded-up reservation from ever being shorter than the
  // scroll it is paying for.
  assert.equal(holdDistanceAt(0, start, span), SPACER_PAD);
  assert.equal(holdDistanceAt(start, start, span), SPACER_PAD);
  // Inside: one document pixel per scrolled pixel, exactly, plus the pad.
  for (const travelled of grid(0, span, 97)) {
    const scroll = start + travelled;
    assert.ok(
      holdDistanceAt(scroll, start, span) >= travelled,
      `the document must never be shorter than the scroll spent (travelled ${travelled})`,
    );
    assert.ok(
      Math.abs(holdDistanceAt(scroll, start, span) - (travelled + SPACER_PAD)) < 1e-9,
      `travelled ${travelled}: expected ${travelled + SPACER_PAD}, got ${holdDistanceAt(scroll, start, span)}`,
    );
  }
  // Past the line's end: frozen. This is the release, and it is a NON-event —
  // the reservation simply stops growing, so nothing is handed over, reverted or
  // re-measured, and the reader keeps the scroll they paid for.
  assert.equal(holdDistanceAt(start + span, start, span), span + SPACER_PAD);
  assert.equal(holdDistanceAt(start + span * 4, start, span), span + SPACER_PAD);
  assert.equal(holdDistanceAt(-1e6, start, span), SPACER_PAD);
  assertNonDecreasing(grid(0, span * 2, 200).map((x) => x), (x) => holdDistanceAt(start + x, start, span), 'reservation');
  // Reversibility: scrolling back up returns the same numbers, because the
  // reservation is a pure function of the scroll and there is no state to unwind.
  for (const travelled of grid(0, span, 41)) {
    assert.equal(
      holdDistanceAt(start + travelled, start, span),
      holdDistanceAt(start + travelled, start, span),
    );
  }
  // A zero span (a footer with nothing to consume) must not open a hold at all.
  assert.equal(holdDistanceAt(start + 100, start, 0), SPACER_PAD);
});

test('the composition is locked to one viewport position for the whole span', () => {
  // THE property the two pins used to have to negotiate, stated here as an
  // identity. An element whose document position is P0 sits at `P0 − scroll` in
  // the viewport; the reservation adds `hold(scroll)` to P0; and for the whole
  // span the sum is constant, for the hole's container AND for the sheet below it,
  // because one box pushes both.
  const start = 5000;
  const span = SCENE.pinDistance;
  const frameDoc = 4000;
  const sheetDoc = 4700;
  const at = (rest: number, scroll: number) => rest + holdDistanceAt(scroll, start, span) - scroll;
  const locked = at(frameDoc, start);
  const lockedSheet = at(sheetDoc, start);
  for (const raw of grid(0, 1, 121)) {
    const scroll = start + span * raw;
    assert.ok(Math.abs(at(frameDoc, scroll) - locked) < 1e-9, `raw=${raw.toFixed(3)}: the hole drifted to ${at(frameDoc, scroll)}`);
    assert.ok(Math.abs(at(sheetDoc, scroll) - lockedSheet) < 1e-9, `raw=${raw.toFixed(3)}: the sheet drifted to ${at(sheetDoc, scroll)}`);
    // The push is the scroll, to the pixel — which is what "locked" means here:
    // one document pixel per scrolled pixel, and never less than that.
    const push = holdDistanceAt(scroll, start, span) - span * raw;
    assert.ok(Math.abs(push - SPACER_PAD) < 1e-9, `raw=${raw.toFixed(3)}: pushed by ${push}`);
  }
  // Past the span the push stops, so the scene scrolls away normally — the release
  // is a NON-event, and the reader keeps the scroll they paid for.
  const released = at(frameDoc, start + span + 100);
  assert.ok(Math.abs(released - (locked - 100)) < 1e-9, 'the document must scroll at one pixel per pixel');

  // `rise` — frame bottom → headline bottom, the number the framing is solved
  // from — is a difference between two held boxes, so the push cancels out of it
  // entirely. That is why the scene may be measured at ANY scroll position, and
  // why growing the reservation cannot perturb the framing it was built on.
  const invite = sheetDoc - SCENE.belowTitle;
  const frameBottom = frameDoc + SCENE.frameHeight;
  const riseAt = (raw: number) => {
    const scroll = start + span * raw;
    return at(invite, scroll) - at(frameBottom, scroll);
  };
  for (const raw of grid(0, 1.4, 61)) {
    assert.ok(Math.abs(riseAt(raw) - riseAt(0)) < 1e-9, `raw=${raw.toFixed(3)}: the rise changed to ${riseAt(raw)}`);
  }
});

test('the hold is active on the span\'s interior only, and the playhead has arrived on both edges', () => {
  const start = 5000;
  const span = SCENE.pinDistance;
  assert.equal(holdActiveAt(start, start, span), false, 'the trigger line itself is not the hold');
  assert.equal(holdActiveAt(start + 1, start, span), true);
  assert.equal(holdActiveAt(start + span - 1, start, span), true);
  assert.equal(holdActiveAt(start + span, start, span), false, 'the span is half-open: it lets go on its last pixel');
  assert.equal(holdActiveAt(start - 1, start, span), false);
  assert.equal(holdActiveAt(start + span * 3, start, span), false);
  // The release lands on a settled playhead: the span outlives the consumption by
  // the settle margin, which is longer than the smoothing distance.
  assert.ok(span > SCENE.run, 'the hold must outlast the fall');
  assert.equal(consumptionTarget(1, SCENE.share), 1);
  assert.equal(consumptionTarget(SCENE.share, SCENE.share), 1);
  assert.ok(SCENE.settle > PLAYHEAD_SMOOTH_PX);
});

test('the curtain rises by exactly the height the consumption vacates', () => {
  // Requirement 4's equation, with nothing in it but the sheet: the footer is in
  // flow directly below it, so the distance the floor rises IS the height the
  // sheet has given up — at the playhead's rate, and by nothing else.
  const riseAt = (p: number): number => SCENE.restHeight - sheetHeightAt(p, SCENE.restHeight, SCENE.collapsible);
  for (const p of grid(0, 1, 141)) {
    assert.ok(
      Math.abs(riseAt(p) - vacatedHeightAt(p, SCENE.collapsible)) < 1e-9,
      `p=${p.toFixed(3)}: the floor rose ${riseAt(p)}, the void vacated ${vacatedHeightAt(p, SCENE.collapsible)}`,
    );
  }
  assert.equal(riseAt(0), 0);
  assert.ok(Math.abs(riseAt(1) - SCENE.collapsible) < 1e-9, 'fully paid back at the end');
  assertNonDecreasing(grid(0, 1, 141), riseAt, 'the floor\'s rise');

  // Two clocks, one quantity each — the bug this replaces paid the layout from
  // the raw scroll while the sheet's height followed the smoothed playhead, so
  // the box the footer sits on was driven by both. Here the collapse depends on
  // the playhead ONLY and the reservation on the scroll ONLY.
  const budget = (p: number, raw: number) =>
    holdBudgetAt(5000 + SCENE.pinDistance * raw, 5000, SCENE.pinDistance, p, SCENE.restHeight, SCENE.collapsible);
  for (const [p1, p2] of [[0.1, 0.9], [0.3, 0.6]] as const) {
    for (const raw1 of [0.2, 0.8]) {
      const a = budget(p1, raw1).flowGivenUp;
      const b = budget(p2, raw1).flowGivenUp;
      assert.ok(
        Math.abs(b - a - (vacatedHeightAt(p2, SCENE.collapsible) - vacatedHeightAt(p1, SCENE.collapsible))) < 1e-9,
        'the collapse must follow the playhead, not the scroll',
      );
    }
  }
  for (const [r1, r2] of [[0.1, 0.9], [0, 1]] as const) {
    const a = budget(0.4, r1).reservation;
    const b = budget(0.4, r2).reservation;
    assert.ok(
      Math.abs(a - b - SCENE.pinDistance * (r1 - r2)) < 1e-9,
      'the reservation must be the scroll, exactly, at any playhead',
    );
    // …and it does not move at all once the span is over, whichever playhead the
    // tail is still settling.
    assert.equal(budget(0.4, 1.4).reservation, budget(1, 1.4).reservation);
  }
});

test('the floor tracks the hem, and only the playhead moves either', () => {
  // The sentence requirement 4 actually needs: the curtain's floor sits at the
  // sheet's hem and cannot part from it, because the hem is the sheet's box and
  // the floor follows that box in flow. So the hem's viewport position is a
  // function of the PLAYHEAD alone (given a held scroll) — a scroll that runs
  // ahead of the smoothing, a tail that settles after it, and a fling that
  // reverses midway can each move nothing under the sheet.
  const start = 5000;
  const span = SCENE.pinDistance;
  const hemAt = (scroll: number, p: number) => {
    const sheetTop = SCENE.pinnedTop + holdDistanceAt(scroll, start, span) - scroll;
    return sheetTop + sheetHeightAt(p, SCENE.restHeight, SCENE.collapsible);
  };
  for (const raw of grid(0, 1, 41)) {
    const scroll = start + span * raw;
    for (const p of grid(0, 1, 41)) {
      // The floor rises by exactly what the consumption has vacated — nothing
      // else moves it, because nothing else is between it and the sheet's box.
      const risen = hemAt(start, 0) - hemAt(scroll, p);
      assert.ok(
        Math.abs(risen - vacatedHeightAt(p, SCENE.collapsible)) < 1e-9,
        `raw=${raw.toFixed(3)} p=${p.toFixed(3)}: the floor rose ${risen}, the void vacated ${vacatedHeightAt(p, SCENE.collapsible)}`,
      );
      // …and the hem's position is a function of the playhead ONLY: the same
      // `p` at two different scrolls inside the span is the same line.
      assert.ok(
        Math.abs(hemAt(scroll, p) - hemAt(start + span * 0.5, p)) < 1e-9,
        `raw=${raw.toFixed(3)}: the hem moved with the scroll`,
      );
    }
  }
  // The one quantity the pad is for: the sheet's box is never more than a pixel
  // away from the space the document has reserved for it.
  for (const raw of grid(0, 1, 41)) {
    const scroll = start + span * raw;
    assert.ok(holdDistanceAt(scroll, start, span) >= span * raw);
    assert.ok(holdDistanceAt(scroll, start, span) <= span * raw + SPACER_PAD + 1e-9);
  }
});

test('the document never runs short while the sheet is consumed', () => {
  for (const tail of [SCENE.tail, 620, MIN_RELEASE_SLACK + 400]) {
    const collapsible = collapsibleHeight(SCENE.restHeight, tail, SCENE.hemInset);
    const scene = { ...SCENE, tail, collapsible };
    let worst = Infinity;
    let worstAt = '';
    // `raw` is the scroll through the span, `p` the smoothed playhead. A fling
    // puts raw ahead of p; a reversal puts it behind; a jump puts both at an end.
    // Every one of them has to leave the release on a scrollable document, or the
    // playhead snaps back and the sheet un-collapses in front of the reader.
    for (const raw of grid(0, 1, 61)) {
      for (const lag of [-0.4, -0.1, 0, 0.1, 0.4]) {
        const p = clamp01(raw + lag);
        const slack = slackAt(p, raw, scene);
        // Closed form: the document has the tail, adjusted for where the hem
        // parks, plus the pad, minus whatever the collapse has taken out of it.
        // The reservation pays the collapse back exactly, so `raw` cancels — the
        // budget is the same at the top of the span and at the bottom of it.
        const closed = tail - SCENE.hemInset + SPACER_PAD - collapsible * collapseAt(p);
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
      `${worstAt}: only ${worst.toFixed(1)}px of scroll left — the release would clamp`,
    );
  }
});

test('the release parks the reservation at the span, on a settled playhead', () => {
  const scroll = 5000 + SCENE.pinDistance;
  const hold = holdDistanceAt(scroll, 5000, SCENE.pinDistance);
  // The consumption has taken the whole allowance out and the scroll has run the
  // whole span, so what the document is left with is the parked pin — the sheet's
  // own box is gone and the curtain has risen into it.
  assert.ok(Math.abs(hold - (SCENE.pinDistance + SPACER_PAD)) < 1e-6);
  const growth = holdBudgetAt(scroll, 5000, SCENE.pinDistance, 1, SCENE.restHeight, SCENE.collapsible).documentGrowth;
  assert.ok(
    Math.abs(growth - (SCENE.pinDistance - SCENE.collapsible)) < 1e-6,
    `expected the span minus the consumed sheet, got ${growth}`,
  );
  assert.ok(growth > 0, 'the hold must not end on a clamped document');
  const atRelease = slackAt(1, 1, SCENE);
  assert.ok(atRelease > 0);
  // …and the playhead is provably 1 by then, which is the whole point of the
  // settle margin: the hold lets go onto a finished fall, never onto one that is
  // still in flight.
  const { final } = walkSpan(SCENE.pinDistance, SCENE.share, 13);
  assert.equal(final, 1);
});

/* ==========================================================================
   Requirement (critical correction) — the live warp is a displacement FIELD,
   never an affine transform. The element's raster is re-sampled per fragment
   through the same remap the shader integrates, and the four properties the
   correction demands are stated as measurable properties of that field:
   aggressive spaghettification, exponential near-side stretching, concentric
   arching, and one continuous body.

   The reference rasters: the invitation's headline line (~700×115) with its
   centre at the fixture's invite rest, and the CTA pill (~240×52) at the CTA
   rest, in sheet-local coordinates — the same numbers the component feeds
   `computeLensMap` with.
   ========================================================================== */

/** The invitation's rest raster, sheet-local (the fixture's ~700×115 line). */
const INVITE_RASTER = { x: FLYERS.invite.x - 350, y: FLYERS.invite.y - 57.5, width: 700, height: 115 };
/** The CTA's rest raster (~240×52). */
const CTA_RASTER = { x: FLYERS.cta.x - 120, y: FLYERS.cta.y - 26, width: 240, height: 52 };
/** The singularity, sheet-local. */
const SHEET_SINGULARITY: Point = { x: SCENE.anchorX, y: SCENE.anchorY };

/** Forward-map a horizontal run of points on a rest line and report the image
 * line. This is the picture the archived "bow" number used to gesture at;
 * here it is the integral of the real field instead of a hand-written dy. */
const mapBaseline = (p: number, raster: typeof INVITE_RASTER, n = 11): Point[] => {
  const field = lensFieldAt(p, EXTENT);
  const points: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const px = raster.x + (raster.width * i) / (n - 1);
    const py = raster.y + raster.height; // the baseline: the word's own bottom
    const out = lensForwardAt(px - SHEET_SINGULARITY.x, py - SHEET_SINGULARITY.y, field, 6);
    points.push({ x: SHEET_SINGULARITY.x + out.x, y: SHEET_SINGULARITY.y + out.y });
  }
  return points;
};

test('the lens is the identity at rest, on every map cell', () => {
  const field = lensFieldAt(0, EXTENT);
  for (const [vx, vy] of [[0, 0], [120, -40], [-300, 220], [640, 800]] as const) {
    const source = lensSourceAt(vx, vy, field);
    assert.ok(Math.abs(source.x - vx) < 1e-9, `identity moved x at ${vx},${vy}`);
    assert.ok(Math.abs(source.y - vy) < 1e-9, `identity moved y at ${vx},${vy}`);
    const out = lensForwardAt(vx, vy, field);
    assert.ok(Math.abs(out.x - vx) < 1e-9);
    assert.ok(Math.abs(out.y - vy) < 1e-9);
  }
  // …and the rasterised map is numerically a no-op: range 0, so the filter's
  // scale goes to zero and the handoff into the pinned scene cannot move the
  // type by even a sub-pixel.
  const region = lensRegionAt(INVITE_RASTER, SHEET_SINGULARITY, field);
  const map = new Float32Array(64 * 64 * 2);
  const range = computeLensMap(region, INVITE_RASTER, SHEET_SINGULARITY, field, 64, map);
  assert.equal(range, 0, 'a rest field must not displace anything');
  for (let k = 0; k < map.length; k += 1) {
    // Void cells are written direction-preserving at magnitude 1 (a no-content
    // bake), content cells are zero: nothing exceeds a no-op by a pixel.
    assert.ok(Math.abs(map[k]) <= 1, `rest map displaced ${map[k]} at ${k}`);
  }
});

/** Decompose the mapped baseline into its list (the linear term — the frame
 * dragging, subordinate by design) and its arch (the quadratic term — the
 * radial field's signature, which a skew CANNOT produce). Least squares on
 * `y(u) = q·u² + l·u + a`, u half-centred. */
const quadraticTerms = (points: Point[], centreX: number): { arch: number; list: number } => {
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let sy = 0;
  let suy = 0;
  let suuy = 0;
  for (const { x, y } of points) {
    const u = x - centreX;
    s0 += 1;
    s1 += u;
    s2 += u * u;
    s3 += u * u * u;
    s4 += u ** 4;
    sy += y;
    suy += u * y;
    suuy += u * u * y;
  }
  // 3×3 Gaussian elimination on the normal equations.
  const m = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]];
  const v = [sy, suy, suuy];
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(m[row][column]) > Math.abs(m[pivot][column])) pivot = row;
    }
    [m[column], m[pivot]] = [m[pivot], m[column]];
    [v[column], v[pivot]] = [v[pivot], v[column]];
    for (let row = column + 1; row < 3; row += 1) {
      const factor = m[row][column] / m[column][column];
      for (let cc = column; cc < 3; cc += 1) m[row][cc] -= factor * m[column][cc];
      v[row] -= factor * v[column];
    }
  }
  const q = v[2] / m[2][2];
  const l = (v[1] - m[1][2] * q) / m[1][1];
  return { arch: q, list: l };
};

test('the field is radial: a horizontal baseline ARCHES UP, concentric with the disk', () => {
  // Requirement: "concentric arching". The baseline of the headline bows
  // toward the hole — its middle (nearest the singularity) is pulled harder
  // than its ends — and the bow is zero at rest and grows with the playhead.
  // A linear skew cannot arch a line at all (a line in, a line out), so the
  // assertion is stated on the QUADRATIC term of the mapped baseline: the
  // arch in px of sagitta across the half-width (350px) of the fixture word.
  // Measured with the tuned field: 2.9px at p = 0.2, 13.9px at p = 0.3 and
  // 36.6px at p = 0.35, while the frame-dragging list stays subordinate.
  for (const [p, want] of [[0.1, 0.1], [0.2, 1.8], [0.3, 8], [0.35, 22]] as const) {
    const base = mapBaseline(p, INVITE_RASTER, 21);
    const { arch, list } = quadraticTerms(base, SHEET_SINGULARITY.x);
    // y is down, so an UPWARD bow is a positive quadratic term: the ends sit
    // below the middle.
    assert.ok(arch > 0, `p=${p}: the baseline bows DOWNWARD (${arch}) — the field is inverted`);
    const sagitta = arch * 350 * 350;
    assert.ok(sagitta > want, `p=${p}: the arch spans ${sagitta}px — a skew, not a bow`);
    // The list is the frame dragging, and it must stay the junior partner:
    // a build whose sideways character exceeds its curvature is the failed
    // linear skew all over again.
    if (p >= 0.2) {
      assert.ok(
        sagitta > Math.abs(list) * 350,
        `p=${p}: listing (${(Math.abs(list) * 350).toFixed(1)}px) dominates the arch (${sagitta.toFixed(1)}px)`,
      );
    }
  }
  // The bow deepens strictly as the field arrives, through the live window.
  let previous = 0;
  for (const p of grid(0.05, 0.35, 20)) {
    const base = mapBaseline(p, INVITE_RASTER, 21);
    const { arch } = quadraticTerms(base, SHEET_SINGULARITY.x);
    const sagitta = arch * 350 * 350;
    assert.ok(sagitta > previous - 1e-9, `the arch shrank at p=${p}`);
    previous = sagitta;
  }
});

test('the near side of a glyph strands exponentially harder than its far side', () => {
  // Requirement: "exponential stretching". Read the tide across the
  // invitation's own 115px-tall glyph run: the top (nearest the horizon)
  // against the bottom, at the image radius the playhead has contracted the
  // flyer to. The differential must be non-linear — a power-law gradient —
  // and it must be present BEFORE the frozen frame takes over.
  for (const p of [0.25, 0.3, 0.35]) {
    const field = lensFieldAt(p, EXTENT);
    const c = contractionAt(p);
    const centre = INVITE_RASTER.y + INVITE_RASTER.height / 2;
    const top = (centre - SHEET_SINGULARITY.y) * c - (INVITE_RASTER.height / 2) * c;
    const bottom = (centre - SHEET_SINGULARITY.y) * c + (INVITE_RASTER.height / 2) * c;
    const tideTop = tidalAt(top, field.horizon, p);
    const tideBottom = tidalAt(bottom, field.horizon, p);
    assert.ok(
      tideTop > tideBottom * 1.15,
      `p=${p}: the surface tide is ${tideTop.toFixed(3)} top vs ${tideBottom.toFixed(3)} bottom — linear skew territory`,
    );
    // Power law, not a linear gradient: the tide falls off super-linearly
    // between the two edges, i.e. log(tide) is negatively curved in log(r) —
    // the sampled mid-tide sits BELOW the linear interpolation (the gradient
    // steepens toward the hole).
    const mid = (top + bottom) / 2;
    const tideMid = tidalAt(mid, field.horizon, p);
    const linear = (tideTop + tideBottom) / 2;
    if (tideTop < TIDAL_CAP * 0.98) {
      assert.ok(tideMid < linear, `p=${p}: the tide is not convex toward the hole`);
    }
  }
  // And the anisotropy it produces — the live-window look itself. These are
  // the numbers the old constants could not reach before the handoff: at the
  // invitation, along/across ≥ 1.3 by p = 0.3 and ≥ 1.5 by p = 0.35.
  for (const [p, want] of [[0.3, 1.3], [0.35, 1.5]] as const) {
    const field = lensFieldAt(p, EXTENT);
    const frame = flyerFrameAt(p, FLYERS.invite, SINGULARITY, field.horizon);
    const ratio = frame.along / frame.across;
    assert.ok(ratio >= want, `p=${p}: anisotropy ${ratio} < ${want} — the flat skew is back`);
    assert.ok(Number.isFinite(field.horizon) && field.horizon > 0);
  }
});

test('the word thins and funnels inward as one body — never blooms, never shatters', () => {
  // Requirement: funnel inward + preserve unified cohesion. The mapped
  // baseline's horizontal span narrows (tangential squeeze) while its arch
  // deepens, and the mapped box perimeter is a continuum — neighbouring
  // samples stay neighbours (the field is C∞ away from the horizon: nothing
  // can tear a hole into the middle of the word).
  let previousSpan = INVITE_RASTER.width;
  for (const p of grid(0.02, 0.37, 24)) {
    const base = mapBaseline(p, INVITE_RASTER, 21);
    const span = base[20].x - base[0].x;
    assert.ok(span < previousSpan + 1e-9, `the word bloomed at p=${p}`);
    if (previousSpan !== INVITE_RASTER.width) {
      assert.ok(span < previousSpan, `the funnel stalled at p=${p}`);
    }
    previousSpan = span;
    // Continuity of the mapped curve: neighbour steps are small relative to
    // the whole arch — a shatter would read as a step discontinuity.
    for (let i = 1; i < base.length; i += 1) {
      const step = distance(base[i - 1], base[i]);
      assert.ok(step < INVITE_RASTER.width / 10, `p=${p}: the mapped word tore at index ${i}`);
    }
  }
  assert.ok(previousSpan < INVITE_RASTER.width * 0.75, `still ${previousSpan}px wide — no funnel`);
});

test('the filter region tracks the falling content and collapses onto the singularity', () => {
  // At rest the content is the box: the region IS the box, padded.
  const rest = lensRegionAt(INVITE_RASTER, SHEET_SINGULARITY, lensFieldAt(0, EXTENT));
  assert.ok(Math.abs(rest.x - (INVITE_RASTER.x - 10)) < 1e-9);
  assert.ok(Math.abs(rest.y - (INVITE_RASTER.y - 10)) < 1e-9);
  assert.ok(Math.abs(rest.width - (INVITE_RASTER.width + 20)) < 1e-9);
  assert.ok(Math.abs(rest.height - (INVITE_RASTER.height + 20)) < 1e-9);
  // Mid-fall the content is between the rest box and the hole; deep in the
  // fall the hull hugs the singularity. The honest invariant is the hull's
  // DISTANCE from the singularity — the centre line alone is NOT monotone,
  // because the frame dragging orbits the content around the hole while it
  // falls in (a swallowed body spirals; that is physical, and asserted here
  // rather than hidden).
  const PROBES = [
    [INVITE_RASTER.x, INVITE_RASTER.y],
    [INVITE_RASTER.x + INVITE_RASTER.width, INVITE_RASTER.y],
    [INVITE_RASTER.x, INVITE_RASTER.y + INVITE_RASTER.height],
    [INVITE_RASTER.x + INVITE_RASTER.width, INVITE_RASTER.y + INVITE_RASTER.height],
    [INVITE_RASTER.x + INVITE_RASTER.width / 2, INVITE_RASTER.y + INVITE_RASTER.height],
  ] as const;
  let previousReach = Infinity;
  for (const p of grid(0.05, 0.995, 40)) {
    const region = lensRegionAt(INVITE_RASTER, SHEET_SINGULARITY, lensFieldAt(p, EXTENT));
    // The painted content is inside the region, exactly what the region is
    // for: sample-pointwise on the forward image of the perimeter.
    const field = lensFieldAt(p, EXTENT);
    let reach = 0;
    for (const [px, py] of PROBES) {
      const out = lensForwardAt(px - SHEET_SINGULARITY.x, py - SHEET_SINGULARITY.y, field, 6);
      const wx = SHEET_SINGULARITY.x + out.x;
      const wy = SHEET_SINGULARITY.y + out.y;
      assert.ok(wx >= region.x - 1e-9 && wx <= region.x + region.width + 1e-9, `x escaped the region at p=${p}`);
      assert.ok(wy >= region.y - 1e-9 && wy <= region.y + region.height + 1e-9, `y escaped the region at p=${p}`);
      reach = Math.max(reach, out.x * out.x + out.y * out.y);
    }
    assert.ok(reach <= previousReach + 4, `the content hull receded from the hole at p=${p}`);
    previousReach = reach;
  }
  const end = lensRegionAt(INVITE_RASTER, SHEET_SINGULARITY, lensFieldAt(1, EXTENT));
  assert.ok(end.width < INVITE_RASTER.width / 4, 'the hull did not collapse with the fall');
  const centre = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
  assert.ok(distance(centre, SHEET_SINGULARITY) < 40, `the hull collapsed ${distance(centre, SHEET_SINGULARITY)}px off the singularity`);
});

test('the baked map: content cells pull toward the singularity, void cells never paint', () => {
  const p = 0.3;
  const field = lensFieldAt(p, EXTENT);
  const region = lensRegionAt(INVITE_RASTER, SHEET_SINGULARITY, field);
  const size = LENS_MAP_SIZE;
  const map = new Float32Array(size * size * 2);
  const range = computeLensMap(region, INVITE_RASTER, SHEET_SINGULARITY, field, size, map);
  assert.ok(range > 20, `p=${p}: the map's range is ${range}px — too timid to bend strokes`);
  assert.ok(range < 900, `p=${p}: range ${range}px would quantise the word into noise`);
  let contentCells = 0;
  let voidCells = 0;
  let sided = 0;
  let funnelled = 0;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const wy = region.y + ((j + 0.5) / size) * region.height;
      const wx = region.x + ((i + 0.5) / size) * region.width;
      const k = (j * size + i) * 2;
      const sx = wx + map[k];
      const sy = wy + map[k + 1];
      const inside =
        sx >= INVITE_RASTER.x &&
        sx <= INVITE_RASTER.x + INVITE_RASTER.width &&
        sy >= INVITE_RASTER.y &&
        sy <= INVITE_RASTER.y + INVITE_RASTER.height;
      if (!inside) {
        voidCells += 1;
        continue; // a void cell: the sampled point is off the raster, as promised
      }
      contentCells += 1;
      // A content cell's displacement points from the output position back OUT
      // to its rest source: away from the singularity, not toward it (the warp
      // pulls the image inward — the map pulls the samples outward). This is
      // the radial half of the funnel, exact in the presence of swirling.
      const away = map[k] * (wx - SHEET_SINGULARITY.x) + map[k + 1] * (wy - SHEET_SINGULARITY.y);
      assert.ok(away >= -1e-6, `cell ${i},${j} samples toward the hole — the warp is inverted`);
      // The sideways half — left letters reach left, right letters reach
      // right — is asserted in aggregate: the frame dragging rotates every
      // sample the same way around the hole, so a cell-by-cell x-sign check
      // would misread rotation as a broken funnel. Tally the shares instead.
      if (wx < SHEET_SINGULARITY.x - 40) {
        sided += 1;
        if (map[k] < 0) funnelled += 1;
      } else if (wx > SHEET_SINGULARITY.x + 40) {
        sided += 1;
        if (map[k] > 0) funnelled += 1;
      }
    }
  }
  // …with enough off-axis content to make the tally meaningful, and a broad
  // majority of it reaching to its own side of the axis (the exact share is
  // ~92% at this playhead; a linear skew would still pass 100% here, which is
  // why this is a funnel property, not the whole story — the arch test above
  // is the one a skew can never pass).
  assert.ok(sided > 50, 'too little off-axis content to judge the funnel');
  assert.ok(
    funnelled / sided > 0.8,
    `only ${funnelled}/${sided} off-axis cells funnel toward their own side — the word is slanting, not arching`,
  );
  // The map is mostly sky and word-edge: both populations exist, and nothing
  // in between mislabels them.
  assert.ok(contentCells > 0, 'no content at all mid-fall — the word is already void');
  assert.ok(voidCells > 0, 'no void mid-fall — the field stopped consuming');
});

test('the borders of the consumption arrive with the tide, not before it', () => {
  // Bite placement, restated as arithmetic on the reference scene the bites
  // were art-directed on (CTA ~34px out, headline ~120px out, cover 976):
  // each centre must sit just past its body's own crossing, so the hole
  // reacts AS the body goes in, not before and not after.
  const cover = coverRadius(EXTENT);
  assert.ok(cover > 900 && cover < 1100, `the fixture's cover moved to ${cover} — re-derive the bites instead`);
  for (const [index, restRadius] of [34, 120].entries()) {
    let crossing = Infinity;
    for (const probe of grid(0.001, 1, 4000)) {
      if (restRadius * contractionAt(probe) <= CROSSING * horizonRadiusAtProgress(probe, EXTENT)) {
        crossing = probe;
        break;
      }
    }
    const centre = BITE_CENTRES[index];
    assert.ok(Number.isFinite(crossing), `rest ${restRadius}px never crosses`);
    assert.ok(centre >= crossing, `bite ${index} fires BEFORE its body crosses (${centre} < ${crossing})`);
    assert.ok(
      centre - crossing <= 0.08,
      `bite ${index} lags its crossing by ${centre - crossing} — the reaction would land late`,
    );
  }
  // Nearest body, first bite: the ordering the response is built on.
  assert.ok(BITE_CENTRES[0] < BITE_CENTRES[1]);
});

test('the filmstrip quantisation is exact at the ends and even between', () => {
  // The filmstrip exists because a feImage href is an async image fetch: the
  // live scrub may never assign a URL the browser has not already decoded, so
  // the painted playhead is always the nearest pre-baked step.
  assert.equal(lensBakeStep(-0.2), 0);
  assert.equal(lensBakeStep(0), 0);
  assert.equal(lensBakeStep(1), 1);
  assert.equal(lensBakeStep(1.4), 1);
  assert.equal(lensBakeStep(0.5), 0.5);
  const step = 1 / LENS_BAKE_STEPS;
  // Within half a step the frame stands; beyond it the next frame is claimed.
  assert.equal(lensBakeStep(step + step * 0.49), step);
  assert.equal(lensBakeStep(step + step * 0.51), 2 * step);
  // And it is monotone non-decreasing over its domain.
  let last = 0;
  for (let i = 0; i <= LENS_BAKE_STEPS; i += 1) {
    const q = lensBakeStep(i / LENS_BAKE_STEPS - 1e-9);
    assert.ok(q >= last - 1e-12, `not monotone at ${i}`);
    last = q;
  }
});

/* ---------------------------------------------------------- the fluid mesh -- */

test('the fluid mesh is the identity at rest, bends and strands mid-fall, and closes onto the point', () => {
  // A self-consistent scene with the singularity directly ABOVE the flyer —
  // the reference geometry the component feeds the mesh.
  const singularity = { x: 640, y: -353.5 };
  const rest = { x: 640, y: 145 };
  const size = { width: 700, height: 115 };
  const geometry = { width: 1280, height: 383, anchorX: 640, anchorY: -353.5, veil: 381.5 };
  const cols = FLUID_GRID_COLS;
  const rows = FLUID_GRID_ROWS;

  // Apply a `flyerTransform` string to a point in the flyer's LOCAL frame:
  // the transform-origin is the box centre, so the map is translate + M·p with
  // M = R(θ)·S(a,b)·R(−θ) — exactly what the DOM composes.
  const applyEnvelope = (css: string, px: number, py: number) => {
    const t = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0\)/.exec(css)!;
    const r = /rotate\((-?[\d.]+)deg\)/.exec(css)!;
    const s = /scale\((-?[\d.]+), (-?[\d.]+)\)/.exec(css)!;
    const theta = (Number(r[1]) * Math.PI) / 180;
    const cosine = Math.cos(theta);
    const sine = Math.sin(theta);
    const a = Number(s[1]);
    const b = Number(s[2]);
    const m00 = cosine * cosine * a + sine * sine * b;
    const m01 = cosine * sine * (a - b);
    const m11 = sine * sine * a + cosine * cosine * b;
    return {
      x: Number(t[1]) + m00 * px + m01 * py,
      y: Number(t[2]) + m01 * px + m11 * py,
    };
  };
  // A cell's per-cell affine (matrix(a,b,c,d,e,f)) maps a cell-local point
  // (u,v) to flyer-local: C0 + (a·u + c·v + e, b·u + d·v + f), where C0 is
  // the cell's top-left rest corner in the flyer's local frame.
  const cellTopLeft = (i: number, j: number) => ({
    x: i * (size.width / cols) - size.width / 2,
    y: j * (size.height / rows) - size.height / 2,
  });
  const applyCell = (css: string, u: number, v: number) => {
    const m = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(css)!;
    const [a, b, c, d, e, f] = m.slice(1).map(Number);
    return { x: a * u + c * v + e, y: b * u + d * v + f };
  };
  // A cell's SCREEN position: the flyer's envelope transform applied to the
  // cell's warped CENTRE in the flyer's local frame.
  const frameAt = (p: number) => {
    const R = horizonRadiusAtProgress(p, geometry);
    const envelope = flyerFrameAt(p, rest, singularity, R);
    const envCss = flyerTransform(envelope);
    const transforms = fluidVertexTransforms(p, rest, singularity, lensFieldAt(p, geometry), envelope, size, cols, rows);
    const cellW = size.width / cols;
    const cellH = size.height / rows;
    const screens: Array<{ x: number; y: number }> = [];
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const origin = cellTopLeft(i, j);
        const local = applyCell(transforms[j * cols + i], cellW / 2, cellH / 2);
        const screen = applyEnvelope(envCss, origin.x + local.x, origin.y + local.y);
        screens.push({ x: rest.x + screen.x, y: rest.y + screen.y });
      }
    }
    return screens;
  };

  // Rest: every cell is the identity — the grid tiles the flyer exactly, so
  // nothing moves at p = 0 and the lift has no seam.
  const atRest = frameAt(0);
  const cellW = size.width / cols;
  const cellH = size.height / rows;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const origin = cellTopLeft(i, j);
      const local = { x: origin.x + cellW / 2, y: origin.y + cellH / 2 };
      const screen = atRest[j * cols + i];
      assert.ok(Math.abs(screen.x - (rest.x + local.x)) < 1e-9, `cell ${i},${j} moved at rest (x)`);
      assert.ok(Math.abs(screen.y - (rest.y + local.y)) < 1e-9, `cell ${i},${j} moved at rest (y)`);
    }
  }
  const restSpan = size.height - cellH;

  // Mid-fall: the near side is hauled further along the pull axis, so the
  // vertical span EXCEEDS the rest span — the spaghettification a flat affine
  // transform cannot express — and the midline bows toward the singularity
  // (the lensing: columns closer to the hole land higher than the edges).
  const mid = frameAt(0.35);
  const topMean = mid.slice(0, cols).reduce((n, c) => n + c.y, 0) / cols;
  const bottomMean = mid.slice((rows - 1) * cols).reduce((n, c) => n + c.y, 0) / cols;
  const midSpan = Math.abs(topMean - bottomMean);
  assert.ok(
    midSpan > restSpan * 1.15,
    `the word did not strand: ${midSpan.toFixed(1)}px vs rest ${restSpan.toFixed(1)}px`,
  );
  const colMeanY = (i: number) => {
    let sum = 0;
    for (let j = 0; j < rows; j += 1) sum += mid[j * cols + i].y;
    return sum / rows;
  };
  const centre = Math.floor(cols / 2);
  const edges = (colMeanY(0) + colMeanY(cols - 1)) / 2;
  assert.ok(edges - colMeanY(centre) > 4, `no lensing bow: ${(edges - colMeanY(centre)).toFixed(1)}px`);

  // Every cell ends ON the singularity — the collapse is geometric, never an
  // opacity fade.
  const end = frameAt(1);
  for (const cell of end) {
    const d = Math.hypot(cell.x - singularity.x, cell.y - singularity.y);
    assert.ok(d < 0.5, `a cell ended ${d.toFixed(2)}px from the singularity`);
  }
});
