# Closing sign-off → event horizon

## What this is (and is not)

A **pinned consumption scene**: the black hole holds the screen while the
sign-off is spaghettified into it, and a **single frozen raster** of the two
sign-off bodies — the invitation and the CTA — carries the plunge, warped by a
small two-stage WebGL2 shader. It is not live DOM-to-GPU streaming, not 3D
reprojection, and it does not follow the cinematic camera in the black-hole
stage.

The singularity is not an artistic guess any more. Because the black hole's frame
is itself pinned for the whole sequence, its centre is a **fixed point on screen**
(`viewport − seam − frameHeight/2`), and because the sign-off sheet is pinned too,
that point is a fixed point *in the sheet's own coordinate space* — normally
inside the sheet, a little below its top edge, since the pinned sheet slides up
over the hole's lower half. `anchorX`/`anchorY` are that point measured, not
derived from a seam edge.

The shader runs two stages, in the order light would meet them:

1. **The tidal remap.** A fragment at radius `r` from the singularity does not
   sample the snapshot at `r`: it samples the source it fell in from,
   `r · (1 + infall(p) + tidal(r))`, rotated by the frame dragging. `infall` is
   the global contraction; `tidal` is the gradient of the pull, which falls off
   with radius, so its derivative is *negative* — the radial axis magnifies while
   the tangential one squeezes. That minus sign is the spaghettification.
2. **The lensing.** The remapped source is traced through the vendored
   inverse-square deflection ODE, ported unchanged from Daniel Greenheck's
   MIT-licensed `blackhole-shader.js` with `vec2` ray state:

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
When the field is closed (`uHorizonPx == 0`) the shader takes an exact identity
path — same texels, same alpha, no resample — so arming the overlay cannot move
the type by a fraction of a pixel.

