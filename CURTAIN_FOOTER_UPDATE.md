# Curtain-Reveal Footer Update

This project includes the full Nemo application with the requested bright “Curtain Reveal” footer overhaul.

## What changed

The footer was rebuilt as a responsive off-white threshold with charcoal typography, a restrained pearl/noise texture, an asymmetrical navigation grid, masked kinetic link labels, magnetic social links for X/Twitter, Discord, and OpenSea, and an edge-to-edge `NEMO` lockup. Existing footer identity, CTA, legal, and back-to-top behavior remain available in the new layout.

A new floor-state controller measures the footer and reserves its height beneath the main experience. It adds `html.at-floor` only at the true document bottom, allowing the fixed ambience and starfield layers to fade away and reveal the footer. The implementation includes responsive mobile rules, visible keyboard focus states through the project’s global focus treatment, fine-pointer gating for magnetism, and reduced-motion fallbacks.

## Development commands

```bash
npm ci
npm run dev
```

## Validation completed

The following checks passed before packaging:

```bash
npm run build
npm run verify:blackhole
```

The archive intentionally excludes `node_modules` and generated `dist` output. Install dependencies with `npm ci` after unpacking.

## Regression fix

The footer surface is now kept in normal document flow with a non-negative stacking level. The earlier negative `z-index` caused the bright footer background to paint behind transparent main sections, obscuring the original void and fixed starfield. The corrected rule preserves the dark ambience throughout the main page and lets the floor-state fade reveal the footer only at the true document bottom.

## Singularity regression fix

The main experience and Singularity section now have explicit paint-layer ownership. `main` and `.singularity` are positioned above the bright footer stack, while the `.bh-frame` remains an isolated stage with its canvas/fallback layers intact. This prevents the footer surface from occluding the black-hole stage or reducing it to a white block.

## Closing block restoration

Restored the post-Singularity closing sign-off block only: the credits marquee containing “ONE CANON · INFINITE VERSIONS,” the “ENTER THE / NEMOVERSE.” invitation, and the “EXPLORE THE UNIVERSES” CTA linking back to the Nemoverse. Existing starfield, Singularity, and curtain-footer code remains unchanged in this pass.

## Curtain reveal — the sticky floor

The bright footer no longer arrives as the next block in the scroll; the void is
lifted off it. `.footer.signoff` is the curtain, `.curtain-footer` is the floor
that was already there, and native scroll does 100% of the work — one scrolled
pixel lifts the curtain by one pixel. No pinning, no scroll interception, no
animation loop.

**The rig.** `.curtain-footer` is `position: sticky; bottom: 0` (never fixed,
never negatively stacked) inside a new `.curtain-stage` wrapper.
`.footer.signoff` gets `z-index: 1` and `margin-bottom: calc(-1 *
var(--curtain-travel))`, so it hangs down over the floor by exactly the travel
distance and paints over it (an ordinary same-stacking-context comparison
against the stage's `z-index: 0`). Its gradient now closes on opaque `#050508`
so the hem reads as a hard edge; the 0–46% stops that let the starfield through
the top of the section are untouched. The obsolete `main { margin-bottom }` is
gone — `main` keeps `position: relative; z-index: 1`.

**Why the wrapper exists.** The negative margin alone cannot produce this
effect, and the earlier plan for it would have failed twice over:

1. *No reveal.* A `-1 × footer-height` margin removes exactly as much document
   height as the reveal has to consume. The sign-off's hem would land on the
   bottom of the viewport at the last scrollable pixel, so the floor would be
   fully covered at maximum scroll and never uncovered at all.
2. *A new bleed.* A sticky `bottom: 0` box that still has travel left behaves
   like a fixed bar at the bottom of the screen. The bright surface would sit
   there for the entire scroll, showing through every transparent section of
   `main` — the same symptom as the old negative `z-index`, from a different
   cause.

`.curtain-stage` fixes both. It is `(footer height + travel)` tall with the
footer flexed to its bottom, which (a) pays the negative margin's height back to
the document, so the last `--curtain-travel` pixels of the page *are* the
reveal, and (b) bounds the sticky travel to exactly that distance. Its
`clip-path: inset(var(--curtain-travel) 0 0 0)` limits the floor's paint window
to the strip below the hem, so the surface cannot be painted — or hit-tested —
anywhere else on the page, whatever the curtain's own opacity does. `clip-path`
clips painting only: no layout change, no scroll container, and the child's
sticky still resolves against the real viewport. The fixed backdrop layers
(`.starfield`, `.ambience`, `.grain`, `.nav`, `.siderail`, `.soundtoggle`,
`.scrollprog`) keep their positioning exactly as before, and `.bh-frame` /
`.singularity` were not touched.

**Floor state.** `FloorState.tsx` keeps its `ResizeObserver` on the footer and
now publishes `--curtain-travel`, a continuous `--curtain-progress` (0 → 1,
measured from the sign-off's hem against the bottom of the viewport) and
`--curtain-chrome-opacity` (holds at 1 for the first 30% of the lift, then
fades). `html.at-floor` still exists but now means "the lift is essentially
complete". The dark fixed chrome fades with the lift and becomes
`pointer-events: none; visibility: hidden` at the floor so it leaves no
invisible tab stops; the custom cursor and the toast host are left working.
Focusing a floor link from higher up the page takes the page to the floor, so
keyboard users never land behind the curtain.

**Footer height — the one-screen rule.** A sticky `bottom: 0` reveal uncovers
the floor bottom-edge-first, so a floor taller than the screen can never show
its top. The audit found the footer at 155–327% of the viewport at every tested
size (1671px at 1920×1080, 1383px at 1280×720, 1482px at 390×844, 1276px at
844×390), which would have hidden most of it. Every vertical measure in the
footer is now capped in `dvh` (with a static fallback declaration for browsers
without `dvh`), with extra compaction at ≤980px, ≤640px, small phones and
short/landscape viewports; the credits grid becomes 2×2 on phones and a single
four-column row on short viewports. The floor now measures 77–94% of the
viewport from 2560×1440 down to 360×640 and 667×375. As a backstop, FloorState
sets `--curtain-travel: 0` whenever the measured footer is taller than the
viewport, which collapses the rig to an ordinary in-flow footer — the same thing
a JavaScript-less or `dvh`-less browser gets.
