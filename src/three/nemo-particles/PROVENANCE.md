# `src/three/nemo-particles/` — the hero particle field, ported from `nemo-webgl.html`

`nemo-particles.js` **is** the inline `<script>` of `nemo-webgl.html`, the
standalone full-page concept that ships in `nemosite.zip` at the repo root
(`nemosite/nemo-webgl.html`, sha256
`9a2e1c2bb401e83bc417de6c19cca7787d7b54b47d11f9bd69e69a38d223d4cf`).

Unlike `src/three/blackhole/`, this folder is *not* byte-identical to its donor,
and cannot be: the donor is a page-load IIFE that grabs its DOM by id, sizes off
`window.innerWidth/innerHeight`, listens on `window` forever and never tears
anything down. It is not a module and it has no seam to mount into. So the
**logic** here is verbatim — every shader string, timing constant, physics term,
threshold and draw call is the original's — and only the **orchestration** was
rewritten, which is exactly the split `components/BlackHoleStage.tsx` already
makes for the black hole ("The stage re-writes only that orchestration").

The four pose files in `public/nemo-particles/` **are** byte-identical to the
zip's `nemosite/data/pose0.json … pose3.json`:

| File | sha256 |
| --- | --- |
| `pose0.json` | `64bd0f0cde8528baaba816f892a249c6543020bad88227d27cd93a6dc757f9a9` |
| `pose1.json` | `fc1cedbb1d0b051d96863faa1514bdfd2c48294c36f21a933359654c4849df78` |
| `pose2.json` | `34c909095609bf05314a6b706b7257beb5d5be73e33d6a2c208f4626b9f78e96` |
| `pose3.json` | `0f10f6faa2500acc1ee477988f58f318892d2fbc31cec38f02b02a2f6a770c5a` |

## What lives where

* **This folder** — the engine. One export, `createNemoParticleField(canvas, options)`.
* `src/components/NemoParticleField.tsx` — the React mounting layer: creates and
  removes the canvas, drives sizing from a `ResizeObserver`, pauses off screen
  with an `IntersectionObserver`, and renders the DOM layers the standalone page
  had around its canvas (breathe · loading veil · fallback · vignette · grain)
  from engine callbacks instead of `document.getElementById`.
* `src/sections/Hero.tsx` — mounts it inside `.hero__bg`, in place of the old
  `CardImage` hero photo. Nothing else in the hero changed.
* `src/styles/nemo-particles.css` — the donor's `<style>` block, re-scoped.
* `tests/unit/nemo-particles.test.ts` — runs the real engine against a recording
  WebGL stub and the real pose JSONs (this sandbox has no browser).

## Adaptations (embedding a standalone page into a React app)

These are the hazards the integration brief called out. Each one is an
orchestration change, not a behaviour change.

