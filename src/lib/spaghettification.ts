/* ============================================================================
   SPAGHETTIFICATION — the pure math of the sign-off's consumption.

   One playhead `p ∈ [0, 1]` — owned by the hold's single ScrollTrigger in
   `components/SignoffHorizon.tsx` — drives four things that must agree:

     1 · the sheet's layout collapse (`collapseAt`) — how much of the sign-off's
        own height has been eaten. The sheet stays in flow while the hold runs, so
        that is precisely how far the curtain below it rises: the distance from
        the sheet's hem to the end of the site never changes, and the floor tracks
        the void (`vacatedHeightAt` is that rate, written down once).

     2 · the live flyers' trajectory (`flyerFrameAt`) — the headline and the CTA
        are lifted out of document flow, translated onto the singularity's exact
        coordinates, stretched along the pull axis, squeezed across it and
        scaled to precisely zero.

     3 · the frozen frame's warp (`infallAt` / `tidalAt` / `swirlAt`, consumed by
        `three/eventHorizonWarp.ts`) — the shader remaps every fragment through
        the SAME field.

     4 · the playhead itself (`consumptionTarget` / `followPlayhead`) — a
        scroll-domain quantity, so the state of the whole scene is a function of
        where the reader IS, never of how long they took to get there.

   (2) and (3) are the same field evaluated two ways: per element on the CPU,
   per fragment on the GPU. That is deliberate. The live paint is exchanged for
   the frozen frame part-way through the fall (`overlayMixAt`), and a handoff
   between two different motion models would be visible as a jump. There is
   therefore no per-flyer stagger either — the shader cannot stagger, and the
   differentiation comes from geometry instead: each flyer sits at its own
   radius, so the tidal gradient bites each one at its own moment.

   Nothing here touches the DOM, GSAP or WebGL. The curves ARE the art
   direction, so they live as pure functions and are unit-tested on their own
   (`npm run test:unit`) — no browser, no GPU, no timing luck.
   ========================================================================== */

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Remap `p` from the window `[a, b]` onto `[0, 1]`, clamped at both ends. */
export const phase = (p: number, a: number, b: number): number =>
  b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a));

const finite = (...ns: number[]): boolean => ns.every((n) => Number.isFinite(n));

/* ---------------------------------------------------------------------------
   WHERE THE HOLD BEGINS — one art-directed composition, SOLVED not hoped for.

   The pin is not triggered by the black hole's own box but by the frame the
   reader is meant to be looking at when the screen locks: the WHOLE black hole
   container at the top of the viewport and the WHOLE "ENTER THE NEMOVERSE"
   headline at the bottom, with the CTA still below the fold.

   That is two containment conditions on one scroll position, and they are not
   independent: the composition is a column of three boxes in one viewport,

     frameTop ──`frameHeight`──▶ frameBottom ──`rise`──▶ titleBottom ──`air`──▶ fold
                                                             │
                                                        `belowTitle`
                                                             ▼
                                                          sheet hem

   so the hole fits if and only if `frameHeight + rise + air ≤ viewport`.
   Stating the trigger on the headline alone (as an earlier version did) only
   guarantees the SECOND condition — the hole's crown is then off the top of the
   screen at the exact moment the hold begins, which is not the reference
   framing, it is a crop of it. The honest fix is not a better predicate but a
   solved one: `rise` does not depend on the frame's height, so the frame's
   height is the free variable. `solveFraming` spends it. The container is cut
   down to the budget the composition leaves, and `parkedFrameTop` then lands on
   exactly 0 when the budget binds — the hole flush with the top of the screen,
   the headline flush with the bottom. The stage publishes that number as
   `--bh-frame-fit` (see `styles/blackhole.css`).

   Everything here is a pure function of measured document distances, because
   the composition is scroll-invariant.
--------------------------------------------------------------------------- */

/** Air left under the headline when the hold begins, as a fraction of the
 * viewport: 40px on the 720px-tall reference framing ≈ 5.5%. */
export const TITLE_AIR_RATIO = 0.055;

/** Never so tight that the headline kisses the fold on a short viewport. */
export const TITLE_AIR_MIN = 24;

/** Never so loose that the CTA climbs into view: 42px is the invitation's own
 * top margin (`.signoff__actions { margin-top: 2.6rem }`), so at this cap the
 * button's top edge sits exactly on the fold — still below it, as the reference
 * framing shows. */
export const TITLE_AIR_MAX = 42;

/** The resolved air under the headline for a given viewport height. */
export function titleAir(viewport: number): number {
  if (!Number.isFinite(viewport) || viewport <= 0) return TITLE_AIR_MIN;
  const air = viewport * TITLE_AIR_RATIO;
  return Math.round(Math.min(TITLE_AIR_MAX, Math.max(TITLE_AIR_MIN, air)));
}

/** The floor on `rise`: a headline sitting on top of the hole's bottom edge is
 * not a composition anyone can read, and there would be nothing between the two
 * boxes to measure the scene from. */
export const MIN_RISE = 24;

/** Below this the black hole is not a black hole any more, it is a smudge. A
 * viewport that cannot hold both boxes at this size gets the degraded framing
 * (and says so) rather than a disc nobody can read. */
export const MIN_FRAME_HEIGHT = 300;

/** Absolute floor, for viewports so short that even the degraded framing cannot
 * contain the container. The scene still runs; `framingHolds` reports that the
 * composition did not fit, instead of pretending it did. */
export const HARD_FRAME_FLOOR = 200;

/** What the reference composition leaves for the black hole's container. */
export function frameBudget(viewport: number, air: number, rise: number): number {
  return viewport - air - rise;
}

/** Whether ONE scroll position can hold both boxes whole: the container's top
 * edge at or below the top of the viewport, the headline's bottom edge at or
 * above the fold. This is the requirement, stated as a predicate — and after
 * `solveFraming` it is true by construction whenever the framing is not
 * degraded. */
export function framingHolds(
  viewport: number,
  air: number,
  rise: number,
  frameHeight: number,
): boolean {
  return finite(viewport, air, rise, frameHeight)
    && viewport > 0 && rise >= MIN_RISE && frameHeight > 0
    && frameHeight + rise <= viewport - air;
}

