import {
  collapsibleHeight,
  framingHolds,
  parkedFrameTop,
  parkedHem,
  pinSpan,
  sheetStartOffset,
  solveFraming,
  titleAir,
  MIN_RISE,
  type FlyerId,
  type Framing,
  type Point,
} from './spaghettification';

export { MIN_RISE };

/* ============================================================================
   Sign-off horizon geometry — every number the pinned consumption scene needs,
   measured rather than guessed.

   Two coordinate spaces matter, and they are kept apart on purpose:

   · DOCUMENT space decides where the hold begins and how long it runs. Both
     pins engage on ONE screen line — the reference framing, solved by
     `solveFraming` so that the whole black hole container is inside the top of
     the viewport and the whole headline is inside the bottom of it — and both
     let go on the scroll pixel where the pin span ends, which is `settle` px
     AFTER the consumption reached 100%. Between those two pixels nothing on
     screen moves at all: the hole is anchored, the invitation is anchored, and
     the only thing that changes is the warp. The pins are coextensive, so there
     is no gap, no double-pin and no handover to time.

   · VIEWPORT space decides the warp. Once the pins are engaged nothing on screen
     moves, so the singularity's position relative to the sheet is one constant
     for the whole fall. In the reference framing the container's top edge is at
     or just below the top of the viewport and the sheet's hem parks BELOW the
     fold, so the singularity lands far above the sheet's own box and the
     overlay's veil is what gives the strands room to fall upward into it.

   The third number is the one requirement 4 lives or dies on: `tail`, the
   curtain's own height in the flow. The consumption takes the sheet's height
   out of the layout and the curtain has to rise into exactly that space, which
   it can only do if the document still has that much scroll left to give.
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
  /** The singularity, in viewport px, for as long as both pins hold. */
  singularity: Point;
  /** The sheet's viewport top while pinned. */
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
  /** The sheet pin's start offset on that same line, minus the pin span the
   * hole's spacer reserves above it (see `sheetStartOffset`). */
  sheetStartOffset: number;
  /** The consumption's own scroll distance. */
  run: number;
  /** The release margin after it: both pins keep holding the screen for this
   * many pixels after the timeline reached 100%, which is what makes "unpin
   * after the text and the button are gone" independent of scroll speed. */
  settle: number;
  /** The span BOTH pins share: one line in, one pixel out. */
  pinDistance: number;
  /** The pin progress at which the consumption is complete. */
  consumptionShare: number;
  /** The curtain's own height in the flow. */
  tail: number;
  /** The resolved `--curtain-travel`: how far the sticky floor hangs below the
   * stage. GSAP copies the sheet's negative margin onto its pin-spacer once, so
   * a resize that re-publishes the travel has to be pushed back onto the spacer
   * by hand or the floor drifts from the sheet's hem. */
  travel: number;
  /** The sheet's hem, as its inset above the bottom of the viewport while the
   * pin holds. Negative in the reference framing: the hem parks below the fold,
   * with the CTA still off-screen. */
  hemInset: number;
  /** How much of the sheet the document can afford to lose. */
  collapsible: number;
}

/** Room left above the sheet for a strand that overshoots its top edge. */
export const VEIL_MARGIN = 28;

/** The variable the composition's container budget is published on. Unset, the
 * stage keeps its own responsive clamp — which is what a page without the
 * consumption scene (mobile, reduced motion, no live stage) gets. */
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

/** A PARKED box's rect is its pinned position, which says nothing about the
 * document. Parentage is not the test — GSAP re-parents a pin into its
 * `.pin-spacer` for as long as the pin exists, and the spacer stays in flow the
 * whole time, so an element can be inside a spacer and still be measurable. The
 * resolved `position` is the honest signal: `fixed` means held on screen. */
const parked = (el: HTMLElement): boolean => getComputedStyle(el).position === 'fixed';