**The same field, two ways.** `lib/spaghettification.ts` is the single place the
art direction is written down: pure functions of one playhead, imported by the
shader glue *and* evaluated per element for the live flyers. The headline and the
CTA are translated toward the singularity, stretched along the pull axis by the
remap's radial magnification `1/f′(r)`, squeezed across it by its tangential
magnification `r/f(r)`, and rotated by the same frame dragging — so when the live
paint is exchanged for the frozen frame part-way through the fall, nothing jumps.
The unit suite checks that equality numerically (the DOM scales *are* the
derivative of the shader's remap), which is why a stagger was rejected: a shader
cannot stagger per element, and a stagger would show as a jump at the handoff.
Differentiation comes from geometry instead — each flyer sits at its own radius,
so the tidal gradient bites each one at its own moment, and they cross the horizon
in order of their distance from the singularity.

**Art-direction knob:** `EFFECTIVE_HORIZON_RADIUS_PX` in
`lib/spaghettification.ts`. A quartic scroll curve expands this seed radius to the
farthest measured corner of the overlay, so progress = 1 consumes every texel at
every footer size. Full consumption is horizon capture, not a final opacity fade
over an otherwise unwarped image.

## The reference framing, and the two pins

The pinned subject is **the black hole**, not the sign-off — and the moment it
takes hold is art-directed off one composition: the hole at the top of the
viewport, the whole `ENTER THE NEMOVERSE` headline at the bottom, and the CTA
still below the fold. The line that produces it is the headline's own bottom
edge, parked `titleAir` px above the bottom of the viewport (5.5% of the
viewport, clamped to 24–42px — and 42px is the invitation's own `2.6rem` top
margin, which is what keeps the button off-screen at the trigger).

Two ScrollTriggers, one screen line, one continuous hold:

| trigger | trigger element | pins | start | distance |
| --- | --- | --- | --- | --- |
| `signoff-horizon-hole` | the headline, `[data-horizon-item="invite"]` | `.bh-frame` | `bottom bottom-={titleAir}` | `sheetPinDistance` |
| `signoff-horizon` | the same headline | `.footer.signoff` (`pinType: 'fixed'`) | the same line, minus the hole's reservation | `max(300, sheetHeight × 1.15)` |
| `signoff-horizon-arm` | `.bh-frame` | — | `bottom bottom+={seam × 4}` | one-shot capture |

Both pins engage on the same scroll pixel and let go on the same one, so the
viewport is completely static for the whole consumption: the hole does not drift,
the sheet does not climb, and the only thing that moves is the warp. The
singularity the invitation falls into is the parked frame's centre, which lands
*above* the pinned sheet — the pull is upward, out of the sheet and into the
hole, and the overlay's veil is the headroom that buys.

**Why the sheet's start is offset.** `pinSpacing` reserves the hole's whole pin
distance in the document above the sheet. That is what makes the hole's release
seamless — GSAP pushes the released frame down into its own reservation by
exactly the pin distance, so its flow position at the release is the position it
was parked at — but it also means that by the time GSAP measures the sheet's
trigger, every box below the hole (the headline included) already sits
`sheetPinDistance` px lower. Asking for the reference line plainly would land the
sheet's pin one whole pin distance late: the hole would let go at the exact
moment the sheet took hold, and the reader would watch it drift for the entire
fall. `sheetStartOffset` subtracts the reservation and puts both pins back on the
one line they share. Two pins on two independently measured lines is not a
continuous hold; it is a gap with extra steps.

The same reservation is why the composition has to be measured with care: `rise`
(frame bottom → headline bottom) crosses the spacer, so `measureSignoffScene`
reads the reservation back off the spacer — minus the `top` offset GSAP gives the
frame once the pin has let go, which cancels it — and subtracts it. GSAP reverts
every pin before a refresh and re-applies them in creation order, so the hole's
trigger, created first, always measures the rest document and the sheet's trigger
always measures the reserved one. A `refreshPriority` on either would break that;
neither has one.

**What fits where.** The stage is `clamp(500px, 76svh, 860px)` and the invitation
block below it is about a third of a viewport, so the composition (frame top →
headline bottom) is taller than the viewport below roughly 1375px of height.
Above that the hole is fully in view with air over it and the framing is exact.
Below it the headline is still captured whole — that is the trigger, and it is
the half of the composition the requirement is specified on — and what gives way
is the stage's own masked crown: the top 13% of `.bh-stage` is faded to
transparent by its mask, and at 900px the crop is ~153px against a disc that
starts ~150px down the stage, so the disc reads whole and the crop lands at the
top edge of the screen, which is a frame, not a cut. Only when the invitation
block alone would eat the viewport (`rise ≥ viewport − titleAir`, i.e. the hole
would be off-screen entirely at the trigger) does the scene degrade to hole-first
— the frame's bottom one seam above the fold, still stated on the headline so the
two pins share one line — and it reports that in the geometry as `degraded`.

`pinType: 'fixed'` (not GSAP's default transform pin) because the sheet is the
containing block of the overlay canvas and of both flyers: a transform there would
reparent every absolute child, and GSAP would then have to compensate the release
with a translate on a box that is also being collapsed. Both pins keep
`pinSpacing`, `anticipatePin: 1` and `invalidateOnRefresh`, and both re-measure
with the layout at rest (`onRefreshInit`), because the sheet's own height drives
its pin-spacer and a collapsed sheet would park the wrong distance.

## The curtain compensation (the layout invariant)

Consuming the sheet removes height from the layout. The distance from the sheet's
hem to the end of the document must not change while that happens, or the curtain
footer lurches. The pin-spacer is the only element that can pay for it — it owns
the sheet's flow box for as long as the pin exists — so the effect writes its box
every frame, from a closed form in `lib/spaghettification.ts`:

```
spacer.height   = sheetHeight(p) + pinDistance × rawProgress + SPACER_PAD
spacer.padding  = min(pinDistance, pinDistance × rawProgress + SPACER_PAD)
sheetHeight(p)  = restHeight − collapsible × collapseAt(p)
collapsible     = min(restHeight, tail − seam + SPACER_PAD − MIN_RELEASE_SLACK)
```

Three properties, each of which the unit suite proves and the browser suite
measures:

* **Tracked.** The stage hangs off the spacer's bottom edge (the sheet's negative
  margin is copied onto it) and clips its paint window inset by
  `--curtain-travel`, so the bright floor meets the hem — one pixel below it — at
  every playhead. `spacer.height − (parked + sheetHeight) === SPACER_PAD` holds
  for *any* pair of playhead and scroll, which is what makes the reveal a handoff
  instead of a jump.
* **Never short.** The parked term is read from the **raw scroll**, not the
  smoothed playhead, so the document grows one pixel per scrolled pixel and a
  fling cannot arrive at a page shorter than its own scroll position. Everything
  visible still follows the scrub.
* **Affordable.** Paying the curtain back spends scroll. What is left at the end of
  the pin is `SPACER_PAD + tail − seam − consumed`, so a curtain too short to pay
  for the whole fall **caps the collapse** (`collapsible`) and the sheet keeps a
  stub; a curtain that cannot pay at all refuses the effect and the real footer
  stays. Degrading the fall is honest. Borrowing scroll from the reader is not —
  a release onto a clamped document snaps the playhead back and un-collapses the
  sheet in one frame.

While the sheet is pinned it also clips itself to its collapsing border box plus
the measured veil above it (`clip-path: inset(-var(--horizon-veil) 0 0 0)`): the
frozen frame and the live flyers keep their rest-size boxes, and without the clip
they would paint over the bright floor below the hem, since the sheet's stacking
context sits above the stage's.

## Ownership and gates

- `src/lib/singularityGate.tsx`: the original synchronous
  `matchMedia('(max-width: 768px)')` policy, now shared by Singularity and the
  sign-off. One provider also subscribes to reduced motion and receives
  **BlackHoleStage's actual status**, including failures, Retry and unmount.
  It has no DOM wrapper and does not alter the stage's GPU backend selection.
- `src/components/SignoffHorizon.tsx`: owns ClosingSignoff's original `<footer>`
  root/ref, the GSAP context/matchMedia branches, both pins, the arm trigger, the
  per-frame layout compensation, reversible scrub, async cancellation and
  cleanup. Footer's curtain relationship is unchanged.
- `src/lib/spaghettification.ts`: the field and the curves — infall, tidal
  gradient, frame dragging, collapse, paint crossfade, horizon growth, the flyer
  frame, and the curtain's compensation closed form. No DOM, no GSAP, no WebGL.
- `src/lib/signoffHorizonGeometry.ts`: one measurement pass over the scene (sheet,
  frame, flyers, curtain), in both document and viewport space. Resolves the
  actual pseudo-element height (the `--bh-seam` token is a `clamp()`, not a
  parseable pixel number) and the curtain's own height, which is the budget the
  compensation spends.
- `src/lib/captureSignoff.ts`: lazily loaded html2canvas capture, used once per
  eligible activation. No other page sections or GPU canvases are cloned.
- `src/three/eventHorizonWarp.ts`: raw WebGL2, one texture, one full-cover
  triangle, no three/WebGPURenderer, no extra WebGPU device, no render loop. It
  imports the field constants from `lib/spaghettification.ts` rather than
  restating them in GLSL defaults.
- `src/styles/signoff-horizon.css`: paint-only overlay rules, the pinned hem
  clip and the keyboard rescue. `blackhole.css` retains its documented three
  jobs: box / seam / still.

Mobile, reduced motion, and any stage status other than `live` get the ordinary
footer: no capture module load, snapshot, overlay context or scrub. The reduced
motion matchMedia branch's finished state is **plain content**, not eaten content.

## Interaction and accessibility

The real CTA and all sign-off text remain mounted, in the accessibility tree and
in the tab order at every playhead. Only two things are ever written to them: the
field's `transform`/`opacity`, and — once a flyer has crossed the horizon —
`pointer-events: none`, so no invisible link is left sitting over the hole.
`visibility` is deliberately *not* used: a hidden element loses its tab stop, and
losing the CTA's tab stop at the end of the fall would be a worse regression than
the stray hit target. The canvas alone is `aria-hidden` and `pointer-events:none`.

While focus is anywhere inside the invitation, CSS immediately restores the real
paint, the real focus ring and the real pointer, in place, and suppresses the
overlay — even at full consumption. This is an intentional keyboard rescue, not a
reset of the scrub: the playhead, the collapse and the curtain stay exactly where
the scroll put them.
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
- The credit crawl (`.signoff__crawl` / `.marquee--credits`) moved above the
  Singularity, so it is no longer part of the captured sheet: nothing inside the
  sign-off backdrop-filters the live page any more, which is what makes the
  frozen frame comparable to the live footer like-for-like. (An isolated SVG
  cannot blur the live page behind it; no live CSS is simplified to suit it.)
- The footer's background gradient stays in the real DOM rather than being
  painted twice (`backgroundColor: null`, and the clone's own background forced
  transparent). This preserves its opaque curtain hem and the existing floor
  reveal; captured texels reveal this backing, not unwarped letters. It also
  means the collapsing hem is a real edge: the sheet's own box shrinks, and the
  frozen frame contributes glyphs only.

The helper corrects html2canvas 1.4's foreignObject origin offset, checks readable
pixels in the headline, and rejects a blank/tainted result instead of hiding the
real invitation. It also re-asserts the clone's box placement (`margin`, `inset`)
and clears a transient root transform after html2canvas's computed-style copy:
captured while **pinned** (`position: fixed` mid-viewport), the resolved inset
shorthands would otherwise serialize after the top/left override — and GSAP's
pin release can leave a one-frame pin-translate on the live element — either of
which pushes the clone below the isolated SVG viewport, rasterizing nothing.
Font, capture, upload, shader or context failures restore the ordinary footer
and report the reason. No repeated automatic capture attempts.

The capture is armed four seams below the fold, well before the hole's pin, and
the sheet is held at playhead 0 for the whole of it: `captureSignoff` awaits font
embedding before html2canvas clones, and a half-collapsed box with half-warped
glyphs is not a usable frozen frame. Rendering playhead 0 rather than skipping
frames matters — the spacer keeps tracking the raw scroll, so no gap opens under
the sheet while the reader waits.

Snapshot/render resolution is capped to 1.5 million pixels and a 2048-pixel edge;
CSS dimensions and hit targets are never scaled. On a width/height reflow **after
capture**, the effect is retired for that activation and real paint returns.
This is deliberate: a frozen raster cannot reflow with the CTA. Resize does not
secretly trigger another capture. Retirement kills both pins, which reverts them
and removes both spacers, so the black hole and the footer come back as ordinary
in-flow boxes with the curtain's normal spacing. A new eligible lifecycle (e.g. a fresh desktop
stage after a mobile hop, or successful Retry) may arm a fresh one-shot capture.

