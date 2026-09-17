import { useEffect, useRef, useState, type RefObject } from 'react';
import { createNemoParticleField } from '../three/nemo-particles/nemo-particles';
import { settleParticleField } from '../lib/particleGate';
import { BASE } from '../lib/data';

/* ============================================================================
   NemoParticleField — the React mounting layer for the WebGL particle field.

   WHY THIS FILE EXISTS
   The engine lives in src/three/nemo-particles/ and is the inline <script> of
   the standalone nemo-webgl.html concept (see PROVENANCE.md there). That
   script was a page-load IIFE: it owned the whole viewport, grabbed its DOM by
   id, listened on window forever and never tore anything down. This component
   re-writes ONLY that orchestration, the same way BlackHoleStage.tsx does for
   the black hole:

     · scoped sizing    ResizeObserver on this element (whose box IS the hero's
                        box — .hero__bg is inset:0 inside .hero), never
                        window.innerWidth/innerHeight
     · scoped styles    everything lives under .nemo-field (styles/nemo-particles.css)
     · scoped input     pointerdown/pointerleave on the hero, not on window
     · full teardown    rAF cancelled, listeners removed, GL objects deleted,
                        context lost, canvas removed — safe under StrictMode
                        and HMR, which mount → unmount → mount the same tree
     · off-screen pause IntersectionObserver stops the loop while the reader is
                        somewhere else on this very long page

   WHAT IT DOES NOT DO
   Nothing about the particles themselves. The four-pose morph/hold cycle, the
   CPU spring physics, the shockwave, the bloom pipeline, the pointer response,
   the arrow keys and the reduced-motion behaviour are all the engine's, and
   the engine is the original code.

   WHAT IT RENDERS
   The DOM layers the standalone page had around its canvas, in the same order:
   canvas → fallback → breathe → vignette → grain. They are ordinary React
   elements because the engine reports state through callbacks instead of
   reaching into the document by id. The original's loading overlay is gone —
   boot-time loading belongs to the boot loader, which will not release the
   page until this field reports ready (see lib/particleGate.ts); the fallback
   survives for the one case the boot cannot express, a renderer that failed.

   POINTER TRACKING — TWO SYSTEMS, DELIBERATELY KEPT APART
   Hero.tsx keeps its own mousemove listener, which nudges .hero__bg a few px
   against the cursor on top of the Framer Motion scroll parallax. That is an
   OUTER transform on the layer that contains this component; it moves the whole
   background, canvas included. The engine's pointer response is INNER: it
   pushes individual particles away from the cursor inside the canvas. They
   compose rather than compete, and the engine converts client coords through
   getBoundingClientRect(), which already includes that outer transform, so the
   particle response stays glued to the real cursor position while the layer
   parallaxes underneath it.
============================================================================ */

/** Static assets, fetched the same way public/art/ is (see `art()` in lib/data). */
const POSE_BASE = `${BASE}nemo-particles`;

/** Keep the loop alive a little past the hero's edge so scrolling back up
 * never shows a frozen field for a frame. Same idea as the singularity stage. */
const VIEW_MARGIN = '18% 0px';

/** What the field says when it cannot paint. There is NO loading overlay any
 *  more (see lib/particleGate.ts): the boot owns the wait, so the only thing
 *  this component ever has to surface is a terminal failure — a missing
 *  renderer, or pose data that never arrived. A silent failure would be worse
 *  than the overlay it replaced, so it stays as one discreet chip at the foot
 *  of the field, never over the hero's type. */
const FAILURE_COPY: Record<'error' | 'unsupported', React.ReactNode> = {
  unsupported: <>WebGL isn&rsquo;t available in this preview environment.</>,
  error: (
    <>
      COULDN&rsquo;T LOAD PARTICLE DATA — the pose files under{' '}
      <code>{POSE_BASE}/pose0.json … pose3.json</code> did not arrive
    </>
  ),
};

type Phase = 'loading' | 'ready' | 'error' | 'unsupported';

/* One id per document: the grain filter is referenced by url(#id), and the
   standalone page's bare "grainFilter" would collide with anything else on the
   page that ever defines one. */
const GRAIN_FILTER_ID = 'nemo-field-grain';

export default function NemoParticleField({
  hostRef,
}: {
  /** The .hero element. Clicks/taps and pointer-leave are captured there —
   * the equivalent of "anywhere on the page" for a page that was one screen. */
  hostRef?: RefObject<HTMLElement | null>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let released = false;

    /* The canvas is created here rather than in JSX so that unmount takes the
       context with it: a canvas element that survives a remount hands back its
       OLD context from getContext(), which destroy() has just lost. */
    const canvas = document.createElement('canvas');
    canvas.className = 'nemo-field__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    stage.insertBefore(canvas, stage.firstChild);

    /* Terminal states release the boot (lib/particleGate.ts). `ready` means
       the poses are baked, so the hero can be revealed with the field already
       painted; `error` / `unsupported` mean there is nothing left to wait for
       and holding the boot for a renderer that does not exist would be pure
       latency. The engine keeps narrating through onStatus, but nothing draws
       it any more — there is no overlay to draw it in. */
    const settleBoot = (next: Phase) => {
      if (released) return;
      setPhase(next);
      settleParticleField();
    };

    const field = createNemoParticleField(canvas, {
      baseUrl: POSE_BASE,
      host: hostRef?.current ?? null,
      onReady: () => settleBoot('ready'),
      onError: () => settleBoot('error'),
      onUnsupported: () => settleBoot('unsupported'),
    });

    /* Boot sizing — the original called resize() once, synchronously, before
       fetching. Same here, measured off the hero's box instead of the window. */
    const box = stage.getBoundingClientRect();
    field.resize(Math.max(1, Math.round(box.width)), Math.max(1, Math.round(box.height)));

    /* Subsequent changes ride the original's 150 ms debounce. */
    const resizeObs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      field.scheduleResize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
    });
    resizeObs.observe(stage);

    const viewObs = new IntersectionObserver(
      (entries) => {
        field.setVisible(Boolean(entries[0]?.isIntersecting));
      },
      { rootMargin: VIEW_MARGIN },
    );
    viewObs.observe(stage);

    return () => {
      released = true;
      resizeObs.disconnect();
      viewObs.disconnect();
      field.destroy();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [hostRef]);

  return (
    <div className="nemo-field" ref={stageRef}>
      {/* ← the engine's <canvas> is inserted as the first child by the effect */}

      {/* No loading overlay: the boot covers the fetch (see particleGate.ts).
          Only a terminal failure has anything left to say. */}
      {(phase === 'error' || phase === 'unsupported') && (
        <div
          className={`nemo-field__fallback${phase === 'error' ? ' is-error' : ''}`}
          role={phase === 'error' ? 'alert' : undefined}
        >
          {FAILURE_COPY[phase]}
        </div>
      )}

      <div className="nemo-field__vignette" />
      <svg className="nemo-field__grain" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <filter id={GRAIN_FILTER_ID}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${GRAIN_FILTER_ID})`} />
      </svg>
    </div>
  );
}