export interface FramingInput {
  viewport: number;
  /** The resolved air under the headline (`titleAir`). */
  air: number;
  /** The resolved `--bh-seam` (the degraded framing's own line). */
  seam: number;
  /** Frame bottom → headline bottom, in the document, at rest. */
  rise: number;
  /** The container's own responsive height, before the composition budgets it. */
  natural: number;
}

export interface Framing {
  /** The shared trigger line, as the headline's inset above the bottom of the
   * viewport. Negative in the degraded framing, where the headline has not
   * arrived yet when the hole takes hold. Rounded ONCE, here: the hold's line and
   * driven off this one number, and rounding each of their start strings
   * separately would let the two lines disagree by a sub-pixel of drift. */
  inset: number;
  /** The container height the composition can actually hold. */
  frameHeight: number;
  /** True when even `MIN_FRAME_HEIGHT` does not fit, i.e. the two containment
   * conditions cannot both be met and the hold starts on the frame's bottom
   * edge (hole-first) instead. */
  degraded: boolean;
}

/** Solve the reference framing: one trigger line AND the container height that
 * makes both boxes fit on it. The frame's height is the only free variable in
 * the composition, so it is the one that moves — `rise` is measured below the
 * frame and does not depend on it, which is what makes this a single pass
 * rather than a fixed-point iteration. */
export function solveFraming({ viewport, air, seam, rise, natural }: FramingInput): Framing {
  if (!finite(viewport, air, seam, rise, natural) || viewport <= 0 || rise < MIN_RISE) {
    // Unmeasurable: move nothing, and report that the composition did not hold.
    return { inset: Math.round(air), frameHeight: natural, degraded: true };
  }
  // The inset is rounded ONCE, here, and the budget is spent from the ROUNDED
  // number: the hold's line is driven off it, and the height is then floored
  // against what that line leaves, so `framingHolds` is true by construction
  // rather than up to half a pixel of rounding.
  const inset = Math.round(air);
  const budget = frameBudget(viewport, inset, rise);
  if (budget >= MIN_FRAME_HEIGHT) {
    // The reference framing holds: the headline's bottom edge `air` above the
    // fold, the whole container above it. Never GROW the stage — the budget is a
    // ceiling, not a target, and a containment ceiling is floored, not rounded.
    return { inset, frameHeight: Math.floor(Math.min(natural, budget)), degraded: false };
  }
  // The invitation block alone eats the screen: hole-first, with the frame's
  // bottom edge one seam above the fold — the same line stated on the headline,
  // so the hold still has one trigger element and one screen line. Negative,
  // because the headline has not arrived yet when the hold begins. The container
  // is still fitted, to whatever the viewport can hold of it.
  return {
    inset: Math.round(seam - rise),
    frameHeight: Math.round(Math.max(HARD_FRAME_FLOOR, Math.min(natural, viewport - seam))),
    degraded: true,
  };
}

/** The held frame's top edge in viewport px, for as long as the hold lasts.
 * Scroll-invariant, which is why the scene can be measured before the hold
 * engages: the trigger line parks the headline's bottom `inset` above the fold,
 * so the frame hangs exactly one composition (`frameHeight + rise`) above that
 * line. With the fitted frame height it is ≥ 0 in the reference framing — 0
 * exactly when the budget binds, i.e. the hole flush with the top of the screen,
 * which is the composition the hold is art-directed on. */
export function parkedFrameTop(
  viewport: number,
  inset: number,
  frameHeight: number,
  rise: number,
): number {
  return viewport - inset - frameHeight - rise;
}

/** Where the sheet's hem parks: `belowTitle` below the trigger line, which in
 * the reference framing is below the fold — the CTA is still off-screen when
 * the hold begins, as the reference framing shows it. */
export function parkedHem(viewport: number, inset: number, belowTitle: number): number {
  return viewport - inset + belowTitle;
}

/* ---------------------------------------------------------------------------
   THE HOLD — how the composition is locked to the viewport.

   Nothing here is `position: fixed` and there is no pin-spacer. A pinned box has
   to be paid for twice: once by the document (the scroll a hold consumes has to
   exist somewhere) and once by the layout (a box lifted out of flow leaves a hole
   where it used to sit). Every previous attempt paid both from INSIDE the
   picture — GSAP's `pinSpacing` writes the reservation as the padding of a spacer
   that replaces the black hole in the flow, i.e. in the seam between the hole and
   the sign-off — which produced three separate failures from one cause:

     · the reservation was itself the wide gap in the seam, and it was spent on
       the wrong side of the composition;
     · the two pins had to be offset against each other's reservation to share one
       screen line (`sheetStartOffset`), which is a handover, not a hold;
     · the pinned container carries an inline `height`/`max-height` that GSAP
       writes at swap-in, so the scene's own re-measurement of that container
       (its composition budget) disagreed with the box on screen, and the honest
       response — refuse the scene — tore the pin down before it could engage.

   The hold pays from OUTSIDE the picture instead. One element (`.bh-hold`, the
   last child of `<main>`, immediately above the singularity section) grows by
   exactly as many pixels as the reader has scrolled past the trigger line:

     · everything at or below it — the hole's container AND the sign-off sheet —
       is pushed down one pixel per scrolled pixel, which cancels the scroll
       exactly. The composition therefore has ONE constant viewport position for
       the whole hold: both boxes rigidly locked, and the distance between them
       (`rise`) untouched because they move together. That is "the parent
       container pinned to the viewport", realised without a pin.
     · nothing leaves the flow, so no box collapses, no element is re-parented
       (React owns its own tree throughout), and no library can write a size onto
       a box the scene measures.
     · the reservation is a pure function of the scroll and simply stops growing
       at the end of the span, so releasing is not a handover at all: the document
       is left `pinDistance` px longer — the same price `pinSpacing` charges — and
       the reader scrolls on from there. Scrolling back up spends it again in
       reverse, so the whole sequence is reversible with no state to unwind.

   `SPACER_PAD` (below, in the curtain compensation) rides on the reservation, so
   the curtain's bright floor is left one pixel below the sheet's hem for the whole
   fall rather than butting against it.
--------------------------------------------------------------------------- */

