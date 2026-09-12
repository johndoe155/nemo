# `src/three/persona-model/` — vendored character rendering

`scene.jsx` is extracted from `nemosite.zip` at the repository root:

```text
Model/index.html
```

The source archive's `Model/index.html` SHA-256 is:

```text
4380bf87e1cf9a11ff854b23a6826eed090ca679aaf62a70dde208f6faaa8a3d
```

## Fidelity rule

Everything that renders or animates the character remains in `scene.jsx` and
is intentionally kept byte-for-byte close to the donor's React script:

- model normalisation and camera-responsive framing;
- HDR environment and four-light studio rig;
- orbit controls, idle float, contact shadow and key-light flux;
- all `onBeforeCompile` vertex/fragment shader source and uniform values;
- model pointer, pointer-leave, global pointer-up/cancel, Enter and Space
  handlers.

Do **not** refactor the shader or retune a value here. `PersonaModelStage.tsx`
may change only scoped mounting, sizing, status UI and teardown concerns.

## Deliberate integration-only changes

1. The Babel/browser import-map header is replaced with normal Vite imports:
   React hooks, `three`, `@react-three/fiber`, `@react-three/drei`, and
   `GLTFLoader` retain their corresponding module sources.
2. `Canvas`, page root creation, the full-viewport loader, and the donor page's
   frame/tag/hero chrome are intentionally not copied. They are standalone-page
   orchestration rather than rendering logic. `PersonaModelStage.tsx` supplies
   a scoped Canvas plus minimal Hub-styled loading/error states; the
   screen-reader description is attached to that widget container.
3. `ResponsiveRig`, `Scene`, and `BASE_FOV` are exported so the mounting layer
   can preserve the donor's exact Canvas settings without duplicating rendering
   logic. Incidental trailing whitespace is normalized to satisfy the Hub's
   whitespace check; no executable source is changed.
4. `./model.glb` and `./studio_small_08_1k.hdr` become
   `import.meta.env.BASE_URL` references under `public/models/persona-model/`.
   This is required because the Hub builds with `base: './'` and may live below
   a deployment sub-path.

No shader text, shader anchor, lighting value, control value, model transform,
or input behaviour was changed.

## Assets copied from the donor archive

| Destination | SHA-256 |
| --- | --- |
| `public/models/persona-model/model.glb` | `d5163ef54753a468da3dd8139eac309aed1525f2e0e1abf0ecc5cd34fe29a208` |
| `public/models/persona-model/studio_small_08_1k.hdr` | `f6a989f89432eb4eee3191364a9c1ceed195c4ec3544173a3c04fd96cb91d0ba` |

## Dependency compatibility

The Hub already owns `three@0.185.1`; it was not changed or downgraded. The
installed React 18-compatible packages are `@react-three/fiber@8.18.0` and
`@react-three/drei@9.122.0`. Their declared peer ranges are respectively
`three >=0.133` and `three >=0.137`, so both explicitly accept the shared
0.185.1 release. `npm install` resolved without overrides, resolutions, or a
forced peer-dependency install.

The donor's import map used `three@0.160.0`, `@react-three/fiber@^8.16.0`, and
`@react-three/drei@^9.108.0`; the r3f/drei versions above are the newest
compatible major patches. The shader's three 0.185 compile result is exercised
by the desktop browser verification described in the integration change.
