/* ============================================================================
   SPAGHETTIFICATION — the pure math of the sign-off's consumption.

   One playhead `p ∈ [0, 1]` — owned by the two pinned ScrollTriggers in
   `components/SignoffHorizon.tsx` — drives three things that must agree:

     1 · the sheet's layout collapse (`collapseAt`) — how much of the sign-off's
        own height has been eaten. Its pin-spacer gives that height back to the
        document at the same rate, so the distance from the sheet's hem to the
        end of the site never changes and the curtain footer rises exactly as
        fast as the void is vacating.

     2 · the live flyers' trajectory (`flyerFrameAt`) — the headline and the CTA
        fall toward the singularity, stretch along the pull axis, squeeze across
        it and scale down into a point.

     3 · the frozen frame's warp (`infallAt` / `tidalAt` / `swirlAt`, consumed by
        `three/eventHorizonWarp.ts`) — the shader remaps every fragment through
        the SAME field.

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

/* ---------------------------------------------------------------------------
   The infall — the global pull toward the singularity.

   The frozen frame implements this as a radial remap: a fragment at radius `r`
   samples the source at `r · (1 + infall(p) + tidal)`. The matching live-DOM
   motion is therefore `r(p) = r0 / (1 + infall(p))`, and `infallAt` is the one
   place that number is written down.

   The pole at `1 / INFALL_POLE` is what makes the fall accelerate instead of
   gliding: by p = 1 the sheet has contracted to `1 / (1 + INFALL_GAIN /
   (1 - INFALL_POLE))` ≈ 8% of its rest distance, i.e. into a point. The last
   few percent are the event horizon's job, not the translation's.
--------------------------------------------------------------------------- */
export const INFALL_GAIN = 1.15;
export const INFALL_POLE = 0.9;
export const INFALL_EASE = 1.35;

export function infallAt(progress: number): number {
  const p = clamp01(progress);
  return (INFALL_GAIN * Math.pow(p, INFALL_EASE)) / (1 - INFALL_POLE * p);
}

/** The fraction of the way to the singularity that the infall has carried a
 * flyer at rest: `r0 → r0 · (1 - fallAt(p))`. */
