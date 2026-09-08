/* ============================================================================
   SPAGHETTIFICATION — the pure math of the sign-off's consumption.

   One playhead `p ∈ [0, 1]` — owned by the two pinned ScrollTriggers in
   `components/SignoffHorizon.tsx` — drives four things that must agree:

     1 · the sheet's layout collapse (`collapseAt`) — how much of the sign-off's
        own height has been eaten. Its pin-spacer gives that height back to the
        document at the same rate, so the distance from the sheet's hem to the
        end of the site never changes and the curtain footer rises exactly as
        fast as the void is vacating (`vacatedHeightAt` is that rate, written
        down once).

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
 * pins to measure the scene from. */
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
   * arrived yet when the hole takes hold. Rounded ONCE, here: both pins are
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
  // number: both pins are driven off `inset`, and the height is then floored
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
  // so both pins still share one trigger element and one screen line. Negative,
  // because the headline has not arrived yet when the hold begins. The container
  // is still fitted, to whatever the viewport can hold of it.
  return {
    inset: Math.round(seam - rise),
    frameHeight: Math.round(Math.max(HARD_FRAME_FLOOR, Math.min(natural, viewport - seam))),
    degraded: true,
  };
}

/** The pinned frame's top edge in viewport px, for as long as the hold lasts.
 * Scroll-invariant, which is why the scene can be measured before either pin
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

/** The sheet pin's start offset on the shared trigger element.
 *
 * The hole's pin reserves its whole pin span in the document above the sheet —
 * that is what `pinSpacing` does (GSAP writes it as the spacer's
 * `paddingBottom`), and it is what makes the hole's release seamless — so by the
 * time GSAP measures the sheet's trigger, every box below the hole (the headline
 * included) already sits that much lower. Asking for the trigger line plainly
 * would land the sheet's pin one whole reservation late: the hole would let go
 * at the exact moment the sheet took hold, and the reader would watch it drift
 * for the entire fall. Subtracting the reservation puts both pins back on the
 * one screen line they share.
 *
 * GSAP will not do this for us: its own cross-trigger compensation only fires
 * when the earlier trigger's PIN is the later trigger's TRIGGER element, and
 * here the pin is the frame while the trigger is the headline inside the sheet. */
export function sheetStartOffset(inset: number, reservedPin: number): number {
  return inset - reservedPin;
}

/* ---------------------------------------------------------------------------
   THE PLAYHEAD — a scroll-domain quantity.

   An earlier version scrubbed the consumption with `gsap`'s `scrub: 0.6`, i.e.
   a TWEEN IN TIME toward the scroll's progress. That is the wrong clock for a
   sequence whose pins must not let go before the timeline finishes: a scrub
   tween needs up to 600ms of wall clock to arrive, while a ScrollTrigger
   releases its pin on the scroll pixel where `progress === 1`. On any fast
   arrival (a fling, a scrollbar drag, a PageDown) the pins therefore let go
   with the consumption still in flight, and the last of the fall played out on
   a released layout that was already scrolling away.

   The playhead here is instead a pure function of the scroll position, with
   smoothing expressed in SCROLLED PIXELS:

     · `consumptionTarget` maps the pin's own progress onto the consumption. The
       pins span `run + settle`; the consumption occupies the first `run`, so the
       target reaches 1 while the screen is still locked.
     · `followPlayhead` rate-limits the written playhead toward that target. It
       is exact at both ends: a jump bigger than the smoothing distance lands on
       the target in one step, and the settle margin is by construction longer
       than the smoothing distance, so the playhead is provably 1 before either
       pin releases.

   Two consequences worth keeping: the scene is deterministic (the same scroll
   position always paints the same frame, which is what makes it testable), and
   nothing continues to move after the scroll stops, so no state can be left
   half-applied when a pin lets go.
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
 * which both pins still hold the screen. It exists for ONE reason — to make
 * "the pins let go after the timeline finishes" a property of the geometry
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
  /** The span BOTH pins share: they engage on one line and let go on one pixel. */
  total: number;
  /** The pin progress at which the consumption is complete. */
  share: number;
}

export function pinSpan(sheetHeight: number): PinSpan {
  const run = runDistance(sheetHeight);
  const settle = settleDistance();
  return { run, settle, total: run + settle, share: run / (run + settle) };
}

