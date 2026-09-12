# `src/three/persona-model/` — vendored donor rendering code

`PersonaModelScene.jsx` is the rendering core extracted from
`nemosite.zip` → `Model/index.html`. Treat the model normalization, animation,
lighting, controls, material patch, and shader strings as read-only donor code.
The typed mounting and failure/loading UI live in
`src/components/PersonaModelStage.tsx`.

## Source

| Donor file | Destination / role | sha256 |
| --- | --- | --- |
| `Model/model.glb` | `public/models/persona-model/model.glb` | `d5163ef54753a468da3dd8139eac309aed1525f2e0e1abf0ecc5cd34fe29a208` |
| `Model/studio_small_08_1k.hdr` | `public/models/persona-model/studio_small_08_1k.hdr` | `f6a989f89432eb4eee3191364a9c1ceed195c4ec3544173a3c04fd96cb91d0ba` |
| Rendering portion of `Model/index.html` | `PersonaModelScene.jsx` | `d7d831b9d2543a867a6d2b71539a656dab13430cf26d878ca3aa51956e003774` |

The destination asset hashes match the files inside the archive.

## Deliberate module-system changes

The donor is an in-browser Babel script backed by an `esm.sh` import map. The
following are the only rendering-file changes needed to make it a Vite module:

- Removed the standalone `createRoot` import and page-level `App` mount.
- Exported the donor's `<Canvas>` composition as `PersonaModelCanvas`.
- Changed `./model.glb` and `./studio_small_08_1k.hdr` to
  `import.meta.env.BASE_URL`-based public paths for sub-path deployments.
- Removed the donor's `LoadingOverlay`, `HeroCopy`, page-wide error boundary,
  and standalone frame. Their widget-scoped integration equivalents live in
  `PersonaModelStage.tsx` and `components.css`.

The constants, model transforms, per-frame behavior, light values, contact
shadow, controls, renderer configuration, and `onBeforeCompile` shader strings
were retained from the donor rather than re-derived.

## Intentionally not carried over

The standalone hero copy, specimen tag, corner brackets, full-viewport loading
and error markup, document resets, Google Fonts, Babel runtime, import map, and
Cloudflare challenge script are page chrome or hosting artifacts, not the model.
The donor's screen-reader description was retained on the scoped widget.

## Dependency note

The donor import map requested `three@0.160.0`,
`@react-three/fiber@^8.16.0`, and `@react-three/drei@^9.108.0`. This integration
uses the newest releases in those React-18-compatible major lines:

- `three@0.185.1` (the Hub's existing shared version)
- `@react-three/fiber@8.18.0`
- `@react-three/drei@9.122.0`

Fiber declares `three >=0.133` and Drei declares `three >=0.137`, so npm resolved
the shared Three version without an override or forced install. npm does emit a
deprecation warning for Drei's transitive `three-mesh-bvh@0.7.8`; the Persona
scene does not import the BVH helpers, and the installed tree resolves its Three
peer to the shared `0.185.1`.

## Verification

Re-extract the source without touching the working tree:

```bash
mkdir -p /tmp/persona-model
unzip -o -q nemosite.zip -d /tmp/persona-model
diff /tmp/persona-model/Model/model.glb public/models/persona-model/model.glb
diff /tmp/persona-model/Model/studio_small_08_1k.hdr public/models/persona-model/studio_small_08_1k.hdr
```

Visual compatibility of the donor's physical-material include patches with
Three 0.185.x must be checked whenever Three or the pmndrs packages are updated.
