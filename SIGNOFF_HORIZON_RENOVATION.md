# Sign-off Horizon — Cinematic Realism Upgrade (Step 0 + changes)

This renovation's own write-up. The design doc (`SIGNOFF_HORIZON.md`) is untouched; this
file carries the Step 0 reconciliation findings and the resulting changes, so the two can
be read together. The math lives in `src/lib/spaghettification.ts` (the single place the
art direction is written down); the DOM wiring lives in
`src/components/SignoffHorizon.tsx`.

---

## Step 0 — what the flyers actually get, and what the stage actually is

Step 0 was mandatory before touching anything: trace the flyer-frame function and confirm
what transform is really applied to `[data-horizon-item="invite"]` and `[data-horizon-item="cta"]`
at runtime, then establish which stage status the section resolves to. Findings:

**1. The flyer transform is anisotropic in the math, and it is what renders.**
`flyerFrameAt` (in `lib/spaghettification.ts`) returns an *anisotropic* frame, not a
shrink: `along` (scale on the pull axis) and `across` (scale off it) differ, plus a
frame-dragging `rotation`. `flyerTransform` writes
`translate3d(x, y, 0) rotate(θ) scale(along, across) rotate(−θ)`. `SignoffHorizon`'s
`applyFrame` applies exactly that string to each flyer element every painted frame —
`el.style.transform = flyerTransform(flyer)`. There is **no fallback/simplified path**:
the same `flyerTransform` drives both the live glyphs and (via the shader's equivalent
field) the frozen frame. The earlier "shrink-and-fade" report was therefore a *math
reading* problem, not a rendering crash.

**2. The root cause was timing, not math.** `MIX_END` is fixed at 0.38 and the live
flyer's `opacity` (the paint exchange with the frozen frame) reaches `0` there. With the
old **quartic** horizon growth (`p⁴`), the horizon stayed small through the first half of
the fall, so the flyers — which sit only ~34px and ~120px from the singularity — spent that
whole still-opaque phase far outside the tidal gradient and contracted nearly
isotropically (ratio ≈ 1.0). The anisotropic stretch happened *after* the paint had
faded, so a reader only ever saw a smaller box. (Confirmed numerically: ratio stayed
≈1.0 across the entire painted window under quartic growth.)

**3. The stage resolves to `live`, and that is the correct branch.** `Singularity.tsx`
returns null on mobile (sync matchMedia, plus a CSS `display:none` backstop).
`BlackHoleStage` has **no** `navigator.gpu` gate — `renderer.init()` resolves on the
WebGL2 fallback, so `data-backend="webgl2"` still means a live, animating stage, status
`live`, reaching `canWarpSignoff = canHoldSignoff && status === 'live'`. Only a browser
with *both* WebGPU and WebGL2 unavailable lands in `unsupported` / `error`, which falls
back to the still. So on any GPU-capable browser the warp branch (and the anisotropic
field) is the real path.

**Conclusion:** the field math *is* wired to the visible flyers; it was just too subtle
under quartic growth. Per the task, this is treated as **tuning (Objective 2)** — no
parallel animation system, no changes to the documented hold or vendored files.

---

## Objective 2 — spaghettify, not shrink-and-fade (tuning)

- **Horizon growth quartic → cubic.** New `HORIZON_GROWTH_EXPONENT = 3` in
  `horizonRadiusAtProgress` (`Math.pow(p, HORIZON_GROWTH_EXPONENT)`). The horizon crosses
  the same distance but arrives at the flyers ~half a playhead earlier, so the tidal
  gradient bites while they are still opaque. Still consumes every texel at `p = 1`.
- **TIDAL_GAIN** 0.9 → 1.4, **SWIRL_TURNS** 0.42 → 0.47 (still < 0.5, type stays
  readable), **MIX_START** 0.04 → 0.12 (live paint holds its own longer),
  **CROSSING** 0.98 → 0.70 (hit target stays alive until genuinely inside the horizon,
  so the geometry-only path still retires flyers in distance order, after the handoff).
  `MIX_END` (0.38), `TIDAL_FALLOFF` (1.6) and the hold/curtain closed forms unchanged.

