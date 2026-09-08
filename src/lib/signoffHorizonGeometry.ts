import {
  collapsibleHeight,
  framingHolds,
  parkedFrameTop,
  parkedHem,
  pinSpan,
  solveFraming,
  titleAir,
  MIN_RISE,
  type FlyerId,
  type Point,
} from './spaghettification';

export { MIN_RISE };

/* ============================================================================
   Sign-off horizon geometry — every number the held consumption scene needs,
   measured rather than guessed.

   Two coordinate spaces matter, and they are kept apart on purpose:

   · DOCUMENT space decides where the hold begins and how long it runs. The hold
     engages on ONE screen line — the reference framing, solved by `solveFraming` so
     that the whole black hole container is inside the top of the viewport and the
     whole "ENTER THE NEMOVERSE" headline is inside the bottom of it — and it lets
     go on the scroll pixel where its span ends, which is `settle` px AFTER the
     consumption reached 100%. Between those two pixels the reservation in
     `.bh-hold` has grown by exactly the scroll the reader spent, so the composition
     has one constant viewport position: nothing on screen moves but the warp.
     There is one span and one line because there is one mechanism — nothing is
     handed from one pin to another, so there is no gap, no double-pin and no
     offset to keep in sync (see `holdDistanceAt` in lib/spaghettification.ts).

   · VIEWPORT space decides the warp. Once the hold engages nothing on screen moves,
     so the singularity's position relative to the sheet is one constant for the
     whole fall. In the reference framing the container's top edge is at the top of
     the viewport and the sheet's hem parks BELOW the fold, so the singularity lands
     far above the sheet's own box and the overlay's veil is what gives the strands
     room to fall upward into it.

   The third number is the one requirement 4 lives or dies on: `tail`, the
   curtain's own height in the flow. The consumption takes the sheet's height out of
   the layout and the curtain rises into exactly that space — the sheet stays in
   flow while it is held, so the floor's rise IS the collapse and nothing else —
   which it can only do if the document still has that much scroll left to give.
   `collapsible` is that allowance in pixels; the arithmetic lives in
   `lib/spaghettification.ts` next to the curves it compensates for.
   ========================================================================== */

export interface SignoffHorizonGeometry {
  /** The sheet's CSS width. */
  width: number;
  /** The sheet's rest CSS height — the height the collapse starts from. */
  height: number;
  /** The singularity, in sheet-local CSS px. NEGATIVE in the reference framing:
   * the parked hole's centre sits above the pinned sheet's top edge, so the fall
   * is upward and the veil is the headroom that buys. */
  anchorX: number;
  anchorY: number;
  /** The resolved `--bh-seam` height (a `clamp()`, so never parseFloat the token). */
  seam: number;
  /** How far the overlay extends above the sheet, so a strand pulled past the
   * sheet's top edge is not clipped mid-fall. */
  veil: number;
}

/** A flyer's rest box, in TWO coordinate spaces, because two different
 * consumers read it:
 *
 * · `x`/`y` are its CENTRE, SHEET-local — the same space the singularity
 *   (`anchorX`/`anchorY`) and the frozen frame's overlay are expressed in, and
 *   the point the field pulls on.
 * · `left`/`top`/`width`/`height` are the box the lift out of document flow
 *   writes back, and an absolutely positioned element resolves against its
 *   OFFSET PARENT's padding box — which here is `.signoff__anchor`
 *   (`position: relative`), not the sheet. Writing the sheet-local numbers
 *   would place every flyer one anchor-offset too far down and to the right,
 *   which is a visible jump on the frame the hold begins. These are therefore
 *   anchor-local, border width included.
 *
 * The lift itself paints nothing either way: the box written back is the rest
 * box exactly. */
