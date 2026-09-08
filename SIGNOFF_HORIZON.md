# Closing sign-off → event horizon

## What this is (and is not)

A **pinned consumption scene**: the black hole holds the screen while the
sign-off is spaghettified into it, and a **single frozen raster** of the two
sign-off bodies — the invitation and the CTA — carries the plunge, warped by a
small two-stage WebGL2 shader. It is not live DOM-to-GPU streaming, not 3D
reprojection, and it does not follow the cinematic camera in the black-hole
stage — which, for as long as the hold lasts, is held still instead (see
*Ownership and gates*).

The singularity is not an artistic guess any more. Because the black hole's frame
is itself pinned for the whole sequence, its centre is a **fixed point on screen**
— and because the composition is *solved* rather than hoped for (see below), that
point is the parked container's centre, `frameHeight / 2` down the viewport when
the budget binds, i.e. with the container's top edge flush with the top of the
screen. Because the sign-off sheet is pinned too, that point is also a fixed point
*in the sheet's own coordinate space*. It lands **above** the pinned sheet's top
edge (`anchorY < 0`, ≈ −354px at 1280×900), because the reference framing parks
the sheet's hem below the fold: the fall is upward, out of the sheet and into the
hole, and the overlay's veil is the headroom that buys. `anchorX`/`anchorY` are
that point measured, not derived from a seam edge. The stage's own cinematic
camera is held for as long as the frame is pinned, so the point is fixed in every
sense, not just in box terms.

The shader runs two stages, in the order light would meet them:

1. **The tidal remap.** A fragment at radius `r` from the singularity does not
   sample the snapshot at `r`: it samples the source it fell in from,
   `r · (1 + infall(p) + tidal(r))`, rotated by the frame dragging. `infall` is
   the global pull, written as the reciprocal of a **contraction that is exactly
   1 at `p = 0` and exactly 0 at `p = 1`** — the fragment ends at the
   singularity, with no pole to divide by and no residual 8% of its rest size.
   `infallAt` is therefore `Infinity` at exactly `p = 1`, which is honest for a
   CPU-side number nobody divides by; the GPU is handed `shaderInfallAt`, the
   same value floored at `MAX_GL_INFALL`, so no driver ever multiplies `0 × inf`
   at the anchor fragment (and at `p = 1` the capture radius has swallowed every
   texel anyway). `tidal` is the gradient of the pull, which falls off with
   radius, so its derivative is *negative* — the radial axis magnifies while the
   tangential one squeezes. That minus sign is the spaghettification.
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
shader glue *and* evaluated per element for the live flyers. For the whole hold
both bodies are lifted **out of document flow** — absolutely positioned at the
exact boxes they already occupied, resolved against `.signoff__anchor` (their
offset parent), with the anchor's own height written back — so the fall is a
transform on a box the layout can no longer move. They are then translated *onto*
the singularity's coordinates, stretched along the pull axis by the remap's radial
magnification `1/f′(r)`, squeezed across it by its tangential magnification
`r/f(r)`, and rotated by the same frame dragging. At `p = 1` the translation is
exactly the pull vector and **both scales are exactly zero**: the DOM crosses the
event horizon instead of being faded out. So when the live paint is exchanged for
the frozen frame part-way through the fall, nothing jumps — and when there is no
frozen frame to exchange with (the capture failed, the context was lost, the
overlay could not be created) the geometry consumes the elements on its own: the
alpha is written **only** while the overlay is attached and drawing.
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
still below the fold. Both halves of that sentence are containment conditions on
ONE scroll position:

```
frameTop ≥ 0                        the whole container is inside the top of the viewport
frameHeight + rise + air ≤ viewport
inviteBottom = viewport − air       the whole headline is inside the bottom of it
```

`rise` (frame bottom → headline bottom) does not depend on the container's height,
so the container's height is the composition's one free variable, and
`solveFraming` spends it. It returns the trigger line (`inset` — the headline's
inset above the fold, rounded once, because both pins are driven off that one
number) *and* the height that makes both conditions true
(`frameHeight = floor(min(natural, viewport − inset − rise))`). The stage
publishes it as `--bh-frame-fit`, which `blackhole.css` caps its own
`clamp(500px, 76svh, 860px)` with, so the budget is a ceiling and never a target:
a container already smaller than the budget is left alone and nothing is
published. With the fit applied, `parkedFrameTop` is exactly 0 when the budget
binds — the hole flush with the top of the screen, the headline flush with the
bottom, on the pixel the hold begins on. At 1280×900 that is a 684px container cut
to 531px.

