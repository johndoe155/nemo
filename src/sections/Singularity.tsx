import BlackHoleStage from '../components/BlackHoleStage';

/* ============================================================================
   THE SINGULARITY — the live WebGPU black hole

   Placement is the whole point: this sits in the seam between the canon
   timeline (Lore, whose drilling rod ends on the "U-007 — THE LAST AURORA"
   node) and the closing credit crawl in the Footer. The last thing read before
   the sign-off is the thing U-007 is falling into.

   Bare stage by design — no kicker, no headline, no body copy. The simulation
   is the statement. A visually-hidden <h2> carries the section for assistive
   tech, and the `id` does double duty as it does everywhere else on the page:
   SideRail auto-discovers `main section[id]` for its dots, and
   lib/scenes.ts maps the same id to the `singularity` ambience district so the
   page background eases into the canvas instead of butting against it.

   All the interesting machinery lives in components/BlackHoleStage.tsx (the
   React mounting layer) and src/three/blackhole/ (the simulation, vendored
   verbatim — see the PROVENANCE.md in that folder).
   ========================================================================== */
export default function Singularity() {
  return (
    <section className="section singularity" id="singularity">
      <h2 className="vh">The singularity — a live black hole simulation</h2>

      {/* .bh-frame carries the seam gradients above and below the stage
          (styles/blackhole.css); .bh-stage inside it owns the canvas box. */}
      <div className="bh-frame">
        <BlackHoleStage />
      </div>
    </section>
  );
}
