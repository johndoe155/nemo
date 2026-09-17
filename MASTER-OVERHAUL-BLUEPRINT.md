# MASTER OVERHAUL BLUEPRINT — v2
## Phase 0 · Analysis & Direction · Awaiting explicit "GO AHEAD"

**Status:** No code, CSS, token, asset, or dependency has been modified. The only
file touched is this document (it replaces the previous Phase-0 blueprint, which
described a pre-overhaul state; the old version is recoverable from git history).

**Working title for the direction: *ONE TAKE.***
The page already contains a film's worth of material. It is being shot like a
dashboard. The overhaul is a **directorial pass** — editing, not adding.

---

# 0. Acknowledgement of Protocol

Rules received and binding:

1. **Phase 0 is analysis-only.** Nothing is written, modified, or refactored —
   no code, no tokens, no CSS — until an explicit **GO AHEAD** is given.
2. **Creative freedom** is granted on layout, palette, motion, and structure,
   **but** every destructive edit, structural deletion, or paradigm shift is
   flagged in §7 and requires individual or grouped approval.
3. **Craft standard:** fluid spatial transitions, deliberate reveals, luxury
   spacing, light/color interplay, no generic web patterns.

This blueprint is grounded in a full inspection of the current `main` codebase
(~29k lines of TS/TSX + ~10.3k lines of scoped CSS across 15 style files), its
assets, its test gates, and its performance budget. It also supersedes the
previous blueprint in this repo ("The Living Archive"), whose core ideas —
scene districts, rod system, narrative framing — were already built into the
current site. Section 1 below explains why the *built result* still reads as
"boring, plain, and repetitive" and what a film-grade pass changes.

---

# 1. State of the Art — What Exists Today

## 1.1 Technical foundation (verified)

- React 18 + TypeScript (strict) + Vite 5, `base: './'`, chunk-split build.
- **One scroll authority:** Lenis, raf riding the GSAP ticker, scroll locks for
  dialogs/menus/boot (`lib/scroll.ts`).
- Framer Motion 11 (component state) + GSAP 3.15/ScrollTrigger (scroll
  choreography) + Three.js 0.185 in **two builds** (WebGL for hero/pulls,
  WebGPU/TSL for the vendored black hole — never edited, see
  `src/three/blackhole/PROVENANCE.md`).
- Scene-district ambience: 8 named districts (`lib/scenes.ts`) driving a WebGL
  nebula shader, a CSS no-WebGL fallback, and `--scene-bg`/`--scene-line`
  tints — one authority, three renderers.
- Bespoke type system: PP Neue Machina (Inktrap + Plain), PP Neue Montreal
  (+ Text), Space Grotesk — subsetted at build, self-hosted.
- Crown-jewel interactive systems: pendulum **suspension roster** (420vh pin,
  inertia handoff, per-card pendulum physics), draggable **rotunda sphere**,
  **liquid-shader portal buttons**, WebGPU **black hole** with HDR bloom,
  **SignoffHorizon** consumption scene (the sign-off is literally eaten by the
  black hole), **curtain footer** reveal, credit-rod and drilling-rod
  mechanisms, magnetic/spring/motion-value choreography throughout.
- Hard gates: `npm run build` (tsc + vite), unit tests, **axe-core WCAG gate**
  (desktop + mobile, zero queued debt), **visual-regression pixel gate**
  (reduced-motion, seeded, frozen clock), and a **payload ratchet**
  (`scripts/budget.mjs` — 662 kB gzip eager JS ceiling, html2canvas must stay
  lazy).
- `prefers-reduced-motion` is a first-class citizen with per-subsystem static
  contracts.

**Verdict:** the engineering is genuinely award-caliber and is the reason this
site exists. The overhaul must *preserve* it. The problem is not capability.

## 1.2 The diagnosis — why it still reads "boring, plain, repetitive"

The site is a **hub**: an organized index of features. A film is a sequence of
**contrasts** — scale shifts, stillness, single ideas per screen. The current
page never does either. Nine specific, code-verifiable causes:

**D1. One header recipe, repeated 12 times.** Every section opens with the same
`SectionHead`: giant ghost numeral → tracked-mono kicker → display H2 → sub
paragraph. The kickers even leak the pitch deck: `01 · THE ANCHOR FEATURE`,
`04 · PILLAR 2 — TOKEN-GATED PERKS`, `05 · PILLAR 3 — …COLLECTIBLES`,
`06 · DIRECT SHOPIFY INTEGRATION`. No cinematic work says "PILLAR 2" to the
audience. This single repeated gesture is the largest source of the
"template" feel.

**D2. One material for everything.** The `.card` glass slab (noise + gradient
border + cursor sheen + accent bloom + brackets) is applied to universe
cards, perk tiers, product cards, lore stat tiles, timeline cards, the chat
panel, and the gauges. The few moments that *break* the card pattern — the
rods, the sphere, the black hole — are exactly the moments the site is best at.
Contrast is the rule; repetition is the bug.

