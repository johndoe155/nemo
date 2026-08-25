/* ============================================================================
   WireframeGlobe — true 3D wireframe sphere for inactive telemetry pods.

   The earlier SVG version drew a circle + ellipses on a single 2D plane and
   rotated that plane around Y, which read as a spinning coin because every
   line was co-planar. This version builds the sphere out of rings placed in
   real 3D space with CSS transforms:

     · meridians  — great circles standing upright, fanned around Y
     · parallels  — latitude rings lying flat at their true height, with
                    radius shrunk to the real chord length sqrt(R² − y²)
     · core       — a small dot at the sphere's centre

   The whole cage is one .npx__globe3d-spin node with transform-style:
   preserve-3d; rotating IT around Y revolves genuine 3D geometry, so the
   latitude rings stay horizontal and the meridians sweep — a globe, not a
   coin. No WebGL context (the section already runs the particle field and
   liquid CTA), and transparent wireframe rings deliberately show their own
   back half for the classic x-ray look.
   ========================================================================== */

/* meridians: upright great circles fanned 45° apart around Y */
const MERIDIANS = [0, 45, 90, 135];

/* parallels: latitude rings.
   r  = ring radius in cqw (1cqw = 1% of the square globe container; the
        sphere is inscribed at R = 50cqw), computed as sqrt(50² - y²)
   y  = height of the ring above/below the equator, in cqw */
const PARALLELS: { r: number; y: number }[] = [
  { r: 50, y: 0 }, // equator
  { r: 44.9, y: -22 }, // upper tropic  (sqrt(2500 − 484) ≈ 44.9; -y = up in CSS)
  { r: 44.9, y: 22 }, // lower tropic
];

export default function WireframeGlobe() {
  return (
    <span className="npx__globe3d" aria-hidden="true">
      <span className="npx__globe3d-spin">
        {MERIDIANS.map((ry) => (
          <i
            key={`m${ry}`}
            className="npx__g-ring npx__g-meridian"
            style={{ ['--ry' as string]: `${ry}deg` }}
          />
        ))}
        {PARALLELS.map(({ r, y }, i) => (
          <i
            key={`p${i}`}
            className="npx__g-ring npx__g-parallel"
            style={{
              ['--pr' as string]: `${r}cqw`,
              ['--py' as string]: `${y}cqw`,
            }}
          />
        ))}
        <i className="npx__g-core" />
      </span>
    </span>
  );
}