/** The px the hold has taken out of the document at `scroll`: `SPACER_PAD`
 * before the trigger line and `span` + `SPACER_PAD` past it, one pixel per
 * scrolled pixel in between. Read from the RAW scroll, never from the smoothed
 * playhead: the document then grows by exactly one pixel per scrolled pixel and a
 * fling can never arrive at a page shorter than its own scroll position.
 *
 * Two floor effects the caller has to respect, both measured in Chromium rather
 * than assumed:
 *
 *  · A document's scroll offsets are integers. A box grown by a FRACTION of a
 *    pixel (0.59582px, the honest number for the 0.6px of scroll a wheel step
 *    moves) reports its `getBoundingClientRect().height` as 1, while
 *    `scrollHeight`/`scrollTop` floor to 0 — so the layout moves the composition
 *    by a whole pixel while the document's length does not, and the reader's
 *    scroll gets clamped back by 1px per frame: a hold that grows slower than the
 *    reader scrolls, i.e. one that leaks. Rounding to whole CSS pixels is what
 *    keeps layout and scroll offset in the same unit.
 *  · Scroll anchoring must be off while the reservation is growing. It exists to
 *    keep content still by moving the scroll by the same amount the layout moved
 *    it, which is precisely the cancellation a hold made of layout cannot
 *    survive: measured, the page snapped back to the top of the span on the frame
 *    after the first push. See `setAnchoring` in components/SignoffHorizon.tsx. */
export function holdDistanceAt(scroll: number, start: number, span: number): number {
  return Math.min(Math.max(scroll - start, 0), Math.max(0, span)) + SPACER_PAD;
}

/** Whether the composition is locked at `scroll`. Past the end of the span the
 * reservation stays spent and the page scrolls on, so the release is the frame
 * where this stops being true — and the playhead has been held at 1 for the whole
 * `settle` margin before it, which is what makes "let go only once the hole has
 * finished eating" a property of the geometry rather than of scroll speed. */
export function holdActiveAt(scroll: number, start: number, span: number): boolean {
  const travelled = Math.min(Math.max(scroll - start, 0), Math.max(0, span));
  return travelled > 0 && travelled < span;
}

/* ---------------------------------------------------------------------------
   THE PLAYHEAD — a scroll-domain quantity.

   An earlier version scrubbed the consumption with `gsap`'s `scrub: 0.6`, i.e.
   a TWEEN IN TIME toward the scroll's progress. That is the wrong clock for a
   sequence whose hold must not let go before the timeline finishes: a scrub tween
   needs up to 600ms of wall clock to arrive, while a ScrollTrigger releases on
   the scroll pixel where `progress === 1`. On any fast arrival (a fling, a
   scrollbar drag, a PageDown) the hold therefore let go with the consumption still
   in flight, and the last of the fall played out on a released layout that was
   already scrolling away.

   The playhead here is instead a pure function of the scroll position, with
   smoothing expressed in SCROLLED PIXELS:

     · `consumptionTarget` maps the hold's own progress onto the consumption. The
       span is `run + settle`; the consumption occupies the first `run`, so the
       target reaches 1 while the screen is still locked.
     · `followPlayhead` rate-limits the written playhead toward that target. It
       is exact at both ends: a jump bigger than the smoothing distance lands on
       the target in one step, and the settle margin is by construction longer
       than the smoothing distance, so the playhead is provably 1 before the hold
       lets go.

   Two consequences worth keeping: the scene is deterministic (the same scroll
   position always paints the same frame, which is what makes it testable), and
   nothing continues to move after the scroll stops, so no state can be left
   half-applied when the hold lets go.
--------------------------------------------------------------------------- */

/** Smoothing, in scrolled pixels: how far the written playhead may trail the
 * scroll. Small enough to keep wheel steps soft, large enough that the settle
 * margin below can pay for it with room to spare. */
export const PLAYHEAD_SMOOTH_PX = 90;

/** The same smoothing in the time domain, per animation frame: the tail that
 * finishes the job when the reader STOPS scrolling with a residual (scrolling
 * back up out of the hold, in particular, where there is no settle margin left
 * to converge in). Rate-limited rather than exponential, so it lands exactly and
 * always stops. */
export const PLAYHEAD_SMOOTH_FRAME = 1 / 12;

/** The consumption's own scroll distance: the fall needs a minimum run to read
 * as a fall rather than a cut, and otherwise scales with what is being eaten. */
export const MIN_SHEET_RUN = 300;
export const SHEET_RUN_RATIO = 1.15;

export function runDistance(sheetHeight: number): number {
  return Math.max(MIN_SHEET_RUN, Math.round(Math.max(0, sheetHeight) * SHEET_RUN_RATIO));
}

/** The release margin: scroll distance past the end of the consumption during
 * which the composition is still locked to the viewport. It exists for ONE
 * reason — to make "let go after the timeline finishes" a property of the geometry
 * rather than of the reader's scroll speed — and it must therefore be at least
 * the smoothing distance. */
export const SETTLE_MIN = 120;
export const SETTLE_FACTOR = 1.5;

export function settleDistance(): number {
  return Math.max(SETTLE_MIN, Math.round(PLAYHEAD_SMOOTH_PX * SETTLE_FACTOR));
}

export interface PinSpan {
  /** The consumption's scroll distance. */
  run: number;
  /** The release margin after it. */
  settle: number;
  /** The span of the whole hold: one line in, one pixel out, nothing between. */
  total: number;
  /** The hold progress at which the consumption is complete. */
  share: number;
}

export function pinSpan(sheetHeight: number): PinSpan {
  const run = runDistance(sheetHeight);
  const settle = settleDistance();
  return { run, settle, total: run + settle, share: run / (run + settle) };
}

/** The consumption playhead a hold progress asks for. Exact: 0 at the trigger's
 * start, 1 at `share`, and held at 1 across the settle margin. */
export function consumptionTarget(triggerProgress: number, share: number): number {
  if (!(share > 0)) return clamp01(triggerProgress);
  return clamp01(triggerProgress / share);
}