**D3. No negative space, no stillness.** Every section is headline + copy +
stats + cards + footnote. The largest spacing token (`--gap-l: 26vw`) is used
in **two** places on the whole page (before the singularity, before the
footer). There is no full-bleed image moment, no single-sentence interlude, no
void where only art breathes. Meanwhile ambient motion never stops: three
marquees, aurora-drifting buttons, `gdrift` gradients, orbit rings, starfield,
grain, particle fields. Constant low-intensity stimulation **flattens**
hierarchy — nothing is ever the only thing on screen. The black hole is the
one "silence" on the page, which proves the technique works when used.

**D4. Color oversaturation in the foreground.** The iris→cyan→magenta
`--grad-primary` gradient is used on the hero title, nearly every section title
accent (`txt-grad`), primary buttons, progress fills, scrollbar, and selection.
Cyan appears in kickers, dots, hairlines, cursor, active states, everywhere.
The *background* has beautiful scene choreography — the *foreground* is one
uniform neon temperature. And the key art (red/black/white screenprint, warm
portal glow) lives in a completely different color world than the UI, so art
and interface read as two different websites sharing a scroll position.

**D5. The hero hides the site's best asset.** The most cinematic image in the
repo — `hero.jpg`, the wide shot of the cloaked wanderer before the ring of
portals — is **not** the hero background. It is the U-000 "Wanderer" plate,
spinning at 1/60th scale on the rotunda sphere. The hero itself is an abstract
WebGL particle field carrying **nine competing elements**: badge marquee,
three-line title, sub-block with animated ASCII separator, lede, two portal
CTAs, scroll hint, telemetry row, progress bar, and a ghost watermark. The
poster is in a drawer; the dashboard is on the cover.

**D6. Dashboard energy in the commerce zone.** Perks = four identical tier
cards. Pulls = probability nodes, liquid gauges, frequency line, radar grid,
wireframe globe — a web3-casino console. Store = hero card + three identical
product cards. These are the most "SaaS product page" screens on a page that
should be a film.

**D7. Chrome overload.** Nine+ always-on systems: custom cursor (dot + glow +
label), side-rail dots, scroll progress bar, velocity FX, sound toggle, grain,
starfield, ambience, nav hairline marker. Each is tasteful in isolation; in
aggregate they read as a demo reel where every section performs a different
interaction, and the viewer never gets a still moment.

**D8. Feature-order narrative.** The scroll order is product-led: roster →
rotunda → persona → perks → pulls → store → artists → **lore** → singularity.
The *story* (who Nemo is, the canon) sits at position 8 of 12 — after the
commerce machinery. A film establishes character and myth **before** it asks
for money. The section immediately preceding the black-hole climax (Lore) is
also the most content-dense one, with four stat tiles diluting the approach.

**D9. Monotone typography.** Five families are defined, but the on-page result
is: tracked uppercase mono everywhere, display H2s between. The reading voice
(Montreal) never appears at scale — the longest prose is small-text lore
paragraphs. There is no editorial layout anywhere: no oversized numerals, no
drop cap, no two-column text, no pull quote, no variable-feature moment
(`ss01–ss03` stylistic sets are subsetted and shipped, barely used). Michroma
is imported (a full 400-weight webfont) and **used in zero rendered pixels**
("kept for future accent use").

**Summary:** the site's problem is not that it lacks craft. It is that it
**refuses to edit**. Everything is on, everything is a card, everything is
cyan, everything enters the same way. The fix is direction, not decoration.

## 1.3 What stays sacred (protected subsystems)

These are tested, performance-sensitive, and among the site's best work. The
overhaul restyles their **surroundings** but does not rewrite their mechanics:

1. `lib/scroll.ts` — the single scroll authority.
2. The suspension roster physics (pendulum cards, inertia handoff) — *keep the
   physics; change the composition* (see §4.5).
3. The rotunda sphere component and its reduced-motion contract.
4. The black hole simulation + `BlackHoleStage` glue + `BlackHoleStill`.
5. `SignoffHorizon` consumption scene + curtain footer + `FloorState`.
6. `lib/scenes.ts` district system (extended, not replaced).
7. All test gates: unit, axe, visual-regression, budget ratchet.
8. Every accessibility behavior (focus traps, scroll locks, aria mirrors,
   reduced-motion statics).
9. The data layer (`lib/data.ts`) as source of truth for all commerce logic —
   odds, tiers, pity, gating stay bit-identical.

---

# 2. Visual & Atmospheric Vision

## 2.1 Direction: **ONE TAKE**

The page is re-cut as **one continuous take in three acts**, with **two
intertitles** and **one deliberate void** — the same dramaturgy that makes the
existing black-hole seam work, generalized to the whole film.

- **ACT I — THE SIGNAL** *(who is this)*: wake → encounter → voice.
- **ACT II — THE CANON** *(what is this)*: registry → drift → story → hands.
- **ACT III — THE DEAL** *(it can be yours)*: doors → ritual → artifacts →
  collapse → return.

An **interlude** (a full-viewport title card: one line of enormous Inktrap on
void, a single accent, no UI) separates the acts. An interlude is a **silence
zone**: every ambient system on the page drops to its static frame for the
duration of the card. The existing pre-singularity gap becomes the third,
longest silence — **the void** — with no card at all, just darkening sky.

