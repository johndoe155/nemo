# THE NEMOVERSE — Hub Frontend

**One canon. Infinite versions.** A production-ready React demo of the pitch
"*The Nemoverse — A Connected Web3 Ecosystem, Anchored by The Nemoverse*"
(Prepared for: nemo · Prepared by: Skippy Rizzo · July 2026).

Built as a Vite + React 18 + TypeScript (strict) SPA with framer-motion-driven
cinematic scrolling. All integrations called for in the pitch are stubbed
behind a clearly-labeled demo layer — see `CAVEATS_AND_ASSUMPTIONS.md`.

## Quick start

```bash
npm install
npm run dev        # dev server (localhost:5173)
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build
```

## What's on the page (top → bottom)

1. **Hero** — full-viewport key art, split-line title reveal, orbiting rings,
   parallax, live countdown badge, scroll progress rail. The CTAs are "portal
   buttons": a liquid WebGL fragment shader (cursor-reactive swirl + ripples,
   click shockwave) behind the primary CTA, refractive glassmorphism for the
   secondary CTA, GSAP magnetic spring pull within a 60px threshold, kinetic
   per-character label rollovers, and mix-blend-mode typography
   (`src/components/PortalButton.tsx`, `src/styles/portal.css`).
2. **The Nemoverse** — the anchor feature. A pinned horizontal roster of
   numbered universes (U-001…U-009) driven by vertical scroll; filters by
   rarity, sorts by date/rarity; each card opens a cinematic dialog with lore,
   specs, artist credit, variant info, revenue split, and claim CTAs. The rail
   ends on the next-drop teaser with a live countdown. (Mobile: wrapping grid.)
3. **The Persona** — in-canon chat window (mock brain) with typing indicators,
   quick replies, banter threads, and guardrail disclaimers.
4. **Holder Perks** — four trait tiers (Genesis → Legendary) with escalating
   early-claim windows, discounts, SKU unlocks; mock wallet verification shows
   the "VERIFIED HOLDER" badge.
5. **POP Pulls** — interactive Proof-of-Purchase simulator: weighted rarity
   odds, holder bonus, pity on the 8th stamp, Golden Gate set bonus at 6
   distinct universes, persistent stamp card, secret-universe chase.
6. **Store** — demo Shopify catalog with holder-gated SKUs and holder pricing.
7. **Artists** — permanent public credits, tied to Nemoverse canon.
8. **Lore** — core identity, the 60/40 self-funding model, stat cards, and the
   canon timeline.
9. **The Singularity** — a live WebGPU black hole (raymarched gravitational
   lensing, blackbody accretion disk, procedural starfield/nebula, HDR bloom),
   sitting in the seam between the canon timeline's last node and the closing
   credit crawl. Bare stage, no copy: the simulation is the statement. See
   *The black hole* below.
10. **The Loop** — the pitch's "How It All Connects" as an orbital diagram
    around the Nemoverse core.

## Architecture

```
src/
  styles/global.css        # design tokens + system layer (edit tokens here)
  styles/components.css    # component rules
  lib/data.ts              # ALL content + business logic (odds, tiers, brain)
  lib/hooks.tsx            # useCountdown, useRevealText, scroll hooks
  components/ui.tsx        # shared primitives (Reveal, Marquee, WalletButton,
                           #   Countdown, Starfield, badges…)
  components/UniverseCard.tsx / UniverseDialog.tsx
  components/BlackHoleStage.tsx  # React mounting layer for the WebGPU sim
  components/BlackHoleStill.tsx  # CSS/SVG static frame (no-WebGPU fallback)
  three/blackhole/         # the simulation, vendored VERBATIM — do not edit
                           #   (see PROVENANCE.md in that folder)
  sections/                # one component per page section
  App.tsx / main.tsx
public/art/                # placeholder AI-generated canon art (replaceable)
```

**Theming:** every color, type, and motion value is a CSS custom property in
`global.css:root`. Rarity/accent colors propagate via `--c` / `--card-accent`
style tokens.