/** Advance the written playhead toward the target by no more than the scroll
 * moved (in smoothing distances) or one frame of the time-domain tail, whichever
 * is more. Lands exactly on the target whenever the scroll jumped further than
 * the smoothing distance, which is what makes a programmatic or scrollbar jump
 * deterministic instead of animated. */
export function followPlayhead(current: number, target: number, scrollDelta: number): number {
  const to = clamp01(target);
  const from = clamp01(current);
  const gap = to - from;
  if (gap === 0) return to;
  const delta = Number.isFinite(scrollDelta) ? Math.abs(scrollDelta) : 0;
  const step = Math.max(delta / PLAYHEAD_SMOOTH_PX, PLAYHEAD_SMOOTH_FRAME);
  return Math.abs(gap) <= step ? to : from + Math.sign(gap) * step;
}

/* ---------------------------------------------------------------------------
   The infall — the global pull toward the singularity.

   The frozen frame implements this as a radial remap: a fragment at radius `r`
   samples the source at `r · (1 + infall(p) + tidal)`. The matching live-DOM
   motion is therefore `r(p) = r0 · contraction(p)` with
   `contraction = 1 / (1 + infall)`, and the two are the same number read two
   ways.

   `contractionAt` is the primitive, because it is the one that has to be exact
   at the ends: it is 1 at p = 0 and **exactly 0** at p = 1, with no pole to
   divide by and no infinity anywhere in the fall. That is what "crosses the
   event horizon" means for the live elements — the flyer's centre lands on the
   singularity's coordinates and its scale lands on zero, on the same frame. An
   earlier version put the pole at 1/0.9, which stopped the fall at 92% of the
   distance and 8% of the size, and then removed the elements with an opacity
   fade instead of with the geometry.

   `infallAt` is `1/contraction − 1`: finite everywhere on [0, 1) and `Infinity`
   at exactly p = 1, which is honest — the pull does diverge at the horizon. No
   consumer divides by it. The GPU is handed `shaderInfallAt`, the same value
   floored so a driver never has to multiply `0 × inf` at the anchor fragment;
   the floor is 1e-6 of a contraction, i.e. two ten-thousandths of a pixel on a
   200px headline, and at p = 1 the capture radius has already swallowed every
   texel of the overlay anyway.
--------------------------------------------------------------------------- */
export const INFALL_GAIN = 1.15;
export const INFALL_EASE = 1.35;

/** The fraction of its rest distance a fragment keeps at `p`: 1 at rest, 0 at
 * the singularity. */
export function contractionAt(progress: number): number {
  const q = 1 - clamp01(progress);
  const pull = INFALL_GAIN * Math.pow(1 - q, INFALL_EASE);
  const sum = q + pull;
  return sum > 0 ? q / sum : 0;
}

/** The shader's global infall term. `Infinity` at exactly p = 1. */
export function infallAt(progress: number): number {
  const contraction = contractionAt(progress);
  return contraction > 0 ? 1 / contraction - 1 : Infinity;
}

/** What the GPU is given: the same term, floored. `MAX_GL_INFALL` is a numeric
 * guard for the fragment shader, not an art-direction knob. */
export const MAX_GL_INFALL = 1e6;

export function shaderInfallAt(progress: number): number {
  return Math.min(infallAt(progress), MAX_GL_INFALL);
}

/** The fraction of the way to the singularity that the infall has carried a
 * flyer at rest: `r0 → r0 · (1 − fallAt(p))`. Exactly 1 at p = 1. */
export function fallAt(progress: number): number {
  return 1 - contractionAt(progress);
}

/* ---------------------------------------------------------------------------
   The tidal field — the gradient of the pull, which is what actually
   spaghettifies.

   The near side of an object is accelerated harder than the far side, so it
   elongates along the pull axis and squeezes across it. The gradient of an
   inverse-square force falls off as the inverse cube, so the term is local by
   nature: it only bites once a flyer is close to the horizon, which is exactly
   when it should start to strand. `TIDAL_FALLOFF` sits between the two, which
   is the artistic licence in this file — 1/r³ strands nothing until the very
   last frame, and 1/r drags the whole page at once.

   Evaluated in screen pixels against the CURRENT horizon radius, which grows
   with the playhead, so one function serves both the shader's per-fragment
   remap and the flyer's per-element stretch.
--------------------------------------------------------------------------- */
export const TIDAL_GAIN = 2.4;
export const TIDAL_FALLOFF = 1.5;
export const TIDAL_CAP = 0.96; // a fragment is never remapped past the singularity

/** The playhead-scaled tidal gain, i.e. the shader's `uTidal`: the value that
 * gets multiplied by `(horizon / radius)^TIDAL_FALLOFF`. */
export function tidalGainAt(progress: number): number {
  return TIDAL_GAIN * clamp01(progress);
}

export function tidalAt(radius: number, horizonRadius: number, progress: number): number {
  if (!(radius > 0) || !(horizonRadius > 0)) return 0;
  const raw = tidalGainAt(progress) * Math.pow(horizonRadius / radius, TIDAL_FALLOFF);
  return Math.min(TIDAL_CAP, raw);
}

/* ---------------------------------------------------------------------------
   Frame dragging. The flow around a rotating horizon is not radial: light that
   grazes it is dragged around. One value, in turns, shared by the shader's
   tangential remap and the flyer's residual rotation so the two spiral the
   same way.
--------------------------------------------------------------------------- */
export const SWIRL_TURNS = 0.47;

export function swirlAt(progress: number): number {
  return SWIRL_TURNS * Math.pow(clamp01(progress), 1.5);
}

/* ---------------------------------------------------------------------------
   The sheet's collapse — requirement 4's compensating quantity.

   It leads the playhead slightly and finishes slightly early: the void is gone
   (and the curtain fully paid back) before the last of the light falls in, so
   the hold releases onto a settled layout instead of a moving one.
--------------------------------------------------------------------------- */
export const COLLAPSE_LEAD = 0.06;
export const COLLAPSE_TAIL = 0.94;
export const COLLAPSE_EASE = 1.45;

