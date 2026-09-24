# THE NEMOVERSE — Hub Frontend

**One canon. Infinite versions.** A production-ready React demo of the pitch
"*The Nemoverse — A Connected Web3 Ecosystem, Anchored by The Nemoverse*"
(Prepared for: nemo · Prepared by: Skippy Rizzo · July 2026).

Built as a Vite + React 18 + TypeScript (strict) SPA with framer-motion-driven
cinematic scrolling. All integrations called for in the pitch are stubbed
behind a clearly-labeled demo layer — see `CAVEATS_AND_ASSUMPTIONS.md`.

## Quick start

```bash
npm ci              # required — node_modules is only partially committed
                    #   (dist/ folders were gitignored when it was snapshotted);
                    #   `npm ci` re-extracts every package from the lockfile
npm run dev         # dev server (localhost:5173)
npm run build       # tsc -b && vite build → dist/
npm run preview     # serve the production build
npm run generate:fonts  # regenerate the 9-face subset font layer (scripts/subset-fonts.mjs)
npm run test:a11y   # axe-core WCAG gate over the whole page (desktop + mobile)
```

## What's on the page (top → bottom)

The page is **a dive** (see `IDENTITY-SPEC.md`): paper stock at the surface,
saturated reef water in the registry, mid-water at the persona, and the trench
at the finale. Scroll position is depth — `lib/scenes.ts` maps every section to
a zone and stamps `data-scene` on `<html>`, and both the WebGL ambience and the
CSS shell retint from the same palette table (`src/lib/palette.ts`).

**Seven beats** (the deck's thirteen blocks merged into seven — see
`IDENTITY-SPEC.md` §2.2):

0. **The Loader — the typographic morph** — the boot sequence that owns the
   screen for its one pass (`components/Loader.tsx`). A massive percentage
   counter counts 0 → 100 dead centre, set in the site's own PP Neue Machina
   Inktrap Ultrabold (extracted to vector outlines at build time — no webfont
   dependency at boot), and its tracking *tightens* across the climb: 0.19em
   down to 0.012em, re-centred every frame so it never drifts. The instant it
   reaches 100%, GSAP's MorphSVG snaps the numerals into the character's vector
   paths (`public/nemo.svg`, refit to a morph-safe 1,279 cubics), and the ink
   adopts the artwork in the same frame. Both morph frames are baked by
   `scripts/generate-nemo-loader.mjs` and the pairing is replayed through the
   real plugin by `scripts/verify-nemo-loader.mjs`. Under the new identity the
   loader is the site's first printed sheet: paper ground, ink type, and the
   landing as a sticker slap rather than a glow bloom.
   `prefers-reduced-motion` skips straight to the landed character.
1. **The Surface — Hero + tape ticker.** Full-viewport paper hero. The wordmark
   is stacked flash lettering: line 1 solid ink, line 2 hollow outline, line 3
   a pink sticker with an ink offset (`styles/print.css`). Live countdown badge
   and a marquee rendered as a manila tape strip. The CTAs are still "portal
   buttons" (liquid WebGL shader + magnetic spring) but re-shaded to water.
2. **The Registry — Z1 reef.** A pinned horizontal roster (the *rod/rail*), the
   wall of numbered universes (U-001…U-009) driven by vertical scroll; filters
   as stamp seals, sorts by date/tier/price; each card opens a cinematic dialog
   with lore, specs, artist credit, variant info, revenue split and claim CTAs.
   The rail ends on the next-drop teaser with a live countdown. (Mobile:
   wrapping grid.) The 3D rotunda sphere that duplicated this canon is gone.
3. **The Stamp Book — Z1 reef.** The Proof-of-Purchase simulator: weighted
   odds, holder bonus, pity on the 8th stamp, the Golden Gate set bonus at six
   distinct universes, a persistent stamp card, the secret-universe chase.
   Editions are numbered plates ("#9584") — tiers are treatments, not hues.
4. **The Persona — Z2 mid-water.** The in-canon chat (mock brain: typing
   indicators, quick replies, banter threads, guardrail disclaimers) beside the
   character's portrait as a *printed glass plate* with tape, a serial and a
   material caption. The 29.5 MB point-model stage is retired (SPEC §7); the
   plate image is a repo placeholder at `public/art/persona-glass.jpg` until the
   commissioned bust lands at the same path.
