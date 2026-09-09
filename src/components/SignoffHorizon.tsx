import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOTION_QUERY, REDUCED_MOTION_QUERY, useSingularityGate } from '../lib/singularityGate';
import {
  clearFrameFit,
  curtainElements,
  measureSignoffScene,
  sceneGeometry,
  type SignoffScene,
} from '../lib/signoffHorizonGeometry';
import {
  FLYER_IDS,
  PLAYHEAD_SMOOTH_PX,
  clamp01,
  collapseAt,
  consumptionTarget,
  followPlayhead,
  flyerFrameAt,
  flyerTransform,
  holdActiveAt,
  holdDistanceAt,
  horizonRadiusAtProgress,
  overlayMixAt,
  sheetHeightAt,
  strandDeltaTransform,
  strandPieceAt,
  type FlyerId,
} from '../lib/spaghettification';
import type { EventHorizonWarp } from '../three/eventHorizonWarp';
import '../styles/signoff-horizon.css';

gsap.registerPlugin(ScrollTrigger);

const FLYER_SELECTOR: Record<FlyerId, string> = {
  invite: '[data-horizon-item="invite"]',
  cta: '[data-horizon-item="cta"]',
};

const STRAND_SEL = '[data-horizon-strand]';

/** Split a flyer's text into per-glyph inline-blocks so each character can
 * fall independently. Idempotent. Skips the CTA's cloned slices. */
const wrapGlyphs = (root: HTMLElement) => {
  if (root.dataset.horizonGlyphs === '1') return;
  root.dataset.horizonGlyphs = '1';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    if (!text.length) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.closest('[data-horizon-strand]')) continue;
    if (parent.closest('.chroma, .txt-grad')) continue;
    const frag = document.createDocumentFragment();
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'horizon-strand';
      span.dataset.horizonStrand = 'glyph';
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      frag.appendChild(span);
    }
    node.parentNode?.replaceChild(frag, node);
  }
};

/** Vertical slices of the CTA: clones of the painted button, each clipped to
 * a strip, so the pill tears into a thread instead of scaling as one box.
 * The real <a> stays in the tree (tabbable, named); the clones are aria-hidden. */
const sliceCta = (el: HTMLElement) => {
  if (el.dataset.horizonSliced === '1') return;
  el.dataset.horizonSliced = '1';
  const source = el.querySelector<HTMLElement>('a, button, .btn');
  if (!source) return;
  const host = document.createElement('div');
  host.className = 'horizon-strand-host';
  host.setAttribute('aria-hidden', 'true');
  const n = CTA_STRANDS;
  for (let i = 0; i < n; i += 1) {
    const slice = document.createElement('div');
    slice.className = 'horizon-strand horizon-strand--slice';
    slice.dataset.horizonStrand = 'slice';
    const left = (i / n) * 100;
    const right = 100 - ((i + 1) / n) * 100;
    slice.style.clipPath = `inset(0 ${right}% 0 ${left}%)`;
    slice.appendChild(source.cloneNode(true));
    host.appendChild(slice);
  }
  el.appendChild(host);
  source.classList.add('horizon-strand-source');
};

const clearStrandTransforms = (el: HTMLElement) => {
  el.querySelectorAll<HTMLElement>(STRAND_SEL).forEach((piece) => {
    piece.style.transform = '';
  });
};

const sameSize = (a: SignoffScene, b: SignoffScene) =>
  Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** GSAP reads `bottom bottom-=X` as "the trigger's bottom edge X px above the
 * bottom of the viewport". A negative inset — the degraded, hole-first framing,
 * where the headline has not arrived yet — has to flip the operator instead of
 * being written as the unparseable `bottom-=-X`. */
const triggerLine = (inset: number): string =>
  `bottom bottom${inset >= 0 ? '-=' : '+='}${Math.abs(Math.round(inset))}`;

