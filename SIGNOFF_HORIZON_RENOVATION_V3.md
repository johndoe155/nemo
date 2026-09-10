# Sign-off Horizon — the lens, finally non-linear (v3)

Companion to `SIGNOFF_HORIZON.md` (v1, untouched), `SIGNOFF_HORIZON_RENOVATION.md`
(the two numeric-tuning passes) and `SIGNOFF_HORIZON_RENOVATION_V2.md` (the strand
attempt). This pass deletes the affine warp outright and rebuilds the live paint as
a displacement field. The hold/pin system is still off-limits.

---

## What was actually wrong

V2's diagnosis was half right and its cure was out of spec.

- **A single 2D transform per flyer can only translate, rotate, scale and shear.**
  That family of maps is *linear in position*: it moves every point of the
  headline along parallel lines, so a horizontal baseline can only slant, never
  bow. Growing `along/across` made a thinner skewed parallelogram, not a strand.
  The reliable symptom — "the word still reads as a rigid, flat skew" — could not
  have been fixed by any constants.
- **V2's own replacement violated the design brief.** Splitting the word into
  glyphs/CTA strips and giving each piece its own transform destroys the one thing
  that was demanded: the word, its global gradient and the CTA warped as **one
  continuous object** — no letter separation, no shattering, no per-letter
  rotation. (The strand machinery was subsequently disconnected from paint; it
  remains in the lib, dormant.)
- **The static displacement map was linear in effect.** A base shape baked once,
  whose only playhead response was a scale ramp `g(p) = fall·72 + tidal·28` plus a
  per-cell jitter, bows the raster the same amount per pixel of playhead — a
  uniform bow, not lensing. True dilation is a *power law in the radius*: points
  near the event horizon stretch exponentially harder than points far from it.
  That cannot be faked by re-scaling one map.

## What the spec demanded (and now gets)

1. **Stretch the raster itself** — severe, aggressive mesh distortion that thins
   and strands the letterforms toward the singularity.
2. **Exponential axial differential** — the side of each glyph nearer the horizon
   stretches exponentially more than the far side.
3. **Concentric arching** — the baseline bows toward the hole, concentric with the
   accretion disk's radial shape; no sideways slant.
4. **One continuous object** — word + gradient + CTA warp as a single unbroken
   raster.

## The fix — a real field, in the DOM's own medium

### The math: `lensFieldAt` → `lensSourceAt` (in `src/lib/spaghettification.ts`)

One pure function now owns the live warp, built from exactly the primitives the
vendored black-hole shader integrates (`shaderInfallAt`, `tidalGainAt`, `swirlAt`,
`horizonRadiusAtProgress` — so live paint and the frozen GPU frame can never
drift apart):

```
c(p)      = contractionAt(p) = e^(−infall·(1−p)^ease)     (max 1; the lift)
g(p,r)    = tidal(r, R, p)   = gain·(R/(R + (c·r − R)+))^TIDAL_FALLOFF − gain
source(v) = S + rotate(c·u, swirl·angle(u)) · (1 + infall + g(p,r))
```

- **Radial** ⇒ requirement 1+3. Under a radial pull, the middle of a horizontal
  baseline is closer to the singularity than its ends, so it falls harder: the
  image of a straight line is a curve concentric with the disk. No skew can do
  that; the field does it for free.
- **Power-law tide** ⇒ requirement 2. `g` rises like `(R/Δ)^1.35` as the near
  edge approaches the horizon, so the top of the headline stretches **0.63 of its
  radius while its bottom stretches 0.46** (a 37% differential) by p = 0.35.
- **Homeomorphism** ⇒ requirement 4. `infall > 0` for every p > 0 means the
  radial map is strictly increasing: the field inverts cleanly on the whole
  sheet, so no fold, no tearing, no inversion — the word stays one continuous
  image of itself, forever.
- **Self-erasing consumption.** The displacement is applied as a *source map*:
  pixels the field has already swallowed source outside the flyer's element box,
  and feImage samples nothing there — transparent. The pinch-off is the field's
  own, not a mask, not a scale-to-zero.

