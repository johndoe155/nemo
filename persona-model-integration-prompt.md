# Task: Embed the 3D character model from `nemosite.zip` into the Hub, Section 02 · PILLAR 4

You're working in the **Nemoverse Hub** repo (Vite + React 18 + TypeScript, strict). Your job is to
take the standalone 3D character viewer shipped in `nemosite.zip` and mount it, pixel-for-pixel
faithful, inside `src/sections/Persona.tsx` (Section 02 · PILLAR 4) next to the NEMO chatbot —
**desktop only**. This is a fidelity-critical port, not a redesign: the visual/interactive result
must be indistinguishable from the donor demo except where the donor file itself is buggy.

## Source and destination

- **Donor** (`nemosite.zip` → `Model/`): a single self-contained `index.html` that boots React 18
  + `@react-three/fiber` + `@react-three/drei` from `esm.sh` CDN imports, transpiled in-browser via
  Babel standalone (`<script type="text/babel">`). It ships `model.glb` (~29 MB) and
  `studio_small_08_1k.hdr` (~1.5 MB) alongside it.
- **Destination**: `src/sections/Persona.tsx`, inside `.persona__chatwrap`, next to `<NemoChat />`.
  `Persona.tsx` is section 02 (`kicker="02 · PILLAR 4 — THE AI PERSONA"`) — confirm you're editing
  the right section before touching anything.

## Non-negotiable: preserve every visual/interactive detail

The donor's `Model` component is not a simple glTF viewer — it has a hand-written shader hack
layered on top of the PBR material via `material.onBeforeCompile`. Every one of the following must
survive the port exactly:

- HDR studio environment lighting (`studio_small_08_1k.hdr`) at the same intensity, plus the exact
  3-directional-light + hemisphere-light rig (positions, colors, intensities).
- ACES Filmic tone mapping, sRGB output color space, the same tone-mapping exposure.
- Camera position/FOV (including the mobile-FOV swap logic — irrelevant once desktop-gated, but
  don't strip it if you're vendoring the file verbatim).
- Orbit-drag rotation with damping, `enableZoom={false}`, `enablePan={false}` — full 360° rotation,
  no zoom/pan.
- The gentle idle floating bob animation.
- The contact shadow under the model.
- The **press-and-hold "torchlight" effect** — this is the centerpiece and the easiest thing to
  break by re-implementing instead of vendoring: the vertical sweep band, the side/front normal
  masking, the leftward warp + ripple vertex displacement, the specular/roughness boost, the rim
  light, the near-white HDR flare spike, and the screen-darken "flux" pulse synced to the key light.
  Triggers on pointer down/up, pointer leave, **and** Enter/Space keydown/keyup.
- Loading progress behavior and a graceful failure state (don't let a WebGL/model-load failure take
  down the rest of the Persona section).

**Do not rewrite the shader math or re-derive the effect from a description.** Vendor the rendering
logic as close to byte-for-byte as the module system allows, and only rewrite the *mounting/
orchestration* layer. This repo already has an established convention for exactly this situation —
follow it:

- Look at `src/three/blackhole/` + its `PROVENANCE.md`, and the header comment at the top of
  `src/components/BlackHoleStage.tsx`. That's a previous case of vendoring a third-party WebGL demo
  verbatim and writing a thin React "stage" component that owns *only* scoped mounting, scoped
  sizing, teardown, and capability/failure handling — never touching the vendored math. Mirror that
  pattern here: e.g. `src/three/persona-model/` for the vendored scene/model/shader logic (plain
  `.jsx`/`.js`, leaning on the `allowJs`/`checkJs:false` carve-out already in `tsconfig.json`,
  which exists for exactly this purpose — read its inline comment), and something like
  `src/components/PersonaModelStage.tsx` for the new, typed, scoped mounting layer.
- Write a `PROVENANCE.md` next to the vendored files the same way the blackhole folder does, with
  a note of what was changed (loader URLs, import sources) and why.