/** The fraction of the sign-off's rest height that has been consumed. */
export function collapseAt(progress: number): number {
  return Math.pow(phase(progress, COLLAPSE_LEAD, COLLAPSE_TAIL), COLLAPSE_EASE);
}

/** The height the consumption has taken out of the layout, in px. This is the
 * quantity the curtain footer has to rise by: not "whatever the scroll did", but
 * exactly the space the void is vacating, at the rate the timeline vacates it. */
export function vacatedHeightAt(progress: number, collapsible: number): number {
  return Math.max(0, collapsible) * collapseAt(progress);
}

/** The sign-off's live layout height at `progress`. `collapsible` is the part
 * of the rest height the document can afford to lose (see below); it equals the
 * rest height on any layout whose curtain is tall enough to pay for the whole
 * fall, which is the normal case. */
export function sheetHeightAt(progress: number, restHeight: number, collapsible = restHeight): number {
  return restHeight - vacatedHeightAt(progress, collapsible);
}

/* ---------------------------------------------------------------------------
   The curtain's compensation — requirement 4, as a closed form.

   The void the sign-off leaves must NOT collapse on its own: the consumed flyers
   are lifted out of flow and moved by transforms, which cost the layout nothing,
   and the sheet's own box is written every frame from `sheetHeightAt`. Under the
   hold (see `holdDistanceAt`) the sheet stays in flow, so the curtain below it
   moves by exactly what the sheet gives up — nothing else has to be paid back,
   and nothing has to be taken from the reader. Three things still have to hold at
   once, and together they pin the behaviour down exactly:

   · TRACKED. The curtain's paint window opens at the stage's top inset by
     `--curtain-travel`, and the stage follows the sheet in flow. The sheet's
     on-screen top is constant for the whole hold (that is what the reservation
     buys) and its box is `sheetHeightAt(p)`, so the hem — and with it the floor,
     `SPACER_PAD` below it — rises by exactly `vacatedHeightAt(p)`: the height the
     consumption has vacated, at the rate the consumption vacates it, and by
     nothing else. That is "linked strictly to the consumption timeline".

   · NEVER SHORT. The reservation is read from the RAW scroll, not from the
     smoothed playhead, so the document grows by exactly one pixel per scrolled
     pixel and a fling can never arrive at a page shorter than its own scroll
     position. The visible collapse follows the playhead, and because the
     reservation cancels the scroll for EVERY box below it, the hem/window identity
     above holds at any lag between the two clocks — a lag can never open a gap
     under the sheet, and can never pinch the floor into it either.

   · AFFORDABLE. Emptying the sheet removes height from the document while the
     hold adds only `pinDistance` back, and what is left must still be scrollable
     when the hold lets go, or the release lands on a clamped document, the
     playhead snaps back and the sheet un-collapses in one frame. With
     `slack = tail − hemInset + PAD − consumed`, the allowance is
     `collapsibleHeight` — the whole sheet on any layout whose curtain is tall
     enough, and the last few percent of the collapse on one that is not.
     Degrading the collapse is the honest fallback: borrowing scroll from the
     reader is not.
--------------------------------------------------------------------------- */
export const SPACER_PAD = 1;

/** Scroll that must still exist once the hold releases. */
export const MIN_RELEASE_SLACK = 24;

/** Scroll left at the end of the consumption, before the compensation spends
 * any of it: the curtain's own height, adjusted for where the sheet's hem parks.
 *
 * `hemInset` is the hem's distance above the bottom of the viewport for as long
 * as the hold runs — positive when it parks above the fold, NEGATIVE when the
 * reference framing leaves it below it (the CTA still off-screen at the
 * trigger), which is scroll the curtain gets to rise into for free. */
export function curtainSlack(tail: number, hemInset: number): number {
  return tail - hemInset + SPACER_PAD;
}

/** How much of the sheet's rest height the document can afford to lose. */
export function collapsibleHeight(restHeight: number, tail: number, hemInset: number): number {
  return Math.max(0, Math.min(restHeight, curtainSlack(tail, hemInset) - MIN_RELEASE_SLACK));
}

/** The hold's two clocks, side by side, as document px. The reservation is what
 * the document GAINS while the hold runs (raw scroll, via `holdDistanceAt`) and
 * `flowGivenUp` is what the composition GIVES UP over the same span (playhead,
 * via `vacatedHeightAt`). The difference is the document's net change, and the
 * one property that has to hold for the release to land on a scrollable page is
 * that it is never negative — with `run + settle` always longer than the sheet is
 * tall, it cannot be. Everything visible is on the other side of that difference:
 * the hem, the floor and the flyers all move by `flowGivenUp` alone, which is
 * why a playhead that lags the scroll cannot open or pinch a seam. */
export function holdBudgetAt(
  scroll: number,
  start: number,
  pinDistance: number,
  progress: number,
  restHeight: number,
  collapsible: number,
): { reservation: number; flowGivenUp: number; documentGrowth: number } {
  const reservation = holdDistanceAt(scroll, start, pinDistance) - SPACER_PAD;
  const flowGivenUp = Math.max(0, restHeight) - sheetHeightAt(progress, restHeight, collapsible);
  return { reservation, flowGivenUp, documentGrowth: reservation - flowGivenUp };
}

/* ---------------------------------------------------------------------------
   The paint crossfade: live DOM out, frozen frame in.

   This is an EXCHANGE between two paints of the same glyphs in the same field,
   never a fade-out: the snapshot holds ONLY the two flyers (the sheet's own
   background stays in the live DOM, so the collapsing hem is never painted
   twice and the curtain meets a real edge). It is also conditional — the caller
   only writes it once the frozen frame is actually attached and drawing. Before
   that (the capture is still running, or the overlay could not be created) the
   live flyers carry the whole fall on their own geometry: they translate onto
   the singularity and scale to zero with no help from an alpha channel. An
   earlier version wrote the mix unconditionally, so a reader who outran the
   capture watched the headline and the CTA simply fade out — the exact "basic
   opacity fade" this sequence is not supposed to contain.

   The mix completes early, while the two layers still agree to within a few
   pixels, and the frozen frame carries the plunge. The real links never leave
   the accessibility tree or the tab order — only their paint is exchanged, and
   focus restores it at any progress.
--------------------------------------------------------------------------- */
export const MIX_START = 0.28;
export const MIX_END = 0.48;