The effect: the page breathes in 12+2 beats instead of 12 same-sized beats.
Drama comes from the *difference* between beats, not the intensity of each.

## 2.2 Color theory overhaul

The palette stays; its **use** is rationed from "utility palette" to
"choreographed lighting."

**House colors (unchanged tokens):** void `#05050a`, bone `#f5f3ff`, iris
`#8a4dff`, cyan `#3fe8ff`, magenta `#ff3d9a`, gold `#ffc857`, ember (BH
config-derived).

**New law — one accent per act:**

| Act | Foreground accent | Rationale |
|---|---|---|
| I — Signal | **Cyan** (system intelligence; the signal that wakes) | cold, waking |
| II — Canon | **Bone + the art's own colors** (no forced UI accent; art plates supply hue) | the canon is *content*, not interface |
| III — Deal | **Gold** (ownership, rarity, value) | warm, transactional, luxurious |
| Coda | **Ember + spectral violet** (already the BH district) | collapse |

Concrete consequences:

1. **The tri-gradient is demoted to exactly three sanctioned sites:** the hero
   "CANON./VERSIONS." lines, the loader morph, the sign-off title. Everywhere
   else `txt-grad` becomes **solid bone**, with the act accent reserved for a
   single word per section. This is the single highest-impact color edit on the
   site: it instantly stops every section looking like the same template.
2. **Chrome desaturates.** Side-rail/console, progress, hairlines, cursor glow
   move from saturated cyan to a 60% desaturated cool tone (`--chrome` token).
   Accent is a *narrative* resource, not a UI default.
3. **Art and UI finally share a temperature.** Universe/artist plates get a
   consistent editorial grade (subtle duotone veil + shared shadow light at
   ~30° warm) so the screenprint reds and the painterly warms sit inside the
   void instead of clashing with cyan chrome. Rarity colors stay — they are
   *data* — but only appear on data surfaces (chips, badges, dialog specs).
4. **Scene districts stay** (they are the right tool) and gain **act-level
   temperature anchors**: I cool-cyan, II neutral-bone, III warm-gold — the
   existing per-district fields are re-tuned around these three poles. The
   background will now visibly *warm up as the deal approaches*, which the
   narrative has never said before.

## 2.3 Typography pairing — from inventory to editorial use

The five families are all strong; the redesign changes **scale and placement**,
not the faces.

| Voice | Face | New role |
|---|---|---|
| **Intertitle** | PP Neue Machina **Inktrap** (ss01) | Act cards at `clamp(4rem, 14vw, 16rem)`; the sign-off title; the loader. Inktrap's ink-trap alternates are finally *used* as a feature, not a fallback. |
| **Display** | Inktrap / Plain (ss02) | Section titles — **one per section, no ghost numeral, no kicker** (see §4.4). Size discipline: H2s drop one notch (`--fs-h2` retune) so the intertitles and the sign-off own the top of the scale. |
| **Editorial** | PP Neue **Montreal Text** | A first-class reading layer for the first time: two-column lore prose (`measure ~62ch`), drop cap on the first lore paragraph, artist pull-quotes at 2.4rem, pull-note callouts in the store. This is the "plain" the user sees — replaced by real editorial surfaces. |
| **Data** | Space Grotesk | Unchanged: coordinates, counters, dates, specs. Gains an **oversized-numeral** mode for lore stats (28vw single number, no tile) — stat tiles die. |
| **Serif accent** | — | **Michroma is removed** (zero rendered uses; pure bundle weight). No replacement needed. |

**Typographic rule per section:** one dominant gesture (a line, a number, an
image) + one reading layer + one data layer. Never more than one of each
simultaneously visible.

## 2.4 Motion philosophy — *One Take* rules

1. **Physical, not decorative.** Inertia, gravity, material response — the
   existing spring registry stays the vocabulary.
2. **Contrast over intensity.** Each act has a *default entrance family* so
   beats differ: Act I — **rise & focus** (opacity + 24px + blur 6→0, the
   current Reveal, now the *quietest* family); Act II — **unfold** (clip-path
   line-mask reveals for titles, plates scaling from a center fold); Act III —
   **settle** (overshoot scale 1.02→1 + elevation bloom landing, the
   "heavy object placed" feel). Same expo-out curves, three personalities.
3. **Silence zones.** Interludes + the pre-singularity void: starfield dims to
   0, grain holds one frame, marquees pause, ambience freezes, cursor glow
   collapses to the dot. Implemented as a single `stillness` flag in the
   scene system (§5.2). This is what makes the next impact land.
4. **Chapter transitions.** At each act boundary, a 600–700 ms **fog bank** —
   a soft light bloom crossing the viewport (shader uniform sweep on the
   existing ambience quad, CSS gradient fallback), timed to the scene change.
   No wipes, no page cuts: the take never breaks.
5. **Velocity stays a language.** The roster's yank→pendulum→rod-ring chain is
   the model: input force = visual consequence. New interactions must justify
   their motion the same way; decorative loops are cut (see §4.3, §4.11).
