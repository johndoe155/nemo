# THE NEMOVERSE — Card Component Audit & Elevation Plan

**Audit scope:** every card-shaped surface in the codebase · **Baseline:** `tsc -b` clean, `vite build` ✓ (3.3s) · **Protocol:** read-only audit — no code modified.

---

## 0 · CARD INVENTORY (10 families, 2 tiers)

| ID | Component | Source | Styles | Role |
|----|-----------|--------|--------|------|
| **C1** | `UniverseCard` (+ `DropTeaserCard` variant) | `src/components/UniverseCard.tsx`, `src/sections/Nemoverse.tsx:266` | `components.css:624-850`, `overhaul.css:483-504` | Flagship roster card |
| **C3** | `ProductCard` (hero + stack) | `src/sections/Store.tsx:9` | `components.css:1256-1366`, `overhaul.css:510-554` | Commerce card |
| **C4** | Perk tier card | `src/sections/Perks.tsx:30` | `components.css:1162-1200` | Text card |
| **C5** | `ArtistCard` | `src/sections/Artists.tsx:33` | `components.css:1368-1425` | Text card, masonry |
| **C6** | `LoreStat` | `src/sections/Lore.tsx:6` | `components.css:1458-1486` | Stat mini-card |
| **C7** | `StampSlot` | `src/sections/pulls/StampCard.tsx:118` | `pulls.css:978-1350` | Interactive pull slot |
| **C8** | `RevealPlate` | `src/sections/pulls/RevealPlate.tsx` | `pulls.css:683-770` | Reveal stage card |
| **C9** | `UniverseDialog` | `src/components/UniverseDialog.tsx` | `components.css:908+` | Modal card |
| **C10** | `cg-card` (Rotunda plate) | `src/components/CircularGallery.tsx` | `circular-gallery.css:121-230` | 3D ring plate |
| — | Adjacent: `.perks__verify` panel, `.countdown__cell`, `.tlitem` | `Perks.tsx`, `ui.tsx`, `Lore.tsx` | various | Audited, lower priority |

**Luxury-grade scores (10 = Awwwards SOTD reference bar):**

| C7 StampSlot | C8 RevealPlate | C1 UniverseCard | C9 Dialog | C10 cg-card | C3 Product | C5 Artist | C4 Perk | C6 LoreStat |
|---|---|---|---|---|---|---|---|---|
| **8.4** | 7.6 | 7.2 | 6.8 | 6.5 | 6.2 | 5.9 | 5.8 | 5.2 |

The gap to a 9.5+ is not effort — it's **consistency**. C7 proves the team can do world-class material; C4/C5/C6 don't share it, and C1 has two latent bugs that silently delete designed behavior.

---

## PHASE 1 — RUTHLESS AUDIT

### 1.1 Depth & Materiality

**What's earned:**
- C1's dual-layer gradient border (`padding-box` + `border-box`, `components.css:629-634`) with living chroma via `gdrift` — a real material idea.
- C7 is the material benchmark: 3-layer shadow stack at rest (ambient `0 24px 50px -20px`, rarity rim glow, `inset 0 0 0 1px` rim), 45° chamfered `clip-path` housing, 15% top-edge specular, corner reticles, noise. This is $30k-grade.
- Cursor-tracked sheen (`useCursorGlow` → `--mx/--my`) with opacity-only fades — correct architecture.

**What fails:**
- **DEP-1 · Elevation grammar is incoherent.** Resting C1/C3/C4/C5 have *zero* ambient shadow — cards float on glow alone; any bright content behind them erases the edge. Hover elevation uses three different technologies: C1 `filter: drop-shadow` (transitioned), C3 `box-shadow` (transitioned — repaints per frame, the exact anti-pattern C1's own comment at `components.css:638-641` warns against), C4/C5 border-color only. One system, three dialects.
- **DEP-2 · No material on card surfaces.** Global `.grain` exists but no card carries noise; `.card` glass (`rgba(255,255,255,0.03-0.055)` fills + `blur(16px)`) reads as flat plastic because there's no frosted rim separation (C7's `inset` highlight is applied nowhere else). 53 `backdrop-filter` usages site-wide, mostly behind 3-6% alpha fills where the blur is nearly invisible — paying GPU cost for imperceptible depth.
- **DEP-3 · Radius anarchy.** 6 / 8 / 10 / 12 / 13 / 14 / 18 / 20 / 22px coexist. `--r-card: 18px` exists and is ignored by ucard (20), product (8 outer / 12 media), stamp (14), reveal/dialog (22), ucard media (13). No concentricity rule between outer and inner radii.
- **DEP-4 · `gdrift` runs on card-scale surfaces.** The engine's own docstring (`motion.css:230-244`) says the raster is "bounded to the small chrome surfaces it's applied to" — but consumers include every `.ucard` (~380×560px × 10), the 1080px dialog, and every `.card`. Infinite `background-position` animation = continuous main-thread raster, 100% duty cycle, forever.