export function overlayMixAt(progress: number): number {
  const t = phase(progress, MIX_START, MIX_END);
  return t * t * (3 - 2 * t); // smoothstep: no visible seam at either end
}

/* ---------------------------------------------------------------------------
   The event horizon.

   `EFFECTIVE_HORIZON_RADIUS_PX` is the ONE art-direction knob of the frozen
   frame: a screen-space seed radius that the scroll curve expands to the
   farthest measured corner of the overlay, so progress = 1 consumes every texel
   at every footer size. It never touches the mass, the lensing gain or the step
   size — the vendored physics below the horizon is unchanged by it.

   The exponent of the growth curve is the tuning knob that decides whether the
   flyers read as a *drop then snap* (a late, quartic close) or as a real
   spaghettification (a field that reaches them while they are still large
   enough to strand). The earlier quartic growth (`p⁴`) held the horizon small
   for the first half of the fall, so the two flyers — which sit only ~34px and
   ~120px from the singularity — spent their whole visible, still-opaque phase
   far outside the tidal gradient and contracted nearly isotropically: the
   texture warped late, after the live paint had already handed over, and the
   sequence read as shrink-and-fade. Cubic growth (`p³`) arrived earlier but
   still not early enough: the anisotropy peaked after the live layer had faded.
   The current exponent (≈ quadratic, tuned with `TIDAL_GAIN` / `TIDAL_FALLOFF`)
   brings the field to the near flyer while the live glyph is still half-visible,
   so the stretch reads as a live event instead of a postcard. The capture
   threshold still swallows every texel at progress = 1; only the *timing* of
   the field's arrival changes.
--------------------------------------------------------------------------- */
export const EFFECTIVE_HORIZON_RADIUS_PX = 26;

/** The exponent of the horizon's growth curve. The one knob that decides whether
 * the flyers read as a *drop then snap* (a late, quartic close) or as a real
 * spaghettification (a field that reaches them while they are still large enough
 * to strand). It is tuned together with `TIDAL_GAIN` / `TIDAL_FALLOFF` so the
 * dramatic anisotropy lands INSIDE the still-opaque window: the paint crossfade
 * hands the live text to the frozen frame at `MIX_END`, and the ratio
 * `along / across` has to reach ~1.3 while the live layer is still half-visible
 * (opacity ≥ 0.5), not after it has faded out. The earlier cubic growth (`p³`)
 * arrived at the nearest flyer too late — the interesting stretch happened after
 * the reader stopped watching the live glyphs. The tuned value (≈ quadratic)
 * reaches the ~34px CTA by the time the crossfade is a third through, so the
 * stretch is a live, readable event. The capture threshold still swallows every
 * texel at progress = 1; only the *timing* of the field's arrival changes. */
export const HORIZON_GROWTH_EXPONENT = 2.4;

/** The overlay covers the sheet plus `veil` px of the seam above it, so the
 * horizon has to reach the farthest corner of THAT box, not of the sheet. */
export interface HorizonExtent {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  veil: number;
}

export function coverRadius(extent: HorizonExtent): number {
  const { width, height, anchorX, anchorY, veil } = extent;
  const cx = anchorX;
  const cy = anchorY + veil; // the singularity, in overlay coordinates
  const bottom = height + veil;
  return Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, bottom - cy),
    Math.hypot(width - cx, bottom - cy),
  );
}

export function horizonRadiusAtProgress(progress: number, extent: HorizonExtent): number {
  const p = clamp01(progress);
  const cover = Math.max(EFFECTIVE_HORIZON_RADIUS_PX, coverRadius(extent));
  const growth = Math.pow(p, HORIZON_GROWTH_EXPONENT);
  return p * (EFFECTIVE_HORIZON_RADIUS_PX + (cover - EFFECTIVE_HORIZON_RADIUS_PX) * growth);
}

/* ---------------------------------------------------------------------------
   The physical response — the black hole reacting to what it eats.

   `flatSimulationConfig` is a STATIC file: `BlackHoleStage` reads the vendored
   mass, lensing gain, Doppler exponent and disk rotation speed once and never
   changes them, so the hole looks the same whether it is about to eat the
   invitation or has finished. This section makes a subset of those parameters
   respond to the SAME consumption playhead that drives the warp — one clock,
   never a second — so the hole reads as a body that notices the bodies falling
   into it.

   These are pure functions of `p` that return EXCURSIONS (relative offsets from
   the baseline in `flatSimulationConfig`), never absolute values: the caller
   multiplies the vendored baseline by `(1 + excursion)` and flattens back to
   the baseline when the hold is not engaged. Two properties are demanded:

   · SMALL. Every excursion is a few percent, eased in and out, so the hole
     moves but never jumps, and the sequence stays readable.
   · RETURNS. At `p = 0` and at `p = 1` every excursion is exactly 0, so a
     page that reuses this simulation instance after the hold is over sees the
     unaltered static config. (The release happens at `p = 1`, so "by release"
     is satisfied by construction.)

   The timing is tied to the per-element crossing order: each flyer is a body
   the hole has just swallowed, and each swallow is one bite. The nearest flyer
   (the CTA) bites first, at `BITE_CENTRES[0]`; the far one (the headline) bites
   second, at `BITE_CENTRES[1]`. A sum of two eased pulses — one per bite — reads
   as "it just ate something" better than a flat ramp, and both have decayed to
   nothing by the end of the consumption.
--------------------------------------------------------------------------- */

/** The playhead values of the two crossings, nearest flyer first. Measured off
 * the reference scene with the current horizon growth, where the CTA (nearest,
 * ~34px) crosses at p≈0.383 and the headline (~120px) at p≈0.525. The bite is
 * centred a hair past its crossing, so the reaction lands as the body goes in
 * rather than just before it. Art direction, not a constant from the shader. */
export const BITE_CENTRES = [0.39, 0.53];