/** The document position the composition is measured FROM: the bottom edge of
 * the black hole container's flow box.
 *
 * GSAP wraps a pin in a `.pin-spacer` that stays in flow for the trigger's whole
 * life and reserves the pin's span inside it (`paddingBottom` + a border-box
 * `height`), and on release it pushes the pin down into that reservation with a
 * TRANSFORM, not with `top`. So the frame's own rect means a different thing in
 * each of the three states: before the pin engages it sits at the TOP of an
 * expanded spacer (the reservation is between it and the headline, and has to be
 * subtracted); after the release it sits at the BOTTOM of the same spacer (the
 * reservation is behind it, and must NOT be subtracted). Reading the frame's own
 * box — and reading the release compensation off `getComputedStyle().top`, which
 * is where GSAP does not put it — understates `rise` by a whole pin distance
 * after the fall, and a `rise` below `MIN_RISE` fails the measurement, which
 * tears the scene down on the first resize after it completes.
 *
 * The spacer's bottom edge is the one boundary that means the same thing in all
 * three states: everything below it is at its true document offset. */
export function flowBottom(frame: HTMLElement): number {
  const spacer = frame.parentElement;
  const box = spacer && spacer.classList.contains('pin-spacer') ? spacer : frame;
  return box.getBoundingClientRect().bottom;
}

/** Take the composition's budget back out and read the container's OWN
 * responsive height. Reading the fitted height as if it were the natural one
 * would ratchet the stage down a little on every measurement. Clearing the
 * variable and reading the box costs one forced layout — affordable, because
 * measurement only ever runs with the layout at rest, never per frame — and both
 * writes happen inside one task, so no intermediate height is painted. */
function naturalFrameHeight(frame: HTMLElement): number {
  const root = document.documentElement;
  const previous = root.style.getPropertyValue(FRAME_FIT_VAR);
  root.style.removeProperty(FRAME_FIT_VAR);
  const height = frame.getBoundingClientRect().height;
  if (previous) root.style.setProperty(FRAME_FIT_VAR, previous);
  return height;
}

/** Publish (or withdraw) the container height the composition can hold. */
export function publishFrameFit(frameHeight: number, natural: number): void {
  const root = document.documentElement;
  const wanted = frameHeight < natural - 0.5 ? `${Math.round(frameHeight)}px` : '';
  if (root.style.getPropertyValue(FRAME_FIT_VAR) === wanted) return;
  if (wanted) root.style.setProperty(FRAME_FIT_VAR, wanted);
  else root.style.removeProperty(FRAME_FIT_VAR);
}

/** Withdraw the budget: the stage goes back to its own responsive clamp. Called
 * on teardown, so a scene that stood down does not leave the black hole shrunk
 * for the rest of the session. */
export function clearFrameFit(): void {
  document.documentElement.style.removeProperty(FRAME_FIT_VAR);
}

/** `previous` supplies the document-space numbers when the scene is re-measured
 * while a pin is holding the screen: the flow relationship between the frame and
 * the headline cannot be read off a box that is parked, the container's natural
 * height cannot be read off a box GSAP has written an inline height onto, and
 * neither has changed. Everything else is re-measured for real. */