| Donor | Here | Why |
| --- | --- | --- |
| `html,body{overflow:hidden}`, `canvas{position:fixed;inset:0}` | wrapper `.nemo-field` is `position:absolute;inset:0` inside `.hero__bg`; CSS owns the display box | the field must fill the hero, not the viewport, and must scroll away with it |
| `resize()` reads `window.innerWidth/innerHeight` and pins `canvas.style.width/height` in px | `resize(cssW, cssH)` takes the hero's measured box from a `ResizeObserver`; only the drawing buffer is set | a fluid container, not a viewport. The 150 ms debounce and the DPR≤1.5 clamp carry over unchanged |
| `e.clientX * DPR` for pointer coords | `toDevicePx()` via `getBoundingClientRect()` | the canvas now sits inside a CSS-transformed (`.hero__bg` parallax), scrolling container; the rect already includes that transform |
| `pointermove`/`pointerdown`/`pointerleave` on `window` | `pointermove` + `keydown` stay on `window`; `pointerdown`/`pointerleave`/`pointercancel` bind to the `.hero` element | "anywhere on the page" meant the whole canvas when the page *was* the canvas. Clicks elsewhere on this 10-section page must not shockwave the hero |
| `:root{--bg,--cyan,--ink,--magenta,…}` and bare `.vignette` / `.grain` / `#fallback` / `.loading-overlay` | `.nemo-field` wrapper + `--npf-*` variables | the site already defines `.vignette` (overhaul.css), `.grain` (global.css, overhaul.css) and `--cyan`/`--ink`/`--magenta` (global.css `:root`); a verbatim copy would have restyled the whole page |
| `overlay.classList`, `loadStatus.textContent`, `getElementById('fallback')` | `onStatus` / `onReady` / `onError` / `onUnsupported` callbacks | React owns that DOM |
| one rAF loop for the life of the page | `start()`/`stop()`, `setVisible()` from an `IntersectionObserver`, full `destroy()` | SPA: listeners, rAF, buffers, programs, shaders, FBOs and the context are all released on unmount, and a fetch that resolves after unmount is ignored |
| canvas in the markup | canvas created in the effect and removed on cleanup | `getContext()` on a surviving canvas hands back its *old* context — which `destroy()` just lost. Same reason `BlackHoleStage.tsx` appends its own canvas |

Two additions, both deliberate and both flagged in the handover notes:

* `keydown` is ignored while the hero is off screen and never taken from a text
  field, listbox or combobox. The donor's unconditional `preventDefault()` on
  ArrowLeft/ArrowRight was harmless on a page that could not scroll; on this one
  it would have eaten arrow keys from every input on the site.
* `pointercancel` is bound alongside `pointerleave`, so a touch that turns into
  a scroll releases the pointer the same way.

## Upstream bugs: reported, not fixed

Per the integration brief's bug protocol these were **left exactly as they are**
in `nemo-particles.js` and raised instead:

1. **`pointerleave` on `window` is very likely dead code.** `pointerleave` does
   not bubble, so a bubble-phase listener on `window` never receives the events
   fired at descendant elements. The donor's `pointer.active = false` /
   `-99999` reset therefore probably never ran; the field self-heals only
   because `interactEnergy` decays (τ = 650 ms). Binding `pointerleave` to the
   hero makes the reset actually fire — the scoping adaptation fixes it by
   accident, not by intent.
2. **The `pointerleave` sentinel pollutes the velocity estimate.** `pointer.x/y`
   is set to `-99999`, and the next `pointermove` computes
   `(nx - pointer.x)/dt` from it, so the first move after re-entry reports an
   enormous pointer speed and briefly applies the maximum vortex
   (`VORTEX = 540`) and `psf = 2.0` to nearby particles. The effect is one
   frame's worth of impulse, so it is subtle — but the sentinel should be
   excluded from the velocity estimate.
3. **Reduced motion only half-applies.** `uReduced` kills the shader's idle
   drift and trims the shader's cursor push by 35 %, but the *CPU* physics has
   no reduced-motion branch at all: `physicsStep` still applies the full
   `REP_A = 2600` Gaussian repulsion and the full vortex. A reduced-motion user
   waving the cursor over the hero still gets a strongly displaced field. This
   is the one that matters most, because it is an accessibility guarantee that
   does not hold.
4. **`EDGE_K` is declared and never read** (`var EDGE_K = 2; // links per hub`).
   The hub link count is effectively hard-coded as "the two nearest neighbours
   in the bracket". Harmless, but the constant lies.

## Verifying the port

```bash
mkdir -p /tmp/nemosite && unzip -o -q nemosite.zip -d /tmp/nemosite
# pose data must be byte-identical
for i in 0 1 2 3; do
  cmp /tmp/nemosite/nemosite/data/pose$i.json public/nemo-particles/pose$i.json && echo "identical: pose$i"
done
# the engine's logic must match the donor script token-for-token apart from the
# orchestration lines listed above (whitespace and comments stripped)
npm run test:unit          # 12 of these tests drive the real engine
```