/** Half-width of each bite's eased pulse, in playhead units. Narrow enough to
 * read as an event, wide enough not to flicker at a frame's duration, and small
 * enough that the two windows stay separate — a clear trough between the
 * swallows, not one merged hump. */
export const BITE_WIDTH = 0.11;

/** Peak relative excursion per bite, as a fraction of the baseline. */
export const MASS_BITE = 0.2; // +20% Schwarzschild mass → horizon grows
export const LENSING_BITE = 0.14; // +14% bending
export const DOPPLER_BITE = 0.22; // +22% Doppler boosting
export const ROTATION_BITE = 0.28; // +28% disk rotation speed

/** A smooth raised pulse centred at `centre`: 0 at both edges of the window and
 * 1 at its centre, eased in and out with a smoothstep so neither end sticks. */
export function bitePulseAt(progress: number, centre: number, width = BITE_WIDTH): number {
  const rise = phase(progress, centre - width, centre);
  const fall = 1 - phase(progress, centre, centre + width);
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return Math.max(0, smooth(rise) * smooth(fall));
}

export interface ConsumptionResponse {
  /** Relative excursion of `blackHoleMass` (and with it the horizon radius). */
  mass: number;
  /** Relative excursion of `gravitationalLensing`. */
  lensing: number;
  /** Relative excursion of `dopplerStrength`. */
  doppler: number;
  /** Relative excursion of `diskRotationSpeed`. */
  rotation: number;
}

/** The physical excursion at `progress`, as relative offsets from the baseline
 * config. Exactly 0 at both ends of the consumption; a small, eased pair of
 * bumps (one per swallowed body) in between. */
export function consumptionResponseAt(progress: number): ConsumptionResponse {
  const bites = Math.min(
    1,
    bitePulseAt(progress, BITE_CENTRES[0]) + bitePulseAt(progress, BITE_CENTRES[1]),
  );
  return {
    mass: MASS_BITE * bites,
    lensing: LENSING_BITE * bites,
    doppler: DOPPLER_BITE * bites,
    rotation: ROTATION_BITE * bites,
  };
}

/* ---------------------------------------------------------------------------
   The flyers.
--------------------------------------------------------------------------- */
export type FlyerId = 'invite' | 'cta';

/** The order the flyers are written to each frame: the headline, then the CTA
 * below it. Painting order is CSS's business, not this array's. */
export const FLYER_IDS: FlyerId[] = ['invite', 'cta'];

/** A flyer has crossed once the horizon has grown past this fraction of its
 * current radius. Crossing retires its hit target; its paint is retired by its
 * own scale, which reaches zero at p = 1 (and is already far below a pixel by
 * the time it crosses).
 *
 * This is a fraction of the CURRENT (contracted) radius, not a fixed pixel
 * distance, so it is the one crossing knob that is safe to tune alongside the
 * horizon's growth exponent: with the earlier horizon growth (2.4) the field
 * swallows the nearest flyer geometrically well before the paint handoff, and a
 * flyer with the old 0.70 threshold would have its hit target retired while it
 * was still painted. Lowering the threshold to 0.50 keeps a flyer's hit target
 * alive until it is genuinely inside the horizon — farther in than `0.70 · R`
 * — so the geometry-only consumption still retires it in order of distance and
 * *after* the paint exchange, which is the property the crossing test pins. */
export const CROSSING = 0.5;

/** The most a flyer may be stretched along the pull axis. A strand, not a
 * balloon: with the field as written the slope never gets small enough for this
 * to bind, so it is a guard against a degenerate radius rather than a look. An
 * earlier version's degenerate branch multiplied the element by 50 — a uniform
 * bloat, and the one thing spaghettification is not. */
export const MAX_ALONG = 24;

/** Below this, `1/slope` is not a meaningful stretch. */
export const SLOPE_FLOOR = 1 / MAX_ALONG;

