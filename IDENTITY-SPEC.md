# NEMOVERSE IDENTITY SPEC — v0.1

**Status:** PLANNING · no code changes authorised by this document
**Branch:** `arena/01a0d4bc-nemo`
**Owner:** Lead Creative Technologist
**Supersedes:** the visual direction described in `src/styles/global.css`'s header block
("void-black canvas, nebula gradients, gold reserved for rarity, glass surfaces,
glow-based elevation"). That direction is retired by §3 of this spec.

> This spec exists because the current build's failure is structural, not cosmetic:
> the visual identity was authored independently of the character and the character
> was placed inside it. Every rule below is derived from the character's own art
> direction (cel shading, flat saturated colour, hard black outlines, street-print
> collage, aquatic setting) or it does not ship.

---

## 0 · Decision log

Four forks were put to the client and resolved on 2026-09-24. Everything downstream
assumes these answers.

| # | Fork | Decision |
|---|------|----------|
| D1 | Luminance regime | **Paper-first.** Off-white print stock is the base ground; saturated flat cel colour and hard black outlines sit on it. Darkness exists only at the bottom of the dive (§2). |
| D2 | Registry format | **Keep the pinned rod/rail roster** (pendulum cards, filter/sort/dialog). **Delete the rotunda sphere.** |
| D3 | Finale | **Keep the scroll mechanic, replace the renderer.** The reservation-hold + sign-off warp survive; the WebGPU raymarcher is replaced by a lightweight fullscreen-quad vortex/refraction shader. |
| D4 | Planning artifact | This document. Execution phases are gated on signed-off amendments to it. |

Carried findings from the diagnosis brief, accepted without amendment:

- The current palette/material system is the most-copied aesthetic in Web3 since 2021;
  it is not ownable and is retired (§3–§4).
- The glass/crystal bust render is the one existing asset compatible with a premium
  beat; glass/chrome becomes the *single* luxury material, used at most twice (§4.5).
- The "#9584 WANTED" edition motif appearing in two separate artworks is the
  project's own card system and replaces the borrowed gacha rarity ramp (§6).
- Thirteen competing "hero moments" collapse to seven beats (§2.2).
- Persistent global chrome is trimmed (§7).

---

## 1 · Identity thesis

**Street-print × reef.** Two voices, one character:

1. **The street voice** — tattoo-flash lettering, torn paper, tape, stamp ink,
   hand tags, paint splatter, edition serials. Loud, flat, outlined, funny.
2. **The reef voice** — cel water, caustic light, bubbles, marine snow, the descent.
   Saturated, wet, alive.

The street voice alone is a 2022 neo-brutalist cliché. The reef voice alone is a
nature documentary. The identity is the product of the two, and the character is
the proof they belong together: a mint-green kid in a hot-pink hoodie, outlined in
black, swimming.

**The glass bust is the exception that proves the rule.** One material in the
character's canon is not flat: the crystal/glass render. It is rationed (§4.5).

### 1.1 What the site is, narratively

The page is **a dive**. Scroll position is depth. The reader starts on dry paper
(the surface, the street, the wanted posters), enters the water at the registry,
descends through the character's world, and ends in the trench — the only dark
place on the page — before surfacing into the footer. The closing statement is
therefore *water*, never space: the site ends by going deeper into the character's
own universe instead of leaving it.

---

## 2 · The dive: depth zones and beat map

### 2.1 Depth zones

The existing scene engine (`lib/scenes.ts` + `observeScenes()`, stamping
`data-scene` on `<html>`) is retained **unchanged in mechanism** and re-authored in
meaning: its eight space districts become four depth zones. No new observer code.

| Zone | Name | Ground | Light quality | Accent set | Beats |
|------|-------|--------|---------------|------------|-------|
| Z0 | SURFACE | `--paper` (warm print stock) | flat daylight; paper tooth at full strength; **no** caustics | pink · mint · ink | 1 |
| Z1 | REEF | `--paper` panels on a saturated `--water` field | cel water, hard caustic shapes, bubbles rising against scroll | water · pink · mint · sky | 2, 3 |
| Z2 | MID-WATER | deep `--water` → `--deep` gradient wash | soft caustics, colour temperature cools, outlines thin by 1px | sky · mint · paper (as light) | 4, 5 |
| Z3 | TRENCH | `--deep` / near-black teal | bioluminescence only: mint + cyan points of light in darkness | bio-mint · bio-cyan | 6 (tail), 7 |

Rules:

- **Monotonic descent.** Zones never repeat or reverse order down the page. A
  reader can always tell how deep they are from the ground alone.
- **Darkness is earned.** Z3 is the only dark ground on the page. Its black is a
  *teal-black* (`--deep`), never the retired purple-black `--void`.
- The zone system replaces `--scene-bg` / `--scene-line` drift with ground + light
  steps; the shader palette table (§3.3) is keyed by zone, not by district name.

### 2.2 Beat map (13 blocks → 7 beats)

| Beat | Zone | Content | Provenance |
|------|------|---------|------------|
| 1 · THE SURFACE | Z0 | Hero + tape-strip ticker | `Hero`, `Marquee` |
| 2 · THE REGISTRY | Z1 | Pinned rod/rail roster, filters, sort, universe dialog | `Nemoverse` (rotunda deleted) |
| 3 · THE STAMP BOOK | Z1 | Proof-of-purchase pull simulator, stamp card, odds | `Pulls` |
| 4 · THE PERSONA | Z2 | Chat + glass-bust portrait | `Persona` (GLB stage deleted) |
| 5 · HOLDER ECONOMICS | Z2 | Perks tiers + store SKUs, one continuous economics beat | `Perks` ⊕ `Store` merged |
| 6 · CANON & CREDITS | Z2→Z3 | Identity/60-40 model, canon timeline, artist credits as a flash-sheet / sticker wall | `Lore` ⊕ `Artists` ⊕ credit crawl merged |
| 7 · THE TRENCH | Z3 | Vortex descent finale → footer surfacing | `Singularity` mechanic reskinned ⊕ `Footer` |

Content-preservation rule: **no pitch content is deleted, only re-homed.** Store,
perks, lore and artist credits are business requirements; merges change their
container, not their existence. The deletion ledger (§7) lists only chrome,
duplicated galleries, space metaphor and dead code.

---

## 3 · Palette spec

### 3.1 Retired

`--void` as ground · `--abyss` · `--iris` / `--iris-deep` as brand hues ·
`--grad-primary` (iris→cyan→magenta) · `--magenta` as brand hue · `--gold` and
`--grad-gold` **as rarity/luxury colour** · `--r-common…--r-secret` rarity ramp ·
`--bh-*` black-hole palette · nebula gradients · glow-based elevation (§4.2).

Migration note: `--gold` currently has **49 consumers**. It is not deleted
blindly; every consumer is re-mapped in Phase 4 to either the foil treatment
(§4.5, legendary edition only) or `--stamp`/`--manila`. A gold-audit checklist is
an exit criterion of Phase 4.

### 3.2 New core palette (PROVISIONAL hexes)

Values are sampled from the five reference artworks supplied 2026-09-24 and are
**provisional until re-swatched against the full final art set**. Token *names and
roles* are final; hexes are not.

| Token | Provisional | Source in the art | Role |
|-------|-------------|-------------------|------|
| `--paper` | `#F2EEE2` | wanted-poster stock / page margin | Z0–Z1 ground, card stock |
| `--paper-2` | `#E5DECC` | poster shadow side | panel wells, tape |
| `--manila` | `#E3CD9C` | "#9584 WANTED" poster body | edition plates, tape strips |
| `--ink` | `#0C0B0E` | cel outline black (not pure #000) | all outlines, all text on light |
| `--pink` | `#E46FA5` | the hoodie | primary brand fill, stamp ink |
| `--mint` | `#93E2A4` | the skin | secondary fill, bio-light in Z3 |
| `--sky` | `#7CC9E8` | the hair | tertiary fill, Z2 light |
| `--water` | `#25B4E4` | reef water field | Z1 field, links, active states |
| `--deep` | `#06202F` | trench / deep panels | Z3 ground, footer |
| `--bio-cyan` | `#5FE3FF` | bubble iridescence | Z3 accent only |
| `--stamp` | `#D8452E` | poster ink / splatter | seals, alerts, one-off accents — rationed like glass |

Derived ramps (all steps must clear the contrast rules in §3.4):
`--pink-deep`, `--mint-deep`, `--water-deep`, `--sky-deep` for hover/pressed and
Z2 cooling; `--paper-ink` (paper at 92/66/56 alpha) as the *only* text-on-dark ramp,
mirroring the structure of the retired `--ink` / `--ink-dim` / `--ink-faint` trio so
the existing two-tier metadata discipline survives the inversion.

### 3.3 Shader palette table (the second artifact)

A token rebuild that touches only CSS produces a half-reskinned site: five
independent palette sources exist today (`global.css:root`, `lib/scenes.ts` RGB
float triplets, `pulls.css`'s private `--obsidian/--silver` block, shader constants
inside `Ambience.tsx` / `PortalButton.tsx` / `pulls/shaders.ts` /
`nemo-particles.js`, and the vendored `blackhole.config.js`).

Phase 2 therefore ships **one module** — working name `src/lib/palette.ts` — that is
the single source of truth for colour, exporting:

1. the CSS custom properties (written to `:root` and per-zone `[data-scene]`), and
2. the float triplets / uniform values consumed by every GLSL consumer.

`lib/scenes.ts` becomes a thin zone→palette mapping over it; `pulls.css`'s private
block is deleted and its consumers re-pointed; the hero particle field
(`nemo-particles.js`, which is character-led — it morphs through Nemo pose
point-clouds — and therefore *stays*) reads its per-pose colours from the table
instead of its baked constants. The vendored `blackhole.config.js` leaves with the
sim (§7), taking the last unmappable source with it.

### 3.4 Contrast rules (written into the token system, enforced by the axe suite)

1. Body and metadata text is `--ink`-on-light or `--paper-ink`-on-dark. **Never
   fill-on-fill** (no mint-on-pink, no paper-on-water) for text at any size.
2. Saturated fills (`--pink/--mint/--water/--sky`) are surfaces, graphics and
   outlines-only-text at display size (≥ 24 px, or ≥ 19 px bold), where
   ink-on-fill pairs must still clear 4.5:1.
3. `--stamp` red never carries meaning alone (pairs with a shape or word).
4. The axe playwright suite and the visual-regression suite are re-baselined at the
   end of Phase 2, not retrofitted in Phase 6.

---

## 4 · Material grammar

Replaces, wholesale: glassmorphism, gradient borders, backdrop blur as elevation,
glow shadows, sheen sweeps.

### 4.1 Outline & edge

- Containers rest at **2px solid `--ink`**; interactive plates and hero furniture at
  **3px**. Outlines are the elevation language on light grounds.
- Radius scale redefined downward: `--r-xs 4px · --r-sm 8px · --r-md 12px`,
  `--r-pill` retained for chips/stamps only. The 18–22px glass radii are retired.
- **Die-cut edges:** selected plates (edition cards, credit stickers) carry a torn
  top or side edge via `clip-path`/mask — the torn-paper vocabulary already present
  in the "Doodle 9584" piece. Torn edges are a per-component decision, never global.

### 4.2 Elevation = print shadow

- `--shadow-print` scale, no blur, no glow: `4px / 6px / 10px / 16px` solid
  `--ink` offsets. Resting cards sit at 6px; hover translates `(-2px,-2px)` and
  steps to 10px (sticker lift); pressed collapses to 4px.
- On Z3 dark grounds the offset shadow inverts to `--bio-cyan` at 1px (bioluminescent
  rim) — the only dark-ground elevation, and the only glow left on the site.

### 4.3 Collage furniture

- **Tape:** rotated translucent `--manila` pseudo-element strips on plate corners.
- **Splatter:** 2–3 shared inline-SVG paint splatters, reused site-wide, tinted via
  `currentColor`. Never more than one per plate.
- **Marker scribble:** hand-drawn underline/circle SVGs that draw in on reveal
  (`stroke-dashoffset`). This is the *only* hand voice — no handwriting webfont
  (licensing + weight).
- **Paper tooth:** the existing 180px fractal `--noise` tile, repurposed from
  "obsidian grain" to print-stock tooth, at raised opacity on Z0/Z1 and faded out by
  Z2 (paper does not exist underwater).

### 4.4 Surface fills

Flat. No gradient fills except: (a) the Z2 depth wash, (b) caustic light painted by
the Ambience quad, (c) the glass material (§4.5). `--grad-primary`, `--grad-ghost`
and all gradient borders are deleted.

### 4.5 The glass ration

Glass/chrome/refraction appears **at most twice** on the page:

1. the Persona bust (beat 4), and
2. one foil moment: the legendary edition seal (§6).

Everywhere else, luxury is expressed by stock quality (manila, foil stamp, emboss
line) — not by blur. `--glass-blur` is deleted.

---

## 5 · Type system

| Role | Face | New treatment |
|------|------|---------------|
| Display | PP Neue Machina Inktrap Ultrabold | **Flash lettering:** solid fill + hard `--ink` outline + `--shadow-print` offset; stacked-wordmark compositions (three stacked treatments of one word: solid / outlined / ghost) as in the tattoo-flash reference. Display tier only. |
| Heading | PP Neue Machina Plain | unchanged face; loses gradient text, gains outline at hero scale only |
| Body | PP Neue Montreal | unchanged. Its politeness is the deliberate foil to the loud display voice. |
| Reading/micro | PP Neue Montreal Text | unchanged |
| Data/serial | Space Grotesk | becomes **the edition voice**: serials, `#9584`-style numbers, tabular counters, telemetry |

- `@fontsource/michroma` is imported in `main.tsx` and referenced by **zero** rules
  or components. Deleted in Phase 1.
- Outline + offset-shadow treatment is forbidden below the display tier.
- The existing subset pipeline (`scripts/subset-fonts.mjs`) is unchanged; if the
  flash-lettering treatment needs glyphs not in the current subsets (e.g. `#`),
  extend the codepoint list, do not add faces.

---

## 6 · Edition system (replaces the rarity ramp)

The art already ships a bespoke edition language: the "#9584 WANTED" poster,
repeated across two pieces. That is the Multiverse card.

1. **Primary identity = serial.** Every universe plate leads with its edition
   serial at display scale in Space Grotesk tabular (`ED. 9584`), not with a rarity
   gem or hue.
2. **Card = wanted poster.** Manila/paper stock, torn top edge, tape corners,
   stamp-ink seal, artist hand-tag signature, splatter. The card is a document
   about a person, not a loot box.
3. **Rarity becomes treatment, not hue.** The `RARITY` map in `lib/data.ts` keeps
   its tier ordering (it drives pity/set logic that stays) but loses its colour
   coupling:

   | Tier | Treatment |
   |------|-----------|
   | common | black ink on paper stock |
   | rare | `--water` ink seal |
   | epic | `--pink` ink seal |
   | legendary | manila stock + foil line (glass ration #2) |
   | secret | sealed/blackout plate, serial redacted |

4. `--r-*` tokens deleted; `SORT_OPTIONS`' rarity sort relabels to edition tier;
   filter chips become stamp seals (shape + ink, not glow).
5. Pulls mechanics (weighted odds, holder bonus, pity on 8th, set bonus) are
   **unchanged in logic** — they are the most ownable interactive on the page — and
   re-dressed in stamp-book language, which the existing stamp card already half
   speaks.

---

## 7 · Deletion & merge ledger

Executed in Phase 1, before any reskin, so the reskin surface is half its current
size. Sizes are current build figures.

| Item | Fate | Dies with it |
|------|------|--------------|
| Rotunda (`sections/Gallery.tsx`, `components/ui/img-sphere.tsx`, `styles/circular-gallery.css`) | DELETE | 29 kB Tailwind-class component, its inline `zIndex: 1000+z` stack, 146 CSS lines, the duplicated 9-universe gallery |
| `Starfield` (`ui/index.tsx` canvas) | DELETE | space metaphor + one always-on 2D canvas |
| `VelocityFX` | DELETE | gimmick chrome |
| `multiverse-background-webgl-3.html` (repo root) | DELETE | 1,664-line orphan referenced by nothing |
| `@fontsource/michroma` import | DELETE | unused import |
| Persona GLB stage (`PersonaModelStage`, `public/models/persona-model/*`) | DELETE | **29.5 MB .glb + 1.5 MB HDR**, the r3f/drei chunk (66.7 kB gz), `preloadPersonaPoints`, `persona-points.json` |
| Black hole (`BlackHoleStage`, `BlackHoleStill`, `three/blackhole/*`, `sections/Singularity.tsx` sim half, `scripts/verify-blackhole.mjs`, PROVENANCE lock) | DELETE | **webgpu three chunk (186 kB gz)**, the vendored-verbatim constraint, `--bh-*` tokens |
| `three/blackhole` coupling in `eventHorizonWarp.ts` | DECOUPLE FIRST | the warp reads exactly three scalars (`blackHoleMass`, `gravitationalLensing`, `stepSize`) from the vendored config; they are re-derived as vortex parameters in the new warp module **before** the folder is deleted |
| `Perks` ⊕ `Store` | MERGE → beat 5 | one section shell, one scene-district handoff |
| `Lore` ⊕ `Artists` ⊕ credit crawl | MERGE → beat 6 | two section shells; credits become the flash-sheet wall |
| `SideRail` | KEEP, RESKIN | becomes the depth gauge (zone tick marks) |
| `CustomCursor` | KEEP, RESKIN | marker dot + bubble ring |
| `.grain` | KEEP | becomes paper tooth (§4.3) |
| `Ambience` quad | KEEP, RESHADE | nebula fbm → caustics/paper-wash keyed by zone; flat in Z0 |
| `SoundToggle` | KEEP, RESTYLE | stamp-sized, demoted |
| `Loader` morph | KEEP, UPGRADE | landing becomes sticker-slap + stamp thud; it is already the most identity-led moment on the page (morphs into Nemo's vector silhouette) and is the template for the whole overhaul |
| `nemo-particles` hero field | KEEP, RECOLOUR | character pose point-clouds are identity-led; colours move to the palette table |

Post-ledger GPU surface: Ambience quad · hero particle field · portal-button liquid
shader (re-shaded) · pulls canvases · vortex finale quad · sign-off warp.
Six contexts, down from ten canvases + one r3f canvas.

---

## 8 · Motion spec

- **Scroll authority untouched.** `lib/scroll.ts` (Lenis + GSAP ticker + holds) is
  the best-engineered module in the repo and is metaphor-agnostic.
- **Signature physics kept:** the pendulum rail (beat 2) and the reservation-hold
  finale (beat 7). Two signature moments, per the diagnosis brief's 2–3 rule; every
  other section gets entrance/interaction motion only.
- **Material motion replaces decorative motion:** stickers *slap* (scale 1.06→1
  with ±1.5° rotate, expo-out), stamps *thud* (scale 1.15→1 + shadow step), scribbles
  *draw*, tape *peels*. Sheen sweeps, bloom crossfades and chromatic aberration are
  deleted.
- **Hero:** stacked flash-lettering wordmark (solid / outlined / ghost treatments
  per line), existing scroll-scatter retained; the orbiting-rings furniture deleted.
- **Water behaviour:** bubbles and marine snow rise *against* scroll direction in
  Z1–Z3 only (particle budget: one shared emitter, not per-section).
- **Finale:** the hold + spaghettification geometry survive verbatim (the
  92 kB `spaghettification.test.ts` suite therefore survives); the lensing shader
  becomes water refraction + vortex swirl, and the raymarcher's sky becomes trench
  darkness with bioluminescent points.
- `prefers-reduced-motion` contract unchanged: every new material motion collapses.

---

## 9 · Performance budget (re-baselined in Phase 6, targeted from Phase 1)

| Metric | Today | Target |
|--------|-------|--------|
| Eager JS (gz) | 643.6 kB | **< 250 kB** (ledger removes 186 + 66.7; pulls' `WebGLRenderer` CTA becomes a quad shader or lazy island) |
| Eager CSS (gz) | 39.5 kB | **< 25 kB** (ledger removes ~6 kB + reskin consolidation) |
| Binary assets | 31 MB in `public/models` | **0** (glass bust enters the existing AVIF pipeline) |
| GPU contexts | 11 | 6 |
| `budget.mjs` | gates lazy islands only | gains eager-total ratchet after Phase 6 |

---

## 10 · Verification policy

- **Keep & re-baseline:** `spaghettification.test.ts` (mechanic survives),
  `nemoLoader.test.ts`, a11y-axe + visual-regression specs (new palette baselines at
  end of Phase 2).
- **Delete with their subjects:** `verify-blackhole.mjs`, blackhole PROVENANCE
  checks, `signoff-horizon.spec.ts` assertions that reference the sim's palette
  (geometry assertions stay).
- **New gate (Phase 2):** a unit test asserting `lib/palette.ts` and the emitted
  `:root`/`[data-scene]` custom properties agree — the regression that prevents a
  repeat of the five-sources-of-truth failure.

---

## 11 · Order of attack

Each phase exits on criteria, not on vibes. No phase begins while the previous
phase's deletions are uncommitted.

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| 0 | This spec signed off | client amendment pass closed |
| 1 | Deletion & merge ledger (§7) | build green; ledger rows verified gone; unit tests green minus deleted subjects |
| 2 | `lib/palette.ts` + zone tokens + shader table; contrast rules; axe/visual re-baseline | palette agreement test green; no retired token referenced anywhere (`grep` gate in CI-free form: a script) |
| 3 | Edition/card system (§6) incl. `data.ts` decoupling | registry + stamp book render new plates; rarity hue references gone |
| 4 | Section reskins against new tokens (components/suspension/pulls/portal/typography CSS); gold-audit checklist closed | every beat reads as its zone; no glass outside the ration |
| 5 | Finale rebuild: vortex quad shader + decoupled warp; trench zone; footer surfacing | hold mechanic + spaghettification tests green; webgpu chunk absent from `dist` |
| 6 | Perf pass + `budget.mjs` ratchet | §9 table met |

---

## 12 · Risks & open questions

1. **Provisional hexes.** More artworks are coming; §3.2 values move when they land.
   Token roles do not.
2. **Neo-brutalist drift.** If the reef voice (caustics, water fields, descent) is
   under-built in Phase 4, the site reads as a cream-and-black-border template.
   Mitigation: Z1/Z2 ground work is scheduled *inside* Phase 4, not after it.
3. **Flatness monotony.** Paper + flat fills can read static. Mitigation: the zone
   descent supplies the page-scale dynamic range; caustic light supplies local life.
4. **Merge density.** Beat 5 and beat 6 each absorb two-to-three old sections; their
   internal hierarchy needs per-beat layout studies before Phase 4, or merges become
   dump grounds.
5. **The glass ration will be violated by accident.** It is a review rule, not a
   lint rule; it goes in the PR checklist for Phases 4–5.
