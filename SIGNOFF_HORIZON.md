# Closing sign-off → event horizon

## What this is (and is not)

A **single frozen raster of ClosingSignoff**, warped by a small WebGL2 shader.
It is not live DOM-to-GPU streaming, not 3D reprojection, and does not follow the
cinematic camera in the black-hole stage.

The fixed 2D anchor is horizontally centered. Its Y position is the measured
lower edge of `.bh-frame::after` in footer coordinates, clamped to the top of the
footer when the section's padding is taller than the seam. This is the deliberate
artistic simplification. The deflection equation itself is ported unchanged from
Daniel Greenheck's MIT-licensed `blackhole-shader.js`, using `vec2` ray state:

```glsl
float rs = uBlackHoleMass * 2.0;
vec2 toCenter = -rayPos / r;
float bendStrength = rs / (r * r) * uStepSize * uGravitationalLensing;
rayDir += toCenter * bendStrength;
rayDir = normalize(rayDir);
rayPos += rayDir * uStepSize;
```

`blackHoleMass`, `gravitationalLensing`, and `stepSize` come directly from
`flatSimulationConfig`. The capture threshold is still `rs * 1.01`; escape is
still `r > 100` in simulation units. Conversion to pixels is
`pixelsPerUnit = effectiveHorizonRadiusPx / rs`, so neither threshold nor the
per-step physics changes units accidentally.

The 2D launch is explicit: parallel rays approach from below the flat DOM plane.
Their unbent paths land on the original texels. Escaped rays finish the remaining
straight flight to that plane; captured rays never sample the texture. There
are 32 integration steps, no swirl/pinch/barrel formula and no per-frame snapshot.

**Art-direction knob:** `EFFECTIVE_HORIZON_RADIUS_PX` in
`src/three/eventHorizonWarp.ts`. A fixed scroll curve expands this seed to the
farthest measured footer corner. Full consumption is horizon capture, not a final
opacity fade over an otherwise unwarped image.

## Ownership and gates

- `src/lib/singularityGate.tsx`: the original synchronous
  `matchMedia('(max-width: 768px)')` policy, now shared by Singularity and the
  sign-off. One provider also subscribes to reduced motion and receives
  **BlackHoleStage's actual status**, including failures, Retry and unmount.
  It has no DOM wrapper and does not alter the stage's GPU backend selection.
- `src/components/SignoffHorizon.tsx`: owns ClosingSignoff's original `<footer>`
  root/ref, the GSAP context/matchMedia branches, arm trigger, reversible scrub,
  async cancellation and cleanup. Footer's curtain relationship is unchanged.
- `src/lib/signoffHorizonGeometry.ts`: resolves the actual pseudo-element height
  (the `--bh-seam` token is a `clamp()`, not a parseable pixel number).
- `src/lib/captureSignoff.ts`: lazily loaded html2canvas capture, used once per
  eligible activation. No other page sections or GPU canvases are cloned.
- `src/three/eventHorizonWarp.ts`: raw WebGL2, one texture, one full-cover
  triangle, no three/WebGPURenderer, no extra WebGPU device, no render loop.
- `src/styles/signoff-horizon.css`: paint-only overlay rules. `blackhole.css`
  retains its documented three jobs: box / seam / still.

Mobile, reduced motion, and any stage status other than `live` get the ordinary
footer: no capture module load, snapshot, overlay context or scrub. The reduced
motion matchMedia branch's finished state is **plain content**, not eaten content.

## Scroll timing

The arm trigger fires when the fixed anchor is one resolved seam below the
viewport, allowing capture to begin offscreen. Scrub begins when that anchor
crosses `viewportHeight - seamHeight` and finishes at `seamHeight`. The start/end
functions invalidate on refresh. The DOM/snapshot paint handoff spans one seam's
scroll distance. There are no guessed percentage lines, pins, layout tweens or
new raw scroll listeners.

The playhead is reversible. Returning to zero restores real DOM paint; revisiting
the effect reuses the original frozen texture, not another DOM walk.

## Interaction and accessibility

The real CTA and all sign-off text remain mounted. Only the children's **opacity**
is exchanged with the overlay. No `display:none`, `visibility:hidden`, `inert`,
`aria-hidden`, transforms or pointer suppression are applied to the real link.
The canvas alone is `aria-hidden` and `pointer-events:none`.

While focus is anywhere inside the invitation, CSS immediately restores its live
paint and ordinary focus ring and suppresses the overlay, even at full
consumption. This is an intentional keyboard rescue, not a reset of the scrub.
The CTA has an explicit readable accessible name so its kinetic per-character
spans aren't announced as individual letters. Its original `#nemoverse` href,
native click/Enter behavior and tab order are unchanged.

