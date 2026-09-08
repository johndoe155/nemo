import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOTION_QUERY, REDUCED_MOTION_QUERY, useSingularityGate } from '../lib/singularityGate';
import {
  analyticPinnedTop,
  clearFrameFit,
  curtainElements,
  measurePinnedTop,
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
  horizonRadiusAtProgress,
  overlayMixAt,
  sheetHeightAt,
  spacerBoxAt,
  type FlyerId,
} from '../lib/spaghettification';
import type { EventHorizonWarp } from '../three/eventHorizonWarp';
import '../styles/signoff-horizon.css';

gsap.registerPlugin(ScrollTrigger);

const FLYER_SELECTOR: Record<FlyerId, string> = {
  invite: '[data-horizon-item="invite"]',
  cta: '[data-horizon-item="cta"]',
};

const sameSize = (a: SignoffScene, b: SignoffScene) =>
  Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** GSAP reads `bottom bottom-=X` as "the trigger's bottom edge X px above the
 * bottom of the viewport". A negative inset — the degraded, hole-first framing,
 * where the headline has not arrived yet — has to flip the operator instead of
 * being written as the unparseable `bottom-=-X`. */
const triggerLine = (inset: number): string =>
  `bottom bottom${inset >= 0 ? '-=' : '+='}${Math.abs(Math.round(inset))}`;

/** GSAP keeps the pin-spacer on the trigger instance but not on its public
 * type. The spacer is the only element that can pay the curtain back for the
 * height the consumption removes, so the effect needs it. */
const spacerOf = (trigger: ScrollTrigger | null | undefined): HTMLElement | null =>
  (trigger as unknown as { spacer?: HTMLElement } | null)?.spacer ?? null;

/** Paint-only enhancement. This IS ClosingSignoff's original footer, not a
 * wrapper (the curtain below depends on its margin and stacking context). The
 * real headline and the real CTA stay mounted, focusable and in the
 * accessibility tree throughout; the only extra DOM is a pointer-inert,
 * aria-hidden canvas.
 *
 * THE PIN BELONGS TO THE BLACK HOLE. Two ScrollTriggers, one scene, one span:
 *
 *   · `signoff-horizon-hole` pins `.bh-frame` — the CONTAINER the black hole
 *     lives in — on the REFERENCE FRAMING: the first scroll position where the
 *     viewport holds the whole container at the top AND the whole "ENTER THE
 *     NEMOVERSE" headline at the bottom, with the CTA still below the fold. That
 *     composition is solved, not hoped for: `solveFraming` budgets the
 *     container's height against the measured distance to the headline, so both
 *     containment conditions are true on the same scroll pixel (see
 *     `lib/spaghettification.ts`). The frame is `position: fixed` for the whole
 *     span, so the hole does not move by one pixel — and the stage's cinematic
 *     camera is held through the gate for as long as the screen is locked, so
 *     the singularity the invitation falls into is a fixed point on screen in
 *     every sense, not just a fixed box.
 *   · `signoff-horizon` pins the sheet on the SAME line for the SAME span and
 *     owns the playhead. It is pinned because the fall needs the singularity to
 *     be a fixed point in the sheet's own coordinate space, and because a sheet
 *     left in flow would slide past the hole and drag the curtain with it. Its
 *     start is offset by the span the hole's spacer reserves above the sheet
 *     (`sheetStartOffset`), which is what makes the two pins coextensive rather
 *     than sequential: one continuous hold, no gap, no double-pin, no jump.
 *
 * THE PIN OUTLASTS THE TIMELINE. The span is `run + settle`: the consumption
 * occupies the first `run` px and the pins keep holding the screen for `settle`
 * px afterwards. The playhead is a scroll-domain quantity (`consumptionTarget` +
 * `followPlayhead`), never a time-domain scrub tween, so it is exact at both
 * ends and cannot still be travelling when GSAP lets go — which is the one thing
 * requirement 2 asks of the release. `settle` is by construction longer than the
 * playhead's smoothing distance, so the guarantee does not depend on how fast
 * the reader arrived.
 *
 * Layout is touched in exactly one direction. The flyers are lifted out of
 * document flow for the duration, the sheet's own height collapses as it is
 * consumed, and its pin-spacer returns that height to the document at the same
 * rate — so the curtain floor rises by precisely the space the void is
 * vacating, and the distance from the sheet's hem to the end of the site never
 * changes. `lib/spaghettification.ts` holds that arithmetic as pure functions.
 */