Supporting new lib surface: `lensForwardAt` (rest → image marching, for hulls
and the region), `lensRegionAt` (the content's tracked clamp — see below),
`computeLensMap` (bakes the inverse map into an n² grid, content-range
normalised, void cells direction-preserving), `LENS_MAP_SIZE` 160.

### The DOM: `src/lib/signoffLens.ts` — two living SVG filters

Per flyer, one permanently mounted `feImage → feDisplacementMap` filter
(`#horizon-lens-invite`, `#horizon-lens-cta`), and a 2D canvas whose 160×160
ImageData is re-encoded from `computeLensMap` **every playhead step**
(`LENS_BAKE_STEP` = 0.004 of the playhead; finer than any visible step at the
map's own resolution). The encoder writes `round(128 + 127·d/range)` per channel
and the filter's `scale` is set to `2·range`, so the full 8-bit budget is spent
on the content cells — sub-pixel bias throughout. At p = 0 the range is 0, the
map is the neutral plane, the filter is never even attached (`filter: ''`), and
the transform is never touched: rest paint is byte-identical to an un-lensed
page.

**The linear skew is gone by construction.** `SignoffHorizon.applyFrame` writes
`el.style.transform = ''` at every playhead, with the reason written above the
assignment. The layout box is the rest box at every p; `offsetLeft/Top/Width/
Height` cannot move. `flyerFrameAt` survives only for two scalar envelope facts
(paint exchange, `consumed` pointer-events) — it owns no paint.

### Region tracking: the clamp follows the swallow (`lensRegionAt`)

The filter region is not a fixed slab over the rest position (the old bug's
last refuge — a fixed region leaves most of the map sampling dead space, and a
"collapse" that painted nothing at the end). Each playhead it is the **forward
hull of the rest box's perimeter** (sampled nx × ny, padded `LENS_PAD_PX` = 10px,
height-clamped against the event-horizon hem, `LENS_MIN_REGION_PX` = 4px
degenerate allowed): it rises with the fall, narrows as the funnel narrows, and
collapses onto the singularity as the last pixel is swallowed. Because the field
is a homeomorphism the perimeter hull provably bounds the image — no interior
point can escape it.

A containment test (`lensForwardAt`-vs-region, forward-image ⊆ region pad) pins
this analytically per fly-bookkeeping tier; the harness draws the region as a
dashed overlay so it can be *watched* riding the fall.

### The crossfade is unchanged (MIX_START 0.14 → MIX_END 0.38)

The live lens hands the paint to the frozen GPU frame at exactly the kept
moments (`overlayMixAt`), and the lens is *stood down* (`scale = 0`,
`silenceFlyerLenses`) once the frozen frame owns the paint — no double baking,
no invisible raster churn. In the unarmed fallback (capture gate off) the live
raster carries the lens to the horizon itself.

## Tuning that came with it

| Knob | v2 value | v3 value | Why |
|---|---|---|---|
| `SWIRL_TURNS` | 0.49 | **0.2** | Frame dragging is a *linear* term in the baseline's decomposition (an odd function: lists the word). It must stay subordinate to the quadratic arch through the whole live window or the design reads as a slant. Measured against the arch (700px fixture baseline): 1.1 vs 2.9px @ p 0.2; 9.8 vs 13.9 @ 0.3; 23.5 vs 36.6 @ 0.35 — arch leads throughout. |
| `BITE_WIDTH` | 0.11 | **0.07** | The two bites (centres 0.25 / 0.41) had merged into one hump; the brief needs a trough. |

The arch law itself — the quadratic coefficient of the mapped baseline, measured
on the fixture's 700px invite: **+0.03px @ p 0.05, 2.86 @ 0.2, 13.94 @ 0.3,
36.63 @ 0.35**. Anisotropy (along-pull stretch ÷ across-pull stretch at the
invite centre): **1.30 @ p 0.30, 1.59 @ 0.35, 1.87 @ 0.38**.

## Tests (`npm run test:unit` → 43/43)

- **Rest / identity** — the lens at p ≡ 0 is numerically exact: zero range, zero
  scale, every map cell the neutral plane; the rest pose needs *no* filter.
- **Exponential tide** — near/far stretch differential ≥ 1.3× @ p 0.30, ≥ 1.5×
  @ 0.35 (measured 1.30 → 1.59); top tide 0.63 vs bottom 0.46.
- **Concentric arch** — quadratic term of the mapped baseline: ≥ 0.1/1.8/8/22px
  at p = 0.1/0.2/0.3/0.35, and **greater than the linear (drag-list) term** at
  every live playhead.
- **Funnel** — ≥ 80% of off-axis content cells fall toward the pull axis
  (measured ≈ 92%).
- **Region** — forward-image containment, collapse-to-singularity, pad ≥ 10;
  void cells direction-preserving; the two consumption bites land at the derived
  fly-book crossings (invite ≈ 0.60, CTA ≈ 0.64), not at hardcoded constants.
- Everything orthogonal to the warp from the previous passes (hold/collapse/
  playhead/curtain/Jacobian-vs-shader probes) still passes unchanged.

### Playwright

`tests/signoff-horizon.spec.ts` was rewritten in the same spirit: the old
"differentiated eigenmatrix ≈ symmetric affine" contract is replaced by the
v3 contract, asserted on the live DOM — transform matrix is `[1,0,0,1,0,0]` at
*every* playhead, offset-box frozen, `filter` is `url(#horizon-lens-…)` with a
re-baked PNG, scale > 0 and region bounding-box tracking the consumption.

**Not run here** (same sandbox gap the last three passes recorded: no Chromium
download, no system browser, `framer-motion`/`html2canvas` absent from the
default npm install, so neither the app build nor Playwright can execute). The
unit suite pins the field analytically, and the dev-server smoke confirms the
module graph compiles and serves the fixture, both gates, and the harness
(`/harness/spaghettification.html` → 200; its TS module and both lib modules
transform cleanly). First live run should sanity-check three things: the arch
direction (mid-baseline rises toward the hole), the region/track alignment at
p ≈ 0.25–0.35, and that no feImage URL 404s. The harness below is the visual
proxy.

## The harness (`harness/spaghettification.html`)

No longer a stale doodle: it is served by `npm run dev` (vite transforms it) and
**imports the production field itself** — `lensFieldAt`, `computeLensMap` via
`paintFlyerLens`, `lensRegionAt`, `mountFlyerLenses` — wired exactly the way
`SignoffHorizon.tsx` wires the invite flyer (same `FLYER_LENS_ID`, sheet-local
raster, sheet-local singularity, per-playhead bake). A slider is the playhead;
it is the *unarmed* path, so the live raster is watchable all the way to the
horizon, and the dashed overlay is the tracked filter region. The invariants
panel states the four design laws so a reviewer can check them against the
picture.

## Untouched (stated explicitly)

- `.bh-hold` / `holdDistanceAt` / `applyHold`
- `signoff-horizon` / `signoff-horizon-arm` ScrollTrigger config
- `run` / `settle` / `pinDistance` / share
- `overflow-anchor` toggling
- curtain closed forms: `sheetHeightAt`, `vacatedHeightAt`, `documentGrowth`,
  `collapsibleHeight`, `curtainSlack`
- `MIX_START` 0.14 / `MIX_END` 0.38 / `overlayMixAt` — the shader handoff is
  unchanged; only what the live layer *is* changed
- `cameraHoldRef` / `singularityGate` camera-freeze contract with `BlackHoleStage`
- the four vendored files under `src/three/blackhole/` (hash-checked)
- no `.pin-spacer`, no second pin
- real CTA stays mounted, tabbable, named, clickable; canvas `aria-hidden`;
  focus-within rescue intact
- the dormant strand section in `spaghettification.ts` — dead per the brief
  (no per-letter decomposition), left in place per the "don't delete lib
  machinery" convention; nothing paints it.

## V3.1 — the feImage fetch pipeline (live-behavior bugfix)

The first live run of the lens produced two symptoms, and both were DOM
mechanics, not math: **random glitchy displacement under scroll, seemingly
punctuated by the block disappearing**, and a block that otherwise **sat
rigidly at its rest position, never moved toward the hole, and was left
standing when the curtain footer slid over the sheet**.

Cause: `feImage` hrefs are not style values — replacing one puts the image
through the document's **async fetch/decode pipeline**, and while that runs,
the displacement input is *transparent black*: channel 0 reads as
`scale·(0 − 0.5) = −range` on both axes, so every output pixel samples
hundreds of px into the void. V3 baked a fresh `toDataURL` PNG on essentially
every scroll frame, so the whole consumption lived inside the fetch race:
wrong displacement or nothing while scrolling, a stale near-rest map when the
pipeline won the race — hence "glitchy / disappears / never moves". (Node
simulation confirmed the field itself was meaty: baseline fall 49px at p=0.10,
range 48px → 500px over the fall, so "nothing visible" was impossible on the
math alone.)

Fix, in `src/lib/signoffLens.ts`:

- **Filmstrip.** The consumption is baked once per flyer as
  `LENS_BAKE_STEPS` = 64 stepping frames (`lensBakeStep` quantises the
  playhead, pure and unit-tested), the data URLs kept alive AND pre-decoded by
  `<img>` twins (`Image` + `decode()`), so assigning a step's URL to the
  feImage is always an image-cache hit — the async path no longer exists on
  the scrub path. A background rAF pre-baker fills the strip (~3 bakes/frame);
  a paint arriving ahead of it bakes its own step synchronously.
- **Trio, atomically.** Region (bbox units), feImage placement (element-local
  user-space px — explicit, never the spec-default subregion), scale and href
  are written together and only across a step boundary; a bake's region/scale
  are always the ones the map was computed against, and whenever the measured
  signature (raster/singularity/geometry) changes, the strip and the warm set
  are rebuilt.
- `LENS_MAP_SIZE` 160 → **128** (cells ≤ ~6px; the GPU interpolates the map),
  halving the strip's decoded memory to ~4MB.

Symptom 2 falls out of the same fix: the unarmed/retired-overlay path — where
the live raster carries the whole fall to the horizon — now actually paints
the consumption (warp → funnel → region collapse → void) instead of a stalled
near-rest map, so there is nothing left standing when the curtain arrives.
Playwright calibration corrected alongside: hash diversity across the live
window is ≥ 2 distinct baked frames (the armed fixture stops baking past
MIX_END, by design).

## V3.2 — the ping-pong (the "completely non-motile" bug's last stand)

V3.1 retired the fetch race; the block still didn't move. The remaining bug
is the other half of the same engine reality: **attribute mutation inside a
`filter` that a `will-change: filter` client already references is not a
reliable invalidation path.** Engines cache the instantiated filter chain per
client: `setAttribute` on its `feImage`/`feDisplacementMap`/region can land
without any repaint reaching the element, so the flyer keeps whatever chain
it was painted with first — a rigid, unwarped block. What no engine can cache
through is a change of the *style property value itself*.

So every flyer now mounts a **pair** of chains, `<base>-a` and `<base>-b`,
and `paintFlyerLens` ping-pongs: each filmstrip step's trio (region,
placement, scale, href — still written atomically, still warm-decoded) goes
into the **inactive** chain, and only then does the component flip
`el.style.filter = url(#<that chain>)`. Every baked step change is therefore
a CSS value change; a value change forces re-resolution; the scaler never
depends on attribute-mutation observability again. Same step in → same id
out → zero writes, so a still playhead costs nothing; a measured re-layout
rebuilds the strip *and still flips on the first repaint* (writing the
currently-referenced chain would squarely re-depend on the broken path).
New `tests/unit/signoffLens.test.ts` pins the pair, the no-op-on-same-step
rule, the flip-on-new-step rule, the strip rebuild on layout change, and the
background pre-baker filling all 65 frames per flyer.

## Files touched

`src/lib/spaghettification.ts` (lens section + retunes),
`src/lib/signoffLens.ts` (new — the filter plumbing),
`src/components/SignoffHorizon.tsx` (applyFrame: no transforms; lens wiring),
`src/styles/signoff-horizon.css` (will-change `opacity, filter`; comments),
`tests/unit/spaghettification.test.ts` (lens suite; stale skew test replaced),
`tests/signoff-horizon.spec.ts` (readScene + the affine-matrix contract replaced
by the lensing contract), `harness/spaghettification.html` (+ its new sibling
`harness/spaghettification.ts`), this write-up.