Specifying the trigger on the headline alone, as an earlier version did,
guarantees only the second condition: at the reference framing's own numbers it
reported "holds" while the container's crown sat 153px above the top of the
screen. That is not the reference composition, it is a crop of it. `framingHolds`
therefore takes the container's height as well, and after `solveFraming` it is
true by construction rather than up to half a pixel of rounding.

| trigger | trigger element | pins | start | distance |
| --- | --- | --- | --- | --- |
| `signoff-horizon-hole` | the headline, `[data-horizon-item="invite"]` | `.bh-frame` | `bottom bottom-={inset}` | `pinDistance = run + settle` |
| `signoff-horizon` | the same headline | `.footer.signoff` (`pinType: 'fixed'`) | the same line, minus the hole's reservation | the same `pinDistance` |
| `signoff-horizon-arm` | `.bh-frame` | — | `bottom bottom+={seam × 4}` | one-shot capture |

`inset` is `titleAir` — 5.5% of the viewport, clamped to 24–42px, and 42px is the
invitation's own `2.6rem` top margin, which is what keeps the button off-screen at
the trigger — in the framing that fits. In the degraded one it is `seam − rise`,
negative: the same screen line, stated on the headline before the headline has
arrived. Both pins engage on that one pixel and let go on one pixel together, so
the viewport is completely static for the whole consumption: the hole does not
drift, the sheet does not climb, and the only thing that moves is the warp. The
singularity the invitation falls into is the parked container's centre, *above*
the pinned sheet — the pull is upward, out of the sheet and into the hole, and the
overlay's veil is the headroom that buys.

### The span: run + settle

The consumption needs a run to read as a fall rather than a cut —
`run = max(300, round(sheetHeight × 1.15))`, i.e. 440px on the 383px reference
sheet — and the pins need a **release margin** after it:
`settle = max(120, round(90 × 1.5)) = 135px`. Both pins span
`pinDistance = run + settle` (575px at 1280×900), so the consumption completes at
`share = run / pinDistance ≈ 0.765` of the trigger's own progress and the screen
stays locked for 135px afterwards. "Unpin only after the text and the button are
entirely gone" is then a property of the geometry rather than of the reader's
hand: `settle` is longer than the playhead's smoothing distance, and the target's
own increment (`1/run`) is always slower than the follower's step (`1/90`), so the
playhead cannot still be in flight when either pin lets go.

### The playhead is a scroll-domain quantity

An earlier version scrubbed the consumption with `scrub: 0.6`: a **tween in time**
toward the scroll's progress. That is the wrong clock for a pin that must not let
go before the timeline finishes, because a ScrollTrigger releases its pin on a
*scroll pixel* while a scrub tween needs up to 600ms of wall clock to arrive. On
any fast arrival — a fling, a scrollbar drag, a PageDown — the pins therefore let
go with the consumption still in flight, and the last of the fall played out on a
released layout that was already scrolling away.

The playhead is now `consumptionTarget(trigger.progress, share)`, rate-limited by
`followPlayhead(current, target, scrollDelta)`: smoothing expressed in *scrolled
pixels* (`PLAYHEAD_SMOOTH_PX = 90`) and exact at both ends. A jump further than
the smoothing distance lands on the target in one step, which is what makes a
programmatic scroll deterministic instead of animated. A short time-domain tail
(`PLAYHEAD_SMOOTH_FRAME = 1/12` per frame, rate-limited so it lands exactly and
then stops) finishes the job when the reader *stops* with a residual left —
scrolling back up out of the hold, in particular, where there is no settle margin
to converge in. Two consequences worth keeping: the scene is deterministic (the
same scroll position always paints the same frame, which is what makes it
testable), and nothing continues to move after the scroll stops, so no state can
be left half-applied when a pin lets go.