export interface FlyerBox extends Point {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SignoffScene extends SignoffHorizonGeometry {
  /** The sheet's resolved vertical padding. The collapse takes the bottom one
   * with it, or the border box stops at the padding instead of at zero; the top
   * one is handed to the anchor's margin so no flyer's rest position moves
   * while the box collapses around it. */
  paddingTop: number;
  paddingBottom: number;
  /** The sheet's viewport left edge: horizontal placement never changes
   * between the measurement and the pin. */
  sheetLeft: number;
  /** The viewport the scene was measured in. */
  viewport: number;
  /** The black hole container's box height, after the composition budget. */
  frameHeight: number;
  /** The container's own responsive height, before the budget. Kept so a resize
   * can give the stage its height back instead of ratcheting it down. */
  naturalFrameHeight: number;
  /** The singularity, in viewport px, for as long as the hold runs. */
  singularity: Point;
  /** The sheet's viewport top while the hold runs. */
  pinnedTop: number;
  /** The flyers' rest boxes: centres sheet-local (the field's space), boxes
   * anchor-local (the lift's space). See `FlyerBox`. */
  flyers: Record<FlyerId, FlyerBox>;
  /** The anchor's rest height. Lifting the flyers out of flow empties it, and
   * the collapse must not move a flyer's rest position, so the effect writes
   * this back for as long as the scene holds. */
  anchorHeight: number;
  /** Frame bottom → headline bottom: how much document sits between the hole
   * and the line that triggers the hold. */
  rise: number;
  /** Headline bottom → sheet hem: the sheet's own share of the composition. */
  belowTitle: number;
  /** The air parked under the headline when the hold begins. */
  titleAir: number;
  /** The shared trigger line, as the headline's inset above the bottom of the
   * viewport. Negative in the degraded framing, where the headline has not
   * arrived yet when the hole takes hold. */
  triggerInset: number;
  /** True when the two containment conditions cannot both be met even at
   * `MIN_FRAME_HEIGHT`, so the hold starts on the frame's bottom edge instead. */
  degraded: boolean;
  /** Whether the reference framing's containment holds with the fitted frame. */
  framed: boolean;
  /** The consumption's own scroll distance. */
  run: number;
  /** The release margin after it: the hold keeps the screen locked for this many
   * pixels after the timeline reached 100%, which is what makes "let go only once
   * the hole has finished eating the text and the button" a property of the
   * geometry rather than of scroll speed. */
  settle: number;
  /** The span of the whole hold: one line in, one pixel out. This is also the
   * document px the reservation (`.bh-hold`) ends up spending. */
  pinDistance: number;
  /** The hold progress at which the consumption is complete. */
  consumptionShare: number;
  /** The curtain's own height in the flow. */
  tail: number;
  /** The resolved `--curtain-travel`: how far the sticky floor hangs below the
   * stage. The sheet keeps its own negative margin for the whole hold (nothing is
   * re-parented), so this is a measurement, not a number the effect has to keep
   * in sync with a spacer. */
  travel: number;
  /** The sheet's hem, as its inset above the bottom of the viewport while the
   * hold runs. Negative in the reference framing: the hem parks below the fold,
   * with the CTA still off-screen. */
  hemInset: number;
  /** How much of the sheet the document can afford to lose. */
  collapsible: number;
}

/** Room left above the sheet for a strand that overshoots its top edge. */
export const VEIL_MARGIN = 28;

/** The variable the composition's container budget is published on — on the
 * frame itself. Unset, the stage keeps its own responsive clamp, which is what a
 * page without the consumption scene (mobile, reduced motion) gets. */
export const FRAME_FIT_VAR = '--bh-frame-fit';

/** The curtain rig, in the order it is measured: the floor's own box is the
 * tail (its sticky travel is granted by the stage on top of that height, so the
 * stage's box would double-count it). */
export function curtainElements(): { floor: HTMLElement | null; stage: HTMLElement | null } {
  return {
    floor: document.querySelector<HTMLElement>('.curtain-footer'),
    stage: document.querySelector<HTMLElement>('.curtain-stage'),
  };
}

/* ---------------------------------------------------------------------------
   Reading the container's OWN height.

   This used to have to reason about three states (rest, parked by a pin, released
   into a pin-spacer), because GSAP wrote an inline `height`/`max-height` on the
   element it pins and re-parented it into a spacer that reserves the pin span in
   the flow. That is where the previous attempt died: the scene measured the
   container, the pin measured it differently, and the disagreement was answered by
   refusing to build the scene — a pin that dismantles itself before it can engage.

   There is now one state, because nothing is pinned and nothing is re-parented: the
   composition is held by a reservation above it (see `holdDistanceAt`), and the only
   inline size on the frame is the one this module publishes. What is still worth
   doing carefully is reading the container's UNBUDGETED height, so the fit can
   never ratchet: withdraw the variable, read the box, put the variable back, all
   inside one task so no intermediate height is ever painted. Any inline height a
   third party may have stamped on the frame is withdrawn for the read too — the
   natural height is what the stylesheet's own clamp says, by definition.
--------------------------------------------------------------------------- */

/** Take the composition's budget back out and read the container's OWN
 * responsive height. Reading the fitted height as if it were the natural one
 * would ratchet the stage down a little on every measurement. Clearing the
 * variable and reading the box costs one forced layout — affordable, because
 * measurement only ever runs with the layout at rest, never per frame — and both
 * writes happen inside one task, so no intermediate height is painted. */
function naturalFrameHeight(frame: HTMLElement): number {
  const previous = frame.style.getPropertyValue(FRAME_FIT_VAR);
  // A third party that sizes the container directly (a legacy rule, a stray
  // inline height) has to be withdrawn for the read too: the UNBUDGETED height is
  // what the fit is solved against, and reading the budgeted one as if it were
  // natural would make the next solve agree with the previous fit and the check
  // below disagree with both.
  const inline = { height: frame.style.height, maxHeight: frame.style.maxHeight };
  frame.style.removeProperty(FRAME_FIT_VAR);
  frame.style.removeProperty('height');
  frame.style.removeProperty('max-height');
  const height = frame.getBoundingClientRect().height;
  if (previous) frame.style.setProperty(FRAME_FIT_VAR, previous);
  if (inline.height) frame.style.height = inline.height;
  if (inline.maxHeight) frame.style.maxHeight = inline.maxHeight;
  return height;
}

/** Publish (or withdraw) the container height the composition can hold. It is
 * written on the frame itself, next to the box it sizes, rather than on `<html>`:
 * a value that lives on the element being budgeted cannot be outranked by an
 * unrelated rule higher up the tree, and it cannot survive this scene by accident
 * because the element it belongs to is the element the scene owns. */
export function publishFrameFit(frame: HTMLElement, frameHeight: number, natural: number): void {
  const wanted = frameHeight < natural - 0.5 ? `${Math.round(frameHeight)}px` : '';
  if (frame.style.getPropertyValue(FRAME_FIT_VAR) === wanted) return;
  if (wanted) frame.style.setProperty(FRAME_FIT_VAR, wanted);
  else frame.style.removeProperty(FRAME_FIT_VAR);
}

/** Withdraw the budget: the stage goes back to its own responsive clamp. Called
 * on teardown, so a scene that stood down does not leave the black hole shrunk
 * for the rest of the session. */
export function clearFrameFit(frame: HTMLElement | null): void {
  frame?.style.removeProperty(FRAME_FIT_VAR);
}

/** Every number here is a viewport-relative difference between boxes, and the
 * hold moves the whole composition by the same amount, so the measurements are
 * scroll-invariant: they read the same at rest, mid-hold, and after the release.
 * `previous` is therefore only a size cache — it lets a resize tell "the sheet
 * reflowed" from "the reader scrolled" without a second layout read. */
export function measureSignoffScene(input: {
  sheet: HTMLElement;
  frame: HTMLElement;
  anchor: HTMLElement;
  flyers: Record<FlyerId, HTMLElement>;
}): SignoffScene | null {
  const { sheet, frame, anchor, flyers } = input;
  const viewport = window.innerHeight;
  // Read the RESOLVED pseudo-element height: --bh-seam is a clamp() expression.
  const seam = parseFloat(getComputedStyle(frame, '::after').height);
  if (!Number.isFinite(seam) || seam <= 0) return null;
  if (viewport <= seam * 2) return null;

  const style = getComputedStyle(sheet);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;

  // ---- the two measurements the container budget is solved from -------------
  // Both are differences between boxes that move together, so they are invariant
  // under the fit that is about to be published — measure first, fit second.
  const inviteBox = flyers.invite.getBoundingClientRect();
  if (!inviteBox.width || !inviteBox.height) return null;
  const sheetBox0 = sheet.getBoundingClientRect();
  if (!sheetBox0.width || !sheetBox0.height) return null;
  const frameBox0 = frame.getBoundingClientRect();
  if (!frameBox0.height) return null;
  // Headline bottom → sheet hem. Both boxes belong to the sheet, so this reads
  // the same whether the sheet is in flow or parked on screen.
  const belowTitle = sheetBox0.bottom - inviteBox.bottom;
  if (!Number.isFinite(belowTitle) || belowTitle <= 0) return null;

  // Frame bottom → headline bottom is the seam the composition is framed on. It
  // crosses from the hole's box into the sheet's, which is only safe because the
  // hold pushes BOTH down by the same reservation: the distance between them can
  // never include the hold's cost, and never did include a pin-spacer's padding,
  // because there is no spacer — the reservation lives above the section.
  const rise = inviteBox.bottom - frameBox0.bottom;
  if (!Number.isFinite(rise) || rise < MIN_RISE) return null;

  // ---- solve the reference framing, and give the stage the height it leaves --
  const air = titleAir(viewport);
  // The container's UNBUDGETED height, read with the fit withdrawn, then the
  // height the composition can hold, published back onto the frame. Nothing else
  // in the page writes a size onto `.bh-frame`, so the box on screen afterwards is
  // the number solved here — and the check below is what proves it did.
  const natural = naturalFrameHeight(frame);
  if (!Number.isFinite(natural) || natural <= 0) return null;
  const framing = solveFraming({ viewport, air, seam, rise, natural });
  publishFrameFit(frame, framing.frameHeight, natural);

  const inset = framing.inset;

  // ---- everything below is measured AFTER the fit --------------------------
  const box = sheet.getBoundingClientRect();
  const frameBox = frame.getBoundingClientRect();
  if (!box.width || !box.height || !frameBox.height) return null;
  if (Math.abs(frameBox.height - framing.frameHeight) > 1.5) {
    // The stage did not take the budget: a stylesheet that outranks the variable,
    // a container query, or a third party sizing the frame behind our back.
    // Refuse rather than build a scene on a composition that is not the one on
    // screen — the trigger line and the singularity would both be wrong. Unlike
    // the pin this replaces, nothing is left half-applied when it does: the
    // reservation is a height on an empty div, and teardown zeroes it.
    return null;
  }
  if (!framingHolds(viewport, air, rise, frameBox.height) && !framing.degraded) return null;

  const { floor, stage } = curtainElements();
  const travel = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--curtain-travel'),
  ) || 0;
  const hemDoc = box.bottom + window.scrollY;
  const tail = floor
    ? floor.getBoundingClientRect().height
    : stage
      ? Math.max(0, stage.getBoundingClientRect().height - travel)
      : Math.max(0, document.documentElement.scrollHeight - hemDoc);
  if (!Number.isFinite(tail) || tail <= 0) return null;