## Lifecycle

Cleanup aborts pending font fetches, kills all three ScrollTriggers (which reverts
both pins and removes both spacers) and the scrub tween, clears the compensation it
wrote onto the sheet's spacer, disconnects ResizeObserver, cancels scheduled refresh
work, restores paint, deletes the texture/shaders/program/VAO, loses the WebGL2
context and removes the canvas. Every activation gets a fresh canvas, never a reused
lost context. The ResizeObserver watches the black hole's frame and the curtain
floor — the two boxes the scene is measured from — and never the sheet itself,
which would watch its own collapse and feed itself.

html2canvas has no cancellation API. A capture already underway is allowed to
settle; its invocation-specific clone iframe is removed even on failure, and a
late CPU canvas is cleared without creating or attaching a renderer. Released
guards across every await cover StrictMode's mount → cleanup → mount, status
changes, reduced-motion changes and unmount.

## Verification

```sh
npm ci
npm run build           # tsc -b + vite build
npm run verify:blackhole
npm run test:unit       # node --test, no browser: the field and the compensation
npx playwright install --with-deps chromium
npm run test:signoff-horizon
```

An existing Chromium can be supplied with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`. Browser artifacts are
ignored; no snapshots, installed browsers or generated dependencies belong in Git.

**What is verified where.** The curves and the compensation are pure functions, so
they are tested as pure functions: `tests/unit/spaghettification.test.ts` runs
under Node's own type stripping (a small resolver hook in `tests/unit/` lets it
import the app's extensionless relative modules) and covers the field's
monotonicity and bounds, the identity at rest, the DOM magnifications against a
numerically differentiated copy of the shader's remap, the transform string's
composition and eigenvectors, the crossing order, the horizon's coverage, and the
curtain budget — including the clip-window/hem identity at arbitrary scrub lag and
the "never short" slack across a grid of fling lags. No browser, no GPU, no timing
luck.

The Playwright suite (`tests/signoff-horizon.spec.ts`, 29 tests) exercises the real
Footer/CSS under StrictMode and covers, on top of the gates and disposal paths:

- **The pin belongs to the black hole**: the hole is the pinned element, both pins
  are driven by the headline's bottom edge, and at the trigger the composition is
  the reference framing — the headline's bottom `titleAir` px above the fold, its
  top on screen, the CTA still below the fold, the hole above the headline with
  the seam gradient between them, and the playhead at zero. `hole.start ===
  sheet.start` and `hole.end === sheet.end`, the hole does not move by one pixel
  while the scroll travels the whole pin distance, the sheet's top does not move
  either, both pins let go only past the end, and the release itself is one pixel
  of motion per pixel of scroll rather than a teleport of the pin distance.
- **The consumption**: the overlay covers the sheet plus the measured veil; the
  flyers' computed matrices equal `flyerFrameAt` (translation, eigenvalues and
  stretched eigenvector) at four playheads; they converge into the point and their
  pointer is retired at the end; the frozen frame paints nothing at progress 1 and
  byte-identical pixels on the return trip.
- **The layout invariant**: hem → document end measured at six playheads against
  the closed form imported in-page, the curtain's clip window one pad pixel below
  the hem, the sheet's height equal to `sheetHeightAt`, the spacer's growth equal
  to the pin distance minus what the sheet gave up, the scroll slack never below
  `MIN_RELEASE_SLACK`, no hem movement across the release, and a short-curtain
  variant that must cap the collapse rather than borrow scroll.
- **The same real CTA** at 0/50/100%: accessible name, Chromium accessibility-tree
  exposure, no `aria-hidden`/`inert`/`hidden` ancestor, native click and Enter,
  Tab and Shift-Tab, the focus rescue (paint, ring, pointer, overlay suppressed,
  playhead untouched), and no stray hit target once consumed.
- More than a thousand GPU texel checks against an independent Float64 CPU port of
  **both** stages, using the imported config and field constants, over two overlay
  boxes (flush and veiled) and six playheads, including capture and escape.
- Native-vs-unwarped snapshot comparisons at DPR 1 and 2, including the headline
  font/gradient and CTA. These allow minor AA/downsampling differences, not a
  lost headline or fallback typeface.

`verify:blackhole` checks all four vendored files against the SHA-256 hashes in
`PROVENANCE.md`. No file in `src/three/blackhole/` was edited.

### Verification history

- **2026-09-06** (pre-pinning): production build, vendored-hash verification, and
  all 23 Chromium browser tests of the then-current single-pin effect.
- **2026-09-07** (sheet-only pin): production type-check clean and all 23 Chromium
  browser tests of that architecture under software WebGL2.
- **2026-09-08** (the overhaul — black hole as the pinned subject, two-stage
  shader, curtain compensation): `tsc -b` clean, `vite build` clean,
  `verify:blackhole` passing, and **19/19 unit tests passing**. The Playwright
  suite was rewritten for the two-pin architecture in the same pass but **could not
  be executed in this environment**: Chromium cannot be downloaded here
  (`cdn.playwright.dev` is unreachable) and no system browser is installed. It is
  therefore unverified-by-execution, and the browser-side claims above describe
  what the suite asserts, not what it has been seen to pass.

- **2026-09-08** (reference framing — the hold art-directed off the screenshot
  composition, two pins on one line): `tsc -b` clean, `vite build` clean,
  `verify:blackhole` passing, and **24/24 unit tests passing** (5 added: the air
  schedule, the framing predicate, the trigger-line helper, the parked positions,
  and the reservation-aware start offset, all cross-checked against the measured
  383px sheet at 1280×900 — `hemInset −102`, `pinDistance 440`,
  `parkedTop −153`, `anchorY −430`). The curtain budget was generalised from
  "hem one seam above the fold" to a signed `hemInset` in the same pass, and the
  Playwright suite was rewritten for the new geometry (29 tests, including the
  framing assertions and the seamless-release check). It **still could not be
  executed in this environment** for the same reason as above: no Chromium can be
  downloaded here and no system browser is installed.

Remaining manual coverage: a first browser run of the rewritten suite, native
NVDA/VoiceOver speech output, Safari/Firefox foreignObject rendering, and a
visual/performance pass on hardware GPUs. Chromium accessibility-tree testing is
not a claim that a human screen-reader session was performed. If another engine
cannot rasterize the essential headline, the safe fallback is already the unchanged
real footer, not a degraded frozen title.