export interface FlyerFrame {
  /** Fraction of the distance to the singularity covered so far. Exactly 1 at
   * p = 1. */
  fall: number;
  /** Translation toward the singularity, in viewport px. At p = 1 this is
   * exactly `(singularity − rest)`, on both axes: the flyer's centre is on the
   * hole's centre. */
  x: number;
  y: number;
  /** Scale along the pull axis: tidal stretch × the contraction into the point.
   * Exactly 0 at p = 1. */
  along: number;
  /** Scale across the pull axis: lateral squeeze × the same contraction.
   * Exactly 0 at p = 1. */
  across: number;
  /** Screen degrees (y down) of the pull axis, plus frame dragging. This is the
   * direction `along` stretches in. */
  rotation: number;
  /** The live layer's share of the paint, for the exchange with the frozen
   * frame. Only written while the frozen frame is attached and drawing — see
   * `overlayMixAt`. */
  opacity: number;
  /** Past the event horizon: retire the hit target, the shader has the remains. */
  consumed: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** `rest` is the flyer's centre in viewport px, measured while the hold runs;
 * `singularity` is the hole's centre in the same coordinates; `horizonRadius` is
 * the current effective horizon in px. Everything else is a pure function of the
 * playhead and of those three numbers. */
export function flyerFrameAt(
  progress: number,
  rest: Point,
  singularity: Point,
  horizonRadius: number,
): FlyerFrame {
  const p = clamp01(progress);
  const dx = singularity.x - rest.x;
  const dy = singularity.y - rest.y;
  const restRadius = Math.hypot(dx, dy) || 1;

  const contraction = contractionAt(p);
  const radius = restRadius * contraction;
  const tidal = tidalAt(radius, horizonRadius, p);

  // The remap a fragment at `radius` came through: source(r) = r·(1 + I + T(r)),
  // with 1 + I = 1/contraction. So the image's radial magnification is 1/f'(r)
  // and its tangential magnification is r/f(r):
  //     across = r / f(r)      = c / (1 + T·c)
  //     along  = 1 / f'(r)     = c / (1 + T·c·(1 − k))
  // T falls off as r^-k, so r·T'(r) = −k·T while the term is unsaturated — that
  // minus sign IS the spaghettification: the radial axis stretches relative to
  // the tangential one, and both contract to zero at the horizon. Written in
  // terms of `c` so that p = 1 evaluates to exactly 0 on both axes instead of
  // dividing an infinity by an infinity.
  const across = contraction / (1 + tidal * contraction);
  const slope = 1 + tidal * contraction * (1 - TIDAL_FALLOFF);
  const along = slope > SLOPE_FLOOR ? Math.min(contraction / slope, MAX_ALONG) : MAX_ALONG;

  // The pull axis, plus the same frame dragging the shader applies to the
  // remapped source. `rotate(θ) · scale(along, across) · rotate(−θ)` is an
  // anisotropic scale whose stretched eigenvector is the direction at θ, so θ is
  // the pull direction itself in screen degrees (y down) — the same orientation,
  // and the same sign, as the shader's rotation matrix.
  const axis = (Math.atan2(dy, dx) * 180) / Math.PI;
  const drag = (tidal * swirlAt(p) * 360) % 360;
  const fall = 1 - contraction;

  return {
    fall,
    x: dx * fall,
    y: dy * fall,
    along,
    across,
    rotation: axis + drag,
    opacity: 1 - overlayMixAt(p),
    consumed: radius <= horizonRadius * CROSSING,
  };
}

/** The `transform` string for a flyer frame: an anisotropic scale about the
 * element's own centre, aligned to the pull axis. Written out longhand because
 * `scale(a, b)` alone cannot scale along an arbitrary axis. A zero scale is
 * written as `0` and not as `0.00000` so the last frame of the fall is exactly
 * the degenerate matrix it is meant to be. */
export function flyerTransform(frame: FlyerFrame): string {
  const { x, y, rotation, along, across } = frame;
  return (
    `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) ` +
    `rotate(${rotation.toFixed(3)}deg) ` +
    `scale(${along.toFixed(5)}, ${across.toFixed(5)}) ` +
    `rotate(${(-rotation).toFixed(3)}deg)`
  );
}

/* ---------------------------------------------------------------------------
   Strands — one flyer is many independently-falling pieces.

   A single affine transform on a bounding box can only ever look like a
   skewed rectangle. Real tidal stretch that reads as cinematic decomposes the
   object: each glyph (or button slice) is evaluated in the SAME field at its
   own rest position, with a small playhead lag for pieces that sit farther
   from the singularity, so the object visibly elongates into a thread.
--------------------------------------------------------------------------- */

/** Playhead lag, in units of p, per pixel of extra rest-radius versus the
 * flyer's centre. Far-side glyphs trail; near-side glyphs lead. Capped so a
 * 240px headline cannot desync by more than a tenth of the fall. */
export const STRAND_LAG_PER_PX = 0.0012;
export const STRAND_LAG_CAP = 0.14;

/** Default slice counts when the caller does not pass measured glyph boxes. */
export const INVITE_STRANDS = 18;
export const CTA_STRANDS = 12;

export interface StrandSpec {
  /** Piece centre in the same coordinate space as `rest` / `singularity`. */
  rest: Point;
}

/** Playhead lag for a piece whose rest is `piece` relative to the flyer's
 * own rest centre. Nearer-to-singularity pieces lead (negative lag, clamped
 * so they never run before p = 0 in a way that changes rest); farther pieces
 * trail. */
export function strandLagAt(piece: Point, flyerRest: Point, singularity: Point): number {
  const pieceR = Math.hypot(singularity.x - piece.x, singularity.y - piece.y);
  const flyerR = Math.hypot(singularity.x - flyerRest.x, singularity.y - flyerRest.y) || 1;
  const extra = pieceR - flyerR;
  const lag = extra * STRAND_LAG_PER_PX;
  if (lag > STRAND_LAG_CAP) return STRAND_LAG_CAP;
  if (lag < -STRAND_LAG_CAP) return -STRAND_LAG_CAP;
  return lag;
}

/** The field at one strand piece. Identical to `flyerFrameAt` except the
 * playhead is shifted by that piece's lag, so the object opens into a thread
 * instead of remaining a rigid box. Opacity / consumed still follow the
 * un-lagged playhead so the parent flyer exchanges paint and retires its hit
 * target as one body. */
export function strandPieceAt(
  progress: number,
  piece: Point,
  flyerRest: Point,
  singularity: Point,
  horizonRadius: number,
): FlyerFrame {
  const lag = strandLagAt(piece, flyerRest, singularity);
  const p = clamp01(progress);
  const warped = flyerFrameAt(clamp01(p - lag), piece, singularity, horizonRadius);
  const envelope = flyerFrameAt(p, flyerRest, singularity, horizonRadius);
  return {
    ...warped,
    opacity: envelope.opacity,
    consumed: envelope.consumed,
  };
}

/** Evenly spaced piece centres across a flyer box, along the axis perpendicular
 * to the pull (so a vertical pull strands the headline left-to-right into a
 * vertical thread). `count` is the number of pieces. */
export function strandRests(
  flyerRest: Point,
  singularity: Point,
  size: { width: number; height: number },
  count: number,
): Point[] {
  const n = Math.max(1, Math.floor(count));
  const dx = singularity.x - flyerRest.x;
  const dy = singularity.y - flyerRest.y;
  const len = Math.hypot(dx, dy) || 1;
  // Unit vector across the pull (screen-space, 90°).
  const ax = -dy / len;
  const ay = dx / len;
  const span = Math.abs(ax) * size.width + Math.abs(ay) * size.height;
  const half = span / 2;
  if (n === 1) return [{ x: flyerRest.x, y: flyerRest.y }];
  const rests: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // −1 … +1
    const dist = t * half * 0.92; // stay inside the painted box
    rests.push({ x: flyerRest.x + ax * dist, y: flyerRest.y + ay * dist });
  }
  return rests;
}

export function strandFramesAt(
  progress: number,
  flyerRest: Point,
  singularity: Point,
  horizonRadius: number,
  size: { width: number; height: number },
  count: number,
): FlyerFrame[] {
  return strandRests(flyerRest, singularity, size, count).map((piece) =>
    strandPieceAt(progress, piece, flyerRest, singularity, horizonRadius),
  );
}
