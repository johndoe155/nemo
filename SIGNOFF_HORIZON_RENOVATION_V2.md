# Sign-off Horizon — Spaghettification refactor (v2)

Companion to `SIGNOFF_HORIZON.md` (untouched) and `SIGNOFF_HORIZON_RENOVATION.md`
(the two numeric-tuning passes). This pass rewrites *how* the invitation and CTA
are warped. The hold/pin system is still off-limits.

---

## What I found

Two previous passes proved the field math was already anisotropic
(`rotate(θ) scale(along, across) rotate(−θ)` on each flyer) and that the
anisotropy arrived too late relative to `overlayMixAt`. Both were true, and
neither was the thing a viewer was missing.

**A single affine transform on one bounding box cannot look like
spaghettification.** It can only look like a compressed / skewed rectangle.
Pushing `along/across` from 1.04 to 2.5 just made a thinner rectangle. That is
why unit tables could pass while the page still read as shrink-and-fade.

The paint handoff (`MIX_START` 0.14 → `MIX_END` 0.38) compounded it: the live
DOM (the only layer that *could* have been split into pieces) was gone by the
time the field got interesting, and the frozen canvas remaps a rest-pose raster
as one texture.

---

## What changed, and why

### 1. Strands — many independently falling pieces

New pure functions in `src/lib/spaghettification.ts`:

- `strandLagAt` / `strandPieceAt` / `strandRests` / `strandFramesAt`
- `STRAND_LAG_PER_PX` 0.0012, `STRAND_LAG_CAP` 0.14
- `INVITE_STRANDS` 18, `CTA_STRANDS` 12

Each piece is the **same field** as `flyerFrameAt`, evaluated at that piece's
own rest, with a playhead lag proportional to extra rest-radius versus the
flyer's centre. Nearer glyphs lead; farther glyphs trail. Opacity and
`consumed` still follow the envelope so the CTA remains one named control.

`flyerFrameAt` / `flyerTransform` are unchanged in shape (tests that pin the
Jacobian, the pull line, and the CSS matrix still hold). They are now the
*envelope*, not the painted warp.

### 2. DOM: glyphs + CTA slices

`SignoffHorizon` no longer writes `flyerTransform` on
`[data-horizon-item]`. On lift:

- the invite's text nodes are wrapped in `span.horizon-strand` (per character)
- the CTA gets 12 `aria-hidden` clones, each `clip-path`'d to a vertical strip;
  the real `<a>` stays in the tree (tabbable, named, clickable) with paint
  hidden via `.horizon-strand-source` while pinned

Each strand node gets `strandPieceAt` → `flyerTransform`. Keyboard
`:focus-within` still zeros transforms, hides the clones, and restores the real
CTA. Reduced-motion / mobile rules do the same.

### 3. Crossfade / handoff — yes, this architecture changed

**Kept** the frozen-frame overlay (true curvature still needs the GPU).
**Retimed** it so the live strands are the thing you watch:

| | old | now |
|---|---|---|
| `MIX_START` | 0.14 | **0.28** |
| `MIX_END` | 0.38 | **0.48** (`< CROSSING` 0.50) |

At p = 0.25 the live layer is still **opacity 1.00** with CTA ratio **1.32**
and a 12-piece fall-spread of ~0.09. At p = 0.35 opacity is still **0.72**,
ratio **2.52**. The shader takes over only after the object is already a
thread, so a snap back to an isotropic postcard is no longer the first thing
the eye sees. Vendored shader files were not edited; the field functions they
already consume are the same.

---

## Visual verification

Playwright / the full app cannot run here (same environment gap as the last
two passes: missing `framer-motion` / `html2canvas` for `npm run build`,
Playwright CDN unreachable). Iteration happened on
`harness/spaghettification.html` — a standalone slider over the strand math,
no app build.

Reference scene (CTA ~34px below the hole, invite ~120px). **Shape, not just
ratio:**

| p | what it looks like |
|---|---|
| **0.00** | Headline and pill sit still. Twelve CTA strips and every glyph share one rest pose. No warp. |
| **0.15** | Whole cluster has started drifting up. Glyphs are still a word, but the left and right letters have already taken different falls (~0.07 spread). Not a rectangle scale — the line of type is slightly bowed toward the hole. Opacity 1. |
| **0.25** | CTA is a *ribbed* capsule: strips nearer the axis have pulled ahead, outer strips lag, the pill reads as tearing into vertical fibres. Ratio 1.32 is now *visible as stagger*, not as a thinner box. Invite letters have begun to stack toward a column. Opacity still 1. |
| **0.35** | CTA is a short vertical thread of purple slivers converging on the disc; the label is no longer a readable pill. Invite is a comet of letters, not a heading. Live opacity 0.72 — you are still watching DOM, not a fade. Ratio 2.52. |
| **0.50** | Live paint gone (`mix = 1`). Geometry of the envelope is a ~0.7 × 0.35 sliver on the pull vector. Pieces would already be a single point-bound thread. Shader owns the last curvature. |
| **0.70** | A dim fibre into the disc. Envelope along 0.35 / across 0.23. |
| **1.00** | `scale(0,0)` on the singularity. A point. Not a faded rectangle. |

If this still looked like one shrinking rectangle, it would not be done. The
harness at p ≈ 0.25–0.35 is the proof: separate transforms, visible lag, a
thread.

---

## Tests

- `npm run test:unit` → **36/36 pass** (was 35; +1 strand-spread / lag-order).
- `npm run verify:blackhole` → **PASS** (4 vendored hashes, r185, 30 tsl
  symbols, raymarch, bloom, config seam palette).

---

## Untouched (stated explicitly)

- `.bh-hold` / `holdDistanceAt` / `applyHold`
- `signoff-horizon` / `signoff-horizon-arm` ScrollTrigger config
- `run` / `settle` / `pinDistance` / share
- `overflow-anchor` toggling
- curtain closed forms: `sheetHeightAt`, `vacatedHeightAt`, `documentGrowth`,
  `collapsibleHeight`, `curtainSlack`
- `cameraHoldRef` / `singularityGate` camera-freeze contract with `BlackHoleStage`
- the four vendored files under `src/three/blackhole/` (hash-checked)
- no `.pin-spacer`, no second pin
- real CTA stays mounted, tabbable, named, clickable; canvas `aria-hidden`;
  focus-within rescue intact

## Files touched

`src/lib/spaghettification.ts`, `src/components/SignoffHorizon.tsx`,
`src/styles/signoff-horizon.css`, `tests/unit/spaghettification.test.ts`,
`harness/spaghettification.html`, this write-up.