### 1.2 Micro-Interactions & Motion Physics

**What's earned:**
- `useTilt` (spring 260/22/0.6 + lift 220/20/0.6), GPU transform-only, inert under reduced motion + coarse pointers.
- C7's separation of tilt layer from flip layer (documented in-source) with a distinct flip spring (320/18 = react-spring tension/friction mapping) — genuinely sophisticated.
- Kinetic buttons, magnetic pull, `RollText` rollovers, custom cursor labels (`data-cursor="OPEN"`).

**What fails:**
- **BUG-1 (verified) · The roster zig-zag is dead code.** `overhaul.css:503-504` sets `:nth-child(odd/even) { transform: translateY(±14px) }`, but every roster card is a `motion.article` with `useTilt`, and framer-motion writes inline `transform: none` at rest (confirmed in `node_modules/framer-motion/dist/es/render/html/utils/build-transform.mjs` — defaults compile to `"none"`). Inline beats stylesheet: **9 of 10 cards render without the designed editorial rhythm**; only `DropTeaserCard` (a plain `div`) offsets. Even without the inline conflict, hover would produce a ±14px discontinuity as the spring transform replaces the CSS offset.
- **BUG-2 (same class) · Product hover lift is dead code.** `components.css:1264` `.product:hover { transform: translateY(-6px) }` can never win over `useTilt`'s inline transform. Only the box-shadow half of that hover ever fires.
- **MOT-1 · Two products in one page.** Flagships get spring physics + cursor awareness; C4/C5/C6 get linear 0.4-0.5s CSS `translateY` with identical in/out curves, no cursor tracking, no exit grace. Awwwards juries notice the seam when scrolling.
- **MOT-2 · Flat depth on tilt.** Glare follows the cursor, but art, badges, and body sit on one plane — no `translateZ` stratification, no counter-parallax of the media layer. C1 tilts as a monolith.
- **MOT-3 · Filter/sort teleports.** Changing rarity filter or sort re-keys the rail with no `layout` animation and no `AnimatePresence` exits — cards pop in/out instantly. This is the single most visible motion deficiency on the page.
- **MOT-4 · Focus-motion parity = zero.** All hover depth (zoom, sheen, tilt, glow) is pointer-only; keyboard focus gets a 2px outline and a static card. `.sheen:hover::after` (`global.css:295`) has no `:focus-visible` twin.
- **PERF-1 · Rail drag re-renders the world.** `Nemoverse.tsx:78-82` calls `setDragOffset` per `mousemove` → Nemoverse + 10 UniverseCards re-render per pointer event. Should be a motion-value/ref write (the codebase already knows this pattern — `useCursorGlow`).
- **EDGE-3 · Drag vs. click.** `mousedown` on a card arms rail drag; releasing after a small drag still fires the card's `onClick` → accidental dialogs. No pixel threshold, no `pointercancel` handling.

### 1.3 Typography & Layout Rhythm

**What's earned:** the 5-role PP font system with documented rationale (`typography.css`), tabular numerals on counters/prices, 3/4 + 4/3 aspect discipline, lore clamped to 3 lines with `min-height: 4.2em` height equalization, hairline-divided meta rows.

**What fails:**
- **TYPO-1 · Two spacing languages.** C1/C3 use px (card 12px, body `14px 10px 6px`), C4/C5 use rem (1.5-1.6rem). C1's body bottom padding (6px) is asymmetric with no optical rationale, and its text column starts 22px from the card edge while media starts at 12px — the eye catches the misaligned left rail.
- **TYPO-2 · Unclamped titles.** `.ucard__name` and `.product__name` have no line clamp; a 2-line name shifts the meta block and card height (lore `min-height` only partially compensates). `.artistcard__body .credit` (`CANON CREDIT · U-001 · U-002 · …`) wraps unclamped at 0.6rem/0.2em tracking — ugly at 3+ credits.
- **TYPO-3 · Sub-9px type.** `.npx__slot-name` is 0.52rem (8.3px) — illegible on desktop, worse in the 4-col mobile grid. Several metadata styles run 0.58-0.62rem tracked uppercase.
- **TYPO-4 · Hardcoded colors over tokens.** Price gold `#ffc857` inline (`UniverseCard.tsx:101`), `#3fe8ff` NEXT DROP badge, `#0a0a14` avatar text — tokens exist (`--gold`, `--cyan`).
- **TYPO-5 · Values not tabular in ucard meta** — `typography.css:49` covers `.mv__stat b, .lorestat b, .countdown__cell b, .product__price` but not `.ucard__meta b` → minted counts jitter as digits tick.

