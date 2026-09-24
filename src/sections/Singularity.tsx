import VortexStage from '../components/VortexStage';
import { useSingularityGate } from '../lib/singularityGate';

/* ============================================================================
   07 · THE TRENCH — beat 7 (zone Z3)

   IDENTITY-SPEC §2.1/§8: the closing statement of the site is WATER, not
   space. The retired WebGPU black hole is replaced by a dependency-free
   vortex quad shader (components/VortexStage.tsx); the scroll mechanic that
   made the old finale great — the `.bh-hold` reservation and the sign-off
   consumption — is untouched, because it was never about gravity: it is
   about a page being pulled, still, into a mouth. Water does that too.

   The id and the `.bh-*` class names stay: the sign-off geometry suite
   (tests/signoff-horizon.spec.ts, SPEC §10) measures them, and renaming
   measured geometry for cosmetics is how suites die.

   Bare stage by design — no kicker, no headline. The vortex is the statement.
   A visually-hidden <h2> carries the section for assistive tech; SideRail
   auto-discovers the id; lib/scenes.ts maps it to the trench district so the
   page darkens into the water instead of butting against it.

   MOBILE REMOVAL — unchanged policy: no hold, no stage, no reservation on
   phones (the gate's canHoldSignoff is false there and blackhole.css hides
   the boxes pre-hydration). The trench reads as a straight dark seam into
   the footer instead.
============================================================================ */

export default function Singularity() {
  const { isMobile, frameRef, holdRef, reportStatus, cameraHoldRef, consumptionRef } =
    useSingularityGate();

  if (isMobile) return null;

  return (
    <>
      {/* THE HOLD — layout reservation, unchanged contract: SignoffHorizon
          grows it one pixel per scrolled pixel across the consumption so the
          vortex and the sign-off stay rigidly locked to the viewport while
          the water takes the invitation. */}
      <div className="bh-hold" ref={holdRef} aria-hidden="true" />

      <section className="section singularity" id="singularity" data-beat="trench">
        <h2 className="vh">The trench — the Nemoverse goes deep</h2>

        {/* .bh-frame carries the seam gradients above and below the stage
           (styles/trench.css); the stage inside owns the canvas box and is
           the container the consumption scene is framed on. */}
        <div className="bh-frame" ref={frameRef} data-cursor="GO UNDER">
          <VortexStage
            onStatusChange={reportStatus}
            cameraHoldRef={cameraHoldRef}
            consumptionRef={consumptionRef}
          />
        </div>
      </section>
    </>
  );
}
