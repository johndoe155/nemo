import type { CSSProperties } from 'react';

/* ============================================================================
   WireframeGlobe — compact, volumetric 3D wireframe sphere for inactive
   telemetry pods.

   GEOMETRY CONTRACT
   -----------------
   The cage is expressed entirely in `cqw` against `.npx__globe3d`, which is a
   size query container locked to a **perfect 1:1 square** and parked in the
   dead centre of the pod's background grid at a deliberately small scale. A
   square container is what makes this a sphere: 1cqw == 1cqh, so a ring
   declared 100cqw × 100cqw is a true circle, never a vertically stretched
   ellipse.

   The cage is built out of rings placed in real 3D space with CSS transforms:

     · meridians  — great circles standing upright, fanned every 30° around Y
     · parallels  — latitude rings lying flat at their true height, radius
                    shrunk to the real chord length sqrt(R² − y²)
     · core       — a small, soft point suspended at the sphere's centre

   Rotating the single .npx__globe3d-spin node (transform-style: preserve-3d)
   around Y revolves genuine 3D geometry, so the latitude rings stay horizontal
   while the meridians sweep — a globe, not a spinning coin. No WebGL context
   (the section already runs the particle field and liquid CTA), and the
   transparent rings deliberately show their own back half for the classic
   x-ray look.
   ========================================================================== */

/* Meridians: upright great circles fanned every 30° around Y (6 circles = 12
   visible half-arcs), which is what gives the cage its longitudinal density.
   `o` is a per-ring opacity multiplier — the circle facing the viewer at rest
   reads brightest, the ones raking away sink back, so the cage has depth
   instead of looking like a flat schematic. */
const MERIDIANS: { ry: number; o: number }[] = [
  { ry: 0, o: 0.5 },
  { ry: 30, o: 0.34 },
  { ry: 60, o: 0.28 },
  { ry: 90, o: 0.42 },
  { ry: 120, o: 0.28 },
  { ry: 150, o: 0.34 },
];

/* Parallels: latitude rings evenly spaced 14cqw apart in height, from the
   south polar ring to the north polar ring (7 rings, symmetric about the
   equator). Radius is the true chord sqrt(50² − y²), so the rings hug the
   sphere's surface and the silhouette closes properly at the poles.
     y = −42 → r = 27.13    y = −28 → r = 41.42    y = −14 → r = 48.00
     y =   0 → r = 50.00 (equator)
   Negative y is up in CSS. */
const PARALLELS: { r: number; y: number; o: number }[] = [
  { r: 27.13, y: -42, o: 0.24 }, // north polar ring
  { r: 41.42, y: -28, o: 0.3 },
  { r: 48.0, y: -14, o: 0.36 },
  { r: 50.0, y: 0, o: 0.52 }, // equator — the brightest structural line
  { r: 48.0, y: 14, o: 0.36 },
  { r: 41.42, y: 28, o: 0.3 },
  { r: 27.13, y: 42, o: 0.24 }, // south polar ring
];

export default function WireframeGlobe() {
  return (
    <span className="npx__globe3d" aria-hidden="true">
      <span className="npx__globe3d-spin">
        {MERIDIANS.map(({ ry, o }) => (
          <i
            key={`m${ry}`}
            className="npx__g-ring npx__g-meridian"
            style={
              {
                ['--ry' as string]: `${ry}deg`,
                ['--go' as string]: o,
              } as CSSProperties
            }
          />
        ))}
        {PARALLELS.map(({ r, y, o }, i) => (
          <i
            key={`p${i}`}
            className="npx__g-ring npx__g-parallel"
            style={
              {
                ['--pr' as string]: `${r}cqw`,
                ['--py' as string]: `${y}cqw`,
                ['--go' as string]: o,
              } as CSSProperties
            }
          />
        ))}
        <i className="npx__g-core" />
      </span>
    </span>
  );
}