The sheet's trigger still declares `scrub: true`, for one mechanical reason and
nothing more: GSAP classifies a trigger with no animation and no `scrub` as a
toggle (`isToggle = !scrub && scrub !== 0`) and never calls its `onUpdate`. With
`scrub` set and no animation attached it creates no scrub tween either — so the
flag is simply what makes the trigger report every scroll frame.

**Why the sheet's start is offset.** `pinSpacing` reserves the hole's whole pin
distance in the document above the sheet. That is what makes the hole's release
seamless — GSAP pushes the released frame down into its own reservation by
exactly the pin distance, so its flow position at the release is the position it
was parked at — but it also means that by the time GSAP measures the sheet's
trigger, every box below the hole (the headline included) already sits
`pinDistance` px lower. Asking for the reference line plainly would land the
sheet's pin one whole pin distance late: the hole would let go at the exact
moment the sheet took hold, and the reader would watch it drift for the entire
fall. `sheetStartOffset` subtracts the reservation and puts both pins back on the
one line they share. Two pins on two independently measured lines is not a
continuous hold; it is a gap with extra steps.

**Measuring across a pin.** `rise` crosses from the container's box to the
sheet's, and the container's box is not where the document left it once GSAP has
parked it — nor once GSAP has compensated the release with a translate.
`flowBottom` reads the **pin-spacer's** bottom edge instead, which is the one
boundary that means the same thing in all three states (rest, parked, released):
everything below it is at its true document offset. Reading the frame's own rect —
or reading the release compensation off `getComputedStyle().top`, which is where
GSAP does not put it — understates `rise` by a whole pin distance after the fall,
and a `rise` below `MIN_RISE` fails the measurement, which tore the scene down on
the first resize after it completed. `rise` is only read while the *sheet* is not
parked (the container being parked is fine: the spacer never moves); while it is,
the previous scene's `rise` is carried over, because nothing it depends on can
change while the screen is locked. The same argument covers the container's
*natural* height: GSAP writes an inline `height` and `max-height` onto a parked
pin at swap-in, so the responsive clamp is not readable from it, and
`naturalFrameHeight` (withdraw the fit, read the box, put the fit back — one task,
no intermediate paint) only ever runs unparked.

**What fits where.** Above roughly 1375px of viewport height the container's own
`clamp(500px, 76svh, 860px)` is already inside the budget, so nothing is published
and the framing is exact with air over the hole. Below that the budget binds and
the stage is cut down to it: the disc stays whole, and what the composition spends
is the mask's own top-13% fade, not the disc. Only when the invitation block alone
eats the viewport (`budget < MIN_FRAME_HEIGHT = 300`) does the scene degrade to
hole-first — the frame's bottom edge one seam above the fold, still stated on the
headline so the two pins share one line — and report it in the geometry as
`degraded`. Below `HARD_FRAME_FLOOR = 200` the container is held at that floor and
`framingHolds` says the composition did not fit instead of pretending it did. And a
scene whose container did not actually take the budget (a stylesheet that outranks
the variable, a container query, a resize that landed between the two reads) is
**refused** rather than built on: the trigger line and the singularity would both
be wrong.

`pinType: 'fixed'` is what GSAP already picks for a viewport scroller, and it is
stated on the sheet because the scene depends on it: a transform pin would make
the sheet the containing block of the overlay canvas and of both lifted flyers,
and `measurePinnedTop` reads `position: fixed` to tell a parked sheet from a
resting one. Both pins keep `pinSpacing`, `anticipatePin: 1` and
`invalidateOnRefresh`, and both re-measure with the layout at rest
(`onRefreshInit`), because the sheet's own height drives its pin-spacer and a
collapsed sheet would park the wrong distance. GSAP reverts every pin before a
refresh and re-applies them in creation order, so the hole's trigger — created
first — always measures the rest document and the sheet's trigger always measures
the reserved one. A `refreshPriority` on either would break that; neither has one.

## The curtain compensation (the layout invariant)

Consuming the sheet removes height from the layout. The gap must **not** collapse
by itself: the distance from the sheet's hem to the end of the document has to
stay put while the bodies above it are eaten, or the curtain footer lurches. The
pin-spacer is the only element that can pay for it — it owns the sheet's flow box
for as long as the pin exists — so the effect writes its box every frame, from a
closed form in `lib/spaghettification.ts`:

```
spacer.height   = sheetHeight(p) + pinDistance × rawProgress + SPACER_PAD
spacer.padding  = min(pinDistance, pinDistance × rawProgress + SPACER_PAD)
sheetHeight(p)  = restHeight − collapsible × collapseAt(p)
vacated(p)      = collapsible × collapseAt(p)        ← the curtain's rise, exactly
collapsible     = min(restHeight, curtainSlack(tail, hemInset) − MIN_RELEASE_SLACK)
curtainSlack    = tail − hemInset + SPACER_PAD
hemInset        = inset − belowTitle                 ← negative in the reference framing
```

The fourth line is requirement 4 stated as an equation: the curtain footer rises by
`vacatedHeightAt(p, collapsible)` — the height the void is vacating, at the rate
the timeline vacates it — and by nothing else. It is driven by the consumption, not
by the disappearance of the elements, and it is driven by the **playhead**, which
is the same clock the visible fall runs on.

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
  visible still follows the playhead. One clock per quantity, and the two are
  provably independent: the collapse depends on `p` alone and the parked span on
  the scroll alone, which is what an earlier version got wrong when it paid the
  spacer from the raw progress while the sheet's height followed a time-smoothed
  tween.
* **Affordable.** Paying the curtain back spends scroll. What is left at the end of
  the pin is `SPACER_PAD + tail − hemInset − consumed` — and `hemInset` is
  *negative* in the reference framing, because the hem parks below the fold, which
  is scroll the curtain gets to rise into for free. A curtain too short to pay for
  the whole fall **caps the collapse** (`collapsible`) and the sheet keeps a stub;
  a curtain that cannot pay at all refuses the effect and the real footer stays. Degrading the fall is honest. Borrowing scroll from the reader is not —
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
  It has no DOM wrapper and does not alter the stage's GPU backend selection. It
  also owns `cameraHoldRef`, the one wire between the sign-off and the stage's
  cinematic camera: `SignoffHorizon` sets it while `.bh-frame` is pinned, and
  `BlackHoleStage` skips its `camera-animation` update for as long as it is set.
  The simulation stays alive — only the 32s establishing move is frozen, so the
  singularity the invitation falls into does not drift under it. No vendored file
  is touched to do it.
- `src/components/SignoffHorizon.tsx`: owns ClosingSignoff's original `<footer>`
  root/ref, the GSAP context/matchMedia branches, both pins, the arm trigger, the
  scroll-domain playhead and its tail, the lift out of document flow, the
  per-frame layout compensation, the camera hold, async cancellation and cleanup.
  Footer's curtain relationship is unchanged.
- `src/lib/spaghettification.ts`: the field, the curves and the composition —
  `titleAir`, `solveFraming`/`framingHolds`/`parkedFrameTop`/`parkedHem`, the pin
  span (`pinSpan`, `consumptionTarget`, `followPlayhead`), contraction/infall,
  tidal gradient, frame dragging, collapse, paint crossfade, horizon growth, the
  flyer frame, and the curtain's compensation closed form. No DOM, no GSAP, no
  WebGL.
- `src/lib/signoffHorizonGeometry.ts`: one measurement pass over the scene (sheet,
  frame, flyers, curtain), in both document and viewport space. Resolves the
  actual pseudo-element height (the `--bh-seam` token is a `clamp()`, not a
  parseable pixel number) and the curtain's own height, which is the budget the
  compensation spends. Owns the pin-state-invariant reads (`flowBottom`,
  `measurePinnedTop`, `naturalFrameHeight`) and the publication of the container's
  budget (`publishFrameFit`/`clearFrameFit` → `--bh-frame-fit`).
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
in the tab order at every playhead. Only three things are ever written to them:
the field's `transform`, its `opacity` (**only** while the frozen frame is
attached and drawing — the exchange is conditional, so a reader who outruns the
capture never watches the headline fade out), and — once a flyer has crossed the
horizon — `pointer-events: none`, so no invisible link is left sitting over the
hole. While the hold lasts they also carry the lift's inline box
(`position: absolute` + `left`/`top`/`width`/`height`), which is their measured
rest box, so the lift itself paints nothing and the layout can no longer move
them.
`visibility` is deliberately *not* used: a hidden element loses its tab stop, and
losing the CTA's tab stop at the end of the fall would be a worse regression than
the stray hit target. The canvas alone is `aria-hidden` and `pointer-events:none`.