**Card system:** all cards share one material (`--elev-rest` resting
elevation + opacity-crossfaded `::before` bloom + `--noise` obsidian grain),
one radius scale (`--r-xs…--r-xl`, inner = outer − 6px), and one physics
family (`useTilt` springs: tilt/lift/press/parallax — see the spring registry
at the top of `styles/motion.css`). Two hard rules live there too: framer
owns `transform` (stylesheet motion must use the independent
`translate`/`rotate`/`scale` properties), and `gdrift`/box-shadow/filter
transitions never run on card-scale surfaces.

**Art pipeline:** `scripts/generate-art-variants.sh` (ImageMagick) emits AVIF
renditions (540/840/full) + inline 24px WebP LQIPs from the JPGs in
`public/art/` into `src/lib/art-variants.ts`; `CardImage` serves them via
`<picture>` + `sizes` with a true blur-up. Replace the placeholder art, then
re-run the script.

**Content:** swap the placeholder canon (NEMO, universes, artists, tweets,
products) in `src/lib/data.ts` — the UI renders whatever the data layer says.

**Motion:** expo-out easing everywhere; scroll-bound parallax (hero), a
420vh pinned horizontal roster (desktop/tablet), marquee tickers, sheen
sweeps, word-level reveals, film grain, and a drifting starfield canvas.
`prefers-reduced-motion` collapses all of it.

**Rod system (`styles/suspension.css`):** three sections share one piece of
structural furniture — a rod — and one vocabulary of rods, cords, grommets and
nodes. All of it inherits the existing tokens (radius scale, `--elev-*`,
`--noise`, palette, easings); nothing new is hardcoded.

| Rig | Section | Physics |
| --- | --- | --- |
| Suspension rod | 01 · roster | `components/HangingCard.tsx` — framer-motion pendulum. `useVelocity` on the rail carriage → negated, clamped inertia target → an intentionally under-damped spring (PENDULUM 34–52 / 5.6–7.1 / ~1.1). Cord length, stiffness and mass vary per index so the rail never swings in lockstep; the pivot sits on the rod, so the arc lift is geometric. Pointer-down injects a torque impulse whose sign follows the side that was poked. |
| Credit rod | 06 · credits | Masked (top/bottom fade) vertical rod; dual-segment plates alternate in from their own side and halt against it, resting at an alternating ±1.7° tilt (left = clockwise, right = counter-clockwise). Click = under-damped rotate + lift spring that rings back to the resting tilt. |
| Drilling rod | canon timeline | GSAP `ScrollTrigger` (scrubbed) scales the rod fill so its tip is pinned to the 65% viewport line — scrolling literally drives it deeper. Each node owns a trigger on that same line, so it lights up on the exact frame the rod pierces it. Cards slide in left/right via framer. |

Split authority is deliberate: framer owns `transform` on the nodes it drives,
GSAP owns the rod fill, and stylesheet-authored offsets use `translate` /
`rotate` (see the rules block at the bottom of `styles/motion.css`).

**The black hole (`src/three/blackhole/` + `components/BlackHoleStage.tsx`):**
section 09 is a real-time WebGPU simulation — raymarched Schwarzschild lensing,
a blackbody accretion disk with Keplerian differential rotation, two FBM nebula
layers, a procedural starfield and an HDR bloom chain — rendered with three's
TSL node materials (`three/webgpu` + `three/tsl`), not a classic
`WebGLRenderer`/`ShaderMaterial`.

Two hard rules, and one honest tradeoff:

*The simulation is vendored verbatim.* `blackhole.js`, `blackhole-shader.js`,
`blackhole.config.js` and `camera-animation.js` are byte-identical to
`webgpu-black-hole-config-driven.zip` at the repo root (sha256s + a re-check
command are in `src/three/blackhole/PROVENANCE.md`). `blackhole.config.js` is
upstream's single source of truth for every tunable parameter, so it is never
edited — including `camera.cinematicMode`, which ships `false`. When the
compiler needs help with those plain `.js` files, the fix goes in config
(`tsconfig.json` sets `allowJs: true` / `checkJs: false`), never in the files.