5. **Holder Economics — Z2.** Perks tiers ⊕ the storefront as one argument:
   four trait tiers with escalating early-claim windows, discounts and SKU
   unlocks; the demo Shopify catalog with holder-gated SKUs and holder pricing;
   mock wallet verification.
6. **Canon & Credits — Z2 → the descent.** Core identity, the 60/40
   self-funding model, stat cards and the canon timeline, closing on the
   permanent public credits rod (the credit plates still bob on their pin).
   The closing crawl reads as a flash-sheet wall.
7. **The Trench — Z3.** A full-viewport water vortex
   (`components/VortexStage.tsx`, dependency-free WebGL2): differential
   rotation, caustics, marine snow rising against the pull, bioluminescent
   points, and a mouth that opens as the sign-off is consumed. Bare stage, no
   copy — the vortex is the statement. The scroll mechanic around it is
   unchanged: `.bh-hold` reserves the page while the sign-off falls into the
   water (`lib/spaghettification.ts`, `components/SignoffHorizon.tsx`).

## Architecture

```
src/
  lib/palette.ts           # THE colour source of truth (tokens + zones + GPU floats)
  lib/scenes.ts            # the dive: section id → depth zone, ambience driver
  lib/scroll.ts            # THE scroll authority (Lenis + holds/locks/pageScrollTo)
  lib/fonts.ts             # critical-font gate awaited by the boot loader
  lib/spaghettification.ts # the sign-off hold/warp math (mechanic, metaphor-agnostic)
  styles/global.css        # design tokens + system layer (edit tokens here)
  styles/print.css         # the Z0 surface: flash lettering, nav, loader, cursor
  styles/water.css         # the Z2/Z3 regime: prose on water, beat furniture, tape
  styles/trench.css        # the finale seam (measured .bh-* geometry names)
  styles/components.css    # component rules
  lib/data.ts              # ALL content + business logic (odds, tiers, brain)
  lib/hooks.tsx            # useCountdown, useRevealText, scroll hooks
  lib/utils.ts             # cn() — the shadcn class-name helper
  components/ui/           # site UI primitives (Reveal, Marquee, WalletButton,
                           #   Countdown, badges, dialogs…)
  components/VortexStage.tsx   # beat 7 renderer — dependency-free WebGL2 vortex
  components/UniverseCard.tsx / UniverseDialog.tsx
  components/Loader.tsx        # the boot sequence — the typographic morph
  lib/nemoLoaderData.ts        # GENERATED — baked morph frames + type metrics
                               #   (rebuild: npm run generate:nemo-loader)
  lib/nemoMorph.ts             # runtime layout mirroring the generator's math
  sections/                # one component per beat (see the beat map above)
  App.tsx / main.tsx
public/art/                # placeholder canon art (replaceable; swap at the same path)
```

**Tailwind + shadcn/ui structure:** Tailwind v4 is installed
(`@tailwindcss/vite`) for the shadcn project structure — `components.json`
points the CLI at `@/components/ui`, `@/lib/utils`, and the style entry
`src/styles/tailwind.css`. That entry deliberately imports **theme + utilities
only, without preflight** — the site's own CSS system (below) must never be
reset — and the generated utilities are unlayered so they out-rank plain
element resets. The `@/*` path alias is configured in both `tsconfig.json`
and `vite.config.ts`. Note that Tailwind v4 tree-shakes: a utility or CSS
variable only ships when something actually uses it (e.g. the shadcn
`--background`-family tokens light up the first time a shadcn primitive that
references them is added via `npx shadcn add`).

**Fonts:** the webfont layer is GENERATED — `scripts/subset-fonts.mjs` emits
`src/assets/fonts/pp-fonts.css` and the nine subsetted faces in
`src/assets/fonts/subset/` from the Pangram Pangram originals on disk. Only
faces a full CSS audit proved reachable ship (25 → 9), each subset to the
codepoints this site paints with (Latin + arrows + geometric shapes +
dingbats), `unicode-range` mirrored, and the `ss01–ss03` stylistic sets
preserved. The originals stay in the repo (the loader's outline generator
reads them). Preload tags are deliberately NOT in `index.html` — src-CSS font
assets are content-hashed at build and the site deploys with `base: './'`, so
the boot gate replaces the preload's guarantee with a stronger one (no swap
at handoff, ever).