## What is explicitly *not* "the model" — leave it out

The donor file is a full standalone landing page, not just a viewer. The following is that page's
own chrome, not part of the model, and should **not** be carried into the widget:

- The hero copy ("Say hello.", the "Drag to orbit… press and hold…" paragraph), the corner
  brackets, and the "Specimen · 001" tag overlay.
- The full-viewport `.loading-overlay` / `.error-fallback` markup and copy — replace with a
  minimal, site-styled loading/error state scoped to the widget's own box (the donor's version is
  `position: fixed; inset: 0`, which would cover the entire page if copied as-is — this must become
  scoped to the widget container regardless).
- The Google Fonts `<link>` tags (Bricolage Grotesque / Inter / IBM Plex Mono) and the Cloudflare
  challenge-platform `<script>` at the bottom of the file — both belong to whatever tool hosted the
  demo, not to the model. **Inter in particular was deliberately purged from this project's bundle**
  (see the comment block at the top of `src/main.tsx`) — do not reintroduce it. If any incidental
  text is kept, it uses the Hub's existing type system (`styles/typography.css`), not new webfonts.
- Do keep an equivalent accessible description (the donor's `sr-only` text) so screen-reader users
  aren't worse off for the dropped visual chrome — attach it to the canvas/container instead of the
  bracket-and-tag frame.

If you're unsure whether some piece of chrome should be kept, default to leaving it out and note
the decision in your summary — don't ask, just flag it (this isn't a bug, just a call you made).

## Desktop-only gating — must not cost mobile/tablet anything

This is a desktop-gated feature, and "gated" means it must not download, parse, or execute on
smaller viewports — not merely be hidden with CSS.

- The repo already has a synchronous, first-paint `matchMedia` hook for exactly this kind of gate:
  `useMediaQuery` in `src/lib/singularityGate.tsx`. Reuse or mirror it rather than inventing a new
  debounced resize-listener version.
- `.persona__grid` already collapses to a single column at `max-width: 980px`
  (`components.css`/`overhaul.css`). Gate the model at that same breakpoint (`min-width: 981px`) so
  it only ever appears when the layout is actually in its two-column, "beside the chat" state —
  don't introduce a different threshold (e.g. the site's other `768px` mobile convention) that
  would leave a broken in-between width.
- Actually skip the work below that breakpoint: dynamically `import()` the `PersonaModelStage`
  component (React.lazy + Suspense, or a manual gated `import()`) so the `@react-three/fiber`/
  `@react-three/drei`/`three` (for r3f) bundle and the `model.glb`/`.hdr` network requests never
  fire under the breakpoint. Verify in the Network tab, not just visually.
- Optional but recommended, and doesn't affect fidelity: don't fetch the 29 MB model eagerly on
  page load even on desktop — mount it once its container scrolls near the viewport, the same way
  `NemoChat` itself already gates its animation on `useInView` from framer-motion.

## Dependency / version risk — verify, don't assume

The donor pins `three@0.160.0`, `@react-three/fiber@^8.16.0`, `@react-three/drei@^9.108.0` via CDN
import map. This repo pins `three@^0.185.1` **as a shared dependency already used elsewhere**
(`src/sections/pulls/ParticleField.tsx`, `LiquidPullButton.tsx`, plus a separate `three/webgpu`
build for the black hole). Do not downgrade the shared `three` version to satisfy the model — it
isn't yours to change.

`@react-three/fiber@8` pairs with React 18 (good, matches this repo), but pmndrs packages pin their
`three` peer-dependency ranges tightly per-minor, and 0.185.x is newer than what some 8.x/9.x
patches declare support for. Before writing any integration code:

1. Add `@react-three/fiber` and `@react-three/drei` to `package.json` and run the install.
2. If peer-dependency resolution fails against the shared `three@^0.185.1`, do **not** silently
   force-install and move on — find the newest `@react-three/fiber@8.x` / `@react-three/drei@9.x`
   patch that explicitly supports three ~0.185, or use a scoped `overrides`/`resolutions` entry, and
   record exactly what you did and why in the `PROVENANCE.md`.
