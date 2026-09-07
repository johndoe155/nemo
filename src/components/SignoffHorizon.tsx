import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOTION_QUERY, REDUCED_MOTION_QUERY, useSingularityGate } from '../lib/singularityGate';
import { measureSignoffHorizon, type SignoffHorizonGeometry } from '../lib/signoffHorizonGeometry';
import type { EventHorizonWarp } from '../three/eventHorizonWarp';
import '../styles/signoff-horizon.css';

gsap.registerPlugin(ScrollTrigger);

const sameSize = (a: SignoffHorizonGeometry, b: SignoffHorizonGeometry) =>
  Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** Paint-only enhancement. This IS ClosingSignoff's original footer, not a
 * wrapper (the curtain below depends on its margin/stacking context). Children,
 * including the real anchor, remain mounted, hit-testable and in the a11y tree
 * throughout. The only extra DOM is a pointer-inert, aria-hidden GPU canvas.
 */
export default function SignoffHorizon({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const { canWarpSignoff, frameRef } = useSingularityGate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const restorePaint = () => {
      root.style.removeProperty('--horizon-mix');
      delete root.dataset.horizonPaint;
      delete root.dataset.horizonProgress;
      delete root.dataset.horizonState;
    };
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      // Here the finished reduced-motion state is the PLAIN footer, not a
      // consumed one. No capture, canvas, ScrollTrigger or scrub is created.
      mm.add(REDUCED_MOTION_QUERY, restorePaint);
      mm.add(MOTION_QUERY, () => {
        const frame = frameRef.current;
        if (!canWarpSignoff || !frame) return;
        const initialGeometry = measureSignoffHorizon(root, frame);
        if (!initialGeometry) return;
        let geometry = initialGeometry;
        let capturedGeometry: SignoffHorizonGeometry | null = null;
        let released = false;
        let armed = false;
        let warp: EventHorizonWarp | null = null;
        let tween: gsap.core.Tween | null = null;
        let armTrigger: ScrollTrigger | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let refreshFrame = 0;
        const abort = new AbortController();
        const playhead = { progress: 0 };

        // Safe before OR after the asynchronous snapshot resolves, just like
        // BlackHoleStage's released guard around renderer.init(). A late image
        // is freed by arm() without ever creating/attaching a GPU context.
        const release = () => {
          released = true;
          abort.abort();
          cancelAnimationFrame(refreshFrame);
          resizeObserver?.disconnect();
          armTrigger?.kill();
          tween?.scrollTrigger?.kill();
          tween?.kill();
          warp?.dispose();
          warp = null;
          restorePaint();
        };
        const fallBack = (reason: string, error?: unknown) => {
          if (released) return;
          release();
          root.dataset.horizonState = 'static';
          if (error) console.warn(`[signoff-horizon] ${reason} Keeping the real footer.`, error);
          else console.info(`[signoff-horizon] ${reason} Keeping the real footer.`);
        };
        const measure = () => {
          // While the pin is engaged the sign-off is position:fixed and its
          // rect top is the frozen pin position. The flow position it was
          // pinned AT lives in GSAP's pin-spacer (the footer sits at the
          // spacer's border-box top, with its margins moved onto the spacer),
          // so anchor measurements read from there. Rect width/height stay
          // authoritative from the element itself: they are what the
          // post-capture reflow retirement checks.
          const spacer = root.style.position === 'fixed' &&
            root.parentElement?.classList.contains('pin-spacer')
            ? root.parentElement
            : null;
          const next = measureSignoffHorizon(
            root,
            frame,
            spacer?.getBoundingClientRect().top,
          );
          if (!next || (capturedGeometry && !sameSize(next, capturedGeometry))) {
            // A frozen raster cannot reflow with the hit targets. Deliberate
            // degradation: retire it for this activation, rather than stretch
            // misregistered text or secretly take another snapshot on resize.
            // ScrollTrigger.kill() reverts the pin, so retirement also
            // restores the ordinary in-flow footer and its curtain spacing.
            fallBack('Layout changed after arming; the one-shot raster was retired.');
            return;
          }
          geometry = next;
        };
        const paint = () => {
          if (released) return;
          root.dataset.horizonProgress = playhead.progress.toFixed(4);
          if (!warp) return;
          try {
            warp.draw(playhead.progress, geometry);
            // Cross the paint seam over one *measured seam's* scroll distance.
            // Transparent/captured texels reveal the original footer background,
            // never the unwarped letters (which have only their paint faded).
            const travel = window.innerHeight - geometry.seam * 2;
            const mix = Math.min(1, playhead.progress * travel / geometry.seam);
            root.style.setProperty('--horizon-mix', String(mix));
            root.dataset.horizonPaint = 'snapshot';
          } catch (error) {
            fallBack('Drawing the snapshot failed.', error);
          }
        };
        const arm = () => {
          if (released || armed) return;
          armed = true; // BEFORE any await: onEnter/refresh/scroll-back share it
          root.dataset.horizonState = 'capturing';
          void (async () => {
            // Also defers past StrictMode's immediate mount → cleanup → mount.
            await document.fonts.ready;
            if (released) return;
            const [{ captureSignoff }, { createEventHorizonWarp }] = await Promise.all([
              import('../lib/captureSignoff'),
              import('../three/eventHorizonWarp'),
            ]);
            if (released) return;
            measure();
            if (released) return;
            capturedGeometry = { ...geometry };
            const snapshot = await captureSignoff(root, abort.signal);
            try {
              if (released) return;
              measure();
              if (released) return;
              warp = createEventHorizonWarp(snapshot, () =>
                fallBack('The overlay WebGL2 context was lost.'),
              );
              // Upload/draw must succeed BEFORE touching live DOM paint.
              warp.draw(0, geometry);
              root.appendChild(warp.canvas);
              root.dataset.horizonState = 'ready';
              paint(); // restored scroll position / fast fling may be mid-scrub
            } finally {
              snapshot.width = snapshot.height = 0; // GPU now owns the only copy
            }
          })().catch((error: unknown) => {
            if (!released) fallBack('Capturing or uploading the sign-off failed.', error);
          });
        };

        // The fixed anchor crosses the viewport's lower seam band — that is
        // the activation threshold (viewportHeight - seamHeight) — and the
        // sign-off PINS there. Pinning is what makes the consumption a scene
        // instead of a passing scroll effect: the page holds still for one
        // controlled distance (the exact run the anchor used to travel,
        // lower seam band → upper seam band = innerHeight - 2 * seam) while
        // scrolling alone drives playhead 0 → 1. No arbitrary percentage
        // lines: every bound is still derived from .bh-frame::after's
        // resolved --bh-seam height and re-invalidated on refresh. Scrub
        // stays fully reversible and remains the only animation driver. The
        // early arm trigger still gives capture one seam of offscreen lead.
        // pinSpacing (GSAP's default, kept explicit) lets the pin-spacer
        // carry the added distance, so the curtain below never moves; killing
        // the trigger reverts the pin and removes the spacer in one step.
        tween = gsap.fromTo(playhead, { progress: 0 }, {
          progress: 1,
          ease: 'none',
          onUpdate: paint,
          scrollTrigger: {
            id: 'signoff-horizon',
            trigger: root,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            start: () => `top+=${geometry.anchorY} ${window.innerHeight - geometry.seam}px`,
            end: () => `+=${window.innerHeight - geometry.seam * 2}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefreshInit: measure,
            onRefresh: paint,
          },
        });
        armTrigger = ScrollTrigger.create({
          id: 'signoff-horizon-arm',
          trigger: root,
          start: () => `top+=${geometry.anchorY} bottom+=${geometry.seam}`,
          onEnter: arm,
          onEnterBack: arm,
          onRefresh: (self) => { if (self.scroll() >= self.start) arm(); },
        });
        // Handles deep-link / browser-restored scroll and a stage that becomes
        // live only after the reader has already passed the arm line.
        if (armTrigger.scroll() >= armTrigger.start) arm();

        resizeObserver = new ResizeObserver(() => {
          if (released) return;
          const previous = geometry;
          measure();
          if (released) return;
          if (!sameSize(previous, geometry) || previous.anchorY !== geometry.anchorY ||
              previous.seam !== geometry.seam) {
            cancelAnimationFrame(refreshFrame);
            refreshFrame = requestAnimationFrame(() => {
              if (!released) ScrollTrigger.refresh();
            });
          }
        });
        resizeObserver.observe(root);
        resizeObserver.observe(frame);
        return release;
      });
    }, root);

    return () => {
      mm.revert();
      ctx.revert();
      restorePaint();
    };
  }, [canWarpSignoff, frameRef]);

  return <footer ref={rootRef} className="footer signoff" aria-label="Closing invitation">{children}</footer>;
}