*Everything around it is glue, and the glue carries the platform concerns.*
Upstream's `main.js` is a standalone Vite entry point — it sizes off
`window.innerWidth/innerHeight`, appends its canvas to `document.body` and
never tears anything down — so `BlackHoleStage.tsx` re-writes only that
orchestration: the canvas is appended to the section's own container and sized
off that container's box via `ResizeObserver`; the loop pauses on an
`IntersectionObserver` so the raymarcher costs nothing off-screen; teardown
cancels the frame loop, disposes the bloom chain, the simulation mesh and the
renderer (`renderer.dispose()` → `backend.dispose()` destroys the WebGPU
device) and removes the canvas. The teardown is written for the async race, not
just the happy path: React StrictMode double-invokes effects, and
`Renderer.dispose()` only frees the backend once `init()` has resolved, so a
cleanup that lands mid-init is followed by a second release pass — otherwise
hot reload leaks a GPU context.

Degradation is deliberate, because this app has no built-in WebGL fallback:
`navigator.gpu` is probed *and* an adapter is requested (a browser can expose
the interface and still hand back no adapter), `renderer.init()` is wrapped in
try/catch, and any of those failing renders `BlackHoleStill` — an inline
SVG/CSS still frame drawn from the simulation's own palette, with no binary
asset added to the repo. The still doubles as the poster underneath the canvas
while it boots, so there is never a blank gap.

Policies worth knowing before you change them:

| Concern | Behaviour |
| --- | --- |
| Touch | Drag-to-orbit is **disabled outright** on coarse pointers, and `OrbitControls`' `touch-action: none` (set in `connect()`, and still scroll-blocking when `enabled` is false) is reset to `pan-y`. A thumb landing mid-page scrolls the page, never the camera. |
| Wheel | `enableZoom` is off everywhere — a mid-page section must not trap page scroll. |
| Cinematic camera | The glue starts `CameraAnimation` itself (upstream gates on `config.cinematicMode`, which is `false` and read-only), so the section has a live establishing move. `prefers-reduced-motion` vetoes it. |
| Reduced motion | No cinematic orbit, no `OrbitControls` damping, and **no animation loop at all** — one static frame, re-drawn on resize. Same contract `Ambience.tsx` gives its static path. |
| Off-screen | Loop stopped; resumed on re-entry (with an 18% root margin so the first visible frame is already warm). |

*The tradeoff:* the page now ships **two** three builds — classic `three`
(~545 kB min, the pulls canvases' `WebGLRenderer`) and `three/webgpu`
(~659 kB min, the simulation) — because the vendored files must keep importing
`three/webgpu` + `three/tsl` and the existing sections must keep working. Both
are split into parallel chunks in `vite.config.ts` (`manualChunks`) so the hero
shell still paints first. Unifying them would mean editing one side or the
other, which the vendoring rule forbids.

**The seam (`lib/scenes.ts` + `styles/blackhole.css`):** the canvas paints its
own opaque sky, so the join with the page is the actual visual problem. It is
solved with the existing scene system, not a parallel one: a new `singularity`
district plus a retuned `abyss` (the district both neighbours — lore above,
connect below — already share) ease the ambience toward the simulation's own
palette, nebula navy `#071f44`/`#010615` with an ember `#7f1b00` hint at the
seam. Those hexes live once, as `--bh-*` tokens in `global.css`, and are
mirrored in `overhaul.css` for the no-WebGL ambience path. Locally, the stage
masks its top and bottom 9% to transparent and `.bh-frame` lays navy above the
canvas / ember below it, so the two backgrounds meet as continuous sky instead
of a hard rectangle.

## Production wiring (what the demo stubs)

| Surface | Stub | Replace with |
| --- | --- | --- |
| Wallet | `useMockWallet()` | RainbowKit / WalletConnect |
| Holder check | simulated | Alchemy / Moralis ownership call |
| Store | 3 demo SKUs | Shopify Storefront/Admin API |
| Pull mint | client-side RNG | Shopify webhook → mint on Base/Polygon |
| X feed | styled mock tweets | X embed / API |
| Persona | regex intent brain | Claude API + persona system prompt |

Full honesty pass: `CAVEATS_AND_ASSUMPTIONS.md`.