/** The consumption playhead a pin progress asks for. Exact: 0 at the trigger's
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
export const TIDAL_GAIN = 0.9;
export const TIDAL_FALLOFF = 1.6;
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
export const SWIRL_TURNS = 0.42;

export function swirlAt(progress: number): number {
  return SWIRL_TURNS * Math.pow(clamp01(progress), 1.5);
}

/* ---------------------------------------------------------------------------
   The sheet's collapse — requirement 4's compensating quantity.

   It leads the playhead slightly and finishes slightly early: the void is gone
   (and the curtain fully paid back) before the last of the light falls in, so
   the pin releases onto a settled layout instead of a moving one.
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

   The gap must NOT collapse naturally: the consumed flyers are lifted out of
   flow and moved by transforms, which cost the layout nothing, and the sheet's
   own box is written every frame from `sheetHeightAt`. The sheet's pin-spacer
   owns its flow box for as long as the pin exists, so the spacer is the only
   place the removed height can be paid back from. Three things have to hold at
   once, and together they pin the formula down exactly:

   · TRACKED. The curtain's paint window opens at the stage's top inset by
     `--curtain-travel`, and the stage hangs off the spacer's bottom edge. So
     the bright floor meets the sheet's hem — one pixel below it — at every
     playhead only if the spacer's height is `sheet height + parked + PAD`,
     where `parked` is the pin span the scroll has already consumed. The floor's
     on-screen rise is then `d(vacatedHeightAt)/d(scroll)` and nothing else: the
     parked term cancels the scroll exactly, which is what "linked strictly to
     the consumption timeline" means in a pinned scene.

   · NEVER SHORT. The parked term is read from the RAW scroll, not from the
     smoothed playhead: the document then grows by exactly one pixel per scrolled
     pixel, and a fling can never arrive at a page shorter than its own scroll
     position. The visible collapse still follows the playhead, and because
     `sheetHeightAt` appears in BOTH terms the hem/window invariant above holds
     at any lag between the two — the lag can never open a gap under the sheet.

   · AFFORDABLE. Paying the curtain back removes height from the document, and
     what is left must still be scrollable after the pin releases, or the
     release lands on a clamped document, the playhead snaps back and the sheet
     un-collapses in one frame. With `slack = tail − hemInset + PAD − consumed`,
     the allowance is `collapsibleHeight` — the whole sheet on any layout whose
     curtain is tall enough, and the last few percent of the collapse on one
     that is not. Degrading the collapse is the honest fallback: borrowing
     scroll from the reader is not.
--------------------------------------------------------------------------- */
export const SPACER_PAD = 1;

/** Scroll that must still exist once the pin releases. */
export const MIN_RELEASE_SLACK = 24;

/** Scroll left at the end of the consumption, before the compensation spends
 * any of it: the curtain's own height, adjusted for where the sheet's hem parks.
 *
 * `hemInset` is the hem's distance above the bottom of the viewport for as long
 * as the pin holds — positive when it parks above the fold, NEGATIVE when the
 * reference framing leaves it below it (the CTA still off-screen at the
 * trigger), which is scroll the curtain gets to rise into for free. */
export function curtainSlack(tail: number, hemInset: number): number {
  return tail - hemInset + SPACER_PAD;
}

/** How much of the sheet's rest height the document can afford to lose. */
export function collapsibleHeight(restHeight: number, tail: number, hemInset: number): number {
  return Math.max(0, Math.min(restHeight, curtainSlack(tail, hemInset) - MIN_RELEASE_SLACK));
}

/** The spacer's box at `progress` (the playhead, which owns everything visible)
 * and `rawProgress` (the scroll itself, which owns the document's length).
 * `pinDistance` is the WHOLE pin span — the consumption run plus the settle
 * margin — because that is what GSAP reserved and what it will push the released
 * sheet down by. `padding` is that parked span, which the sheet's flow box sits
 * on top of once the pin lets go. */
export function spacerBoxAt(
  progress: number,
  rawProgress: number,
  restHeight: number,
  pinDistance: number,
  collapsible: number,
): { height: number; padding: number } {
  const height = sheetHeightAt(progress, restHeight, collapsible);
  const parked = Math.max(0, pinDistance) * clamp01(rawProgress);
  return {
    height: Math.max(0, height) + parked + SPACER_PAD,
    padding: Math.min(Math.max(0, pinDistance), parked + SPACER_PAD),
  };
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
export const MIX_START = 0.04;
export const MIX_END = 0.38;

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

   Growth is quartic on purpose: the horizon holds small while the sheet is
   still recognisably a sheet, then closes fast. By the time it matters, the
   infall has already contracted the image and the tidal term has already
   stranded it.
--------------------------------------------------------------------------- */
export const EFFECTIVE_HORIZON_RADIUS_PX = 26;

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
  const growth = p * p * p * p;
  return p * (EFFECTIVE_HORIZON_RADIUS_PX + (cover - EFFECTIVE_HORIZON_RADIUS_PX) * growth);
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
 * the time it crosses). */
export const CROSSING = 0.98;

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

/** `rest` is the flyer's centre in viewport px, measured with the sheet pinned;
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