  // Where the hem parks, as its inset above the bottom of the viewport: below the
  // fold in the reference framing, which is scroll the curtain gets for free, and
  // the number the collapse budget is capped by.
  const hemInset = inset - belowTitle;
  const collapsible = collapsibleHeight(box.height, tail, hemInset);
  if (collapsible <= 0) return null; // nothing can be paid back: keep the real footer

  // The hold's whole span: the consumption's run plus the release margin that
  // guarantees the playhead has arrived before the composition lets go. It is also
  // exactly how much the reservation ends up costing the document.
  const span = pinSpan(box.height);

  // While held, the singularity sits at the frame's centre, and the frame's top
  // edge hangs one composition above the trigger line. Both are scroll-invariant,
  // which is why the scene can be measured long before the hold engages — and the
  // frame top is 0 when the budget binds, so the singularity lands ABOVE the held
  // sheet and the veil pays for the upward fall.
  const frameTop = parkedFrameTop(viewport, inset, frameBox.height, rise);
  const singularity: Point = {
    x: frameBox.left + frameBox.width / 2,
    y: frameTop + frameBox.height / 2,
  };
  // The sheet's hem parks `belowTitle` below the trigger line, i.e. below the
  // fold in the reference framing: the CTA is still off-screen when the hold
  // begins, and the whole invitation block is what the fall consumes.
  const pinnedTop = parkedHem(viewport, inset, belowTitle) - box.height;
  const anchorX = singularity.x - box.left;
  const anchorY = singularity.y - pinnedTop;