Measured on the actual reference scene (viewport 900×1280, restHeight 383, SINGULARITY
{640,265.5}, FLYERS invite {640,145} / cta {640,300}), the anisotropy now lands inside
the painted window:

| p | CTA opacity | CTA along / across | CTA ratio |
|---|---|---|---|
| 0.20 | 0.77 | 0.871 / 0.841 | 1.04 |
| 0.25 | 0.50 | 0.838 / 0.766 | 1.09 |
| 0.30 | 0.23 | 0.824 / 0.664 | 1.24 |
| 0.35 | 0.04 | 0.869 / 0.528 | 1.65 |

CTA `along` also exceeds 1 (≈1.02 at p≈0.40) — a real stretch along the pull axis, not
just a smaller box. Invite ratio reaches ≈2.00 at p=0.50. End state at `p = 1` is a true
point: `scale(0,0)` positioned exactly on the pull vector, never an opacity fade at
non-zero size.

## Objective 1 — the hole reacts to what it eats

- New pure curves of `p` in `lib/spaghettification.ts`: `consumptionResponseAt(p)` and
  `bitePulseAt(...)`, plus constants `BITE_CENTRES` [0.39, 0.53] (measured crossing
  moments: CTA first, then invite), `BITE_WIDTH` 0.11, and `MASS_BITE` 0.2 /
  `LENSING_BITE` 0.14 / `DOPPLER_BITE` 0.22 / `ROTATION_BITE` 0.28.
- Excurions are relative offsets from `flatSimulationConfig`, exactly `0` at `p = 0` and
  `p = 1`, small and eased in/out, two distinct bites. They feed the vendored
  `BlackHoleSimulation.updateUniforms(config)` public API **from outside** the vendored
  files (same pattern as `cameraHoldRef`): a `consumptionRef` is added to
  `singularityGate`, written by `SignoffHorizon` on the hold edge and per-frame with the
  playhead, and read by `BlackHoleStage`'s render loop. Applied only while the hold is
  engaged and the stage is `live`; every other state leaves the sim at the static config,
  and release restores the baseline exactly once.

Baseline → peak (then back): mass 0.4 → 0.48, lensing 2.4 → 2.736, Doppler 1.0 → 1.22,
disk rotation −8.7 → −11.14. All return to baseline by `p = 0.64`, well before release.

---

## Verification

- `npm run test:unit` → **35/35 pass** (was 32; +3 for the consumption-response curves).
- `npm run verify:blackhole` → **PASS** (4 vendored hashes, r185, 30 tsl symbols,
  raymarch, bloom, config seam palette).
- `npm run build` → still fails **pre-existing** (`framer-motion` and `html2canvas` are
  not installed in this sandbox; ~53 TS2307 errors, none in the files this renovation
  touched). Environment gap, not a regression.
- Browser / Playwright e2e cannot run here (`cdn.playwright.dev` unreachable, ECONNRESET)
  — documented environment limitation, stated rather than silently skipped.

Files changed: `src/lib/spaghettification.ts`, `src/lib/singularityGate.tsx`,
`src/components/SignoffHorizon.tsx`, `src/components/BlackHoleStage.tsx`,
`src/sections/Singularity.tsx`, `tests/unit/spaghettification.test.ts`.
Untouched (unchanged, listed explicitly): `.bh-hold` / `holdDistanceAt` / `applyHold`,
the `signoff-horizon` / `signoff-horizon-arm` ScrollTriggers, `run` / `settle` /
`pinDistance` / share, `overflow-anchor` toggling, the curtain compensation closed forms,
`cameraHoldRef` / `singularityGate` camera-freeze contract, and the four vendored files
under `src/three/blackhole/` (hash-checked). No `.pin-spacer`, no second pin.