/**
 * Paint-only enhancement. This IS ClosingSignoff's original footer, not a wrapper
 * (the curtain below depends on its margin and stacking context). The real
 * headline and the real CTA stay mounted, focusable and in the accessibility tree
 * throughout; the only extra DOM is a pointer-inert, aria-hidden canvas.
 *
 * THE HOLD IS NOT A PIN, AND THAT IS THE FIX. The requirement is one sentence
 * with three clauses, and every previous attempt died on the cost of the first:
 * pin the CONTAINER that holds both the black hole and "ENTER THE NEMOVERSE" from
 * the moment both are visible, release only after the hole has finished eating the
 * text and the button, and do not open a gap in the page.
 *
 * The attempt before this one used two GSAP pins, and died of what a pin costs.
 * `pinSpacing: true` pays for a pinned hold by padding the pin-spacer, and the
 * spacer replaces the pinned element IN THE FLOW:
 *
 *   · the hole's pin therefore reserved its whole span INSIDE `.singularity`,
 *     between the composition and the footer — 641 px of seam at 1280×900. That is
 *     the "wide gap between the singularity and the sign-off" verbatim: the price
 *     of the hold was billed into the one place a reader could see it.
 *   · a pinned element carries an inline `height`/`max-height` that GSAP copies
 *     off the computed style at swap time, permanently. The scene's own "is the
 *     stage the height I solved for?" guard therefore read 684 px where it expected
 *     545, mid-refresh, with the layout legitimately mid-swap — and its response
 *     was to tear the scene down from inside its own measurement: `fallBack()`
 *     from `onRefreshInit`, killing the hole's trigger before it had ever engaged
 *     and leaving the sheet parked `position: fixed` over a 641 px spacer nobody
 *     would ever take back (`trigger.kill()` without `revert` does not undo a
 *     pin). Pinning "entirely non-functional", from a mechanism that only ever
 *     failed while being measured.
 *
 * Both are properties of paying for the hold from inside the picture. So the hold
 * is paid for from OUTSIDE it, by one self-maintaining element (`holdDistanceAt`
 * in lib/spaghettification.ts has the arithmetic):
 *
 *   · `.bh-hold`, an empty div immediately above `#singularity`, gets a height of
 *     "how far the scroll has travelled through the hold, +1". Everything at or
 *     below it — the composition, the sheet, the curtain — is pushed down one
 *     pixel per scrolled pixel, so the reader cannot scroll away from the
 *     composition: the whole scene keeps ONE viewport position for the whole span,
 *     and every number this file paints is a difference between boxes inside it,
 *     which cancels the push exactly.
 *   · the release is the reservation simply stopping. No handover between two
 *     pinned triggers (that seam is where the teleport lived), no spacer to
 *     dismantle, no inline height to undo, no `pinChange` to be a frame late for.
 *     Scrolling up unwinds it by construction, and the document only ever grows.
 *   · the cost is spent in the void above the section, where nothing is measured
 *     and nobody is reading, so the sign-off's gap to the singularity stays the
 *     seam it was designed to be.
 *
 * THE PIN OUTLASTS THE TIMELINE, unchanged: the span is `run + settle`, the
 * consumption occupies the first `run` px and the hold keeps the screen locked for
 * `settle` px afterwards. The playhead is a scroll-domain quantity
 * (`consumptionTarget` + `followPlayhead`), never a time-domain scrub tween, and
 * `settle` is by construction longer than the playhead's smoothing distance, so the
 * guarantee does not depend on how fast the reader arrived.
 *
 * Layout is touched in exactly one direction. The flyers are lifted out of
 * document flow for the duration, the sheet's own height collapses as it is
 * consumed, and — because the sheet stays IN that flow while it is held — the
 * curtain's sticky floor rises into precisely the space the void is vacating, at
 * the rate `vacatedHeightAt` sets, so the distance from the sheet's hem to the end
 * of the site never changes. `lib/spaghettification.ts` holds that arithmetic as
 * pure functions.
 *
 * The capture and the warp are the only parts that still ask the GPU, and they are
 * gated apart from the hold (`canHoldSignoff` / `canWarpSignoff`): a footer that
 * cannot be rasterised loses its frozen frame (`data-horizon-state="hold"`) and
 * keeps its sequence. Gating the hold on the stage's status is what made the
 * section look un-pinned on every browser where `renderer.init()` does not
 * resolve — and it is the difference between an effect that degrades and one that
 * never appears.
 */