### 1.4 Media & Assets

**What's earned:** aspect-ratio boxes everywhere (CLS-safe), accent-tinted skeleton wash + opacity fade-in, `loading=lazy` beyond index 2, hover zoom 1.06-1.07 at 0.9s expo, dual scrim (top+bottom) on C1.

**What fails:**
- **MED-1 · Asset pipeline is 2015.** Nine 1086×1448 JPEGs (327-583KB, roster ≈3.4MB) + 352KB hero — served into 280-380px CSS slots. No `srcset`/`sizes`, no AVIF/WebP, ~3× DPR oversize. No `decoding="async"`; first cards lack `fetchpriority="high"`.
- **MED-2 · No true blur-up.** Load-in is an opacity fade from 0.2 on the full-res file — no LQIP/blur placeholder, so slow networks see a dark void then a pop.
- **MED-3 · No hover grade or mask choreography.** Zoom exists; no saturate/brightness micro-grade on hover, no clip-path/mask transitions between states (C8 has them for phase changes — the technique is in-repo but unused on C1/C3).

### 1.5 A11y & Performance

**What's earned (keep all of this):** dialog focus trap + focus restore + Esc + scroll lock; global AAA focus ring (2px cyan, ≥3:1); comprehensive `prefers-reduced-motion` kill switches in 4 stylesheets; tilt/glow/cursor inert on coarse pointers; DPR-capped canvases; Starfield draws a single static frame under reduced motion; transform-only animation discipline; 44px targets with invisible hit-slop.

**What fails:**
- **A11Y-1 ·** Focus-motion parity (see MOT-4) — aesthetics are pointer-gated.
- **A11Y-2 ·** `motion.article role="button"` + `aria-label` overrides the inner `<h3>` and lore for screen readers — the card's heading semantics are destroyed at the roster level (dialog restores them). Acceptable pattern, improvable: `aria-labelledby` the name.
- **PERF-2 ·** `gdrift` on large surfaces (DEP-4) + transitioned `box-shadow` on C3 (DEP-1) + 53 backdrop-filters = steady paint load that competes with the pinned-roster scroll for frame budget.
- **PERF-3 ·** `Reveal` entrance animates `filter: blur(6px)→0` on whole card subtrees — brief but raster-heavy when 10 cards stagger in; blur-ins belong on text lines, not card-size surfaces.
- **PERF-4 ·** >900kB main chunk (three + gsap + framer, no code-splitting) — hero TTI risk in production.
- **PERF-5 ·** `getBoundingClientRect` per pointermove in `useTilt` (unbatched reads interleaved with framer writes); `useCursorGlow` already demonstrates the rAF-batch fix.

### 1.6 Edge Cases & Responsiveness

- **EDGE-1 ·** Stamp grid stays 4-col at 375px → ~78px slots; the 14px chamfer + 12px insets are proportionally enormous and the 8.3px name is unreadable. The globe already scales via container queries (`cqw`) — the chamfer/insets/type don't. Recommend 2-col ≤480px or full `cqw` scaling.
- **EDGE-2 ·** `ucard` `clamp(280px…)` + 2×1.25rem gutters = exactly 320px — zero slack on the smallest supported phones (scrollbar overflow risk).
- **EDGE-4 ·** Dark-mode only; hardcoded dark-on-light values (`#0a0a14` avatar text, `rgba(5,5,10,.55)` badge fills) would invert badly if a light theme ever lands. Note only.
- **EDGE-5 ·** Content drift: `DropTeaserCard` hardcodes "AUG 22" / "U-007" while its countdown is data-driven (`Nemoverse.tsx:289-295`).
- **Good:** text clamps where they exist, `nowrap+ellipsis` on slot names, touch fallbacks (wrap grid ≤860px), reduced-motion collapse of masonry/grid.

---

## PHASE 2 — ELEVATION PLAN

### 2.1 Card-by-card diagnosis → proposal