## Rasterization findings and deliberate fallbacks

The default html2canvas JS painter did **not** reproduce this sign-off acceptably
(gradient text and the transformed marquee were broken). The implementation
therefore uses html2canvas's native SVG/foreignObject path instead:

- `.txt-grad.chroma`: native CSS preserves gradient clipping and chroma. The
  site's actual loaded `@font-face` assets are embedded into the snapshot; without
  them, SVG images silently substitute a system font and lose the Machina inktraps.
- `.btn-spark` / cursor bloom / button strata: their current computed paint is
  frozen, as intended. Native hover/focus and the real hit target still work.
- `.marquee--credits`: the frozen band retains its tilt, edge mask, translucent
  tint and text. **Backdrop blur is intentionally omitted in the clone only**:
  an isolated SVG cannot blur the live page behind it. No live CSS is simplified.
- The footer's background gradient stays in the real DOM rather than being
  painted twice. This preserves its opaque curtain hem and the existing floor
  reveal; captured texels reveal this backing, not unwarped letters.

The helper corrects html2canvas 1.4's foreignObject origin offset, checks readable
pixels in the headline, and rejects a blank/tainted result instead of hiding the
real invitation. Font, capture, upload, shader or context failures restore the
ordinary footer and report the reason. No repeated automatic capture attempts.

Snapshot/render resolution is capped to 1.5 million pixels and a 2048-pixel edge;
CSS dimensions and hit targets are never scaled. On a width/height reflow **after
capture**, the effect is retired for that activation and real paint returns.
This is deliberate: a frozen raster cannot reflow with the CTA. Resize does not
secretly trigger another capture. A new eligible lifecycle (e.g. a fresh desktop
stage after a mobile hop, or successful Retry) may arm a fresh one-shot capture.

## Lifecycle

Cleanup aborts pending font fetches, kills both ScrollTriggers and the scrub tween,
disconnects ResizeObserver, cancels scheduled refresh work, restores paint, deletes
the texture/shaders/program/VAO, loses the WebGL2 context and removes the canvas.
Every activation gets a fresh canvas, never a reused lost context.

html2canvas has no cancellation API. A capture already underway is allowed to
settle; its invocation-specific clone iframe is removed even on failure, and a
late CPU canvas is cleared without creating or attaching a renderer. Released
guards across every await cover StrictMode's mount → cleanup → mount, status
changes, reduced-motion changes and unmount.

## Verification

```sh
npm ci
npm run build
npm run verify:blackhole
npx playwright install --with-deps chromium
npm run test:signoff-horizon
```

An existing Chromium can be supplied with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`. Browser artifacts are
ignored; no snapshots, installed browsers or generated dependencies belong in Git.

Verified on 2026-09-06: production build, vendored-hash verification, and all
**23 Chromium browser tests pass**. A production-bundle smoke test of the complete
App also reached a live stage and ready overlay with the existing curtain active,
restored live CTA paint on focus, and reported no runtime JavaScript errors. GPU
checks here used software WebGL2, with a small test-only stage resolution.

The Playwright suite exercises the real Footer/CSS under StrictMode and covers:

- Mobile at 375/768px, desktop at 769px, a mobile round trip, reduced motion,
  booting/unsupported/error gates.
- Measured seam start/end, one capture/upload/context, no overlay WebGPU request.
- Reversible scroll and identical frozen mid-progress pixels on the return trip.
- Fully transparent captured output at completion.
- Native click, Tab, Shift-Tab and Enter at 0/50/100%, visible focus rescue,
  and an exposed link in Chromium's accessibility tree at all three states.
- Status loss, remount, context loss, failed WebGL2 creation, resize and late
  capture completion after unmount/reduced motion/status change.
- The actual BlackHoleStage status → gate connection using its live WebGL2
  fallback in the software-GL test environment (small test-only stage resolution).
- More than a thousand GPU texel checks against an independent Float64 CPU port
  using the same imported config, including capture and escape.
- Native-vs-unwarped snapshot comparisons at DPR 1 and 2, including the headline
  font/gradient and CTA. These allow minor AA/downsampling differences, not a
  lost headline or fallback typeface.

`verify:blackhole` checks all four vendored files against the SHA-256 hashes in
`PROVENANCE.md`. No file in `src/three/blackhole/` was edited.

Remaining manual coverage: native NVDA/VoiceOver speech output, Safari/Firefox
foreignObject rendering and a visual/performance pass on hardware GPUs. Chromium
accessibility-tree testing is not a claim that a human screen-reader session was
performed. If another engine cannot rasterize the essential headline, the safe
fallback is already the unchanged real footer, not a degraded frozen title.
