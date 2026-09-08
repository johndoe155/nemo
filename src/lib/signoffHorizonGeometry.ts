import {
  collapsibleHeight,
  framingHolds,
  parkedFrameTop,
  parkedHem,
  sheetStartOffset,
  titleAir,
  triggerInset,
  type FlyerId,
  type Point,
} from './spaghettification';

/* ============================================================================
   Sign-off horizon geometry — every number the pinned consumption scene needs,
   measured rather than guessed.

   Two coordinate spaces matter, and they are kept apart on purpose:

   · DOCUMENT space decides where the hold begins and how long it runs. Both
     pins engage on ONE screen line — the reference framing, with the headline's
     bottom edge parked `titleAir` px above the bottom of the viewport, the
     whole headline in view and the black hole above it — and both let go on the
     scroll pixel where the consumption reaches 100%. Between those two pixels
     nothing on screen moves at all: the hole is anchored, the invitation is
     anchored, and the only thing that changes is the warp. The pins are
     coextensive, so there is no gap, no double-pin and no handover to time.

   · VIEWPORT space decides the warp. Once the pins are engaged nothing on screen
     moves, so the singularity's position relative to the sheet is one constant
     for the whole fall — and it is NOT where the hole sits in the document: the
     pinned frame hangs high (normally with its masked crown above the fold) and
     the pinned sheet's hem hangs BELOW the fold, with the CTA still off-screen,
     so the singularity lands far above the sheet's own box and the overlay's
     veil is what gives the strands room to fall upward into it.

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
  /** The singularity, in sheet-local CSS px. `anchorY` is normally positive:
   * the pinned sheet overlaps the hole's lower half. */
  anchorX: number;
  anchorY: number;
  /** The resolved `--bh-seam` height (a `clamp()`, so never parseFloat the token). */
  seam: number;
  /** How far the overlay extends above the sheet, so a strand pulled past the
   * sheet's top edge is not clipped mid-fall. */
  veil: number;
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
  /** The black hole frame's box height. */
  frameHeight: number;
  /** The singularity, in viewport px, for as long as both pins hold. */
  singularity: Point;
  /** The sheet's viewport top while pinned. */
  pinnedTop: number;
  /** The flyers' rest centres, sheet-local. */
  flyers: Record<FlyerId, Point>;
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
  /** True when the composition is too tall for the reference framing to show
   * the hole at all, so the hold starts on the frame's bottom edge instead. */
  degraded: boolean;
  /** The sheet pin's start offset on that same line, minus the pin distance the
   * hole's spacer reserves above it (see `sheetStartOffset`). */
  sheetStartOffset: number;
  /** How far the sheet holds the screen while it is consumed. */
  sheetPinDistance: number;
  /** The hole's pin: the same span, on the same line, ending on the same pixel. */
  holePinDistance: number;
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

/** The consumption needs a minimum run to read as a fall rather than a cut. */
export const MIN_SHEET_RUN = 300;

/** The floor on `rise`: a headline sitting on top of the hole's bottom edge is
 * not a composition anyone can read, and there would be nothing between the two
 * pins to measure the scene from. */
export const MIN_RISE = 24;

/** The fall's length as a multiple of the sheet's own height. */
export const SHEET_RUN_RATIO = 1.15;

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

/** GSAP reserves the hole's whole pin distance inside its `.pin-spacer` for as
 * long as the pin exists, and that reservation sits in the document BETWEEN the
 * frame and the sheet. Any distance measured across it is therefore inflated by
 * exactly that much — but the composition the hold is framed on is a REST
 * relationship, so the reservation has to come back out. It is read off the
 * spacer rather than remembered, because a resize can have re-published a
 * different pin distance since the last measurement and the two have to agree
 * or the trigger line drifts by the difference.
 *
 * Once the pin has let go, GSAP pushes the frame down into its own reservation
 * (an inline `top` of exactly the pin distance) so the release is seamless; the
 * two cancel, and this reads zero again. Zero also before the pin exists, which
 * is when the scene is first measured. */
function reservedPin(frame: HTMLElement, frameHeight: number): number {
  const spacer = frame.parentElement;
  if (!spacer || !spacer.classList.contains('pin-spacer')) return 0;
  const pushedDown = parseFloat(getComputedStyle(frame).top) || 0;
  const reserved = spacer.getBoundingClientRect().height - frameHeight - pushedDown;
  return Number.isFinite(reserved) && reserved > 0 ? reserved : 0;
}

