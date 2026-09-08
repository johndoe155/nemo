import {
  collapsibleHeight,
  type FlyerId,
  type Point,
} from './spaghettification';

/* ============================================================================
   Sign-off horizon geometry — every number the pinned consumption scene needs,
   measured rather than guessed.

   Two coordinate spaces matter, and they are kept apart on purpose:

   · DOCUMENT space decides the two pin distances. The black hole holds the
     screen from the moment its frame is fully in view — its bottom edge one
     resolved seam above the bottom of the viewport — and does not let go until
     the consumption is over. The sheet's own pin begins `handoff` pixels later,
     which is exactly the distance from the frame's bottom to the sheet's hem:
     how far the sheet has to travel to be seen at all while the hole holds
     still. The hole's pin therefore spans both legs, and the handoff between
     the two pins is one continuous hold with no gap and no double-pin.

   · VIEWPORT space decides the warp. Once both pins are engaged nothing on
     screen moves, so the singularity's position relative to the sheet is one
     constant for the whole fall — and it is NOT where the hole sits in the
     document: the pinned sheet slides up over the hole's lower half, so the
     singularity lands inside the sheet's own box.

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
  /** Frame bottom → sheet hem: the hole's pin, up to the sheet's pin. */
  handoff: number;
  /** How far the sheet holds the screen while it is consumed. */
  sheetPinDistance: number;
  /** The hole's whole pin: the handoff plus the consumption. */
  holePinDistance: number;
  /** The curtain's own height in the flow. */
  tail: number;
  /** The resolved `--curtain-travel`: how far the sticky floor hangs below the
   * stage. GSAP copies the sheet's negative margin onto its pin-spacer once, so
   * a resize that re-publishes the travel has to be pushed back onto the spacer
   * by hand or the floor drifts from the sheet's hem. */
  travel: number;
  /** How much of the sheet the document can afford to lose. */
  collapsible: number;
}

/** Room left above the sheet for a strand that overshoots its top edge. */
export const VEIL_MARGIN = 28;

/** The consumption needs a minimum run to read as a fall rather than a cut. */
export const MIN_SHEET_RUN = 300;

/** Below this the two pins would be one pin: the sheet has to travel a visible
 * distance while the hole holds still, or there is no handoff to speak of. */
export const MIN_HANDOFF = 24;

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

/** GSAP re-parents a pin into its `.pin-spacer` for as long as the pin exists,
 * so this is the reliable "is this box currently held out of flow" test — and a
 * held box's rect is its PINNED position, which says nothing about the document. */
const inFlow = (el: HTMLElement): boolean => !el.parentElement?.classList.contains('pin-spacer');

/** `previous` supplies the document-space numbers when the scene is re-measured
 * while a pin is holding: the flow relationship between the frame's bottom and
 * the sheet's hem cannot be read off two boxes that are both parked on screen,
 * and it has not changed. Everything else is re-measured for real. */
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

  // Both pins start on the same screen line — the frame's bottom and the sheet's
  // hem, one seam above the bottom of the viewport — so the distance between
  // them is a pure document-space measurement, and only readable while both
  // boxes are actually in the document.
  let handoff: number;
  if (inFlow(sheet) && inFlow(frame)) {
    handoff = hemDoc - (frameBox.bottom + scrollY);
    if (!Number.isFinite(handoff) || handoff < MIN_HANDOFF) return null;
  } else if (previous) {
    handoff = previous.handoff;
  } else {
    return null; // pinned with nothing measured yet: no honest number exists
  }

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

  const collapsible = collapsibleHeight(box.height, tail, seam);
  if (collapsible <= 0) return null; // nothing can be paid back: keep the real footer
  const sheetPinDistance = Math.max(MIN_SHEET_RUN, Math.round(box.height * SHEET_RUN_RATIO));

  // While pinned, the singularity sits at the frame's centre: the frame's bottom
  // is one seam above the bottom of the viewport, so its centre is half a frame
  // above that line, and the sheet's pinned top is its hem on the same line.
  // Both are scroll-invariant, which is why the scene can be measured before
  // either pin engages.
  const singularity: Point = {
    x: frameBox.left + frameBox.width / 2,
    y: viewport - seam - frameBox.height / 2,
  };
  const pinnedTop = viewport - seam - box.height;
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
    handoff: Math.round(handoff),
    sheetPinDistance,
    holePinDistance: Math.round(handoff) + sheetPinDistance,
    tail,
    travel,
    collapsible,
  };
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

