import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOTION_QUERY, REDUCED_MOTION_QUERY, useSingularityGate } from '../lib/singularityGate';
import {
  curtainElements,
  measurePinnedTop,
  measureSignoffScene,
  sceneGeometry,
  type SignoffScene,
} from '../lib/signoffHorizonGeometry';
import {
  FLYER_IDS,
  clamp01,
  collapseAt,
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
 * THE PIN BELONGS TO THE BLACK HOLE. Two ScrollTriggers, one scene:
 *
 *   · `signoff-horizon-hole` pins `.bh-frame` from the moment the hole is fully
 *     in view — its bottom edge one seam above the bottom of the viewport — and
 *     does not let go until the consumption is complete. This is the anchor of
 *     the whole sequence: the hole holds the screen while it eats.
 *   · `signoff-horizon` pins the sheet for the last leg of that same hold, and
 *     scrubs the playhead. It is pinned because the fall needs the singularity
 *     to be a fixed point in the sheet's own coordinate space, and because a
 *     sheet left in flow would slide past the hole and drag the curtain with
 *     it. Its start is exactly the hole's handoff line (`hem − frame bottom`),
 *     so the two pins are one continuous hold: no gap, no double-pin, no jump.
 *
 * Layout is touched in exactly one direction. The sheet's own height collapses
 * as it is consumed and its pin-spacer returns that height to the document at
 * the same rate, so the curtain floor rises by precisely the space the void is
 * vacating and the distance from the sheet's hem to the end of the site never
 * changes. `lib/spaghettification.ts` holds that arithmetic as pure functions.
 */
export default function SignoffHorizon({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const { canWarpSignoff, frameRef } = useSingularityGate();

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
    };
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      // The finished reduced-motion state is the PLAIN footer, not a consumed
      // one: no capture, canvas, pin or scrub is ever created.
      mm.add(REDUCED_MOTION_QUERY, () => {
        restorePaint();
      });
      mm.add(MOTION_QUERY, () => {
        const frame = frameRef.current;
        const anchor = sheet.firstElementChild as HTMLElement | null;
        if (!canWarpSignoff || !frame || !anchor) return;
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
        let sceneState = '';
        let spacerMargin = '';
        let sheetVeil = '';
        let applying = false;
        let capturing = false;
        let warp: EventHorizonWarp | null = null;
        let tween: gsap.core.Tween | null = null;
        let holeTrigger: ScrollTrigger | null = null;
        let armTrigger: ScrollTrigger | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let refreshFrame = 0;
        const abort = new AbortController();
        const playhead = { progress: 0 };
        const sheetTrigger = () => tween?.scrollTrigger ?? null;

        /* ---- lifecycle --------------------------------------------------- */
        const release = () => {
          released = true;
          abort.abort();
          cancelAnimationFrame(refreshFrame);
          resizeObserver?.disconnect();
          armTrigger?.kill();
          holeTrigger?.kill();
          const spacer = spacerOf(sheetTrigger());
          tween?.scrollTrigger?.kill();
          tween?.kill();
          // The spacer outlives its trigger on GSAP's pin cache. Clearing the
          // compensation here means a later activation can never re-insert a
          // spacer that is already short by a consumed sheet.
          if (spacer) {
            spacer.style.height = '';
            spacer.style.paddingBottom = '';
          }
          releaseLayout();
          restorePaint();
        };
        const fallBack = (reason: string, error?: unknown) => {
          if (released) return;
          release();
          sheet.dataset.horizonState = 'static';
          if (error) console.warn(`[signoff-horizon] ${reason} Keeping the real footer.`, error);
          else console.info(`[signoff-horizon] ${reason} Keeping the real footer.`);
        };

        /* ---- layout: the collapse, and the curtain's compensation -------- */
        const releaseLayout = () => {
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
          const spacer = spacerOf(sheetTrigger());
          if (spacer) {
            spacer.style.height = '';
            spacer.style.paddingBottom = '';
          }
        };

        const remeasure = () => {
          const next = measureSignoffScene({ sheet, frame, flyers: flyerEls, previous: scene });
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
          scene.pinnedTop = measurePinnedTop(sheet, scene.viewport - scene.seam - scene.height);
        };

        /** The sheet's own pin progress straight off the scroll, unsmoothed.
         * The spacer is paid from this, so the document grows one pixel per
         * scrolled pixel and a fling can never outrun it. */
        const rawProgress = () => {
          const trigger = sheetTrigger();
          if (!trigger) return 0;
          const change = trigger.end - trigger.start;
          return change > 0 ? clamp01((trigger.scroll() - trigger.start) / change) : 0;
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
            // live flyers keep their rest-size boxes while the sheet's own box
            // collapses, so the sheet clips them to itself plus the veil above.
            if (sheetVeil !== `${current.veil}px`) {
              sheetVeil = `${current.veil}px`;
              sheet.style.setProperty('--horizon-veil', sheetVeil);
            }

            // The compensation. The spacer owns the sheet's flow box for as
            // long as the pin exists: it keeps GSAP's parked pin distance and
            // returns the consumed height, so the stage — and with it the
            // sticky floor and the clip window that hides the floor above the
            // hem — rises by exactly the space the sheet has vacated.
            const spacer = spacerOf(sheetTrigger());
            if (spacer) {
              const box = spacerBoxAt(p, rawProgress(), current.height, current.sheetPinDistance, current.collapsible);
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
            // evaluated per element. Translation toward the singularity, tidal
            // stretch along the pull axis, squeeze across it, frame dragging.
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
              el.style.opacity = flyer.opacity.toFixed(4);
              // Past the event horizon the frozen frame paints void there, so
              // the real element must not keep an invisible hit target sitting
              // over the hole. pointer-events (NOT visibility) is the tool: the
              // flyer stays in the tab order and in the accessibility tree, and
              // focus anywhere in the sheet restores paint and pointer together
              // (see signoff-horizon.css).
              el.style.pointerEvents = flyer.consumed ? 'none' : '';
            }

            // The frozen frame takes over the paint as the field takes hold.
            sheet.style.setProperty('--horizon-mix', overlayMixAt(p).toFixed(4));
            if (warp) {
              try {
                warp.draw(p, geometry);
                sheet.dataset.horizonPaint = 'snapshot';
              } catch (error) {
                fallBack('Drawing the snapshot failed.', error);
                return;
              }
            }

            const state = sheet.style.position === 'fixed' || p > 0 ? 'pinned' : 'idle';
            if (state !== sceneState) {
              sceneState = state;
              sheet.dataset.horizonScene = state;
            }
            sheet.dataset.horizonProgress = p.toFixed(4);
          } finally {
            applying = false;
          }
        };

        const resync = () => {
          syncPin();
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
              // Upload/draw must succeed BEFORE touching live DOM paint.
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
        // stood down instead of failing silently.
        prepareMeasure();
        if (released || !scene) return;

        // 1 · THE BLACK HOLE — the anchor of the sequence. It pins when it is
        // fully in view and stays pinned for the handoff plus the whole
        // consumption, so the reader watches the hole hold the screen while the
        // sheet slides up into its lower half and then falls in.
        holeTrigger = ScrollTrigger.create({
          id: 'signoff-horizon-hole',
          trigger: frame,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          start: () => `bottom bottom-=${scene?.seam ?? 0}`,
          end: () => `+=${Math.max(1, scene?.holePinDistance ?? 1)}`,
          invalidateOnRefresh: true,
          onRefreshInit: prepareMeasure,
          onRefresh: resync,
        });

        // 2 · THE SHEET, for the last leg of the same hold, and the scrub.
        // `pinType: 'fixed'` (not GSAP's default transform pin) because the
        // sheet is the containing block of the overlay canvas and of both
        // flyers: a transform there would reparent every absolute child.
        tween = gsap.fromTo(playhead, { progress: 0 }, {
          progress: 1,
          ease: 'none',
          onUpdate: () => applyFrame(playhead.progress),
          scrollTrigger: {
            id: 'signoff-horizon',
            trigger: sheet,
            pin: true,
            pinType: 'fixed',
            pinSpacing: true,
            anticipatePin: 1,
            start: () => `bottom bottom-=${scene?.seam ?? 0}`,
            end: () => `+=${Math.max(1, scene?.sheetPinDistance ?? 1)}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefreshInit: prepareMeasure,
            onRefresh: resync,
            onToggle: resync,
            // GSAP applies its recorded pin state (which includes the sheet's
            // rest height, padding and width) AFTER the scrub tween has rendered
            // for this scroll, so on the frame the pin engages — or re-engages on
            // the way back up — the collapse would be undone and left that way
            // until the next playhead change. The trigger's own onUpdate runs
            // last, which makes the compensation order-independent.
            onUpdate: () => applyFrame(playhead.progress),
          },
        });

        // The capture is armed well before it is needed: html2canvas plus the
        // font embedding is hundreds of milliseconds of work, and the sheet must
        // be frozen at rest for all of it. Arming at four seams below the fold
        // buys roughly a viewport of scroll on top of the hole's handoff, so a
        // fast fling still arrives after the frozen frame is ready instead of
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
            previous.tail !== scene.tail ||
            previous.collapsible !== scene.collapsible ||
            previous.handoff !== scene.handoff ||
            previous.sheetPinDistance !== scene.sheetPinDistance;
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
      restorePaint();
    };
  }, [canWarpSignoff, frameRef]);

  return <footer ref={rootRef} className="footer signoff" aria-label="Closing invitation">{children}</footer>;
}