While focus is anywhere inside the invitation, CSS immediately restores the real
paint, the real focus ring and the real pointer, in place, and suppresses the
overlay — even at full consumption. The lift needs no undoing for that: the box it
writes is the flyer's rest box, so clearing the transform lands the flyer exactly
where document flow would have put it. This is an intentional keyboard rescue, not
a reset of the playhead: the scroll position, the collapse and the curtain stay
exactly where the reader left them. One consequence
of the collapsing hem is worth stating plainly: the rescue restores a flyer to its
*rest* box, and the sheet's hem clip cuts that box off once the collapse has run
past it — so late in the fall the rescue returns the paint, the ring, the pointer
and the tab stop, but not necessarily a fully visible headline. Restoring the
sheet's height to fix that would move the curtain under the reader, which is the
one thing requirement 4 forbids.
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
both pins and removes both spacers), clears the compensation it wrote onto the
sheet's spacer, drops the lifted flyers back into document flow, releases the
camera hold, withdraws `--bh-frame-fit` so the stage gets its own responsive height
back, disconnects ResizeObserver, cancels the scheduled refresh and playhead-tail
frames, restores paint, deletes the texture/shaders/program/VAO, loses the WebGL2
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

**What is verified where.** The curves, the composition and the compensation are
pure functions, so they are tested as pure functions:
`tests/unit/spaghettification.test.ts` (32 tests) runs under Node's own type
stripping (a small resolver hook in `tests/unit/` lets it import the app's
extensionless relative modules) and covers the field's monotonicity and bounds,
the identity at rest, the DOM magnifications against a numerically differentiated
copy of the shader's remap (in the unsaturated regime exactly, and as a bound
where the tidal cap binds), the transform string's composition and eigenvectors,
the crossing order, the horizon's coverage, and the curtain budget — including the
clip-window/hem identity at arbitrary playhead lag and the "never short" slack
across a grid of fling lags. It also pins the four requirements as properties:

- the solved framing **holds** across a sweep of viewports and rises
  (`parkedFrameTop ≥ 0` and the headline whole), where the headline-only predicate
  reported "holds" for a composition whose container was 153px off the top of the
  screen;
- the contraction is **exactly** 1 at `p = 0` and **exactly** 0 at `p = 1`, with no
  pole in between, `infallAt(1) === Infinity` while `shaderInfallAt` stays finite,
  and the flyer's painted area never exceeds its rest area (no bloom);
- the playhead is **exactly** 1 on every frame whose trigger progress has passed
  `share`, at fifteen constant scroll speeds from 1px/frame to a 4000px teleport
  and over a deterministic variable-speed walk — which is requirement 2's "unpin
  only after the timeline finishes", as arithmetic rather than as timing luck;