/** `previous` supplies the document-space numbers when the scene is re-measured
 * while a pin is holding the screen: the flow relationship between the frame's
 * bottom and the headline cannot be read off a box that is parked, and it has
 * not changed. Everything else is re-measured for real. */
export function measureSignoffScene(input: {
  sheet: HTMLElement;
  frame: HTMLElement;
  flyers: Record<FlyerId, HTMLElement>;
  previous?: SignoffScene | null;
}): SignoffScene | null {
  const { sheet, frame, flyers, previous = null } = input;
  const viewport = window.innerHeight;
  const box = sheet.getBoundingClientRect();
  const frameBox = frame.getBoundingClientRect();
  // Read the RESOLVED pseudo-element height: --bh-seam is a clamp() expression.
  const seam = parseFloat(getComputedStyle(frame, '::after').height);
  if (!box.width || !box.height || !frameBox.height || !Number.isFinite(seam) || seam <= 0) return null;
  if (viewport <= seam * 2) return null;

  const style = getComputedStyle(sheet);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const scrollY = window.scrollY;
  const hemDoc = box.bottom + scrollY;

  // The reference framing is read off the headline's own box: it is the flyer
  // that has to be entirely in view when the screen locks. prepareMeasure() has
  // already restored the rest state, so this is the un-warped box.
  const inviteBox = flyers.invite.getBoundingClientRect();
  if (!inviteBox.width || !inviteBox.height) return null;
  // Headline bottom → sheet hem. Both boxes belong to the sheet, so this reads
  // the same whether the sheet is in flow or parked on screen.
  const belowTitle = box.bottom - inviteBox.bottom;
  if (!Number.isFinite(belowTitle) || belowTitle <= 0) return null;

  // Frame bottom → headline bottom crosses from the hole's box to the sheet's,
  // so it is only readable while neither box is parked on screen — and only
  // once the hole's reserved pin distance is taken back out of it.
  let rise: number;
  if (!parked(sheet) && !parked(frame)) {
    rise = inviteBox.bottom - frameBox.bottom - reservedPin(frame, frameBox.height);
    if (!Number.isFinite(rise) || rise < MIN_RISE) return null;
  } else if (previous) {
    rise = previous.rise;
  } else {
    return null; // parked with nothing measured yet: no honest number exists
  }

  // The one screen line both pins share: the headline's bottom edge, `air` px
  // above the fold. Only a composition too tall to show the hole at all falls
  // back to hole-first, and says so.
  const air = titleAir(viewport);
  const degraded = !framingHolds(viewport, air, rise);
  // Rounded once, here: both pins are driven off this one number, and rounding
  // each of their start strings separately would let the two lines disagree by
  // a sub-pixel — which is a sub-pixel of drift in an otherwise exact hold.
  const inset = Math.round(triggerInset({ degraded, air, seam, rise }));

  const { floor, stage } = curtainElements();
  const travel = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--curtain-travel'),
  ) || 0;
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
  const sheetPinDistance = Math.max(MIN_SHEET_RUN, Math.round(box.height * SHEET_RUN_RATIO));

  // While pinned, the singularity sits at the frame's centre, and the frame's
  // top edge hangs one composition above the trigger line. Both are
  // scroll-invariant, which is why the scene can be measured before either pin
  // engages — and the frame top is normally negative, so the singularity lands
  // ABOVE the pinned sheet and the veil pays for the upward fall.
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

  const local = {} as Record<FlyerId, Point>;
  for (const id of Object.keys(flyers) as FlyerId[]) {
    const rect = flyers[id].getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    local[id] = {
      x: rect.left + rect.width / 2 - box.left,
      y: rect.top + rect.height / 2 - box.top,
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
    singularity,
    pinnedTop,
    flyers: local,
    rise: Math.round(rise),
    belowTitle: Math.round(belowTitle),
    titleAir: air,
    triggerInset: inset,
    degraded,
    sheetStartOffset: sheetStartOffset(inset, sheetPinDistance),
    sheetPinDistance,
    // Both pins span exactly the consumption: they engage on the same screen
    // line and let go on the same scroll pixel, so the hold is one continuous
    // frame from the reference composition to 100% warped.
    holePinDistance: sheetPinDistance,
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

