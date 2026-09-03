import { Suspense, lazy, useEffect, useRef, useState } from 'react';

/* ============================================================================
   06.5 · GARGANTUA — the donor black-hole shader, mounted verbatim
   --------------------------------------------------------------------------
   The WebGL component itself (components/ShaderCanvas.tsx + hooks/* +
   lib/gargantuaRenderer.ts + lib/shaders/*.glsl) is copied byte-for-byte from
   the Gargantua.zip project — nothing in those files is edited, so every
   integration concern lives HERE, in the wrapper:

     · Code-split + lazy — the shader chunk (three is already chunked) only
       starts streaming when the section approaches the viewport, so the hero
       shell paints first.
     · Intersection gating — the canvas mounts shortly before the section
       enters the viewport and unmounts (disposing its WebGL context via the
       donor's own cleanup) once it has scrolled well past. This keeps a
       second always-on rAF/WebGL loop off the page, and scopes the donor's
       window-level arrow-key orbit listeners to the stretch of page where
       the black hole is actually on screen.
     · prefers-reduced-motion — the donor animates continuously and has no
       reduced-motion handling, so these visitors get a static eclipse frame
       instead of the live shader (house pattern: Hero/Footer read
       matchMedia the same way, stable, no first-pass flicker).

   Position: its own <section> between the Canon Timeline (Lore, above) and
   the footer's credit-crawl marquee (below). Neighbour sections untouched.
   ========================================================================== */

const LazyShaderCanvas = lazy(() =>
  import('../components/ShaderCanvas').then((m) => ({ default: m.ShaderCanvas })),
);

/* House pattern (Hero.tsx / Footer.tsx read matchMedia identically). */
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Mount half a viewport before / unmount half a viewport after the band —
   preload headroom without keeping the GPU loop alive page-wide. */
const INTERSECTION_ROOT_MARGIN = '50% 0px 50% 0px';

export default function Gargantua() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNearViewport(true); // ancient browser — mount unconditionally
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setNearViewport(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: INTERSECTION_ROOT_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      className="gargantua"
      id="gargantua"
      ref={rootRef}
      aria-label="Gargantua — a real-time black hole. Drag to orbit."
    >
      <div className="nemo-gargantua">
        {prefersReduced ? (
          /* Static fallback frame (see .gargantua__still) — no animation loop. */
          <div className="gargantua__still" aria-hidden="true" />
        ) : nearViewport ? (
          <Suspense fallback={<div className="gargantua__placeholder" aria-hidden="true" />}>
            <LazyShaderCanvas />
          </Suspense>
        ) : (
          <div className="gargantua__placeholder" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