6. **Reduced-motion contract per feature:** every new effect ships with a
   named static state (the interlude is already static; the fog becomes a
   crossfade; stillness is simply… the whole page). The axe + visual gates
   cover the rest.

## 2.5 Atmosphere & lighting

- **One light logic:** each act has a key light direction. I — light from
  above-right (the portal ring). II — museum overhead (single source, plates
  catch it). III — low warm key (gold ingress, already hinted by the `vault`
  district). Card/plate shadows and sheens retune per act via tokens, so the
  *lighting* changes even when the geometry doesn't.
- **Depth as a value:** the hero gets true parallax layers (art planes vs.
  foreground type vs. background spores); interludes get a faint depth-of-field
  vignette; the rotunda enters from black.
- **Grain** stays but its intensity becomes scene-aware (lower in Act III,
  highest in the void).

---

# 3. Structural & Layout Redesign

## 3.1 The new scroll order (a major re-order — flagged F6)

| # | Now | Then | Chapter |
|---|---|---|---|
| 0 | Loader | Loader (unchanged) | Wake |
| 1 | Hero (particle field + 9 UI elements) | **The Poster** — key art, 5 elements | Encounter |
| 2 | Marquee (announcement strip) | *deleted* (F3) | — |
| 3 | Nemoverse roster | Persona — **moved up** | The Voice |
| 4 | Rotunda | Nemoverse roster | The Registry |
| 5 | Persona | Rotunda | The Drift |
| 6 | Perks | **Lore** — moved up | The Canon |
| 7 | Pulls | **Artists** — moved up | The Hands |
| 8 | Store | *Interlude I* — "ONE CANON. INFINITE VERSIONS." | (silence) |
| 9 | Artists | Perks | First Doors |
| 10 | Lore | Pulls | The Ritual |
| 11 | Crawl | Store | Artifacts |
| 12 | Singularity | *Interlude II* — "HOLDERS CROSS FIRST." | (silence) |
| 13 | Sign-off + footer | Crawl → **The Void** (long still) → Singularity → Sign-off + footer | Collapse → Return |

Rationale: **character → myth → deal.** The persona speaks in Act I so the
audience knows *who* before seeing the product. Lore and Artists — the
emotional core — sit in Act II's center instead of being buried at 8/12. All
commerce sits in Act III after the second intertitle's promise. The crawl,
void, and singularity keep their existing tested mechanics; only their
*preparation* changes.

Nav links, anchor ids, and `SECTION_SCENE` mappings update with the re-order
(chrome work, no feature loss).

## 3.2 Per-section redesign

### 3.2.1 Loader — "Wake" *(enhancement, non-destructive)*
Keep the morph (it is a signature). Changes: the percentage counter's final
frame hands its residual energy to the hero — the morph target's glow becomes
the hero's first ambient light (one shared uniform), and the skip key stays.
Under reduced motion: unchanged instant-land.

### 3.2.2 Hero — "The Poster" *(destructive F1, F2)*
- **The key art is the hero.** `hero.jpg` (already served as 1672px AVIF)
  full-bleed, slow scale/pan (Ken Burns ~1.12→1.18 over the first 100vh),
  with the existing particle field re-scoped as **low-density foreground
  spores** drifting in front of the figure — the field shrinks in job, not in
  presence. WebGL fog/vignette pass (CSS fallback) ties the image edge into
  the void.
- **Nine elements → five:**
  1. Title — bottom-left, asymmetric, two lines: `ONE CANON.` (bone) /
     `INFINITE VERSIONS.` (sanctioned tri-gradient). Bigger than today,
     Inktrap, with the per-letter glitch kept only on "VERSIONS."
  2. One lede sentence (Montreal, not tracked-mono).
  3. **One** primary portal CTA ("ENTER THE NEMOVERSE"). The secondary glass
     CTA moves to the roster teaser, where its target lives.
  4. One data line, top-right, mono, single string:
     `EST. 2026 — 09 UNIVERSES — NEXT DROP D-4` (the live countdown survives
     as the only moving part).
  5. Scroll hint (kept, smaller).
- **Deleted (F2):** badge marquee ticker, ASCII separator sub-block, telemetry
  row (its five stats dissolve into the single data line + the roster's own
  stats), orbit rings, and the hero progress bar (the console in §3.2.13 owns
  progress).
- **Exit:** the GSAP title scatter stays; the art **folds** — on scroll the
  image shears/scales into a horizontal band that becomes the top edge of Act
  I's first content (one scrubbed transform, compositor-only).

### 3.2.3 Persona — "The Voice" *(moved + re-composed)*
- Act I, screen 3: the first interactive moment on the page. The 3D point-model
  stage keeps its lazy-load + error-boundary contracts.
- Composition inverts: **model large and centered-left in dark; the chat is a
  small transmission panel bottom-right** — the character is the subject, the
  chat is how you reach him. Support copy shrinks to one line; the "BUILT ON
  THE CLAUDE API" disclaimer becomes a footnote micro-label (demo honesty kept,
  visual weight cut 70%).