export default function SignoffHorizon({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const { canWarpSignoff, frameRef, cameraHoldRef } = useSingularityGate();

  // useLayoutEffect, not useEffect: GSAP's pin re-parents both the hole's frame
  // and this footer into their pin-spacers, and a PASSIVE cleanup would only run
  // after React has already tried (and failed, NotFoundError) to delete the
  // re-parented nodes from their recorded parents. Layout cleanups run
  // synchronously before host deletions, so the trigger kills below have
  // restored both elements by the time React removes them.
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
        const flyerEls = {} as Record<FlyerId, HTMLElement>;
        for (const id of FLYER_IDS) {
          const el = sheet.querySelector<HTMLElement>(FLYER_SELECTOR[id]);
          // No flyers, nothing to consume: fail closed and keep the real footer.
          if (!el) return;
          flyerEls[id] = el;
        }
        if (!canWarpSignoff) return;

        let scene: SignoffScene | null = null;
        let capturedScene: SignoffScene | null = null;
        let released = false;
        let armed = false;
        let sceneState = '';
        let spacerMargin = '';
        let sheetVeil = '';
        let lifted = false;
        let applying = false;
        let capturing = false;
        let warp: EventHorizonWarp | null = null;
        let holeTrigger: ScrollTrigger | null = null;
        let sheetTrigger: ScrollTrigger | null = null;
        let armTrigger: ScrollTrigger | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let refreshFrame = 0;
        let tailFrame = 0;
        let lastScroll = -1;
        const abort = new AbortController();
        const playhead = { progress: 0 };

        /* ---- lifecycle --------------------------------------------------- */
        const release = () => {
          released = true;
          abort.abort();
          cancelAnimationFrame(refreshFrame);
          cancelAnimationFrame(tailFrame);
          resizeObserver?.disconnect();
          cameraHoldRef.current = false;
          armTrigger?.kill();
          holeTrigger?.kill();
          const spacer = spacerOf(sheetTrigger);
          sheetTrigger?.kill();
          sheetTrigger = null;
          // The spacer outlives its trigger on GSAP's pin cache. Clearing the
          // compensation here means a later activation can never re-insert a
          // spacer that is already short by a consumed sheet.
          if (spacer) {
            spacer.style.height = '';
            spacer.style.paddingBottom = '';
          }
          releaseLayout();
          restorePaint();
          // The composition budget belongs to this scene. Withdrowing it gives
          // the stage its own responsive height back rather than leaving the
          // black hole shrunk for the rest of the session.
          clearFrameFit();
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
          const spacer = spacerOf(sheetTrigger);
          if (spacer) {
            spacer.style.height = '';
            spacer.style.paddingBottom = '';
          }
        };

        const remeasure = () => {
          const next = measureSignoffScene({ sheet, frame, anchor, flyers: flyerEls, previous: scene });
          if (!next) {
            fallBack('The pinned scene could not be measured.');
            return;
          }
          if (capturedScene && !sameSize(next, capturedScene)) {
            // A frozen raster cannot reflow with the hit targets. Deliberate
            // degradation: retire it for this activation rather than stretch
            // misregistered type or secretly take another snapshot on resize.
            // Killing the triggers reverts both pins, so retirement also
            // restores the ordinary in-flow footer and its curtain spacing.
            fallBack('Layout changed after arming; the one-shot raster was retired.');
            return;
          }
          scene = next;
          // Published with the other state attributes: the consumption's own
          // scroll distance, which is what makes the settle margin after it
          // inspectable (and testable) from outside the effect. The pin span is
          // the trigger's `end - start`; the fall ends `run` px into it.
          sheet.dataset.horizonRun = String(next.run);
        };

        // Everything GSAP is about to measure has to be at rest: the sheet's
        // height drives its own pin-spacer, and a collapsed sheet would park
        // the wrong distance in the document.
        const prepareMeasure = () => {
          releaseLayout();
          remeasure();
        };

        const syncPin = () => {
          if (!scene) return;
          scene.pinnedTop = measurePinnedTop(sheet, analyticPinnedTop(scene));
        };

        /* ---- the playhead: scroll-domain, exact at both ends ------------- */
        /** The consumption the scroll is asking for RIGHT NOW. A pure function
         * of the pin's own progress: 0 at the trigger line, 1 at the end of the
         * run, held at 1 across the settle margin. */
        const targetProgress = (): number =>
          sheetTrigger && scene ? consumptionTarget(sheetTrigger.progress, scene.consumptionShare) : 0;

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
          if (released) return;
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

        const onScrollFrame = () => {
          if (released || !scene || applying) return;
          const scroll = sheetTrigger ? sheetTrigger.scroll() : window.scrollY;
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
            const pinned = sheet.style.position === 'fixed';
            const holding = pinned || p > 0;
            // The hole is rigidly static for as long as the screen is locked:
            // the container is pinned (`position: fixed`), and its cinematic
            // camera holds with it. Gated on the FRAME's own pin, not on the
            // playhead — the hold is over the moment the container lets go, even
            // if the tail is still settling the last of the fall on an unpinned
            // layout. A held camera after the release would freeze the stage's
            // establishing move for the rest of the session.
            cameraHoldRef.current = frame.style.position === 'fixed';
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
            sheet.style.paddingBottom = `${paddingBottom}px`;
            sheet.style.height = `${target}px`;

            // The hem clip (see signoff-horizon.css): the frozen frame and the
            // lifted flyers keep their rest-size boxes while the sheet's own box
            // collapses, so the sheet clips them to itself plus the veil above.
            if (sheetVeil !== `${current.veil}px`) {
              sheetVeil = `${current.veil}px`;
              sheet.style.setProperty('--horizon-veil', sheetVeil);
            }

            // The compensation. The spacer owns the sheet's flow box for as
            // long as the pin exists: it keeps GSAP's parked pin span and
            // returns the consumed height, so the stage — and with it the
            // sticky floor and the clip window that hides the floor above the
            // hem — rises by exactly the space the sheet has vacated, at the
            // rate `vacatedHeightAt` sets, and by nothing else. The parked term
            // comes off the RAW scroll so the document grows one pixel per
            // scrolled pixel and can never be flung short.
            const spacer = spacerOf(sheetTrigger);
            if (spacer) {
              const box = spacerBoxAt(p, rawProgress(), current.height, current.pinDistance, current.collapsible);
              spacer.style.height = `${box.height}px`;
              spacer.style.paddingBottom = `${box.padding}px`;
              // GSAP copies the sheet's negative margin onto the spacer once, at
              // swap-in. Keep it current: the travel is re-published on resize.
              const margin = `-${current.travel}px`;
              if (margin !== spacerMargin) {
                spacerMargin = margin;
                spacer.style.marginBottom = margin;
              }
            }

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
              // The alpha is a paint EXCHANGE with the frozen frame, never the
              // thing that removes the element: it is only written once that
              // frame is attached and drawing. With no overlay the live glyphs
              // carry the whole fall and are consumed by their own geometry —
              // translated onto the hole's centre and scaled to zero.
              el.style.opacity = warp ? flyer.opacity.toFixed(4) : '';
              // Past the event horizon the frozen frame paints void there, so
              // the real element must not keep an invisible hit target sitting
              // over the hole. pointer-events (NOT visibility) is the tool: the
              // flyer stays in the tab order and in the accessibility tree, and
              // focus anywhere in the sheet restores paint and pointer together
              // (see signoff-horizon.css).
              el.style.pointerEvents = flyer.consumed ? 'none' : '';
            }

            // The frozen frame takes over the paint as the field takes hold —
            // and only if there is a frozen frame to take over with.
            sheet.style.setProperty('--horizon-mix', (warp ? overlayMixAt(p) : 0).toFixed(4));
            if (warp) {
              try {
                warp.draw(p, geometry);
                sheet.dataset.horizonPaint = 'snapshot';
              } catch (error) {
                fallBack('Drawing the snapshot failed.', error);
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

        /** The sheet's own pin progress straight off the scroll, unsmoothed.
         * The spacer is paid from this, so the document grows one pixel per
         * scrolled pixel and a fling can never outrun it. */
        function rawProgress(): number {
          if (!sheetTrigger) return 0;
          const change = sheetTrigger.end - sheetTrigger.start;
          return change > 0 ? clamp01((sheetTrigger.scroll() - sheetTrigger.start) / change) : 0;
        }

        const resync = () => {
          syncPin();
          // A refresh or a toggle is not a scroll: snap to the state the scroll
          // is actually asking for instead of trusting a playhead a stale
          // measurement left behind, then re-derive from here.
          lastScroll = sheetTrigger ? sheetTrigger.scroll() : -1;
          playhead.progress = targetProgress();
          applyFrame(playhead.progress);
        };

        const arm = () => {
          if (released || armed || !scene) return;
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
            prepareMeasure();
            if (released || !scene) return;
            capturedScene = { ...scene };
            capturing = true;
            let snapshot: HTMLCanvasElement;
            try {
              // captureSignoff awaits font work before it clones, so the live
              // sheet has to be held still across the whole call.
              snapshot = await captureSignoff(sheet, abort.signal);
            } finally {
              capturing = false;
            }
            try {
              prepareMeasure();
              if (released || !scene) return;
              syncPin();
              warp = createEventHorizonWarp(snapshot, () =>
                fallBack('The overlay WebGL2 context was lost.'),
              );
              // Upload/draw must succeed BEFORE touching live DOM paint: the
              // crossfade is only ever written once this frame is really there.
              warp.draw(playhead.progress, sceneGeometry(scene));
              sheet.appendChild(warp.canvas);
              sheet.dataset.horizonState = 'ready';
              applyFrame(playhead.progress); // a restored scroll may be mid-fall
            } finally {
              snapshot.width = snapshot.height = 0; // GPU now owns the only copy
            }
          })().catch((error: unknown) => {
            if (!released) fallBack('Capturing or uploading the sign-off failed.', error);
          });
        };

        /* ---- the two pins ------------------------------------------------ */
        // Measured here, after the lifecycle exists, so an unmeasurable scene
        // (or a curtain too short to pay for any of the fall) reports why it
        // stood down instead of failing silently. This is also the pass that
        // solves the reference framing and publishes the container's budget.
        prepareMeasure();
        if (released || !scene) return;

        // 1 · THE BLACK HOLE — the anchor of the sequence. It pins on the
        // REFERENCE FRAMING: the headline's bottom edge one resolved `titleAir`
        // above the bottom of the viewport, with the container's own height
        // budgeted so that the whole hole is inside the top of the viewport on
        // that same pixel. The trigger is therefore the headline, not the frame —
        // the frame is what gets PINNED (`pin: element`), and it stays exactly
        // where that line parked it until the span is over: not one pixel of
        // drift, for the whole fall and the settle after it.
        //
        // Created FIRST on purpose. GSAP refreshes in creation order and each
        // pin reserves its span in the document as it goes, so this spacer is
        // already in place when the sheet's trigger below is measured — which is
        // exactly what `sheetStartOffset` compensates for.
        holeTrigger = ScrollTrigger.create({
          id: 'signoff-horizon-hole',
          trigger: flyerEls.invite,
          pin: frame,
          pinSpacing: true,
          anticipatePin: 1,
          start: () => triggerLine(scene?.triggerInset ?? 0),
          end: () => `+=${Math.max(1, scene?.pinDistance ?? 1)}`,
          invalidateOnRefresh: true,
          onRefreshInit: prepareMeasure,
          onRefresh: resync,
        });

        // 2 · THE SHEET, on the same line for the same span, and the playhead.
        // `pinType: 'fixed'` is what GSAP already picks for a viewport scroller,
        // and it is stated here because the scene DEPENDS on it: a transform pin
        // would make the sheet the containing block of the overlay canvas and of
        // both lifted flyers, and `measurePinnedTop` reads `position: fixed` to
        // tell a parked sheet from a resting one.
        //
        // No scrub TWEEN. GSAP's `scrub` smooths in TIME, and a pin releases on
        // a SCROLL pixel — the two clocks cannot be made to agree, which is how
        // the previous implementation came to unpin with the fall still in
        // flight. The playhead is derived from `self.progress` directly
        // (`consumptionTarget`) and smoothed in the scroll domain
        // (`followPlayhead`), with the settle margin paying for the smoothing.
        // `scrub: true` is still declared, for one mechanical reason: GSAP only
        // calls `onUpdate` on a trigger it does not classify as a toggle
        // (`isToggle = !scrub && scrub !== 0`), and with no animation attached
        // it creates no scrub tween either. So this is the flag that makes the
        // trigger report every scroll frame, and nothing more.
        sheetTrigger = ScrollTrigger.create({
          id: 'signoff-horizon',
          scrub: true,
          // The SAME trigger element, the SAME screen line and the SAME span as
          // the hole's pin, offset by the pin distance the hole's spacer
          // reserved above the sheet. Two pins, one hold: they engage together,
          // they let go together, and nothing between them is left to time.
          trigger: flyerEls.invite,
          pin: sheet,
          pinType: 'fixed',
          pinSpacing: true,
          anticipatePin: 1,
          start: () => triggerLine(scene?.sheetStartOffset ?? 0),
          end: () => `+=${Math.max(1, scene?.pinDistance ?? 1)}`,
          invalidateOnRefresh: true,
          onRefreshInit: prepareMeasure,
          onRefresh: resync,
          onToggle: resync,
          // GSAP applies its recorded pin state (which includes the sheet's
          // rest height, padding and width) BEFORE this runs, so on the frame
          // the pin engages — or re-engages on the way back up — the trigger's
          // own onUpdate is what makes the compensation order-independent.
          onUpdate: onScrollFrame,
        });

        // The capture is armed well before it is needed: html2canvas plus the
        // font embedding is hundreds of milliseconds of work, and the sheet must
        // be frozen at rest for all of it. Arming at four seams below the fold
        // buys roughly a viewport of scroll on top of the hole's first leg, so
        // a fast fling still arrives after the frozen frame is ready instead of
        // catching the fall mid-capture.
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
        if (armTrigger.scroll() >= armTrigger.start) arm();
        resync();

        // The frame and the curtain are the two boxes this scene is measured
        // from, and neither is animated by the effect — watching the sheet
        // itself would watch the collapse and feed itself.
        const curtain = curtainElements();
        resizeObserver = new ResizeObserver(() => {
          if (released || applying) return;
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
            previous.sheetStartOffset !== scene.sheetStartOffset ||
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
      clearFrameFit();
      restorePaint();
    };
  }, [canWarpSignoff, frameRef, cameraHoldRef]);

  return <footer ref={rootRef} className="footer signoff" aria-label="Closing invitation">{children}</footer>;
}
