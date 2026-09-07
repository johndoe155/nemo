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
          const next = measureSignoffHorizon(root, frame);
          if (!next || (capturedGeometry && !sameSize(next, capturedGeometry))) {
            // A frozen raster cannot reflow with the hit targets. Deliberate
            // degradation: retire it for this activation, rather than stretch
            // misregistered text or secretly take another snapshot on resize.
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

        // The fixed anchor crosses the viewport's lower seam band, then its
        // upper seam band. No arbitrary percentage trigger lines: both margins
        // come from .bh-frame::after's resolved --bh-seam height. Scrub is fully
        // reversible; it is the only animation driver (no scroll listener/RAF
        // render loop). The early arm gives capture one seam of offscreen lead.
        tween = gsap.fromTo(playhead, { progress: 0 }, {
          progress: 1,
          ease: 'none',
          onUpdate: paint,
          scrollTrigger: {
            id: 'signoff-horizon',
            trigger: root,
            start: () => `top+=${geometry.anchorY} ${window.innerHeight - geometry.seam}px`,
            end: () => `top+=${geometry.anchorY} ${geometry.seam}px`,
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
