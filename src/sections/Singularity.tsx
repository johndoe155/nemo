import BlackHoleStage from '../components/BlackHoleStage';
import { useSingularityGate } from '../lib/singularityGate';

/* ============================================================================
   THE SINGULARITY — the live WebGPU black hole

   Placement is the whole point: this sits in the seam between the canon
   timeline (Lore, whose drilling rod ends on the "U-007 — THE LAST AURORA"
   node) and the closing credit crawl above it. The crawl has been moved
   above the black hole so it is completely unaffected by the event-horizon
   warping effect.

   Bare stage by design — no kicker, no headline, no body copy. The simulation
   is the statement. A visually-hidden <h2> carries the section for assistive
   tech, and the `id` does double duty as it does everywhere else on the page:
   SideRail auto-discovers `main section[id]` for its dots, and
   lib/scenes.ts maps the same id to the `singularity` ambience district so the
   page background eases into the canvas instead of butting against it.

   All the interesting machinery lives in components/BlackHoleStage.tsx (the
   React mounting layer) and src/three/blackhole/ (the simulation, vendored
   verbatim — see the PROVENANCE.md in that folder).

   MOBILE REMOVAL — this section is intentionally NOT rendered on mobile.
   The check is synchronous on first paint (matchMedia) so there is no flash
   of the heavy WebGPU stage on phones, and a CSS fallback in
   styles/blackhole.css (display:none at the same breakpoint) guarantees the
   section never occupies layout even before JS hydrates. Desktop / wide
   screens are completely untouched.
   ========================================================================== */

export default function Singularity() {
  const { isMobile, frameRef, holdRef, reportStatus, cameraHoldRef } = useSingularityGate();

  // On mobile: render nothing — the section must appear as if it was never
  // implemented. No DOM, no canvas, no observers, no heavy GPU init, and no
  // reservation: `.bh-hold` is returned with the section, so the box the hold
  // would spend does not exist either. styles/blackhole.css hides `.bh-hold` at
  // the same breakpoint, which is the pre-hydration window where the section's
  // own `display: none` has not taken effect yet but a stale height could.
  if (isMobile) return null;

  return (
    <>
      {/* THE HOLD. An empty box whose only job is to be tall at the right time:
          components/SignoffHorizon.tsx writes `holdDistanceAt(scroll, start, span)`
          onto it for the span of the sign-off's consumption, which pushes the
          section below — and the sign-off below that — down one pixel per scrolled
          pixel, so the whole composition keeps one fixed viewport position while
          the hole eats the invitation. It is the pin's replacement, and it sits HERE,
          immediately above the section and outside it, for three reasons:
            · the cost lands in the void between the crawl and the black hole, not in
              the seam between the hole and the sign-off (a reservation spent INSIDE
              the picture is the wide gap this section used to have);
            · `#singularity`'s own box never changes size, so `.singularity::before`
              — the atmosphere that bleeds into the sections around it — cannot be
              stretched over a box that grows and shrinks with the scroll;
            · the section keeps its exact geometry for `measureSignoffScene`, which
              solves the composition's framing from distances measured across it.
          It is `aria-hidden` and inert: a layout reserve, not content. */}
      <div className="bh-hold" ref={holdRef} aria-hidden="true" />

      <section className="section singularity" id="singularity">
        <h2 className="vh">The singularity — a live black hole simulation</h2>

        {/* .bh-frame carries the seam gradients above and below the stage
            (styles/blackhole.css); .bh-stage inside it owns the canvas box. It is
            the CONTAINER the composition is framed on — no longer "pinned" in the
            GSAP sense, since the reservation above holds the section and therefore
            this box rigidly in the viewport, but every number the consumption scene
            solves is still measured from it, which is why the ref stays with the
            section and not with the footer that reads it. `cameraHoldRef` is the
            other half of "static": the box is held by the reservation, the framing
            inside it by the stage (see components/SignoffHorizon.tsx). */}
        <div className="bh-frame" ref={frameRef}>
          <BlackHoleStage onStatusChange={reportStatus} cameraHoldRef={cameraHoldRef} />
        </div>
      </section>
    </>
  );
}
