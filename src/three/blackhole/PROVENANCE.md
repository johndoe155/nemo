# `src/three/blackhole/` — vendored verbatim. Do not edit.

These four files **are** the black hole simulation. They were copied
byte-for-byte out of `webgpu-black-hole-config-driven.zip` at the repo root and
must stay identical to it — no refactors, no renamed exports, no swapped
`three/webgpu` / `three/tsl` imports, no touched math, and no changed values in
`blackhole.config.js` (it is documented upstream as the single source of truth
for every tunable parameter).

| File | Role | sha256 |
| --- | --- | --- |
| `blackhole.js` | `BlackHoleSimulation` — uniform plumbing, inverted-sphere mesh, per-frame update, resize | `357f91e42ec8aaed865ec9d3c885c23f5ac50a7172df7e35af334e53ed618d1a` |
| `blackhole-shader.js` | the TSL raymarcher: gravitational lensing, accretion disk, star field, nebula | `8e22de459e83445969ab9694655cd3bc3cc6ee28203871aebd6cb3353c18c1e5` |
| `blackhole.config.js` | every parameter, nested + auto-flattened (`flatSimulationConfig`) | `dfae8afd955a6804a0c40d0b2da22d8b190f1ffcce82b8dc32d08c89329aff64` |
| `camera-animation.js` | `CameraAnimation` — Catmull-Rom cinematic flythrough | `e27ef2383a97c0c326f1d3b672929ad711f1bb85919a1f42061f117a851ad949` |

Re-verify at any time (paths relative to the repo root):

```bash
mkdir -p /tmp/bh && unzip -o -q webgpu-black-hole-config-driven.zip -d /tmp/bh
for f in blackhole.js blackhole-shader.js blackhole.config.js camera-animation.js; do
  diff "/tmp/bh/webgpu-black-hole-main/$f" "src/three/blackhole/$f" && echo "identical: $f"
done
```

## What lives where

* **This folder** — the simulation. Read-only.
* `src/components/BlackHoleStage.tsx` — the React mounting layer. Upstream's
  `main.js` is a standalone Vite entry point (it sizes off
  `window.innerWidth/innerHeight`, appends its canvas to `document.body`, and
  never tears anything down), so it cannot be dropped into a component tree.
  The stage re-writes **only** that orchestration: scoped mounting, scoped
  sizing, full teardown, off-screen pausing, WebGPU feature detection,
  `prefers-reduced-motion`, and the touch policy. Rewriting the orchestration is
  not rewriting the shader.
* `src/components/BlackHoleStill.tsx` — the CSS/SVG static frame shown when
  WebGPU is unavailable or the renderer fails to initialise.
* `src/sections/Singularity.tsx` — the homepage section that hosts the stage.
* `src/styles/blackhole.css` — stage box, seam gradients, still styling.
* `src/lib/scenes.ts` — the `singularity` district + the retuned `abyss`
  district, so the page's own ambience meets the canvas without a seam.

## Not carried over from the zip

`main.js` (replaced by the glue above), `index.html`, `styles.css`,
`vite.config.js`, `.github/workflows/deploy.yml`, and `public/cloud.png` —
the last is referenced by nothing in the four files (verified by grep; the only
matches for "cloud" are prose comments about procedural nebula clouds), so it
was deliberately left behind.

## Dependency note

Upstream declares `three@^0.181.1`. This project ships **three 0.185.1** — the
current latest — which exposes the `three/webgpu`, `three/tsl` and
`three/addons/*` subpath exports the simulation imports. Compatibility was
verified rather than assumed: every one of the 27 TSL symbols
`blackhole-shader.js` imports resolves, the full raymarch node graph builds
(`MeshBasicNodeMaterial.colorNode`), `BlackHoleSimulation` / `CameraAnimation`
instantiate and tick, and the bloom post-processing chain constructs. No second
copy of `three` is vendored to dodge the version question.

## Upstream

`webgpu-black-hole` — MIT, Daniel Greenheck.