- New restraint: the cursor's x-position subtly biases the model's attention
  (a single uniform, disabled under reduced motion/coarse pointer) — the
  archive noticing the visitor.

### 3.2.4 Nemoverse — "The Registry" *(composition change, physics sacred)*
- **The rod and the pendulums stay exactly as built.**
- The rail becomes an **exhibition**, not a rack: cards at varied cord lengths
  with **scale variance** (U-000 The Wanderer and the drop-teaser hang larger
  as bookends; commons sit at 0.86 scale) so the eye travels a composed line
  instead of a uniform grid.
- **Card quieting:** at rest a universe card is *art + code only* (U-001, name
  in small type). Lore line, rarity badge, price, claim CTA all defer to hover
  / focus (and to the dialog). This removes the densest repeating pattern on
  the page (10 identical card faces) without deleting any data.
- Filters/sort/minimap stay but demote to a thin **control strip** above the
  rod (they are tools, not the show).
- **Dialog → plate inspection:** the dialog restyles to full-bleed art on the
  left, annotation column on the right (lore as prose, specs as data table,
  claim CTA visually subordinate). All existing behaviors (scroll lock, focus
  trap, revenue split, variants) unchanged.
- Mobile rack: same quieting; physics unchanged.

### 3.2.5 Rotunda — "The Drift" *(museum entry, non-destructive)*
- The sphere stays (component untouched). New **entry choreography**: the stage
  opens from black — a single overhead light eases in as the section crosses
  the fold (stage opacity + ambience), and auto-rotation starts *after* the
  light lands (1.5 s of stillness = contemplation before play).
- The three count badges demote to one data line. The flat/reduced-motion list
  is unchanged.

### 3.2.6 Lore — "The Canon" *(editorial rebuild — the plainest section, most upside)*
- Becomes the site's **editorial spread**: two-column Montreal Text prose
  (~62ch), **drop cap** on paragraph one, the three `hl` spans become real
  pull-emphasis (size, not color).
- **Stat tiles die (F7):** the four `lorestat` cards become **oversized bare
  numerals** in the prose gutter (Space Grotesk, ~7vw, tabular) with one-line
  captions — numbers embedded in the story, not dashboarded beside it. The
  live countdown survives as one of them.
- The **drilling-rod timeline stays untouched** — it is the section's spine and
  the last thing before the void. Its "U-007 — THE LAST AURORA" end-node now
  visually *loses cohesion* into the void that follows (nodes' edges blur as
  the void gap opens — a 300 ms crossfade, static under reduced motion).

### 3.2.7 Artists — "The Hands" *(editorial, mostly non-destructive)*
- The credit rod stays. **Quotes are enlarged to 2.4rem Montreal italic** as
  the plate's dominant element; metadata (handle, canon codes) demotes to
  micro-labels. Gold appears here for the first time in Act II as a
  *provenance* accent (the collar's rim), not a CTA color.
- The section is where the film becomes human after the technology of the
  registry — spacing widens, motion slows (entrance durations ×1.4).

### 3.2.8 Interludes I & II *(new — flagged F4)*
Two full-viewport title cards:
- **I:** `ONE CANON.` / `INFINITE VERSIONS.` (Inktrap 14vw, bone, cyan act
  accent on the period only) — between Act II and Act III.
- **II:** `HOLDERS CROSS FIRST.` (gold period) — between lore/timeline and the
  commerce act, immediately after the crawl.
- Each: one line, one accent, no links, no chrome. **Silence zone** (§2.4.3).
  Scroll duration ~120vh of pinned stillness (the take pauses).
- Accessibility: real `<h2>` per interlude so the heading ladder stays intact.

### 3.2.9 Perks — "First Doors" *(destructive F8)*
- The four identical tier cards become a **vertical access ladder**: one column
  of four rungs (Genesis → Legendary) hanging off a single gold thread, each
  rung revealing as it crosses the fold (Act III settle entrance). Rung face:
  tier name large, three benefits in prose (not bullets), the early-access
  window as a big numeral.
- The verification row stays and becomes the act's climax: the "VERIFIED
  HOLDER" confirmation is staged as a system stamp (one-shot light + stamp
  press sound, existing audio system) rather than a badge that simply appears.
- All tier data, gating, and wallet behavior unchanged.

### 3.2.10 Pulls — "The Ritual" *(destructive F9)*
- The dashboard hides behind the ritual. Rest state: **one sealed fragment**
  center-stage (the liquid-pull button is its seal), the stamp ledger below as
  a physical ledger card, and the particle field dimmed to embers.
- **Probability nodes, liquid gauges, frequency line, radar grid, wireframe
  globe — all remain implemented** but live behind a single `PROBABILITY /
  ODDS` disclosure (a quiet data panel that slides open), satisfying the
  "system rules accessible" requirement without putting a control room on the
  cover.
- **The pull moment is full-viewport:** on pull, the section chrome fades, the
  reveal plate takes the center of the screen (existing RevealPlate, restaged),
  rarity light floods the scene district for 2 s, then everything settles
  back. Crescendo + cooldown, as a ritual demands.
- All engine logic (`usePullEngine`, pity, set bonus, persistence) untouched.