**Theming:** colour lives in ONE place — `src/lib/palette.ts`. `global.css:root`
mirrors those hexes as custom properties and a unit test
(`tests/unit/palette.test.ts`) fails the build if the two ever drift; the WebGL
layer reads the same table through `floats()` and `lib/scenes.ts`. Depth zones
then flip only the ramps that are safe to flip globally (hairlines, panels,
legacy accent aliases); text colour is opted into per section with
`.zone-water`. Tier/accent colours still propagate via `--c` /
`--card-accent`, and the retired rarity ramp (`--r-*`) now maps tiers to
treatments rather than hues.

**Card system:** all cards share one material — paper stock, `--noise` tooth,
a 2px ink outline, an offset print shadow (`--shadow-print-*`) and a printed
accent rule along the bottom edge — one radius scale (`--r-xs…--r-xl`), and one physics
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

**Scroll authority (`lib/scroll.ts`):** Lenis is the ONE scroller. Wheel input
is smoothed by the engine (touch stays native), its raf rides the GSAP ticker
(one rAF cadence for the whole page), ScrollTrigger updates come off
`lenis.on('scroll')`, and anchor links glide through one delegated handler.
Anything that MOVES the page (nav anchors, the footer rewind, the roster's
`goToCard`, the drag→scroll handoff) goes through `pageScrollTo`; readers keep
subscribing to native scroll events. Modal surfaces (dialog, mobile menu,
boot loader) freeze the engine through `holdScroll`/`lockPage` keys, so a
locked viewport can never bank wheel deltas into a jump on unlock — and
`scroll-behavior: smooth` is gone from `html` for good (Lenis's programmatic
scrolls resolve through it; two smoothing layers on one position = mush).
The boot loader additionally swallows scroll keys, marks `#root` inert, and
releases only after the critical font faces land (`lib/fonts.ts`, capped).

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

**The trench vortex (`src/components/VortexStage.tsx` + `styles/trench.css`):**
beat 7 is a full-viewport WebGL2 fragment shader on a single full-cover
triangle — differential (inner-faster) rotation, fbm water sheets, caustic
cresting, marine snow drifting up against the pull, bioluminescent points
pinned to the rotating field, and a mouth whose radius opens with the sign-off
consumption. It is deliberately dependency-free: the retired WebGPU raymarcher
cost a vendored-verbatim constraint, a `three/webgpu` + `three/tsl` chunk
(186 kB gz) and the dual-three-build tradeoff the old README documented. Both
are gone; the finale now costs no library at all.

The stage keeps the contracts the section always had, because they are the
parts that made the old finale work:

| Concern | Behaviour |
| --- | --- |
| Status gate | `onStatusChange('live' \| 'unsupported' \| 'error')` — `singularityGate` only lets the sign-off warp when the renderer reports `live`; anything else costs the reader the frozen overlay, never the hold. |
| No WebGL2 | The stage reports `unsupported` and the painted CSS trench in `styles/trench.css` *is* the finale — the scroll mechanic is layout, not paint. |
| Reduced motion | **No animation loop at all** — one static frame, redrawn on resize. |
| Off-screen | Loop paused on an `IntersectionObserver` (18% root margin so the first visible frame is warm). |
| The hold | While the sign-off hold locks the screen the water goes **still** (time freezes; the consumption keeps feeding the mouth) — the same rigidly-static contract the cinematic camera used to give the raymarcher. |
| Teardown | Loop cancelled, context lost via `WEBGL_lose_context`, canvas removed — StrictMode-safe. |

**The seam (`lib/scenes.ts` + `styles/trench.css`):** the canvas paints its own
opaque water, so the join with the page is the visual problem — and it is solved
by the same depth-zone system the rest of the dive uses, not a parallel one.
`SECTION_ZONE` maps `#singularity` to the `trench` zone, which drives the page
ground, the ambience uniforms and the CSS-shell tint from one table
(`src/lib/palette.ts`). Locally, the stage masks its top and bottom 9% to
transparent and `.bh-frame` lays trench water above the canvas and mouth-dark
below it, so the two grounds meet as continuous depth instead of a hard
rectangle.

**The measured names are intentional.** `.bh-hold`, `.bh-frame` and
`--bh-frame-fit` kept their old names through the rewrite because
`tests/signoff-horizon.spec.ts` measures them: the reservation the sign-off
grows, the box the consumption scene is framed on, and the height the framing
solver spends. Renaming measured geometry for cosmetics is how suites die.

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