**C1 UniverseCard** (files: `UniverseCard.tsx`, `components.css:624-850`, `overhaul.css:483-504`)
| Current | Proposed |
|---|---|
| Zig-zag rhythm silently dead (BUG-1) | Move rhythm to the independent `translate: 0 ±14px` property (composes with framer's `transform`, zero conflict) or to a rail wrapper; add ±2px entrance settle |
| Monolithic tilt | Layered depth: media counter-parallax ±6px (inverse `useTransform` of tilt motion values), badges at `translateZ(24px)`, body at `translateZ(12px)`, `transform-style: preserve-3d` on card |
| Hover glow = transitioned `drop-shadow` filter | Two-layer resting elevation (inset rim light + ambient + accent bloom) with hover glow crossfaded on a pseudo-element (opacity only, 0.45s expo) — no filter/box-shadow transitions |
| No focus depth | `:focus-visible` mirrors hover: same glow, same media zoom, same sheen (`.sheen:focus-visible::after`) |
| Filter/sort teleports | `layout` prop + `AnimatePresence mode="popLayout"` on rail children; spring `{ stiffness: 240, damping: 26 }` |
| Name unclamped, meta non-tabular, hardcoded gold | 2-line clamp + `min-height: 2.4em`; tabular-nums on meta `b`; `var(--gold)` |
| Plain gradient glass | + `--noise` overlay (4.5%, overlay blend) + 1px inset top specular (adopt C7's rim recipe) |
| — | Press state: `active` scale 0.985 spring (tactile confirm), 120ms |

**C3 ProductCard** (`Store.tsx`, `components.css:1256-1366`)
- Delete dead `transform` hover (BUG-2); replace `box-shadow` transition with pseudo-glow crossfade; radius 8→`--r-lg` outer / `--r-md` media (concentric); media hover grade `saturate(1.08) brightness(1.04)`; srcset + `decoding="async"`; hero gets `fetchpriority="high"`; stack-card name clamp; price row baseline alignment (values align to cap-height, not baseline of the suffix).

**C4 PerkCard** (`Perks.tsx`, `components.css:1162-1200`)
- Adopt the C1 material (resting elevation + rim light + noise); adopt `useTilt` at reduced throw (`maxDeg: 1.2, lift: -4`) so all cards share one physics family; tier accent wash gradient at card top (rarity-tinted, 8% → transparent); list markers animate to filled ◆ on hover (staggered 40ms); uniform `--r-lg`; head row baseline grid.

**C5 ArtistCard** (`Artists.tsx`, `components.css:1368-1425`)
- Same material/physics adoption as C4; credit line clamped to 1 line with hover expand (or `title` tooltip); avatar gets the C7 rim treatment (inset specular + ambient shadow instead of single soft shadow); quote clamp 3 lines; `--r-lg`.

**C6 LoreStat** (`Lore.tsx`, `components.css:1458-1486`)
- From the weakest card to a "gauge tile": accent hairline on the left edge (rarity/gold), value gets gradient text (`--grad-gold`), count-up keeps IntersectionObserver trigger; hover = tilt-lite + glow crossfade (no translateY); `--r-md`; min-height uniform (2 rows: value / label+note).

**C7 StampSlot** — benchmark; polish only: slot-name 0.52→0.625rem + 1-line clamp; chamfer/insets/type scale via `cqw` (extend the existing globe pattern) or 2-col ≤480px; add press spring (`scale .97`, stiffness 500/damping 26).

**C8 RevealPlate / C9 UniverseDialog** — focus-motion parity on interactive children; dialog media gains scroll-scrub parallax (±10px `useScroll` on the panel); C8 corners + rim are strong; both get the noise pass; dialog scrollable region gets `overscroll-behavior: contain`.

**C10 cg-card** — adopt radius token (`--r-md`); front card gets the reflection sweep (reuse `.npx__slot-front::after` sheen); static shadows already read well in 3D space.

### 2.2 Design system tokens (additions to `global.css :root`)

```css
/* Radius scale — one concentric system (inner = outer − 6px at 12px padding) */
--r-xs: 6px;  --r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 22px; --r-pill: 999px;

/* Elevation — static two-layer resting treatment (no transitions on these) */
--elev-rest:
  inset 0 1px 0 rgba(255,255,255,0.045),                       /* rim light */
  0 24px 48px -24px rgba(0,0,0,0.62),                          /* ambient */
  0 8px 32px -16px color-mix(in srgb, var(--card-accent, #8a4dff) 22%, transparent); /* accent bloom */
--elev-hover: /* applied via opacity crossfade on ::before, never transitioned directly */
  0 32px 64px -28px rgba(0,0,0,0.7),
  0 12px 48px -18px color-mix(in srgb, var(--card-accent, #8a4dff) 38%, transparent);

/* Material */
--noise-url: url("data:image/svg+xml,…feTurbulence…");  /* 180px tile, applied at 4.5%, mix-blend: overlay */
--glass-blur: blur(16px) saturate(140%);                 /* restricted: overlay chips + stage only */

/* Motion */
--ease-expo: cubic-bezier(0.16, 1, 0.3, 1);      /* exists — entrances/pointer */
--ease-exit: cubic-bezier(0.76, 0, 0.24, 1);     /* NEW — exits/collapses */
/* Springs (JS constants, framer-motion): */
/* TILT  { stiffness: 260, damping: 22, mass: 0.6 }  — exists */
/* LIFT  { stiffness: 220, damping: 20, mass: 0.6 }  — exists */
/* FLIP  { stiffness: 320, damping: 18, mass: 1.0 }  — exists (C7) */
/* LAYOUT{ stiffness: 240, damping: 26, mass: 1.0 }  — NEW: filter/sort rail reflow */
/* PRESS { stiffness: 500, damping: 26, mass: 1.0 }  — NEW: active confirm */

/* Type floors */
--fs-meta-min: 0.625rem;   /* 10px desktop floor for tracked uppercase metadata */
--fs-meta-mobile: 0.6875rem;
```

### 2.3 Code specifications

- **No new dependencies.** framer-motion 11 covers springs, `layout`, `AnimatePresence`; the repo's own `useTilt`/`useCursorGlow` are the right primitives to extend (add an optional parallax-layer return: inverse `useTransform` values consumed by media/badge layers).
- **Transform authority rule (new):** CSS authors rhythm via the independent `translate`/`rotate`/`scale` properties only; framer owns `transform`. Documented in `motion.css` — prevents BUG-1/BUG-2 class regressions.
- **Perf rules:** no transitioned `box-shadow`/`filter` on card-size surfaces (pseudo-element opacity crossfades); `gdrift` scoped off card-scale surfaces (static multi-stop border gradient at rest, drift only on buttons/pills ≤64px tall); `Reveal` on cards drops `filter: blur` (keeps opacity+transform; blur-in stays on text lines); tilt reads rAF-batched; rail drag becomes a motion value (zero React re-renders); drag-vs-click via 6px threshold + click suppression.
- **Media pipeline:** build-time AVIF/WebP + `srcset` (1086/720/480 widths) via `vite-plugin-image-optimizer` or pre-generated assets in `public/art/`; 24px-tall LQIP base64 behind the existing skeleton wash (true blur-up); `decoding="async"`, `fetchpriority` on above-fold.
- **A11y:** `aria-labelledby` on ucard (preserve heading), `:focus-visible` twins for every `:hover` depth effect, metadata type floors, `overscroll-behavior: contain` on dialog.
- **Files touched (estimated):** `global.css`, `components.css`, `overhaul.css`, `pulls.css`, `motion.css`, `typography.css` (token/style layers) · `UniverseCard.tsx`, `Nemoverse.tsx`, `Store.tsx`, `Perks.tsx`, `Artists.tsx`, `Lore.tsx`, `StampCard.tsx`, `useTilt.ts` (behavior) · no changes to data layer or build config except the image-optimizer plugin.

### 2.4 Phasing (approval granularity)

| Phase | Contents | Risk |
|---|---|---|
| **P0 · Bug fixes** | BUG-1 zig-zag, BUG-2 dead hover, PERF-1 drag re-renders, EDGE-3 drag-click threshold, TYPO-4 hardcoded tokens | Trivial, pure wins |
| **P1 · Material system** | Tokens (§2.2), elevation grammar, noise, radius unification, gdrift rescoping | Low — visual delta sitewide |
| **P2 · Motion physics** | C1 layered parallax + focus parity, layout animations on filter/sort, C4/C5/C6 join the tilt family, press states | Medium |
| **P3 · Media pipeline** | AVIF/WebP srcset, LQIP blur-up, decoding/fetchpriority | Low, biggest KB win |
| **P4 · Edge polish** | Stamp grid mobile, clamps, type floors, EDGE-5 content drift | Trivial |

### 2.5 Do-not-touch list (already at standard)

Dialog focus trap/restore · `useCursorGlow` architecture · C7 tilt/flip layer separation + springs · 5-role typography system · reduced-motion coverage · aspect-ratio CLS discipline · transform-only animation discipline · rarity accent propagation via `--card-accent`.