export function fallAt(progress: number): number {
  const infall = infallAt(progress);
  return infall / (1 + infall);
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

/** The sign-off's live layout height at `progress`. `collapsible` is the part
 * of the rest height the document can afford to lose (see below); it equals the
 * rest height on any layout whose curtain is tall enough to pay for the whole
 * fall, which is the normal case. */
export function sheetHeightAt(progress: number, restHeight: number, collapsible = restHeight): number {
  return restHeight - collapsible * collapseAt(progress);
}

/* ---------------------------------------------------------------------------
   The curtain's compensation — requirement 4, as a closed form.

   The sheet's pin-spacer owns its flow box for as long as the pin exists, so
   the spacer is the only place the removed height can be paid back from. Three
   things have to hold at once, and together they pin the formula down exactly:

   · TRACKED. The curtain's paint window opens at the stage's top inset by
     `--curtain-travel`, and the stage hangs off the spacer's bottom edge. So
     the bright floor meets the sheet's hem — one pixel below it — at every
     playhead only if the spacer's height is `sheet height + parked + PAD`,
     where `parked` is the pin distance the scroll has already consumed.

   · NEVER SHORT. The parked term is read from the RAW scroll, not from the
     smoothed playhead: the document then grows by exactly one pixel per scrolled
     pixel, and a fling can never arrive at a page shorter than its own scroll
     position. The visible collapse still follows the smoothed playhead, which
     is what the scrub is for.

   · AFFORDABLE. Paying the curtain back removes height from the document, and
     what is left must still be scrollable after the pin releases, or the
     release lands on a clamped document, the playhead snaps back and the sheet
     un-collapses in one frame. With `slack = tail - seam + PAD - consumed`, the
     allowance is `collapsibleHeight` — the whole sheet on any layout whose
     curtain is tall enough, and the last few percent of the collapse on one
     that is not. Degrading the collapse is the honest fallback: borrowing
     scroll from the reader is not.
--------------------------------------------------------------------------- */
export const SPACER_PAD = 1;

/** Scroll that must still exist once the pin releases. */
export const MIN_RELEASE_SLACK = 24;

/** Scroll left at the end of the consumption, before the compensation spends
 * any of it: the curtain's own height, minus the seam of air the sheet's hem is
 * parked above the bottom of the viewport. */
export function curtainSlack(tail: number, seam: number): number {
  return tail - seam + SPACER_PAD;
}

/** How much of the sheet's rest height the document can afford to lose. */
export function collapsibleHeight(restHeight: number, tail: number, seam: number): number {
  return Math.max(0, Math.min(restHeight, curtainSlack(tail, seam) - MIN_RELEASE_SLACK));
}

/** The spacer's box at `progress` (the smoothed playhead, which owns everything
 * visible) and `rawProgress` (the scroll itself, which owns the document's
 * length). `padding` is the parked pin distance the sheet's flow box sits on
 * top of once the pin lets go. */
export function spacerBoxAt(
  progress: number,
  rawProgress: number,
  restHeight: number,
  pinDistance: number,
  collapsible: number,
): { height: number; padding: number } {
  const height = sheetHeightAt(progress, restHeight, collapsible);
  const parked = pinDistance * clamp01(rawProgress);
  return {
    height: Math.max(0, height) + parked + SPACER_PAD,
    padding: Math.min(pinDistance, parked + SPACER_PAD),
  };
}

/* ---------------------------------------------------------------------------
   The paint crossfade: live DOM out, frozen frame in.

   The snapshot holds ONLY the two flyers (the sheet's own background stays in
   the live DOM, so the collapsing hem is never painted twice and the curtain
   meets a real edge), so the two layers are the same glyphs in the same field. The mix completes early, while they
   still agree to within a few pixels, and the frozen frame carries the plunge.
   The real links never leave the accessibility tree or the tab order — only
   their paint is exchanged, and focus restores it at any progress.
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

/** A flyer stops painting once the horizon has grown past this fraction of its
 * current radius — it has crossed, and the frozen frame owns the remains. */
export const CROSSING = 0.98;

export interface FlyerFrame {
  /** Fraction of the distance to the singularity covered so far. */
  fall: number;
  /** Translation toward the singularity, in viewport px. */
  x: number;
  y: number;
  /** Scale along the pull axis: tidal stretch × the contraction into the point. */
  along: number;
  /** Scale across the pull axis: lateral squeeze × the same contraction. */
  across: number;
  /** Screen degrees (y down) of the pull axis, plus frame dragging. This is the
   * direction `along` stretches in. */
  rotation: number;
  /** Live paint, exchanged for the frozen frame by `overlayMixAt`. */
  opacity: number;
  /** Past the event horizon: stop painting, the shader has it now. */
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

  const infall = infallAt(p);
  const fall = infall / (1 + infall);
  const radius = Math.max(restRadius / (1 + infall), 1e-4);
  const tidal = tidalAt(radius, horizonRadius, p);

  // The remap a fragment at `radius` came through: source(r) = r·(1 + I + T(r)),
  // so the image's radial magnification is 1/f'(r) and its tangential
  // magnification is r/f(r). T falls off as r^-k, so r·T'(r) = -k·T while the
  // term is unsaturated — that minus sign IS the spaghettification: the radial
  // axis stretches relative to the tangential one, and both contract overall.
  const total = 1 + infall + tidal;
  const slope = tidal >= TIDAL_CAP ? total : total - TIDAL_FALLOFF * tidal;
  const along = slope > 0.02 ? 1 / slope : 50;
  const across = 1 / total;

  // The pull axis, plus the same frame dragging the shader applies to the
  // remapped source. `rotate(θ) · scale(along, across) · rotate(−θ)` is an
  // anisotropic scale whose stretched eigenvector is the direction at θ, so θ is
  // the pull direction itself in screen degrees (y down) — the same orientation,
  // and the same sign, as the shader's rotation matrix.
  const axis = (Math.atan2(dy, dx) * 180) / Math.PI;
  const drag = (tidal * swirlAt(p) * 360) % 360;

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
 * `scale(a, b)` alone cannot scale along an arbitrary axis. */
export function flyerTransform(frame: FlyerFrame): string {
  const { x, y, rotation, along, across } = frame;
  return (
    `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) ` +
    `rotate(${rotation.toFixed(3)}deg) ` +
    `scale(${along.toFixed(5)}, ${across.toFixed(5)}) ` +
    `rotate(${(-rotation).toFixed(3)}deg)`
  );
}
