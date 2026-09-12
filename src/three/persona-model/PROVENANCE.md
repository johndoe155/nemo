# `src/three/persona-model/` — vendored donor rendering code

`PersonaModelScene.jsx` began as the rendering core extracted from
`nemosite.zip` → `Model/index.html`. Its light rig, controls, renderer settings,
model animation, contact shadow, and hand-written `onBeforeCompile` shader are
donor code. The loading orchestration around that core now supports the
precomputed particle-first preview described below.

## Source

| Donor file | Destination / role | sha256 |
| --- | --- | --- |
| `Model/model.glb` | `public/models/persona-model/model.glb` | `d5163ef54753a468da3dd8139eac309aed1525f2e0e1abf0ecc5cd34fe29a208` |
| `Model/studio_small_08_1k.hdr` | `public/models/persona-model/studio_small_08_1k.hdr` | `f6a989f89432eb4eee3191364a9c1ceed195c4ec3544173a3c04fd96cb91d0ba` |
| Rendering portion of `Model/index.html` | `src/three/persona-model/PersonaModelScene.jsx` | vendored rendering core plus documented orchestration changes |

The destination GLB/HDR hashes match the files inside the archive.

## Deliberate integration changes

The donor is an in-browser Babel page backed by an `esm.sh` import map. The Hub:

- Removes the standalone `createRoot`, page mount, page chrome, and viewport-wide
  loading/error UI.
- Exports its `<Canvas>` composition as `PersonaModelCanvas`.
- Uses `import.meta.env.BASE_URL` public paths for the GLB and HDR.
- Loads the GLB through one module-cached `GLTFLoader.loadAsync()` promise rather
  than suspending the whole canvas with `useLoader`. The full mesh preparation,
  material patching, HDR, and contact shadow still run as before.
- Shows the precomputed particle representation while that promise settles,
  then fades the particles after the prepared mesh renders its first frame.
- Moves the donor's centering/rotation and viewport-fit formulas into
  `normalization.js`, shared with the offline generator and both runtime
  representations.

The shader constants and shader source replacements, held-state timing and
flux, light values, contact-shadow values, camera, tone mapping, orbit control
configuration, and detailed-model idle animation remain unchanged.

## Precomputed persona points

`public/models/persona-model/persona-points.json` contains 12,000 deterministic
surface samples generated from the real persona GLB. It is a 3D extension of the
schema demonstrated by the supplied root `model.json`: flattened XYZ triples and
x/y/z bounds, with no unused RGB payload. The supplied `model.json` itself is the
unrelated 2D `Torn-Paper` asset and is not imported or copied into this flow.

Regenerate after **every** change to `model.glb`:

```bash
npm run generate:persona-points
```

The generator loads the GLB with `GLTFLoader`, applies the shared static
centering/rotation, transforms every mesh into world space, allocates samples by
transformed surface area, and uses `MeshSurfaceSampler` with a seeded random
source. Coordinates are rounded to five decimal places. This is intentionally a
manual build step: replacing the GLB without rerunning it will make the preview
silhouette drift from the detailed model at swap time.

## Intentionally not carried over

The standalone hero copy, specimen tag, corner brackets, vignette background,
full-viewport loader, document resets, Google Fonts, Babel runtime, import map,
and Cloudflare challenge script are page or hosting chrome. The HDR remains
reflection/lighting-only; neither Drei's `Environment` nor the Three scene paints
a background, and the canvas keeps the donor's alpha renderer setting.

## Dependency note

The donor import map requested `three@0.160.0`,
`@react-three/fiber@^8.16.0`, and `@react-three/drei@^9.108.0`. This integration
uses:

- `three@0.185.1` (the Hub's existing shared version)
- `@react-three/fiber@8.18.0`
- `@react-three/drei@9.122.0`

Fiber declares `three >=0.133` and Drei declares `three >=0.137`, so npm resolves
the shared Three version without an override or forced install.

## Verification

```bash
mkdir -p /tmp/persona-model
unzip -o -q nemosite.zip -d /tmp/persona-model
diff /tmp/persona-model/Model/model.glb public/models/persona-model/model.glb
diff /tmp/persona-model/Model/studio_small_08_1k.hdr public/models/persona-model/studio_small_08_1k.hdr
npm run generate:persona-points
git diff --exit-code -- public/models/persona-model/persona-points.json
```

Visual compatibility of the donor's physical-material include patches with
Three 0.185.x must be checked whenever Three or the pmndrs packages are updated.