export function measureSignoffScene(input: {
  sheet: HTMLElement;
  frame: HTMLElement;
  anchor: HTMLElement;
  flyers: Record<FlyerId, HTMLElement>;
  previous?: SignoffScene | null;
}): SignoffScene | null {
  const { sheet, frame, anchor, flyers, previous = null } = input;
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
  // Headline bottom → sheet hem. Both boxes belong to the sheet, so this reads
  // the same whether the sheet is in flow or parked on screen.
  const belowTitle = sheetBox0.bottom - inviteBox.bottom;
  if (!Number.isFinite(belowTitle) || belowTitle <= 0) return null;

  // Frame bottom → headline bottom crosses from the hole's box to the sheet's,
  // so it is only readable while the SHEET is not parked on screen. The frame
  // being parked is fine: `flowBottom` reads its spacer, which never moves.
  let rise: number;
  if (!parked(sheet)) {
    rise = inviteBox.bottom - flowBottom(frame);
    if (!Number.isFinite(rise) || rise < MIN_RISE) return null;
  } else if (previous) {
    rise = previous.rise;
  } else {
    return null; // parked with nothing measured yet: no honest number exists
  }

  // ---- solve the reference framing, and give the stage the height it leaves --
  const air = titleAir(viewport);
  let natural: number;
  let framing: Framing;
  if (parked(frame) && previous) {
    // GSAP has written an inline height onto the parked container, so its own
    // responsive clamp is not readable. Nothing the budget depends on has
    // changed while the screen is locked, so the solved framing is carried over.
    natural = previous.naturalFrameHeight;
    framing = {
      inset: previous.triggerInset,
      frameHeight: previous.frameHeight,
      degraded: previous.degraded,
    };
  } else {
    natural = naturalFrameHeight(frame);
    if (!Number.isFinite(natural) || natural <= 0) return null;
    framing = solveFraming({ viewport, air, seam, rise, natural });
    publishFrameFit(framing.frameHeight, natural);
  }
  const inset = framing.inset;

  // ---- everything below is measured AFTER the fit --------------------------
  const box = sheet.getBoundingClientRect();
  const frameBox = frame.getBoundingClientRect();
  if (!box.width || !box.height || !frameBox.height) return null;
  if (Math.abs(frameBox.height - framing.frameHeight) > 1.5) {
    // The stage did not take the budget (a stylesheet that outranks the
    // variable, a container query, a resize that landed between the two reads).
    // Refuse rather than build a scene on a composition that is not the one on
    // screen: the trigger line and the singularity would both be wrong.
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

  // Where the hem parks, as its inset above the bottom of the viewport: below
  // the fold in the reference framing, which is scroll the curtain gets for
  // free, and the number the collapse budget is capped by.
  const hemInset = inset - belowTitle;
  const collapsible = collapsibleHeight(box.height, tail, hemInset);
  if (collapsible <= 0) return null; // nothing can be paid back: keep the real footer

  // One span, shared by both pins: the consumption's run plus the release margin
  // that guarantees the playhead has arrived before either pin lets go.
  const span = pinSpan(box.height);

  // While pinned, the singularity sits at the frame's centre, and the frame's
  // top edge hangs one composition above the trigger line. Both are
  // scroll-invariant, which is why the scene can be measured before either pin
  // engages — and the frame top is 0 when the budget binds, so the singularity
  // lands ABOVE the pinned sheet and the veil pays for the upward fall.
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
    sheetStartOffset: sheetStartOffset(inset, span.total),
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

/** The sheet's viewport top while pinned, analytically: its hem parks
 * `belowTitle` below the shared trigger line. `measurePinnedTop` prefers the
 * real rect once the pin has engaged; this is the value the scene — and with it
 * the singularity, the anchor and the veil — was built on, so the two have to
 * agree or the fall would move mid-flight. */
export function analyticPinnedTop(scene: SignoffScene): number {
  return parkedHem(scene.viewport, scene.triggerInset, scene.belowTitle) - scene.height;
}

/** The subset the frozen frame's shader needs. */
export function sceneGeometry(scene: SignoffScene): SignoffHorizonGeometry {
  const { width, height, anchorX, anchorY, seam, veil } = scene;
  return { width, height, anchorX, anchorY, seam, veil };
}

/** The sheet's viewport top while its pin holds it. GSAP positions a
 * `pinType: 'fixed'` pin with `top` and then compensates the release with a
 * `y` translate, so the rect is the truth here — but only while the pin is
 * actually engaged. Before that (and once the pin has let go) the analytic
 * position is the one the scene was built on, and mixing the two would move the
 * singularity mid-flight. */
export function measurePinnedTop(sheet: HTMLElement, analytic: number): number {
  if (sheet.style.position !== 'fixed') return analytic;
  const top = sheet.getBoundingClientRect().top;
  return Number.isFinite(top) ? top : analytic;
}