- the spacer's height falls by **exactly** `vacatedHeightAt`, at any scroll
  position, with the collapse independent of the scroll and the parked span
  independent of the playhead (requirement 4's one-clock-per-quantity).

The Playwright suite (`tests/signoff-horizon.spec.ts`, 31 tests) exercises the real
Footer/CSS under StrictMode and covers, on top of the gates and disposal paths:

- **The pin belongs to the black hole**: the hole's *container* is the pinned
  element, both pins are driven by the headline's bottom edge, and at the trigger
  the composition is the reference framing — the headline's bottom `titleAir` px
  above the fold, its top on screen, **the container's top edge on screen too**
  (`frame.top ≥ 0`, with `frame.height + rise ≤ viewport − air`), the published
  `--bh-frame-fit` equal to the box on screen, the CTA still below the fold, the
  hole above the headline with the seam gradient between them, and the playhead at
  zero. `hole.start === sheet.start` and `hole.end === sheet.end`, the hole does
  not move by one pixel while the scroll travels the whole consumption, the
  sheet's top does not move either, **both pins are still holding on the frame the
  consumption reaches 100%** (the trigger's own progress is short of 1 by the
  settle margin), both let go only past the end, and the release itself is one
  pixel of motion per pixel of scroll rather than a teleport of the pin distance.
- **The playhead**: one instant jump lands it exactly, nothing moves over 400ms
  with the scroll stopped, a fling past the whole span still ends on a complete
  fall with the layout settled rather than half-applied, and scrolling back up out
  of the hold converges on 0 and puts both bodies back in document flow.
- **The consumption**: the two bodies are lifted out of document flow for the
  whole hold — `position: absolute`, and an `offset*` layout box identical to
  their resting one at every playhead, with the anchor's height written back —
  the overlay covers the sheet plus the measured veil; the flyers' computed
  matrices equal `flyerFrameAt` (translation, eigenvalues and stretched
  eigenvector) at four playheads; at the end their centre is **on** the
  singularity and their box is a point (the written matrix is the degenerate one,
  `scale(0, 0)`, with the translation equal to the pull vector); their pointer is
  retired; the frozen frame paints nothing at progress 1 and byte-identical pixels
  on the return trip.
- **The layout invariant**: hem → document end measured at six playheads against
  the closed form imported in-page, the curtain's clip window one pad pixel below
  the hem, the sheet's height equal to `sheetHeightAt`, the spacer's growth equal
  to the pin distance minus what the sheet gave up, the scroll slack never below
  `MIN_RELEASE_SLACK`, no hem movement across the release, and a short-curtain
  variant that must cap the collapse rather than borrow scroll.
- **The same real CTA** at 0/50/100%, with both pins engaged: accessible name,
  Chromium accessibility-tree exposure (including at the horizon, where its own
  box has contracted into a point), no `aria-hidden`/`inert`/`hidden` ancestor,
  native click and Enter, Tab and Shift-Tab, the focus rescue (paint, ring,
  pointer, overlay suppressed, playhead and collapse untouched), and no stray hit
  target once consumed.
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

- **2026-09-08** (the failed sequence rewritten: solved framing, one span for both
  pins, a scroll-domain playhead, geometric consumption, the lift, and the
  curtain's closed form): **32/32 unit tests passing** (rewritten against the new
  API — 8 added, covering the solved framing's containment sweep, the exact-zero
  contraction and the floored shader term, the playhead's arrival-before-release
  property at fifteen scroll speeds plus a variable-speed walk, the anti-bloom
  area bound, the spacer's two-clock separation and the vacated-height identity),
  and `npm run verify:blackhole` passing (all four vendored hashes, the raymarch
  graph, and a simulation + cinematic-camera tick). `tsc -b` **cannot complete in
  this environment**: the installed `framer-motion` ships no `dist/` and
  `vite`'s own `dist/node/cli.js` is absent, so 44 `TS2307`/implicit-`any` errors
  remain — the same 44 the untouched tree produces, and **none of them in a file
  this change touches** (checked by re-running `tsc -b --force` on a stashed
  tree). `vite build` fails for the same reason (`ERR_MODULE_NOT_FOUND` inside
  vite itself), so the production bundle is unbuilt here rather than broken.
  The Playwright suite was rewritten for this architecture in the same pass —
  31 tests: the framing containment (`frame.top ≥ 0`) and the published
  `--bh-frame-fit`, the settle window (both pins still holding at 100%
  consumption), the playhead's determinism and its convergence on the way back up,
  the lift's layout box, the exact-zero DOM crossing, the rescue and stray-hit
  probes re-sited onto the geometry that can actually be hit-tested, and the CPU
  shader port switched to `shaderInfallAt`. It **still could not be executed
  here**: the Chromium download fails (`cdn.playwright.dev` unreachable) and no
  system browser is installed. It is unverified-by-execution; the browser-side
  claims above describe what the suite asserts, not what it has been seen to pass.

Remaining manual coverage: a first browser run of the rewritten suite, native
NVDA/VoiceOver speech output, Safari/Firefox foreignObject rendering, and a
visual/performance pass on hardware GPUs. Chromium accessibility-tree testing is
not a claim that a human screen-reader session was performed. If another engine
cannot rasterize the essential headline, the safe fallback is already the unchanged
real footer, not a degraded frozen title.