  // The anchor is measured BEFORE the flyers: it is their offset parent, so the
  // lift's `left`/`top` are relative to its padding box. Both boxes belong to
  // the pinned sheet and move together, so this reads the same whether the sheet
  // is in flow or parked on screen.
  const anchorBox = anchor.getBoundingClientRect();
  if (!anchorBox.height) return null;
  const anchorStyle = getComputedStyle(anchor);
  const anchorBorderLeft = parseFloat(anchorStyle.borderLeftWidth) || 0;
  const anchorBorderTop = parseFloat(anchorStyle.borderTopWidth) || 0;

  const local = {} as Record<FlyerId, FlyerBox>;
  for (const id of Object.keys(flyers) as FlyerId[]) {
    const rect = flyers[id].getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    local[id] = {
      // The centre is what the field pulls on, sheet-local like the singularity.
      x: rect.left + rect.width / 2 - box.left,
      y: rect.top + rect.height / 2 - box.top,
      // The box is what the lift writes, in the offset parent's padding box.
      left: rect.left - anchorBox.left + anchorBorderLeft,
      top: rect.top - anchorBox.top + anchorBorderTop,
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    width: box.width,
    height: box.height,
    anchorX,
    anchorY,
    seam,
    veil: Math.max(0, -anchorY) + VEIL_MARGIN,
    paddingTop,
    paddingBottom,
    sheetLeft: box.left,
    viewport,
    frameHeight: frameBox.height,
    naturalFrameHeight: natural,
    singularity,
    pinnedTop,
    flyers: local,
    anchorHeight: anchorBox.height,
    rise: Math.round(rise),
    belowTitle: Math.round(belowTitle),
    titleAir: air,
    triggerInset: inset,
    degraded: framing.degraded,
    framed: framingHolds(viewport, air, rise, frameBox.height),
    run: span.run,
    settle: span.settle,
    pinDistance: span.total,
    consumptionShare: span.share,
    tail,
    travel,
    hemInset,
    collapsible,
  };
}

/** The sheet's viewport top while the hold runs, analytically: its hem parks
 * `belowTitle` below the trigger line. This is the value the scene — and with it
 * the singularity, the anchor and the veil — is built on, and `heldPinnedTop`
 * corrects it against the real rect while the hold runs, which is a measurement of
 * the same box rather than a negotiation with a pin. */
export function analyticPinnedTop(scene: SignoffScene): number {
  return parkedHem(scene.viewport, scene.triggerInset, scene.belowTitle) - scene.height;
}

/** The subset the frozen frame's shader needs. */
export function sceneGeometry(scene: SignoffScene): SignoffHorizonGeometry {
  const { width, height, anchorX, anchorY, seam, veil } = scene;
  return { width, height, anchorX, anchorY, seam, veil };
}

/** The sheet's viewport top while the hold runs. The sheet is never taken out of
 * flow, so while the reservation is holding it this rect IS its parked position:
 * reading it costs nothing and absorbs the sub-pixel difference between the
 * trigger line GSAP computed and the analytic one the scene was solved on. With
 * the hold not engaged, the rect is the sheet's resting position and says nothing
 * about the parked one, so the analytic value stands. */
export function heldPinnedTop(sheet: HTMLElement, analytic: number, held: boolean): number {
  if (!held) return analytic;
  const top = sheet.getBoundingClientRect().top;
  return Number.isFinite(top) ? top : analytic;
}