### 3.2.11 Store — "Artifacts" *(visual restructuring F10)*
- One **featured artifact** (the existing hero product, larger, art-bleed to
  the viewport edge) + the rest as **catalog plates** stacked with varying
  scale and offset — no identical-card grid. Each plate: image + name + price
  + one annotation line; holder-gating stays as the gold "HOLDER SKU" tag.
- Product images receive the same editorial grade as the universe plates
  (§2.2.3) so the store finally shares the film's lighting.
- All wallet/pricing/gating/toast behavior unchanged.

### 3.2.12 Singularity + Void + Sign-off + Footer *(protected; approach only)*
- **Mechanics untouched** (black hole, horizon consumption, curtain).
- New preparation: after the crawl, **the void** — the existing `--gap-l`
  expanded to ~60vh of pure stillness (starfield → 0, ambience → `abyss`,
  vignette closes to 0.9) before the hole's first warm frame. The take holds
  its breath exactly once before the climax.
- Sign-off copy: "ENTER THE NEMOVERSE." stays (it is the loop's promise); the
  footer's "PILLAR"-free rewrite comes from the copy pass (§3.2.13).

### 3.2.13 Chrome — the Console *(consolidation, flagged F5)*
Nine always-on systems → **four**:
1. **Cursor** (dot + glow + label) — kept; label vocabulary trimmed from 11 to
   7 (DRAG/RELEASE, ENTER, PULL, NUDGE, LOOK INTO IT, SPIN, NEMO SEES YOU).
2. **Ambience** (scene districts + new act anchors + stillness flag).
3. **Grain** (scene-aware intensity).
4. **The Console** — a single thin left-edge instrument replacing SideRail +
   ScrollProgress + (relocated) SoundToggle: three act-marks that light as the
   film progresses, a 1px progress filament running the edge, and the sound
   state as a tiny glyph. It appears on scroll velocity and **fades to 40%**
   at rest (the chrome breathes with the take). Hidden entirely on touch.
- **Deleted (F3):** the hero badge marquee, the announcement marquee strip
  (its content — drop date, holder priority, cadence — lives on in the hero
  data line, the teaser card, and the lore). The credits crawl (110 s) stays —
  it is the film's end credits, not a UI marquee.
- VelocityFX folds into the console's filament (velocity makes the filament
  pulse, instead of a separate layer).

### 3.2.14 Copy pass *(destructive F11 — display copy only)*
Every on-page string audited; the pitch-deck layer is removed from the
audience-facing surface:

| Now | Then |
|---|---|
| `01 · THE ANCHOR FEATURE` | (kicker removed) — title: `The Registry` |
| `03 · PILLAR 4 — THE AI PERSONA` | — `The Voice` |
| `04 · PILLAR 2 — TOKEN-GATED PERKS` | — `First Doors` |
| `05 · PILLAR 3 — PROOF-OF-PURCHASE COLLECTIBLES` | — `The Ritual` |
| `06 · DIRECT SHOPIFY INTEGRATION` | — `Artifacts` |
| `THE CORE IDENTITY` / `Who is NEMO?` | kept (this one works) |
| footer `THE BASE / 06`, `NEMOVERSE PROTOCOL v0.1.0` | `ONE CANON · INFINITE VERSIONS` + `© 2026 THE NEMOVERSE` |

Functional strings (buttons, aria-labels, toasts, demo disclaimers) are
preserved or minimally rephrased; `lib/data.ts` copy fields are edited in
place so every consumer (dialog, crawl, footer) updates from one source. The
demo-honesty lines (mock wallet, demo catalog, canned brain) **stay** —
honesty is part of the brand, only their visual weight drops.

---

# 4. Technical & Interaction Stack

## 4.1 No new frameworks, no new heavy dependencies

| Layer | Tool | Role (unchanged authority) |
|---|---|---|
| Scroll | **Lenis** (existing) | The only scroller; all new pins ride it |
| Scroll choreography | **GSAP + ScrollTrigger** (existing) | Interlude pins, hero fold, fog timing, stillness scheduling |
| Component state | **Framer Motion** (existing) | Reveal grammar, card/dialog/ledger springs |
| Rendering | **Three.js WebGL** (existing build) | Hero spores, pulls field, ambience quad |
| Climax | **Three WebGPU/TSL** (vendored, untouched) | Black hole |
| New code | ~small TS modules + scoped CSS only | §4.2–§4.4 |

**Budget contract:** the 662 kB eager-JS ratchet is a hard gate for every
milestone. The hero change is net *negative* (key art AVIF replaces a dense
particle field at the fold; spores reuse the existing field at lower
resolution). No new fonts, no new textures beyond existing AVIFs. The Michroma
removal is a small positive.

## 4.2 New module: `lib/chapters.ts` — the Chapter Director

One small authority (a `useChapters()` hook + an effect on the existing
scene observer) that publishes, per scroll position:

- current **act** (I/II/III/coda) and **chapter** id,
- the act's **accent token** and **entrance family** (consumed by the reveal
  grammar),