3. Either way, visually confirm after wiring it up that the "hold" shader effect (which patches
   `#include <lights_fragment_begin>` / `#include <opaque_fragment>` on the compiled physical
   material shader) still produces the same look under `three@0.185.x` as it does when you open the
   donor file standalone under its pinned `three@0.160.0`. These are anchor-based string patches on
   stable include names, so they should survive the version jump, but *confirm it, don't assume it*
   — if the sweep/rim/flare looks different, that's a real bug to report (see below), not something
   to quietly tweak back into looking similar.

Extend `vite.config.ts`'s existing `manualChunks` (currently `webgl` / `webgpu` / `animation`) with
a new chunk for the r3f/drei stack — the file's own comment already documents and accepts shipping
two separate `three` builds for fidelity reasons; this is the same tradeoff a third time, not a new
one.

## Asset placement

Move `model.glb` and `studio_small_08_1k.hdr` into `public/` (e.g.
`public/models/persona-model/`), and reference them the same way `src/lib/assets.ts` already does
for `LOGO_SRC` — via `import.meta.env.BASE_URL` — rather than the donor's page-relative
`./model.glb`, since this project builds with `base: './'` and can be deployed under a sub-path.

## Layout

Inside `.persona__chatwrap`, place the new stage component beside `<NemoChat />` (not overlapping
the copy column) at the `min-width: 981px` breakpoint established above. Scope any new CSS to new,
purpose-named classes in `components.css`/`overhaul.css` following the existing `.persona__*`
naming; it must have zero effect on layout at ≤980px, where `NemoChat` should look and behave
exactly as it does today. The donor's vignette stage background (the `--void`/`--studio-center`/
`--studio-outer` radial gradient) is part of how the lighting reads and should be kept, resized to
the widget's box rather than the full viewport.

## Failure handling

Wrap the mounted stage in an error boundary, following this repo's existing pattern (see
`SectionBoundary` in `App.tsx` and the philosophy documented at the top of
`BlackHoleStage.tsx`: *"three decides, the glue does not"* — don't add aggressive WebGL capability
probing beyond what's needed; let the library fail naturally and catch the render error). A failure
here must never take down the chat panel or the rest of Section 02.

## Verification checklist before you call this done

- [ ] `npm run build` (`tsc -b && vite build`) passes with zero new type errors.
- [ ] At ≥981px viewport: HDR lighting/reflections match the standalone donor file; drag-to-orbit
      works with damping, no zoom/pan; idle float animation runs; press-and-hold (mouse) and
      Enter/Space (keyboard) both trigger the full sweep/warp/ripple/specular/rim/flare sequence and
      decay correctly on release; contact shadow renders; resizing the window keeps the model
      framed.
- [ ] At ≤980px: no `model.glb`, `.hdr`, or r3f/drei chunk requests fire at all (check the Network
      tab), and the chat panel is unaffected.
- [ ] Reintroduce a page reload at both sizes to confirm the gate is correct on first paint, not
      just after a resize event.

## Bug-reporting protocol

If you find an actual functional bug or limitation in the donor's original code — something that
misbehaves even when you open `nemosite`'s `index.html` standalone, or a genuine version
incompatibility that would force you to change how an effect looks or behaves — **stop and report
it to me with specifics** instead of silently patching around it or changing the visual result.
Ordinary integration/plumbing decisions (exact wrapper component shape, minor loading-state
styling, file layout inside `src/three/persona-model/`) are yours to make without asking.

## When you're done, report back

- Every file added/changed.
- Every new dependency added, and the exact versions you landed on (plus a one-line note if you hit
  the peer-dependency issue above and how you resolved it).
- Confirmation of each item in the verification checklist.
- Any bugs found in the donor code, per the protocol above.
