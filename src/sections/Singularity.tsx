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
  const { isMobile, frameRef, reportStatus, cameraHoldRef } = useSingularityGate();

  // On mobile: render nothing — the section must appear as if it was never
  // implemented. No DOM, no canvas, no observers, no heavy GPU init.
  if (isMobile) return null;

  return (
    <section className="section singularity" id="singularity">
      <h2 className="vh">The singularity — a live black hole simulation</h2>

      {/* .bh-frame carries the seam gradients above and below the stage
          (styles/blackhole.css); .bh-stage inside it owns the canvas box. It is
          also the element the pinned consumption scene pins — the CONTAINER of
          the black hole, so that the hole itself stays rigidly anchored and
          static on screen while the sign-off falls into it (see
          components/SignoffHorizon.tsx). `cameraHoldRef` is the other half of
          "static": the box is held by the pin, the framing inside it by the
          stage. */}
      <div className="bh-frame" ref={frameRef}>
        <BlackHoleStage onStatusChange={reportStatus} cameraHoldRef={cameraHoldRef} />
      </div>
    </section>
  );
}