- **stillness** boolean (interludes + void),
- **fog** event at act boundaries (a single GSAP timeline sweeping the
  ambience uniform + a CSS gradient fallback for no-WebGL).

It reuses `observeScenes`' center-band IntersectionObserver — no new observer
machinery, no new rAF loop (the GSAP ticker already owns cadence). All existing
district logic stays; the director is a *reader* of the same section ids, so
the two cannot drift.

## 4.3 Reveal grammar v2

`<Reveal>` keeps its API (so migration is mechanical) and gains an `act`
prop that selects the entrance family (§2.4.2). A **title mask** primitive
(line-clip reveal for Intertrap lines) is added alongside. Everything
compositor-safe (transform/opacity/clip-path only), per the existing
framer-owns-transform rule in `motion.css`. The old blur-in is **Act I's**
family and the quietest of the three; no card on the site may use two
families in one section.

## 4.4 Statics & accessibility

- Every new feature ships a named reduced-motion static (documented in the
  feature's file header, matching repo convention).
- Interludes are real sections with `<h2>`; the heading ladder (hero h1 →
  interlude h2 → section h2/h3) is verified by the axe gate.
- Focus: the pulls disclosure and the console get standard focus management;
  the console is `aria-hidden` chrome (its information — act position — is
  already in the nav).
- Keyboard-only path: all moved sections keep their anchors and scroll-spies.

## 4.5 Performance controls (inherited + new)

- Inherited: IntersectionObserver off-screen pausing, DPR caps, WebGPU
  feature detection, scroll locks, lazy 3D, no autoplay audio, transform/
  opacity-only continuous motion, build + ratchet gates.
- New: **spore density tiers** (spores count scales with device memory /
  pointer type), **stillness as a budget** — silence zones are also GPU
  cooldowns (the page idles exactly where the film is quiet), and the
  fog sweep is a uniform animation (zero layout, zero paint beyond the quad).
- Mobile: interludes render as short (40vh) stills; the console is hidden;
  the pulls full-viewport moment becomes a full-*width* moment; all
  re-orders re-verified at 390px.

## 4.6 Asset strategy

- **Use what exists:** `hero.jpg` (1672w AVIF) becomes the hero; no new
  downloads for any milestone except optional re-crops of existing plates.
- Interludes and the void are **CSS-only** (tokens + fog), zero assets.
- If the art brief later demands new key frames, they enter through the
  existing `generate-art-variants.sh` AVIF/LQIP pipeline and the budget gate.

---

# 5. Incremental Execution Roadmap

Each milestone is a **visually shippable state**: ends with `npm run build`
green, axe green, visual-regression re-baselined for that milestone, and the
budget ratchet green. Milestones are committed individually so the film can be
reviewed take by take.

### M0 — Lock & baseline *(0 code risk)*
Approve §7 flags; lock the new section order and copy table; capture
before/after screenshot references (1440×900, 390×844, reduced-motion);
record perf baselines. Deliverable: this blueprint v2 marked approved + copy
sheet.

### M1 — Foundation: tokens, materials, act anchors *(low risk)*
Retune `:root`: act accent tokens, `--chrome` desaturated tone, H2 scale
retune, editorial measures; material classes (void/print/glass/metal/light);
scene-district re-anchoring to the three act poles; Michroma removal.
**Visible result:** the site looks calmer and warmer toward the footer with
zero layout changes.

### M2 — Chapter scaffolding *(moderate)*
`lib/chapters.ts` (acts, stillness, fog), the console (replacing side-rail +
progress bar + sound-toggle placement), the two interludes, silence-zone
wiring (starfield/grain/marquee/fog all honor stillness), nav + scene map
re-order.
**Visible result:** the page has a spine — three acts, two breaths, one
instrument.

### M3 — The Poster *(moderate; F1, F2)*
Hero key-art composition, spores re-scope, element reduction, data line,
single CTA, the fold-exit.
**Visible result:** a first impression that looks like a film poster, not a
SaaS hero.

### M4 — Act I complete *(moderate)*
Persona move + re-composition, attention bias, chrome cleanup of the new
opening.
**Visible result:** you meet the character before the product.

### M5 — Act II: registry, drift, canon, hands *(high — the core)*
Roster exhibition composition + card quieting + dialog restyle; rotunda
museum entry; Lore editorial spread + numeral mode + node-to-void handoff;
Artists quote enlargement.
**Visible result:** the middle of the film is the best part.

### M6 — Act III: doors, ritual, artifacts *(moderate–high)*
Perks ladder + verification stamp; Pulls ritual restage + odds disclosure +
full-viewport pull; Store artifact catalog + image grade.
**Visible result:** commerce as ceremony, with every engine behavior intact.

### M7 — The ending *(high — protected territory, surgical only)*
The void, crawl placement, singularity approach tuning, sign-off/footer copy.
**No changes** to `SignoffHorizon`, `BlackHoleStage`, curtain, or their tests.
**Visible result:** the climax is earned.

### M8 — Hardening & validation *(low risk, high care)*
Full gate pass: tsc build, unit, axe (both viewports), visual-regression
final baseline, budget ratchet; device matrix (desktop/tablet/phone, touch,
coarse, reduced-motion, no-WebGL, no-WebGPU, keyboard-only); frame-timing spot
check on the three WebGL stages; final copy proof.
**Deliverable:** the finished film, gated.

**Rollout note:** because the re-order (F6) is structural, M2 carries the
re-order; M3–M7 then work in the *new* order. If F6 is rejected, M2 inserts
interludes + console at current seams instead and M4/M5 swap scope — the
milestone boundaries themselves are unaffected.

---

# 6. Success Criteria

1. **No repeated gesture:** zero verbatim-repeated header compositions; each
   of the 12 content sections has a distinct dominant gesture (auditable by
   screenshot grid).
2. **Silence is measurable:** 3 still zones exist (2 interludes + void) where
   a DOM-audit shows continuous animations at 0 (reduced motion) / 1 (grain,
   paused).
3. **One accent per act:** token audit — no section uses two act accents; the
   tri-gradient appears in exactly 3 places (loader, hero, sign-off).
4. **Hero restraint:** ≤ 5 interactive/visible UI elements in first viewport.
5. **No pitch language on-page:** grep gate for `PILLAR`, `INTEGRATION`,
   `ANCHOR FEATURE` returns zero audience-facing matches.
6. **Editorial layer exists:** ≥ 62ch two-column prose with drop cap; ≥ 2
   oversized numerals; ≥ 1 pull quote.
7. **Protected subsystems untouched:** black-hole, horizon, curtain, roster
   physics, sphere, scroll authority — diff shows styling-only changes around
   them.
8. **All gates green:** tsc, unit, axe (0 violations, both viewports),
   visual-regression (re-baselined), budget ≤ 662 kB eager gzip.
9. **The test:** a first-time visitor can describe the page in one sentence
   ("it felt like a film about a character, then a deal") and cannot name a
   moment where two sections looked like the same template.

---

# 7. Destructive / Major Structural Changes — REQUIRES APPROVAL

Each item below is flagged per protocol. My recommendation is marked; approve
as a group or individually.

| # | Change | What dies/changes | Recommendation |
|---|---|---|---|
| **F1** | **Hero background swap** — WebGL particle field hero → key-art "Poster" hero. The particle field survives as low-density foreground spores. | The current hero backdrop system (largest first-view GPU cost) | **Approve** — highest-impact change on the site |
| **F2** | **Hero element cut** — remove badge marquee, ASCII sub-block, telemetry row, orbit rings, hero progress bar; 9 elements → 5 | 5 hero UI elements (all decorative; data survives in the single data line + roster) | **Approve** |
| **F3** | **Delete the announcement marquee** between hero and roster (and the hero's ticker). Credits crawl stays. | 2 of 3 marquees; their 5 strings are re-homed (hero data line, teaser card, lore) | **Approve** |
| **F4** | **Two new full-viewport interludes** + the void — new sections in the scroll order | Adds ~160vh of pinned stillness to the scroll length | **Approve** — this is the core of the direction |
| **F5** | **Chrome consolidation** — SideRail + ScrollProgress + SoundToggle + VelocityFX merged into the Console; 11 cursor labels → 7 | 3–4 standing chrome systems (features retained, presentation unified) | **Approve** |
| **F6** | **Section re-order** — Persona → #3, Lore → #6, Artists → #7, commerce → Act III (see §3.1 table) | The current scroll order; nav + scene maps update | **Approve** — narrative logic demands it; rejectable in isolation, in which case M2 adapts |
| **F7** | **Lore stat tiles → bare numerals** — the four `lorestat` cards are removed as cards | 4 card elements (data and live countdown preserved) | **Approve** |
| **F8** | **Perks grid → access ladder** — four-card grid replaced by a vertical rung column | The grid layout (all tier data/behavior preserved) | **Approve** |
| **F9** | **Pulls de-dashboard** — gauges/probability/radar/globe fold behind an odds disclosure; rest state becomes the ritual stage | The always-visible control room (all components preserved behind the disclosure) | **Approve** |
| **F10** | **Store grid → artifact catalog** — identical card stack replaced by scaled plates + featured bleed | The 4-card product grid layout (all SKUs, gating, pricing preserved) | **Approve** |
| **F11** | **Copy rewrite** — pitch-deck language purged from all audience-facing strings (kickners, titles, footer protocol line) | Display copy only; functional/aria/demo-disclaimer strings preserved | **Approve** |

**Explicitly NOT proposed** (for the record): any change to the black-hole
simulation, SignoffHorizon mechanics, curtain mechanics, roster physics,
sphere component, Lenis authority, rarity data system, wallet/odds/pity/gating
logic, or any accessibility behavior. No new heavy dependencies. No new
beyond-budget assets.

---

# 8. Awaiting Sign-off

Nothing has been changed except this document. On your reply:

- **"GO AHEAD"** — full blueprint executed as recommended (all F-flags
  approved as a group).
- **"GO AHEAD, except F2, F9"** (or any subset) — execution begins with those
  items deferred; affected milestones adapt as noted in §5.
- **Any change to the direction** — the blueprint is revised before a single
  line of code moves.

> **GO AHEAD**