export default function SignoffHorizon({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const { canHoldSignoff, canWarpSignoff, frameRef, holdRef, cameraHoldRef, consumptionRef } = useSingularityGate();

  // useLayoutEffect, not useEffect: the reservation has to be in the DOM's height
  // before ScrollTrigger measures anything (a first paint with the composition
  // already inside the span would otherwise land on a document that has not been
  // extended yet), and the cleanup has to run synchronously before React removes
  // the footer — a detached `.bh-hold` cannot pay for a hold any more, and a
  // detached sheet cannot be measured. There is no re-parenting to unwind here:
  // nothing in this effect ever moves an element out of its parent.
  useLayoutEffect(() => {
    const sheet = rootRef.current;
    if (!sheet) return;
    const restorePaint = () => {
      sheet.style.removeProperty('--horizon-mix');
      sheet.style.removeProperty('--horizon-veil');
      delete sheet.dataset.horizonPaint;
      delete sheet.dataset.horizonProgress;
      delete sheet.dataset.horizonState;
      delete sheet.dataset.horizonScene;
      delete sheet.dataset.horizonRun;
    };
    // Frame fitting is a pure layout solve and must not wait for the
    // WebGPU/WebGL status or motion-preference gate. Pinning and consumption
    // remain opt-in below.
    const frame = frameRef.current;
    const holdEl = holdRef.current;
    const anchor = sheet.firstElementChild as HTMLElement | null;
    if (frame && anchor) {
      const flyerEls = {} as Record<FlyerId, HTMLElement>;
      let complete = true;
      for (const id of FLYER_IDS) {
        const el = sheet.querySelector<HTMLElement>(FLYER_SELECTOR[id]);
        if (!el) {
          complete = false;
          break;
        }
        flyerEls[id] = el;
      }
      if (complete) measureSignoffScene({ sheet, frame, anchor, flyers: flyerEls });
    }
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      // The finished reduced-motion state is the PLAIN footer, not a consumed
      // one: no capture, canvas, pin or scrub is ever created.
      mm.add(REDUCED_MOTION_QUERY, () => {
        restorePaint();
      });
      mm.add(MOTION_QUERY, () => {
        if (!frame || !anchor) return;
        // THE LAYOUT HALF is gated on layout alone: the hold, the fall, the
        // collapse and the release. THE PAINT HALF (`canWarpSignoff`) is the part
        // that needs a live stage, and it is asked separately, below.
        if (!canHoldSignoff) return;
        // Without the reservation there is nothing to hold the composition with, so
        // there is no scene: styling the footer while the page scrolls normally
        // under it would give the reader a collapse with no hold — the half-applied
        // state this file keeps refusing. Stand down instead.
        if (!holdEl) return;
        const flyerEls = {} as Record<FlyerId, HTMLElement>;
        for (const id of FLYER_IDS) {
          const el = sheet.querySelector<HTMLElement>(FLYER_SELECTOR[id]);
          // No flyers, nothing to consume: fail closed and keep the real footer.
          if (!el) return;
          flyerEls[id] = el;
        }
        let scene: SignoffScene | null = null;
        let capturedScene: SignoffScene | null = null;
        let released = false;
        let armed = false;
        /** Whether the scroll is inside the hold's span. Owns the camera gate and
         * the hem mask, and nothing else — the playhead deliberately does not read
         * it (see `applyFrame`). */
        let held = false;
        let sceneState = '';
        let sheetVeil = '';
        let lifted = false;
        let applying = false;
        let capturing = false;
        /** Mid-refresh: the layout is deliberately at rest and the scroll is not
         * where the reader is. See `prepareForRefresh`. */
        let refreshing = false;
        let savedScrollBehavior: string | null = null;
        let overlayOff = false;
        /** The scroller's inline `min-height` that `prepareMeasure` borrows to keep
         * the document open while the reservation is zeroed, or null when nothing is
         * borrowed. Handed back by `handBackDocument`, which `resync` and `release`
         * both call. */
        let measuringMinHeight: string | null = null;
        let warp: EventHorizonWarp | null = null;
        let holdTrigger: ScrollTrigger | null = null;
        let armTrigger: ScrollTrigger | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let refreshFrame = 0;
        let tailFrame = 0;
        let lastScroll = -1;
        /* How long the one-shot snapshot may hold the sheet still. Generous on
         * purpose: html2canvas clones the footer and rasterises it on the main
         * thread, which on a cold cache and a slow GPU is seconds, not frames. */
        const CAPTURE_PATIENCE_MS = 12_000;

        const abort = new AbortController();
        const playhead = { progress: 0 };

        /** The reservation's height. `SPACER_PAD` is the resting state, and the only
         * other writer is `applyHold` below: the element is never removed, never
         * hidden, never animated, so it cannot strand anything when it is released.
         *
         * Rounded to whole CSS pixels on purpose, and it is a rule of the MEDIUM,
         * not a style choice: scroll offsets are integers, so a box grown by a
         * fraction of a pixel moves the layout by a whole pixel (Chrome rounds the
         * grown box's own rect up) while `scrollHeight`/`scrollTop` floor it away.
         * The document then ends up 1px shorter per frame than the scroll it has to
         * support, the reader's position is clamped back, and the hold leaks a pixel
         * per wheel step — measured, the composition arriving 59px early after 59
         * frames of exactly that. Whole pixels put the layout and the scroll offset
         * in the same unit, and the `SPACER_PAD` makes the rounding go the safe way. */
        const setHold = (px: number) => {
          const wanted = `${Math.round(px)}px`;
          if (holdEl.style.height !== wanted) holdEl.style.height = wanted;
        };

        /** THE ONE THING THE BROWSER HAS TO BE TOLD NOT TO DO.
         *
         * Scroll anchoring is a kindness for the rest of the page — a late-loading
         * image above the viewport must not shove the reader away from what they
         * were reading — and it works by moving the SCROLL by the same amount the
         * layout moved the content, so the anchor node stays put on screen.
         *
         * That is the exact opposite of what a hold made of layout needs: here,
         * moving the content down by one pixel per scrolled pixel IS the effect, and
         * the scroll has to keep advancing so the trigger's progress can run. With
         * anchoring on, the two cancel in the wrong direction: the reservation grows,
         * the browser pulls `scrollY` back by the same amount, and the reader is
         * treading water at the top of the hold — measured, on Chromium, as the page
         * snapping from 1139 back to 1079 on the frame after the first push, with the
         * playhead frozen at 0 forever. A hold that cannot be scrolled through is
         * worse than no hold, so for as long as the composition is being pushed, the
         * scroller opts out and the layout is allowed to move the page's contents.
         *
         * It is written on the scroller rather than on `.bh-hold` because the
         * compensation is decided by the anchor node chosen from anywhere in the
         * scroller's contents: opting out the box that changes does not opt out the
         * node that gets stabilised. And it is switched back the moment the hold is
         * over, so the rest of the page keeps the behaviour it was designed with. */
        const setAnchoring = (locked: boolean) => {
          const wanted = locked ? 'none' : '';
          if (document.documentElement.style.overflowAnchor !== wanted) {
            document.documentElement.style.overflowAnchor = wanted;
          }
        };

        /** The reservation, from the RAW scroll — never from the smoothed playhead,
         * which is exactly what makes the held boxes lock to one viewport position
         * however hard the playhead lags. Called first on every scroll frame, every
         * refresh and every toggle, before anything is painted or measured. */
        const applyHold = (self?: ScrollTrigger) => {
          const source = self ?? holdTrigger;
          if (released || !source || !scene) return;
          const span = Math.max(1, scene.pinDistance);
          const scroll = source.scroll();
          setHold(holdDistanceAt(scroll, source.start, span));
          const active = holdActiveAt(scroll, source.start, span);
          if (active === held) return;
          held = active;
          cameraHoldRef.current = active;
          // The physical response (mass / lensing / Doppler / disk rotation) is
          // gated on the SAME hold edge as the camera: while the reservation is
          // growing the hole is eating, and every other state is the static
          // config. `BlackHoleStage` reads `active` and `progress` per frame.
          consumptionRef.current.active = active;
          setAnchoring(active);
        };

        /* ---- lifecycle --------------------------------------------------- */
        const release = () => {
          if (released) return;
          released = true;
          abort.abort();
          cancelAnimationFrame(refreshFrame);
          cancelAnimationFrame(tailFrame);
          resizeObserver?.disconnect();
          resizeObserver = null;
          ScrollTrigger.removeEventListener('refreshInit', prepareForRefresh);
          ScrollTrigger.removeEventListener('refresh', afterRefresh);
          afterRefresh();
          handBackDocument();
          cameraHoldRef.current = false;
          consumptionRef.current.active = false;
          consumptionRef.current.progress = 0;
          held = false;
          // The canvas is appended by hand, so React never sees it, and the WebGL2
          // context is ours to give back. Both used to leak: no dispose anywhere,
          // which a status flip (live → error → live) would pay for with a fresh
          // context per activation and a stale overlay over a plain footer.
          warp?.dispose();
          warp = null;
          armTrigger?.kill();
          armTrigger = null;
          holdTrigger?.kill();
          holdTrigger = null;
          releaseLayout();
          restorePaint();
          // The composition budget belongs to this scene. Withdrawing it gives the
          // stage its own responsive height back rather than leaving the black hole
          // shrunk for the rest of the session — and it is published on the frame,
          // so a teardown cannot leave anything behind on `<html>`.
          clearFrameFit(frame);
        };
        const fallBack = (reason: string, error?: unknown) => {
          if (released) return;
          release();
          sheet.dataset.horizonState = 'static';
          if (error) console.warn(`[signoff-horizon] ${reason} Keeping the real footer.`, error);
          else console.info(`[signoff-horizon] ${reason} Keeping the real footer.`);
        };

        /* ---- layout: the lift, the collapse, and the curtain's payback ---- */
        /** Take the two bodies out of document flow, at the exact boxes they
         * already occupy. Requirement 3's "detach" is literal: from here on the
         * fall is a transform on a box the layout can no longer move, and the
         * sheet's collapse cannot perturb a flyer's rest position by a
         * sub-pixel. The anchor's height is written back because lifting its
         * only two children would empty it. */
        const liftFlyers = () => {
          if (lifted || !scene) return;
          lifted = true;
          wrapGlyphs(flyerEls.invite);
          anchor.style.height = `${scene.anchorHeight}px`;
          for (const id of FLYER_IDS) {
            const el = flyerEls[id];
            const box = scene.flyers[id];
            el.style.position = 'absolute';
            el.style.left = `${box.left}px`;
            el.style.top = `${box.top}px`;
            el.style.width = `${box.width}px`;
            el.style.height = `${box.height}px`;
            el.style.margin = '0px';
          }
        };
        const dropFlyers = () => {
          if (!lifted) return;
          lifted = false;
          anchor.style.height = '';
          for (const id of FLYER_IDS) {
            const el = flyerEls[id];
            clearStrandTransforms(el);
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.width = '';
            el.style.height = '';
            el.style.margin = '';
          }
        };

        const releaseLayout = () => {
          cameraHoldRef.current = false;
          consumptionRef.current.active = false;
          consumptionRef.current.progress = 0;
          held = false;
          setAnchoring(false);
          // The reservation is the ONE thing this effect adds to the layout, so it
          // is the one thing teardown has to take back. Zeroing it shortens the
          // document, which is only ever safe at rest — and `prepareMeasure` is
          // the one caller that wants exactly that, for the duration of a refresh.
          setHold(0);
          dropFlyers();
          sheet.style.height = '';
          sheet.style.paddingTop = '';
          sheet.style.paddingBottom = '';
          sheet.style.removeProperty('--horizon-veil');
          sheetVeil = '';
          anchor.style.marginTop = '';
          for (const id of FLYER_IDS) {
            flyerEls[id].style.transform = '';
            flyerEls[id].style.opacity = '';
            flyerEls[id].style.pointerEvents = '';
          }
          if (sceneState) {
            sceneState = '';
            delete sheet.dataset.horizonScene;
          }
        };

        const remeasure = () => {
          const next = measureSignoffScene({ sheet, frame, anchor, flyers: flyerEls });
          if (!next) {
            fallBack('The held scene could not be measured.');
            return;
          }
          if (capturedScene && !sameSize(next, capturedScene)) {
            // A frozen raster cannot reflow with the hit targets. Deliberate
            // degradation, and it is now LOCAL to the overlay: retire the frame
            // and the canvas, keep the hold, the fall, the collapse and the
            // release — which are layout, and which the next approach of the
            // footer re-arms for a fresh capture.
            retireOverlay('Layout changed after arming; the one-shot raster was retired.');
          }
          scene = next;
          // Published with the other state attributes: the consumption's own
          // scroll distance, which is what makes the settle margin after it
          // inspectable (and testable) from outside the effect. The pin span is
          // the trigger's `end - start`; the fall ends `run` px into it.
          sheet.dataset.horizonRun = String(next.run);
          if (held) {
            // The hold is running, so the reservation and everything painted
            // against the re-measured scene have to be re-applied now: a resize
            // that landed mid-span would otherwise paint the OLD geometry over a
            // layout that no longer matches it.
            applyHold();
            applyFrame(playhead.progress);
          }
        };

        /** Re-measure the scene with the layout genuinely at rest, and with the
         * reservation OUT of the way: the trigger line, the frame's box, the
         * headline's rise and the curtain's tail are all properties of the
         * document's own geometry, and the hold is this effect's addition to it.
         * Zeroing it first is what makes a measurement taken mid-hold identical to
         * one taken at rest — the one invariant the whole scene leans on. It also
         * puts the sheet's real box back, because a half-consumed sheet would be
         * measured as the scene's rest height. */
        /** The borrowed length goes back. Split out of `prepareMeasure` because the
         * restore has to reach three places: the end of a refresh, the end of the
         * capture window, and `release` — the last of which must not leave the page
         * a span too long with nothing in it. */
        const handBackDocument = () => {
          if (measuringMinHeight === null) return;
          document.documentElement.style.minHeight = measuringMinHeight;
          measuringMinHeight = null;
        };

        const prepareMeasure = () => {
          const root = document.documentElement;
          const before = root.scrollHeight;
          setHold(0);
          releaseLayout();
          remeasure();
          // A zeroed reservation is a page a whole span shorter, and any scroll
          // recorded across that window is clamped by the short document: GSAP's
          // `refresh` saves the scroll position and puts it back, the browser clamps
          // a `scrollTo` on the way through, and the reader ends up at the bottom of
          // a page that no longer exists rather than where they were standing. The
          // hold then re-applies at a scroll outside the span and the composition
          // stalls at the top of the hold — the exact failure the earlier attempts at
          // this section kept producing. So the layout is put at rest, which is what
          // the measurement is for, while the LENGTH is held open until the
          // reservation comes back. Positions at rest, scroll unaffected.
          if (measuringMinHeight === null && before > root.scrollHeight) {
            measuringMinHeight = root.style.minHeight;
            root.style.minHeight = `${before}px`;
          }
        };

        /* GSAP refreshes for reasons of its own (a resize, a `scrollEnd` repair,
         * another component's `ScrollTrigger.refresh()`), and a refresh is a
         * violent event for a layout-driven hold: `_refreshAll()` records the
         * scroll, sets it to 0, repositions every trigger, then puts the scroll
         * back. Three things have to happen around that.
         *
         *  · THE SCENE IS MEASURED AT REST, before anything is positioned. Hence
         *    `refreshInit`, which GSAP dispatches to every trigger before it
         *    touches a single layout.
         *  · THE EFFECT'S OWN WRITES ARE FROZEN while it runs. The reservation is
         *    zeroed for the duration, so a `scroll` event arriving mid-refresh
         *    reports a document 640 px shorter than the reader is standing in;
         *    re-applying the hold from that reading is how the previous attempt
         *    came to snap the page back to the start of the span and stall there.
         *    `onScrollFrame`, the tail and the ResizeObserver all check this flag.
         *  · SMOOTH SCROLLING IS TURNED OFF for the duration. `html` carries
         *    `scroll-behavior: smooth` for the page's anchor links, which turns
         *    GSAP's "scroll to 0, then back" into two animated scrolls that fight
         *    each other across frames — the layout gets measured while the page is
         *    gliding somewhere else, and the trigger's line is derived from a
         *    scroll position that is on its way somewhere. `auto` for the length of
         *    one refresh makes both jumps synchronous, which is also what GSAP
         *    itself does for its own scrollers. */
        const prepareForRefresh = () => {
          if (released) return;
          refreshing = true;
          const root = document.documentElement;
          savedScrollBehavior = root.style.scrollBehavior;
          root.style.scrollBehavior = 'auto';
          prepareMeasure();
        };
        const afterRefresh = () => {
          const root = document.documentElement;
          if (savedScrollBehavior !== null) root.style.scrollBehavior = savedScrollBehavior;
          savedScrollBehavior = null;
          if (released) return;
          refreshing = false;
          // The scroll has been put back, so the reservation, the camera gate and
          // the playhead are re-derived against the layout as it now stands.
          resync();
        };

        /** The capture and the warp, lost. `applyFrame` then paints the live
         * flyers with no alpha exchange, and the next approach of the footer can
         * arm a fresh capture (the layout changed, so the old raster is no longer
         * the page it depicts). */
        const retireOverlay = (reason: string, error?: unknown) => {
          if (released || overlayOff) return;
          overlayOff = true;
          armed = false;
          capturedScene = null;
          warp?.dispose();
          warp = null;
          if (error) console.info(`[signoff-horizon] ${reason}`, error);
          else console.info(`[signoff-horizon] ${reason}`);
          // Say WHAT is running, not merely that the paint is gone: a reader (and
          // a test) has to be able to tell "the overlay is not mounted here" from
          // "the scene never ran". Losing that distinction is how a missing GPU
          // used to read as a missing pin.
          if (held) sheet.dataset.horizonState = 'hold';
          else delete sheet.dataset.horizonState;
          delete sheet.dataset.horizonPaint;
        };

        /* ---- the playhead: scroll-domain, exact at both ends ------------- */
        /** The consumption the scroll is asking for RIGHT NOW. A pure function of
         * the hold's own progress: 0 at the trigger line, 1 at the end of the run,
         * held at 1 across the settle margin. */
        const targetProgress = (): number =>
          holdTrigger && scene ? consumptionTarget(holdTrigger.progress, scene.consumptionShare) : 0;

        /** Advance the written playhead by no more than the scroll moved. A
         * jump further than the smoothing distance lands exactly, which is what
         * makes a scrollbar drag or a programmatic scroll deterministic. */
        const stepPlayhead = (scrollDelta: number): boolean => {
          const next = followPlayhead(playhead.progress, targetProgress(), scrollDelta);
          if (next === playhead.progress) return false;
          playhead.progress = next;
          return true;
        };

        /** The time-domain tail: when the reader STOPS with a residual left —
         * scrolling back up out of the hold, where there is no settle margin to
         * converge in — the playhead still has to arrive, or the scene is left
         * half-applied on an unpinned layout. Rate-limited, so it lands exactly
         * and then stops. */
        const tailTick = () => {
          tailFrame = 0;
          // A refresh is in flight: the sheet is at rest, the scroll is wherever
          // GSAP left it, and the target is meaningless. Try again next frame.
          if (released || refreshing) {
            if (!released) scheduleTail();
            return;
          }
          // Busy this frame (a capture is holding the sheet at playhead 0, or a
          // frame is being applied): try again on the next one rather than
          // dropping a residual on the floor.
          if (capturing || applying) {
            scheduleTail();
            return;
          }
          if (stepPlayhead(0)) applyFrame(playhead.progress);
          if (!released && playhead.progress !== targetProgress()) scheduleTail();
        };
        const scheduleTail = () => {
          if (tailFrame || released) return;
          tailFrame = requestAnimationFrame(tailTick);
        };

        const onScrollFrame = (self: ScrollTrigger) => {
          if (released || refreshing) return;
          // BEFORE the `applying` guard and before the playhead: the layout is
          // written from the raw scroll on the frame the scroll arrived, because
          // the boxes everything else is measured against are the boxes this
          // holds. `applying` only guards the paint, which may legitimately wait.
          applyHold(self);
          if (!scene || applying) return;
          const scroll = self.scroll();
          // No previous sample (a scroll that arrived before any resync): treat
          // it as one full smoothing distance, i.e. land exactly where the
          // scroll is asking instead of easing into it from an unknown place.
          const delta = lastScroll < 0 ? PLAYHEAD_SMOOTH_PX : scroll - lastScroll;
          lastScroll = scroll;
          if (stepPlayhead(delta)) applyFrame(playhead.progress);
          if (playhead.progress !== targetProgress()) scheduleTail();
        };

        /* ---- the scene, once per playhead -------------------------------- */
        const applyFrame = (progress: number) => {
          if (released || !scene || applying) return;
          applying = true;
          try {
            const current = scene;
            // While the one-shot snapshot is being taken the sheet has to hold
            // its rest geometry, or the frozen frame would capture a
            // half-collapsed box with half-warped glyphs. Rendering playhead 0
            // (instead of skipping the frame) matters: the spacer keeps tracking
            // the raw scroll, so the curtain's window still opens one pixel
            // below the hem and no gap opens under the sheet while the reader
            // waits for the capture.
            const p = clamp01(capturing ? 0 : progress);
            // The simulation's physical response reads this playhead each frame.
            // Written here, on the same clock the warp is painted with, so the
            // hole reacts to the consumption at the moment it happens.
            consumptionRef.current.progress = p;
            const holding = held || p > 0;
            // The hole is rigidly static for as long as the screen is locked, and
            // its cinematic camera holds with it — `applyHold` owns that flag, on
            // the span's edges rather than on the playhead: the hold is over the
            // moment the reservation stops growing, even if the tail is still
            // settling the last of the fall on a layout that is scrolling away. A
            // held camera after the release would freeze the stage's establishing
            // move for the rest of the session.
            if (holding) liftFlyers();
            else dropFlyers();

            const fraction = collapseAt(p);
            const consumed = current.collapsible * fraction;
            const target = sheetHeightAt(p, current.height, current.collapsible);

            // The sheet's box collapses. Its top padding is handed to the
            // anchor's margin (a fixed-position sheet is a BFC, so the margin
            // cannot collapse through it), which lets the border box reach a
            // true zero without moving a single flyer's rest position.
            const paddingBottom = current.paddingBottom * (1 - fraction);
            anchor.style.marginTop = consumed > 0 ? `${current.paddingTop}px` : '';
            sheet.style.paddingTop = consumed > 0 ? '0px' : '';
            // The sheet's box is written only while the scene has hold of it: at
            // playhead 0 the real box IS the number, and leaving a rounded
            // `439.844px` inline on an unconsumed footer both counts as a layout
            // change this effect "caused" (which re-triggers the ResizeObserver,
            // and with it a refresh) and makes the disarmed state unverifiable.
            sheet.style.paddingBottom = holding ? `${paddingBottom}px` : '';
            sheet.style.height = holding ? `${target}px` : '';

            // The hem clip (see signoff-horizon.css): the frozen frame and the
            // lifted flyers keep their rest-size boxes while the sheet's own box
            // collapses, so the sheet clips them to itself plus the veil above.
            if (sheetVeil !== `${current.veil}px`) {
              sheetVeil = `${current.veil}px`;
              sheet.style.setProperty('--horizon-veil', sheetVeil);
            }

            // And that is all the layout this frame touches. There is no spacer to
            // compensate, for two reasons: the sheet was never re-parented, so its
            // own `--curtain-travel` margin still belongs to it; and it is still
            // IN the flow, so shrinking it IS the payback — the sticky floor and
            // the clip window that hides the floor above the hem rise by exactly
            // the space the sheet has vacated, at the rate `vacatedHeightAt`
            // sets, and by nothing else. The reservation above the composition
            // grows by the same pixel this one shrinks by, which is why the hem's
            // distance to the end of the site is constant to within `SPACER_PAD`
            // at any playhead lag, and why a release that lands on a still-
            // settling fall moves nothing.

            // The flyers: the same field the shader integrates per fragment,
            // evaluated per element. Translation onto the singularity's exact
            // coordinates, tidal stretch along the pull axis, squeeze across it,
            // frame dragging, and a scale that reaches precisely zero.
            const geometry = sceneGeometry(current);
            const radius = horizonRadiusAtProgress(p, geometry);
            const singularity = {
              x: current.sheetLeft + current.anchorX,
              y: current.pinnedTop + current.anchorY,
            };
            for (const id of FLYER_IDS) {
              const el = flyerEls[id];
              const rest = {
                x: current.sheetLeft + current.flyers[id].x,
                y: current.pinnedTop + current.flyers[id].y,
              };
              const flyer = flyerFrameAt(p, rest, singularity, radius);
              el.style.transform = flyerTransform(flyer);
              el.style.opacity = warp ? flyer.opacity.toFixed(4) : '';
              el.style.pointerEvents = flyer.consumed ? 'none' : '';

              const pieces = el.querySelectorAll<HTMLElement>(STRAND_SEL);
              pieces.forEach((piece) => {
                let pieceRest = {
                  x: Number(piece.dataset.strandRestX),
                  y: Number(piece.dataset.strandRestY),
                };
                if (!Number.isFinite(pieceRest.x) || !Number.isFinite(pieceRest.y)) {
                  piece.style.transform = 'none';
                  const fresh = piece.getBoundingClientRect();
                  pieceRest = {
                    x: fresh.left + fresh.width / 2,
                    y: fresh.top + fresh.height / 2,
                  };
                  piece.dataset.strandRestX = String(pieceRest.x);
                  piece.dataset.strandRestY = String(pieceRest.y);
                }
                const frame = strandPieceAt(p, pieceRest, rest, singularity, radius);
                piece.style.transform = strandDeltaTransform(frame, flyer);
              });
            }

            // The frozen frame takes over the paint as the field takes hold —
            // and only if there is a frozen frame to take over with.
            sheet.style.setProperty('--horizon-mix', (warp ? overlayMixAt(p) : 0).toFixed(4));
            // Degraded, but only in paint: say so, so a reader (and a test) can
            // tell "the overlay is not mounted here" from "the scene never ran".
            if (!warp && held && sheet.dataset.horizonState !== 'hold') sheet.dataset.horizonState = 'hold';
            if (warp) {
              try {
                warp.draw(p, geometry);
                sheet.dataset.horizonPaint = 'snapshot';
              } catch (error) {
                // A dead context costs the frozen frame. It does not cost the hold,
                // the fall, the collapse or the release, and it must never take the
                // composition's box down with it — that is how a driver reset
                // became "pinning is entirely non-functional".
                retireOverlay('Drawing the snapshot failed; the live paint carries the fall.', error);
                return;
              }
            }

            const state = holding ? 'pinned' : 'idle';
            if (state !== sceneState) {
              sceneState = state;
              sheet.dataset.horizonScene = state;
            }
            sheet.dataset.horizonProgress = p.toFixed(4);
          } finally {
            applying = false;
          }
        };

        const resync = (self?: ScrollTrigger) => {
          // The borrowed document length goes back before the box is re-applied, so
          // the two never overlap: reservation plus a padded root would be a page a
          // span too long, and the reader would find blank space under the footer.
          handBackDocument();
          // First, the box: a refresh may have re-derived `start`, and a
          // re-measure may have changed the span, so the reservation is re-applied
          // to the geometry as it now stands. This is also the ONLY thing that puts
          // the hold back at the end of a refresh that did not need a re-measure.
          applyHold(self);
          if (!scene) return;
          // A refresh or a toggle is not a scroll: snap to the state the scroll is
          // actually asking for instead of trusting a playhead a stale measurement
          // left behind, then re-derive from here.
          lastScroll = (self ?? holdTrigger)?.scroll() ?? -1;
          playhead.progress = targetProgress();
          applyFrame(playhead.progress);
        };

        /** Take the frozen frame, then hand it to WebGL2. Everything in here is
         * paint: a failure retires the overlay and leaves the hold running. */
        const arm = () => {
          if (released || armed || overlayOff || !scene || !canWarpSignoff) return;
          armed = true; // BEFORE any await: onEnter/refresh/scroll-back share it
          sheet.dataset.horizonState = 'capturing';
          void (async () => {
            // Also defers past StrictMode's immediate mount → cleanup → mount.
            await document.fonts.ready;
            if (released) return;
            const [{ captureSignoff }, { createEventHorizonWarp }] = await Promise.all([
              import('../lib/captureSignoff'),
              import('../three/eventHorizonWarp'),
            ]);
            if (released) return;
            // `remeasure`, NOT `prepareMeasure`. The snapshot has to be a raster of
            // the sheet's REST geometry, and `capturing` below is what pins it there
            // — the reservation is not part of that geometry, and zeroing it is the
            // one thing that must not happen while the reader stands inside the span:
            // it takes a whole span out of the document ABOVE them, so the scroll
            // they asked for is momentarily past the end of the page, the jump is
            // clamped, the hold disengages at the clamped offset, and nothing puts
            // it back (a retired overlay returns before the restore). The reader
            // ends up parked at progress 0 at the top of a span they have already
            // paid for, which is what this section's whole first attempt did.
            // Everything `measureSignoffScene` reads is a size or a relative
            // distance, and `pinnedTop` is derived analytically rather than off a
            // held rect, so the held layout measures the same scene.
            let snapshot: HTMLCanvasElement;
            // A capture that never comes back would freeze the fall at playhead 0
            // for the rest of the session, because the sheet is deliberately held
            // still while the snapshot is taken. The frozen frame is an
            // optimisation and the hold is not, so the clock belongs to the
            // overlay: after this long the capture is abandoned, the fall resumes
            // from wherever the scroll has it, and the live paint carries the
            // consumption. Without it a software rasteriser that takes its time —
            // or a page that loses the iframe race — costs the reader the whole
            // animation, which is a worse failure than no animation at all.
            const patience = setTimeout(() => {
              abort.abort();
              retireOverlay('The sign-off capture did not finish in time; the live paint carries the fall.');
              resync();
            }, CAPTURE_PATIENCE_MS);
            try {
              // captureSignoff awaits font work before it clones, so the live
              // sheet has to be held still across the whole call.
              snapshot = await captureSignoff(sheet, abort.signal);
            } finally {
              clearTimeout(patience);
              capturing = false;
            }
            try {
              // Re-read the geometry the overlay is about to be painted against: the
              // sheet has been held at playhead 0 across the whole capture. Still
              // without touching the reservation, for the reason documented above.
              remeasure();
              if (released || overlayOff || !scene) return;
              // No `pinnedTop` to re-read off a parked box: the sheet stayed in flow
              // for the whole capture, so the scene measured between the two
              // `prepareMeasure` calls is already the geometry the overlay will be
              // painted against. `resync()` at the end re-applies the reservation.
              warp = createEventHorizonWarp(snapshot, () =>
                retireOverlay('The overlay WebGL2 context was lost; the live paint carries the fall.'),
              );
              // Upload/draw must succeed BEFORE touching live DOM paint: the
              // crossfade is only ever written once this frame is really there.
              warp.draw(playhead.progress, sceneGeometry(scene));
              sheet.appendChild(warp.canvas);
              sheet.dataset.horizonState = 'ready';
              // `prepareMeasure` zeroed the reservation for the capture, and no
              // scroll may arrive between then and now: re-apply the hold AND
              // re-derive the playhead against the re-measured scene, which also
              // paints the restored scroll position a restored scroll may be at.
              resync();
            } finally {
              snapshot.width = snapshot.height = 0; // GPU now owns the only copy
            }
          })().catch((error: unknown) => {
            // No snapshot, no WebGL2, a module that will not load: lose the frozen
            // frame, keep the hold, and let the next approach of the footer try
            // again. Refusing the whole scene for this is what made a missing GPU
            // look like a missing pin.
            if (!released) {
              retireOverlay('Capturing or uploading the sign-off failed; the live paint carries the fall.', error);
              resync();
            }
          });
        };

        /* ---- the hold: one span, one trigger, no pin ------------------ */
        // Measure once before anything is positioned: the trigger line, the run and
        // the container budget all come out of this pass, and the run has to be
        // published before ScrollTrigger is asked to place a start line.
        prepareMeasure();
        if (released || !scene) return;

        // ONE trigger, and no `pin` on it. The composition is held by the
        // reservation `.bh-hold` grows above it, which means:
        //
        //   · there is nothing to keep in sync. The hole and the sheet used to be
        //     two pins whose starts had to be offset against each other's spacer,
        //     and whose ends had to be made to land on the same pixel; here they
        //     are the same box, moved by the same number, so `|sheet.start −
        //     hole.start| = 0` and `|sheet.end − hole.end| = 0` are not a
        //     property the effect maintains but a fact about there being one
        //     trigger at all. The release cannot be a handover, because there is
        //     nothing to hand over.
        //   · the measurement is stable. GSAP writes no inline size on anybody and
        //     re-parents nothing, so `measureSignoffScene` sees the layout it
        //     expects whether or not the hold is engaged — which is why the strict
        //     frame-height guard below (and with it the whole scene) can survive a
        //     refresh, where before it killed the scene from inside one.
        //
        // `start` is the REFERENCE FRAMING: the headline's bottom edge one resolved
        // `titleAir` above the bottom of the viewport, with the container's height
        // budgeted so the whole hole is inside the top of the viewport on that same
        // pixel. `solveFraming` makes both containment conditions true together
        // (see lib/spaghettification.ts), and the reservation is written from this
        // trigger's own scroll, so the hole does not move by one pixel for the whole
        // fall and the settle after it.
        //
        // No scrub TWEEN. GSAP's `scrub` smooths in TIME and this hold releases on
        // a SCROLL pixel — the two clocks cannot be made to agree, which is how the
        // attempt before last came to let go with the fall still in flight. The
        // playhead is derived from `self.progress` directly (`consumptionTarget`)
        // and smoothed in the scroll domain (`followPlayhead`), with the settle
        // margin paying for the smoothing. `scrub: true` is still declared, for one
        // mechanical reason: GSAP only calls `onUpdate` on a trigger it does not
        // classify as a toggle (`isToggle = !scrub && scrub !== 0`), and with no
        // animation attached it creates no scrub tween either. So this is the flag
        // that makes the trigger report every scroll frame, and nothing more.
        ScrollTrigger.addEventListener('refreshInit', prepareForRefresh);
        ScrollTrigger.addEventListener('refresh', afterRefresh);

        holdTrigger = ScrollTrigger.create({
          id: 'signoff-horizon',
          trigger: flyerEls.invite,
          scrub: true,
          start: () => triggerLine(scene?.triggerInset ?? 0),
          end: () => `+=${Math.max(1, scene?.pinDistance ?? 1)}`,
          invalidateOnRefresh: true,
          onRefresh: resync,
          onToggle: resync,
          // The reservation and the playhead are written in the same callback GSAP
          // runs inside its own ticker, so the layout can never be a frame behind
          // the paint — and the release lands on a playhead that is provably 1.
          onUpdate: onScrollFrame,
        });

        // THE CAPTURE, armed well before it is needed: html2canvas plus the font
        // embedding is hundreds of milliseconds of work, and the sheet has to be
        // frozen at rest for all of it. Arming four seams below the fold buys
        // roughly a viewport of scroll on top of the hold's first leg, so a fast
        // fling still arrives after the frozen frame is ready instead of catching
        // the fall mid-capture.
        //
        // This is the ONLY place `canWarpSignoff` is consulted, and it is
        // deliberately not the same question as the hold: a stage that never went
        // live costs the reader the frozen frame, not the sequence.
        if (canWarpSignoff) {
          armTrigger = ScrollTrigger.create({
            id: 'signoff-horizon-arm',
            trigger: frame,
            start: () => `bottom bottom+=${Math.max(1, Math.round((scene?.seam ?? 0) * 4))}`,
            onEnter: arm,
            onEnterBack: arm,
            onRefresh: (self) => {
              if (self.scroll() >= self.start) arm();
            },
          });
          // Handles deep-link / browser-restored scroll and a stage that becomes
          // live only after the reader has already passed the arm line.
          if (armTrigger.scroll() >= armTrigger.start) void arm();
        }
        resync();

        // The frame and the curtain are the two boxes this scene is measured
        // from, and neither is animated by the effect — watching the sheet
        // itself would watch the collapse and feed itself.
        const curtain = curtainElements();
        resizeObserver = new ResizeObserver(() => {
          // `applying`/`refreshing`: both are moments when this effect is the one
          // changing the observed boxes (the collapse writes the sheet's height),
          // and re-measuring in response to your own write is how a scene eats its
          // own tail. The refresh that follows will re-measure anyway.
          if (released || applying || refreshing) return;
          const previous = scene;
          prepareMeasure();
          if (released || !scene) return;
          const moved =
            !previous ||
            !sameSize(previous, scene) ||
            previous.seam !== scene.seam ||
            previous.frameHeight !== scene.frameHeight ||
            previous.naturalFrameHeight !== scene.naturalFrameHeight ||
            previous.tail !== scene.tail ||
            previous.collapsible !== scene.collapsible ||
            previous.rise !== scene.rise ||
            previous.belowTitle !== scene.belowTitle ||
            previous.triggerInset !== scene.triggerInset ||
            previous.degraded !== scene.degraded ||
            previous.pinDistance !== scene.pinDistance;
          if (moved) {
            cancelAnimationFrame(refreshFrame);
            refreshFrame = requestAnimationFrame(() => {
              if (!released) ScrollTrigger.refresh();
            });
          } else {
            resync();
          }
        });
        resizeObserver.observe(frame);
        if (curtain.floor) resizeObserver.observe(curtain.floor);
        else if (curtain.stage) resizeObserver.observe(curtain.stage);
        return release;
      });
    }, sheet);

    return () => {
      mm.revert();
      ctx.revert();
      cameraHoldRef.current = false;
      // `release` (the matchMedia cleanup) has already run by now, so these two
      // are the belt for the braces: a scene that never reached its cleanup — or
      // one whose gate closed while a capture was in flight — must not leave the
      // black hole budgeted, the footer styled, or the page 641 px longer than
      // the composition it was built on.
      holdRef.current && (holdRef.current.style.height = '');
      clearFrameFit(frameRef.current);
      restorePaint();
    };
  }, [canHoldSignoff, canWarpSignoff, frameRef, holdRef, cameraHoldRef, consumptionRef]);

  return <footer ref={rootRef} className="footer signoff" aria-label="Closing invitation">{children}</footer>;
}
