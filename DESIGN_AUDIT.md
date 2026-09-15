# THE NEMOVERSE — Design Audit & Awwwards Elevation Roadmap

**Pass:** v3 · 2026-09-15 · audit against the working tree at `36501a4`
**Verdict up front:** this is not a template site. The glyph-morph loader, the pendulum
roster, the WebGPU singularity, the rod furniture system, and the token discipline are
already award-tier *craft*. What separates it from Site of the Day is no longer assets —
it's **scroll authority, input parity, typographic first-paint, and the last 10% of
state feedback**. This audit is evidence-based: every finding cites the file it lives in.

> ## Execution status — 2026-09-15
>
> **P0 and P1 are executed** (this pass). Deltas from the written plan, with reasons:
>
> | Plan said | Shipped | Why |
> | --- | --- | --- |
> | `<link rel="preload">` ×3 in `index.html` | Critical-font **gate inside the loader** (`lib/fonts.ts` awaited by `Loader.tsx`, capped 1.5 s) | src-CSS font assets are content-hashed at build and the site deploys `base:'./'` — a static preload tag 404s in one of the two environments. Gating the handoff removes the swap itself, which is strictly the stronger guarantee. |
> | `size-adjust` fallback faces | Deliberately omitted | The gate makes fallback paint invisible for the critical moment; shipping metric overrides for `local()` families (Arial/Helvetica) can't be measured in this pipeline, and invented numbers would *cause* drift. |
> | fontkit subsetting | `subset-font` (harfbuzz-wasm) via new `scripts/subset-fonts.mjs`, which now **generates `pp-fonts.css` itself** | fontkit's `createSubset().encode()` is a PDF-embedder (emits raw CFF/naive-sfnt, no WOFF2 brotli container). harfbuzz preserves the `ss01–ss03` feature tables the hero uses; every face round-trips through fontkit as a build gate. |
> | `--ink-faint` → `.56` + hairline pass | Token → `rgba(245,243,255,0.56)` (≈6:1 on void) + `--ink-faint-decor` keeps the old value; the 30 mono-family dim labels take the lightness from Space Grotesk's real **300 weight** (`typography.css` micro-label pass) | The micro-label clusters all resolve to `--font-mono` (Grotesk 300–700 axis), not Montreal — so the "lighter, not dimmer" move happens on the variable weight axis, exactly one selector list. |
> | Lenis "desktop only" leaning | Instance runs for all pointers; engine gates itself: wheel smoothing + `respectReducedMotion` (1:1 under reduce), touch stays **native** (1.x default), anchor glide + `pageScrollTo` unified everywhere | One implementation path for hold/lock/scrollTo incl. reduced motion; mobile momentum and every horizontal track are behaviorally untouched. |
> | Refresh-freeze "already partial — unify" | `ScrollTrigger.refreshInit/refresh` → `holdScroll('st-refresh')/releaseScroll` in `lib/scroll.ts` | SignoffHorizon's bespoke `scroll-behavior` save/restore guard becomes vestigial (kept; harmless) and every *other* refresh is protected for free. |
>
> Extra inside P1's spirit: `ScrollProgress` lost its chase-spring (same
> double-smoothing crime as the hero's), the Footer rewind now rides the
> anchor channel instead of a raw `window.scrollTo`, and `#root` goes
> `inert + aria-hidden` for the boot window (scroll keys swallowed; Lenis
> held under key `'boot'` so a stopped engine never banks deltas).
>
> **P2 and P3 are executed** (second pass, same day). Deltas from the
> written plan, with reasons:
>
> | Plan said | Shipped | Why |
> | --- | --- | --- |
> | P2.8 (3.1): plates as a keyboard-operable carousel with per-plate tab stops | The sphere is ONE focusable `region` (`aria-roledescription="3D carousel"`); Arrow L/R step the nearest plate to front via the component's own Z-solve (`rotY = θ_plate − 90°`, shortest-path ease consumed by `updateMomentum` — the same authority loop drag rides), Up/Down tilt, Home/End jump, Enter opens the front plate. Plates are `aria-hidden` chrome; a visually-hidden `<ul>` mirrors all 12 canon plates; under reduced motion the 3D sphere **does not mount** and the plates render as a plain figure grid | The carousel-with-slides pattern (one tab stop) is the ARIA-recommended shape for this furniture; 60 focusable DOM nodes rotating at 60 fps would strand the tab order inside moving content. The mirror list satisfies the crawlable-text requirement identically. |
> | — (found during 3.1) | Touch parity: `touchstart` no longer `preventDefault`s (it was a no-op anyway — React touch handlers are passive), and the non-passive `touchmove` handler claims the gesture only when horizontal-dominant; `touch-action: pan-y` on the sphere. Spotlight is now a real dialog (shared `useFocusTrap`, Escape, `lockPage('sphere-spotlight')`) | The rotunda was hijacking vertical page scroll on Android. Same policy the singularity's canvas documents. |
> | P2.9 (2.2): `animate(scrollY, …, spring)` then `lenis.scrollTo(target, { velocity })` | Release velocity from a 4-sample timestamp window → projected offset → snapped to the card pitch → ONE `pageScrollTo(…, { smooth, duration })` glide through the Lenis authority | Framer's `animate` on scrollY while Lenis also owns scroll is two engines on one property; a projected-then-snapped single tween is the same physics with one authority. Duration scales with travel so slow drags still decelerate. |
> | P2.10 (2.3): replay ≈ 0.9 s | `sessionStorage('ldr-seen')`; replay = count 0.30 s from 82 → beat 0.04 → snap 0.34 (expo curve preserved, compressed) → hold 0.22 → fade overlap ≈ 0.9–1.0 s total. Skip = any `pointerdown`/`keydown` or `wheel ≥ 2` → `tl.progress(1)` (skipped boots still await the font gate) | The snap must survive as a SNAP; proportional compression keeps its character at the promised envelope. Also: the boot inertness moved from `#root` to the loader's siblings (`:scope > :not(.ldr)`) so the loader's new `tabIndex`/`role="status"`/"press any key to skip" affordance is actually reachable. |
> | P3.12 dolly: `camera.position.z = base + progress * 40` | Scale-dolly: post-`camAnim.update`, position × (1 − 0.18·p), progress eased from the host rect inside the existing frame loop | `CameraAnimation` rewrites position absolutely every frame and `OrbitControls` re-baselines from it; a raw z-write would either fight or compound. The multiplicative form is the audit's "±18% mapped to section progress", axis-robust across the whole flythrough, frozen by the same `cameraHoldRef` that freezes the rig. The config stays untouched, as demanded. |
> | P3.12 crawl: "pin the last crawl frame" | `CrawlRise.tsx`: GSAP `scrub: 0.5` against `clip-path: inset(100%→0 top)` + `translateY` — the scrub itself *is* the pin (revealed exactly while the strip owns its viewport position; nothing in flow is pinned) | Pinning a one-line marquee would reflow the page for a reveal effect. Same engine, same channels (clip/transform), no layout cost. |
> | P3.13: layoutId on card + dialog media, rotunda "same trick" | Roster: `layoutId="plate-<id>"` handoff — card plate surrenders the id in the same commit the panel claims it, `handedBack` flips it back on close ⇒ the spring carries the art both ways, ~0.6 s feel. Rotunda: **View Transitions** (the audit's authorized fallback): 60 plates re-render per frame, framer projection across all of them is the "too invasive" case; the clicked plate is named synchronously before the OLD snapshot, the modal (statically named) is the NEW side, UA morphs the box, reduced-motion and no-VT browsers fall back to the plain crossfade | Zero cost at rest for the sphere; the roster keeps the framer version because its media node is static DOM. |
> | P3.14 (1.3): gap scale + bleed + hairline numerals | `--gap-s/m/l: 10/16/26vw` in `global.css`; `.section` rides M (ceiling 13rem); L on exactly the two thresholds (`#singularity` top, `#connect` top); rotunda runs S and bleeds `margin-inline: calc(-1*var(--gutter))`; `.sechead__num` restyled to the literal `1px var(--line-strong)` outline; Lore gained its `07` numeral so every head carries one | The P0 subset ships Inktrap 400/800 only — the "Hairline" cut was a removed face, so the outline treatment IS the hairline effect: 800-weight path, 1px stroke, transparent fill. Numbers ride the existing `--scroll-vel` rotate hook. |
>
> P2.11 shipped complete (`layoutId` markers on Nav **and** SideRail, separate
> ids; `data-cursor` sweep: SPIN/RELEASE/DRAG on the rails, LOOK INTO IT on the
> stage, COLLECT on stamp slots; cursor glow now blooms for every labelled
> surface). The axe gate's `#rotunda` exclusion was removed with P2.8; the debt
> list is empty at both viewports.
>
> **P4 and P5 are executed** (third pass, same day). Deltas from the written
> plan, with reasons:
>
> | Plan said | Shipped | Why |
> | --- | --- | --- |
> | 3.4: extend the two-blip engine with a diegetic map, `sound.ts` registry `{ event: {freq, dur, type, filter} }` | `SOUND` table owns every voice (attract/confirm carried over at their original numbers); `rodRing(speed)` maps |carriage velocity| px/ms through base+perUnit→cap, computed from the same MotionValue `HangingCard` differentiates; `stampThud`/`pullWhoosh` fire at `usePullEngine`'s phase transitions, the thud **before** the reveal frame; the near-miss (secret/legendary one pull before pity) inserts the 2-frame hesitation + rising glissando. Components import zero numbers. | Autoplay policy respected structurally: the toggle click is the only gesture that may create the context; a persisted preference re-arms suspended and starts the bed on the first real pointerdown. |
> | 3.4: gravity swell "updated from the Lenis/scroll channel at 10 Hz, not per-frame; zero cost off-axis" | Gain = f(distance to `#singularity`'s rect), two detuned sines (52/47.3 Hz) inside the 40–60 Hz window; the bed subscribes to a scroll tick **emitted by `lib/scroll`** (the authority stays ignorant of audio; sound owns the subscriber set) and self-throttles at 100 ms. "Zero cost" taken literally: outside `FAR_VH` the oscillators are stopped and nodes disconnected — a single throttled watcher re-arms on return. | A muted-but-running bed is still a running bed. The emit lives on native `window.scroll` so it fires with or without Lenis. |
> | 3.5: `whileTap={{ scale: 0.985 }}` on perk/store/plate cards + bloom at 0.5 | The CSS equivalent under `(pointer: coarse)`: `:active { scale: 0.985 }` + `::after` bloom opacity 0.5 in `motion.css` — `scale` is the independent property, so presses never fight the framer `transform` authority, and the rotunda's sixty hot-path divs needed no motion-component conversion | Same feel, zero JS. The audit's own house rule (independent properties) pointed here. |
> | 3.5: "one util, four call sites" | `lib/haptics.ts` with the audit's exact patterns (8 / [4,24,10] / 6) and the pattern table exported as `HAPTIC` (registry discipline shared with sound); sites: pull stamp, legendary/secret reveal, roster dialog open, rotunda spotlight open. Feature-detect is `'vibrate' in navigator`, which is iOS-honest by construction. | — |
> | 1.4: "expose `--scene-bg`/`--scene-line` custom properties that Ambience writes to `html` per district" | `SCENE_TINTS` map in `scenes.ts`, written by `observeScenes.apply()` — the call that already stamps `data-scene` and feeds the shader — so the CSS shell, the WebGL ambience and the no-WebGL fallback cannot drift: one scene authority, three renderers. `body` rides `--scene-bg` on a 1.6 s linear ease; card hairlines ride `--scene-line`; reduced motion kills the transitions. | Writing inside Ambience itself would leave the no-WebGL path untinted. Values are temperature leans of the existing palette (the `--bh-*` hexes for navy/ember) — "do not add new hues" honored literally. |
> | 1.4: luminance steps `--void-2`/`--void-3` for card wells | Added; `background-color` only overrides on `.ucard`/`.card` (void-2) and `.npx__slot`/`#rotunda .cg-stage` (void-3) — the gradient layers stay, the wells gain a navy floor under the white haze instead of more alpha | — |
> | 3.7: `DEMO WALLET` chip, 10 px, gold outline, reset action | `WalletButton`'s connected branch grows the chip beside the address when `onReset` is passed; Nav×2 + Perks pass `wallet.disconnect` (clears `ocu-wallet` — the persisted state the audit named). Hidden under 860 px where the nav keeps one clean CTA; the section-level button still carries it. | — |
> | P5.19: "Lighthouse (mobile, throttled), WebPageTest filmstrip" | Measurement that a sandbox can make HONEST became a permanent gate instead: `scripts/budget.mjs` (`npm run budget`, post-build) parses `dist/index.html`'s eager graph (entry + modulepreload), gzips exactly those assets, hard-fails if `captureSignoff`/`html2canvas` ever enter it, and ratchets total eager JS at the measured 643 kB +3%. Lighthouse numbers from a sandboxed CPU would be theater — the payload graph is reproducible, so that is what is pinned. | Measured at 2026-09-15: framework 47 + animation 53 + entry 175 + webgl 186 + webgpu 182 (kB gz). Both three chunks ARE eager by the README's documented, accepted trade; the budget encodes THAT policy rather than inventing a new one, and the ratchet is where future P5 gains register. |
> | P5.19: "move html2canvas behind a dynamic import at the exact moment the signoff plate enters the second viewport, not merely idle" | Verified already true in this tree, to the letter: `captureSignoff.ts` (which statically pulls html2canvas) is imported at exactly one site — inside `SignoffHorizon`'s `arm()`, behind ScrollTrigger id `signoff-horizon-arm`, armed at `bottom bottom+=4·seam` (~1.3 viewports of lead at 1280×900, per the measured 641 px seam) — and the build keeps it a 205 kB lazy island. The budget gate now guards the property against regression. | The `arm` line's comment argues the lead distance is load-bearing for fast flings; re-tuning it to a literal viewport count would trade a real race for a wording match. Roadmap outcome kept, mechanism left standing. |
> | P5.20: "consider a motion-safe Playwright visual-regression suite" | Shipped: `tests/visual-regression.spec.ts` (8 cases — hero, roster head, rotunda flat (proves P2.1's reduce branch), pulls idle, store, dialog open, footer, plus a boot-skip assertion), extending the signoff-horizon pattern: determinism by frozen `Date.now`/seeded `Math.random`/`getAnimations().pause()` after a settle wait, under `reducedMotion: 'reduce'`. Deliberately NOT `page.clock` — the clock API fakes rAF too and would strand every entrance mid-tween; deliberately NOT the 3D interiors — engine behaviour already belongs to the fixture suites. Baselines seed on CI with `--update-snapshots`; `npm run test:visual`. | The boot-skip affordance shipped in P2.10 is what makes deterministic entry possible at all — the suite is the first consumer of that. |
>
> **P6 is executed** (fourth pass, same day) — a verification pass, not a
> roadmap phase. The gates below were all run against a real Chromium, and
> the point is that P0–P5 shipped with **three regressions the gates caught
> and one the gates could not**: `npm run test:a11y` was RED on `main`
> (contradicting the P2 note that "the debt list is empty at both
> viewports"), the store's featured product rendered no image, and POP Pulls'
> decorative chips sat on top of its own copy.
>
> | Finding | Shipped | Why |
> | --- | --- | --- |
> | `aria-progressbar-name` (serious) on `.npx__progress-track` and `aria-prohibited-attr` (serious) on `.roster__progress` — **both viewports** | Named the stamp ledger's track (`aria-valuemin` added too) and gave the roster bar `role="progressbar"` with its already-visible percentage as the value | A `div` has no role to name, and a progressbar needs a name as well as values. The roster's number was already on screen — it just wasn't the accessible value. |
> | `color-contrast` (serious) on the rotunda's iris badge — 4.01:1 at 10.5px | `.cg__badge` paints its label in `color-mix(in srgb, var(--c) 50%, var(--ink))` | The base `.badge` paints text in the raw accent; on the badge's own 12% tint, `#8a4dff` fails AA. Mixing toward ink keeps the hue legible while the dot/border/glow keep the pure accent. |
> | Store hero: **no image at all** | Removed the inline `position: relative` on the media box; the hero's bottom-anchored copy now holds AA over bright art; the 2-line name clamp is released for the featured card | The inline style beat `.store__hero .product__media { position: absolute; inset: 0 }`, so the media box was 0×0 and the `<img>` laid out inside it — loaded, correct `naturalWidth`, invisible. Flattening the hero to one row also fixed `align-items: flex-end` mis-anchoring the copy on the inherited *column* axis (it aligned horizontally, at the top). |
> | POP Pulls: three "floating holo chips" over real content | Chips are a real flex row below the stage (float animation and reduced-motion branch kept) | `.is-b` landed on the stamp ledger's "NEXT PULL / LANDS HERE" and `.is-c` on the Golden Gate copy — the stage box is not the visible plate's box, because the tilt and the stamp card overflow it. Nothing can be covered now, at any width. |
> | Roster bottom line: three overlaps | `.roster__counter` clears the fixed SOUND toggle via a fixed floor, `.roster__hint` centred in the dead space between counter and arrows | "SCROLL TO TRAVERSE" was cut in half by the toggle; "HORIZONTAL DRIFT →" sat under the arrow buttons. The toggles are fixed-size elements, so the counter's clearance is a fixed length, not a multiple of the gutter. |
> | Six section numerals contradicted their own kickers (`04` in the pull simulator, `05` in the store, `02` in the persona, …) while `07` appeared twice | Renumbered to scroll order: `03` persona, `04` perks, `05` pulls, `06` store, `07` artists, `08` lore | Each head printed a different number from the kicker immediately above it. |
> | Canon counts drifted from the data layer — hero "Seven registered universes" (8), Lore "7 / 7 / 1050", persona "seven … two" | Counts and the "two that don't want to be known" tally derive from `UNIVERSES`/`visibleUniverses`/`ARTISTS`; `--cyan`/`--iris`/`--gold` replace the raw hexes the badge and persona already used | The registry above the hero lede already read 9/1151/815 from the same arrays. |
> | The drop date was in the past, so the page argued with itself: "U-007 IS LIVE · NOW MINTING" beside "NEXT DROP · 6D", Lore's *hardcoded* `6D`, U-007 still `upcoming · 0/100`, and the persona speaking the old date | The drop clock **rolls** (`data.ts`): canon date while it is ahead, then four days out. One `useCountdown` in `Lore` feeds the flagged `NEXT DROP` tile; `DROP_LABEL_LONG` carries the persona's prose | A demo cannot hardcode a date — the moment it passes, the ticker, the teaser, the dialog and the lore tiles stop agreeing. Pinning a real launch date is now a one-line edit. |
> | Scrollspy kept the last section lit (nav read `07 ARTISTS` at the top of the page) | `useScrollspy` and `SideRail` clear the active id when nothing is in the band | A stale highlight is a wrong reading of where you are. |
> | Four perk tier cards ragged by 46px (231 / 185 / 217 / 239) | `.perks__grid` stretches and the `Reveal` wrapper passes its height to `.perk` | Each card is wrapped in a motion div, so the grid item was the *wrapper* — it stretched while the card sized to its own content, which is the one thing a comparability row must not do. |
> | No-WebGL notice centred behind the hero headline | Parked at the foot of the field as a glass chip | `z-index: 10` inside the field still loses to the hero content, so honest copy rendered as smudged type under the title. |
> | Store: two overlapping badges on gated SKUs at phone widths | A gated SKU shows only its gated chip; the kind badge is capped and ellipsised | A gated SKU's `kind` already reads "HOLDER-EXCLUSIVE SKU" — the same fact printed twice, and the two chips collided on their shared 10px row. |
> | `useRevealText` / `useScrollProgress` / `useSectionReveal` / `useParallax` — zero references; `RarityBadge` never rendered; `small ? 'badge' : 'badge'`; `.replace(' ', ' ')`; a local `DROP_LABEL` duplicating the exported one; `<div className="scrim" />` with no rule | Deleted / unified | `useScrollProgress` was also the double-smoothing wrapper P1 had already banned. |
>
> Verified: `tsc -b` clean · `npm run build` clean · 74/74 unit · **a11y
> green at 1280×900 and 390×844** · signoff-horizon green · visual-regression
> green (8/8 on a re-run against seeded baselines — the page renders
> deterministically). Every layout fix was confirmed by measuring the real
> boxes in Chromium, not by eye: a full-section text-overlap scan now returns
> only decorative giant type and one-line-box bleed.
>
> **The roadmap is now executed end-to-end (P0–P6).** Remaining open items
> are exactly the two the roadmap itself left conditional: real-lab
> Lighthouse/filmstrip numbers to drive the ratchet down (P5.19's measuring
> half), and any *new* surfaces earning their own cursor labels.

---

## Verified baseline (do not regress)

| System | Where | Status |
| --- | --- | --- |
| Boot morph (Machina outlines → vector character, build-baked) | `components/Loader.tsx`, `lib/nemoMorph.ts` | Excellent |
| Semantic type tokens (5 roles, legacy aliases) | `styles/global.css` | Excellent |
| Pinned horizontal roster + underdamped pendulum cards | `sections/Nemoverse.tsx`, `components/HangingCard.tsx` | Excellent |
| Rod furniture (3 rigs, one vocabulary) | `styles/suspension.css` | Excellent |
| WebGPU black hole + graceful degradation + seam | `components/BlackHoleStage.tsx`, `styles/blackhole.css` | Excellent |
| Reduced-motion (36 files), focus-visible, skip link, dialog focus trap | global | Strong |
| Art pipeline (AVIF 540/840/full + LQIP blur-up) | `scripts/generate-art-variants.sh`, `CardImage` | Strong |
| Motion perf policy (framer owns transform; no shadow/gdrift transitions on cards) | README, `motion.css` | Strong |

Measured build (`npm run build`, clean `tsc -b`):
CSS **194.4 kB** (38.5 gzip) · `index` JS **484 kB** (167.6 gzip) · `three` classic chunk
**736 kB** · `three/webgpu` chunk **659 kB** · **25 self-hosted woff2 faces (~1.9 MB on disk)**.

---

## 1 · Aesthetic & Spatial Elevation

### 1.1 · Typography ships 25 faces and preloads zero — the loader exists to show the type, then FOUTs it
`pp-fonts.css` declares 10 Montreal + 6 Plain + 6 Inktrap + 2 Text faces (with full italics),
no `unicode-range`, and `index.html` has **no `<link rel="preload">`**. The boot morph is
build-extracted outlines (no webfont dependency), but the instant the loader hands off,
the H1 — the one moment the whole sequence built toward — renders in fallback and swaps.
Three rules in the entire codebase use italic; ~12 of 25 faces are dead weight in `dist/`.

**Fix (one day, highest-leverage typographic win in the repo):**
1. Preload exactly three faces in `index.html`: `machina-inktrap-ultrabold-normal`,
   `machina-plain-regular-normal`, `montreal-regular-normal` (the roles the hero + nav
   actually paint with), `crossorigin`.
2. Delete the italic cuts of **both Machina families** (display faces are uppercase in
   every consumer); keep one Montreal italic for `<em>`.
3. `fontkit` is already a devDependency — extend `scripts/` to subset the display faces
   to `U+0020-007E + punctuation` (all-caps for Machina). Expect 50 kB → 12–18 kB per face.
4. Declare `size-adjust`/`ascent-override` on the local fallback so swap shifts < 1%.

### 1.2 · `--ink-faint` fails WCAG on the exact text that carries the "technical HUD" aesthetic
`rgba(245,243,255,.38)` on `--void` computes to **≈ 3.2 : 1** — under AA for small text — and
it is applied **38 times across `components.css` + 12 more in the other layers**, almost all of it
at 10–12 px tracked metadata (kickers, specs, card indices). The HUD look is *dim*, not *invisible*.

**Fix:** split the token into `--ink-faint` (bump to `rgba(245,243,255,.56)` ≈ 4.6 : 1) for text,
and a new `--hairline-faint` for decorative uses. Then pair the contrast lift with the thing that
actually buys the "dim" look: letter-spacing is already wide; add optical weight by dropping these
labels to Montreal **Hairline** (a face you ship and barely use) rather than lowering alpha.
Auditing target: 0 text instances below 4.5 : 1; sweep with axe-core in CI (see §4).

### 1.3 · Uniform section grammar flattens the scroll story
Every section follows `shell → SectionHead → grid`. The roster's 420vh pin is the only
structural *event*. On a page of eleven sections, two events read as monotony.

**Fixes, in order of budget:**
- **Vertical dynamic range:** define a section-gap scale in `global.css` —
  `--gap-s: 10vw; --gap-m: 16vw; --gap-l: 26vw` — and *use it unevenly*: `--gap-l` only
  before the Singularity and the Sign-off. Negative space is what makes the black hole land.
- **Bleed the rotunda** (`#rotunda`): the 3D sphere is the only full-viewport object; give it
  `margin-inline: calc(-1 * var(--gutter))` and let plates pass under the nav fade. Grid-breaking
  starts where depth already exists.
- **Editorial layering:** the pinned rail gets a `roster__ghost` watermark; every `SectionHead`
  should get a corresponding oversized `sechead__num` set in Machina Inktrap **Hairline outline**
  (`-webkit-text-stroke: 1px var(--line-strong); color: transparent`), scroll-rotated by the
  existing `--scroll-vel` hook (the mechanism is already in `audit-gaps.css` — extend the selector list).
- **Optical alignment:** tracked-uppercase kickers and card copy need hanging-punctuation:
  `hanging-punctuation: first allow-end` where supported + manual `text-indent: -0.35em` on
  quote/paren starts in dialog lore. Left edges of mixed punctuation currently read ragged.

### 1.4 · Palette depth: the void is one value
`--void: #05050A` is absolute black-ish everywhere; `--abyss` exists but is rarely used.
Luxury dark UIs get depth from *temperature drift*, not from alpha.

**Fix:** promote the existing scene system (`lib/scenes.ts` already has `singularity`/`abyss`
districts for the WebGL ambience) into the CSS shell: expose `--scene-bg` / `--scene-line`
custom properties that `Ambience` writes to `html` per district, so the page background subtly
shifts navy→ember around the black hole and iris→cyan around the persona — the seam treatment
(`blackhole.css`) already proves the technique works locally; globalize it.
Reserve one *non-negotiable* accent surface — gold — exactly as-is: rarity and "money moments"
only. Do not add new hues; add **luminance steps** (`--void-2`, `--void-3` for card wells).

---

## 2 · Motion & Interaction Architecture

### 2.1 · Scroll has six owners and no single authority — adopt Lenis
Current listeners: Nav scroll state, `ScrollProgress`, `VelocityFX`, `useScrollspy`,
Nemoverse mobile carriage, plus framer's `useScroll` (which *also* runs a `useSpring` on the
hero) and GSAP `ScrollTrigger` (drilling rod, SignoffHorizon). Add `html { scroll-behavior: smooth }`
and anchor jumps, and you get **stacked smoothing** — a spring riding on a native inertial
animation riding on separate rAF reads. Trackpad scroll feels mushy; nav anchor jumps and
scrubbed triggers fire on different frames.

**Fix (the single highest-impact motion change):**
```ts
// lib/scroll.ts — one authority
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initScroll() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis; // Nav/ScrollProgress/VelocityFX subscribe to lenis.on('scroll'), not window
}
```
Remove `scroll-behavior: smooth` from `global.css` (Lenis owns anchor easing now; give
`nav__link` clicks `lenis.scrollTo(target, { offset: -var(--nav-h) })`). For framer consumers,
feed `window.scrollY` unchanged — framer reads native position which Lenis animates, so all
`useScroll` scrubs stay valid, but they now share Lenis's frame pacing. Kill the hero's
`useSpring` wrapper (double smoothing — the spring existed to hide native scroll quantization).

### 2.2 · The roster drag dies on release — the one place physics must win
`Nemoverse.tsx` onUp: the dragged offset is solved back into `scrollYProgress` via a bare
`window.scrollTo` — correct handoff, **zero momentum**. The cards are underdamped pendulums
(34–52 stiffness, 5.6–7.1 damping per README) but the carriage that drives them stops dead.
The physics vocabulary breaks exactly where the eye is.

**Fix:** track pointer velocity (last 4 `pointermove` deltas, rAF-windowed), then on release run
a spring on a *motion value that feeds the scroll position*: `animate(scrollY, target + vel*k,
{ type:'spring', stiffness: 90, damping: 20 })` (framer's `animate` imperative API), with
magnetic snap: after inertia decays below ~2 px/f, spring to `nearestCardIndex * cardPitch`.
With Lenis this becomes `lenis.scrollTo(target, { velocity })` in one line. Add the `DRAG`
cursor label + `grabbing` state on the custom cursor (it currently flips only `data-hover`).

### 2.3 · The boot lock is 4.1 s, unconditional, keyboard-permeable, and repeats forever
Loader timeline: 2.15 s count + 0.16 s beat + 0.82 s snap + **1.6 s hold** ≈ 4.1 s minimum, every
visit, no skip. It blocks `wheel`/`touchmove` but not **keyboard** scroll (PageDown/arrows
still drive the page underneath, desyncing ScrollTrigger measurements the comment explicitly
protects). And there is no `sessionStorage` bypass, while wallet/pulls/sound all persist state.

**Fix, three small changes:**
1. `skip()` — any `pointerdown`, `keydown` (Space/PageDown/Escape/arrows) or `wheel ≥ 2` during
   boot jumps the timeline with `tween.progress(1)` and runs `finish()`. Award sites earn
   cinematic by *letting you leave*.
2. `sessionStorage.setItem('ldr-seen','1')` on finish; boot replays in `0.9 s` (count fast-forwards
   from 82, morph keeps its snap) on repeat visits. Keep full skip under reduced motion.
3. During boot add `main, footer, nav { inert: true }`-style blocking: `html.is-booting body
   { overflow: clip }` is not viable (breaks sticky rigs — their comment explains why), so also
   `addEventListener('keydown', blockScroll)` and `.preventDefault()` tab-focus escape
   (the loader wrapper gets `tabIndex={0} aria-label="Loading — press any key to skip"`).

### 2.4 · Scroll-driven timelines to add (all glue-side, nothing vendored)
- **Hero → roster handoff:** scrub the hero's three title lines *apart* (line 1 ←, line 3 →,
  line 2 up, opacity→0) across the first 40vh while the particle field's `hero__bg` scale
  continues — the title literally gets flung into the rail. GSAP timeline, `scrub: 0.6`,
  bound to the same range that currently just fades `contentOpacity`.
- **Singularity dolly:** `BlackHoleStage.tsx` already owns camera orchestration (it starts
  `CameraAnimation` itself). Add a scroll-scrubbed `camera.position.z` offset (±18%) mapped to
  section progress so approaching the hole *pulls you in*; veto under reduced motion. One
  `lenis.on('scroll')` → `camera.position.z = base + progress * 40`. The config stays untouched.
- **Rotunda scroll-coupled spin:** `img-sphere.tsx` has drag + auto-rotate; add a scroll-enter
  impulse (velocity of the section's `scrollYProgress` → angular velocity decay) so the sphere
  "keeps spinning" from being scrolled past — same gust channel the hanging cards already use
  (`gust={pageScroll}` pattern is proven on desktop and mobile).
- **Sign-off crawl:** pin the last crawl frame with a scrubbed `translateY` against `clip-path:
  inset()` so credits *rise out of the void* rather than ending. Mechanism exists in
  `signoff-horizon.css` (GSAP-driven) — extend, don't rebuild.

### 2.5 · Shared-element transitions where DOM already repeats content
The roster card and the dialog show the **same art + code + rarity** — right now that's two
disconnected renders. `framer-motion` is v11: give `UniverseCard`'s media and `UniverseDialog`'s
media the same `layoutId={`plate-${u.id}`}`, open the dialog from `event.target`-anchored state,
and let one 0.6 s expo-spring carry the plate from rail to panel. The card *becomes* the dialog.
Same trick for the rotunda plate spotlight (currently an independent fade). If layout animation
proves too invasive across the hanging-card springs, fall back to the **View Transitions API**
(`startViewTransition` behind feature-detect; swap→crossfade fallback) — zero coupling to either
tree's transform authority.

---

## 3 · UX Craftsmanship & Sensory Polish

### 3.1 · The rotunda is mouse-only — the single worst credibility gap in the app
`img-sphere.tsx`: **zero** `tabIndex`, `role`, `aria`, keyboard handling (verified). The Rotunda is
the canonical "wow" feature; a keyboard user gets a static image they can't operate and an SR user
gets nothing. Awwwards' own jury feedback loop runs on this.

**Fix:** `role="region" aria-roledescription="3D carousel"`, `tabIndex={0}`, `aria-label="Rotunda —
9 universes. Arrow keys rotate, Enter inspects."`; `ArrowLeft/Right` = step one plate to front
(reuse the drag release's snap math), `Enter` = open the plate's spotlight, `Home/End` = first/last.
Mirror plates as a visually-hidden `<ul>` of real links (the roster's hrefs) so the section is
crawlable. Under reduced motion, auto-rotation must stop and plates become a plain list.

### 3.2 · Mobile menu has no Escape, no focus trap, and pops the scrollbar
`Nav.tsx` closes only by ✕/link tap. The dialog got a real trap (`UniverseDialog.tsx` L34–52);
the menu didn't. Both set `body.style.overflow='hidden'` without `scrollbar-gutter: stable` or
padding compensation — ~15 px layout jump on open, on desktop widths where the menu is even
secondary (marginal, but it's visible).

**Fix:** extract the dialog's trap into `useFocusTrap(open)` in `lib/hooks.tsx`, share it with the
menu + rotunda spotlight; add `Escape → close`; globally add `html { scrollbar-gutter: stable }`
and delete the manual padding math forever.

### 3.3 · Countdown live-region spam
The hero badge is `role="status" aria-live="polite"` wrapping a marquee whose text contains
`D-xx H-xx`, re-rendered every second by `useCountdown`. Screen readers will read the counter
constantly. **Fix:** `aria-live="off"` on the visual ticker; place one polite live node with the
static sentence and a second `assertive` one only at `t.done`. 10 lines.

### 3.4 · Sensory map — extend the existing sound engine into a diegetic one
`lib/sound.ts` ships two oscillator blips. The page's metaphors are *metal, gravity, ink*:
- **Rod ring** — on card press while the roster is dragging: short filtered noise burst,
  frequency mapped to `|carriage velocity|` (the same value `HangingCard` consumes).
- **Gravity swell** — gain = f(distance to `.singularity` section rect), a 40–60 Hz sine bed,
  updated from the Lenis/scroll channel at 10 Hz, not per-frame. Zero cost off-axis.
- **Stamp thud** — pull resolves (the pull canvas already gates by IntersectionObserver;
  the audio trigger belongs in `usePullEngine` phase transitions, *before* the reveal frame for
  anticipation: whoosh at `spinning`, thud at `result`).
- **Near-miss tension** — 2-frame hesitation + a rising glissando when RNG landed secret/legendary
  one slot away from pity — this is the casino cue, cheap to build on the existing blip().
All behind the current opt-in toggle; keep lazy AudioContext (it is), and add a
`sound.ts` registry `{ event: {freq, dur, type, filter} }` so tuning stays out of components.

### 3.5 · Tactile parity: haptics + press states
`navigator.vibrate` appears **zero** times. On coarse pointers where the cursor glow and magnets
don't exist, touch gets no physical channel back:
- `vibrate(8)` on pull stamp, `vibrate([4, 24, 10])` on legendary/secret reveal, `vibrate(6)` on
  dialog open. Feature-detect `('vibrate' in navigator)` — silent on iOS. One util, four call sites.
- Press states: `.perk`, store cards and rotunda plates have tilt on hover (framer `useTilt`) —
  on `touch` devices the equivalent is `whileTap={{ scale: 0.985 }}` + the bloom pseudo-element
  opacity set to 0.5. The `.pk` registry in `motion.css` should carry it for all three, per card.

### 3.6 · Micro-feedback inventory (small, but each is visible in a screen recording)
- **Nav:** scrollspy `active` is a class swap; add a shared `layoutId="nav-marker"` bar that
  *slides between* links (2 lines in `Nav.tsx`, and the section count in `SideRail` gets the
  same treatment).
- **Chips:** filter changes reflow the rail instantly — animate `maxX` measurement
  (`animate(railWidth, …)`) so re-sort visibly *rethreads* instead of snapping.
- **Dialog:** add `scrollbar-width: thin` + gradient thumb on `.dialog__body` (chat already has
  it — `nemo-chat.css` L272 — inconsistency, not absence).
- **Toast:** "ADDED TO CART · DEMO" is right; add the rarity hue of the *current* universe
  context via `--card-accent` so the toast belongs to wherever the user is standing.
- **Cursor label:** extend `data-cursor` to rotunda ("SPIN"), singularity ("LOOK INTO IT"),
  stamp card ("COLLECT") — the mechanism exists; only three surfaces carry labels today.

### 3.7 · Honest-demo affordances
Store mints gated SKUs behind a mock wallet that persists in `localStorage` forever once
"connected" — for a demo pitched at clients, add a `DEMO WALLET` chip (10 px, `--gold` outline)
beside the connected address with a reset action. The README's honesty pass deserves UI parity.

---

## 4 · Prioritized Execution Roadmap

**Ordering logic:** first paint → scroll authority → input parity → physics continuity →
sensory layer → payload. Each step is independently shippable and testable.

### Phase 0 — First-paint & integrity (≈ 2 days)
1. Font preloads (3 faces) + subsetting script via `fontkit` + drop unused italics · `1.1`
2. `--ink-faint` split + Hairline treatment for micro-text + axe-core CI gate
  (`@axe-core/playwright`, budget: 0 serious on the 1280×900 + 390×844 matrix) · `1.2`
3. `scrollbar-gutter: stable` + shared `useFocusTrap` wired into mmenu + `Escape` closes menu · `3.2`
4. Countdown live-region restructure · `3.3`
   **Exit criteria:** H1 paints in Machina on first visit; axe green; no layout pop on dialog/menu open.

### Phase 1 — Scroll authority (≈ 3 days)
5. Lenis integration + remove `scroll-behavior:smooth` + hero `useSpring` removal +
   all six scroll consumers onto the single channel · `2.1`
6. `html.is-booting` → full input inertness (keydown + tab-trap) · `2.3.3`
7. GSAP ScrollTrigger refresh plumbing on `lenis.on('scroll')` (already partial in Lore/Signoff — unify)
   **Exit criteria:** one rAF cadence site-wide; trackpad scroll has one smoothing curve, no mush.

### Phase 2 — Interaction parity (≈ 3 days) — ✅ executed 2026-09-15
8. Rotunda keyboard + SR layer (the carousel pattern in `3.1`) — **non-negotiable** · `3.1`
9. Roster drag momentum + index snap + `DRAG` cursor state · `2.2`
10. Loader skip-on-any-input + session short-pass · `2.3.1–2`
11. Nav marker (`layoutId`), `data-cursor` sweep across surfaces · `3.6`
    **Exit criteria:** every canvas/3D surface operable by keyboard; drag feels continuous with physics.

### Phase 3 — Cinematic layer (≈ 4 days) — ✅ executed 2026-09-15
12. Hero→roster title scatter scrub; rotunda scroll-gust; singularity camera dolly;
    sign-off crawl clip-rise · `2.4`
13. Card→dialog shared-element (`layoutId` plate morph, VT-API fallback) · `2.5`
14. `--gap-s/m/l` spatial scale + rotunda bleed + outlined oversized section numerals · `1.3`
    **Exit criteria:** three scroll-scrubbed "events" per viewport-height of scroll, all
    reduced-motion-vetoed, all frame-budgeted (transform/opacity/`clip-path` only — respect
    the motion.css rules block).

### Phase 4 — Sensory & depth (≈ 3 days) — ✅ executed 2026-09-15
15. Sound registry: rod ring / gravity swell / stamp thud + near-miss · `3.4`
16. Haptics util + `whileTap` parity on touch · `3.5`
17. Scene-global background drift from `lib/scenes.ts` into CSS custom properties · `1.4`
18. Demo-wallet chip + reset · `3.7`

### Phase 5 — Payload & proof (ongoing) — ✅ executed 2026-09-15 (code + gate; lab numbers still due)
19. Measure first: Lighthouse (mobile, throttled), WebPageTest filmstrip. The two three-builds
    trade is documented and accepted (`README`); attack the rest — `html2canvas` (204 kB chunk)
    is capture-only for the Sign-off: move behind a dynamic import at the exact moment the
    signoff plate enters the second viewport, not merely idle.
20. Consider a `motion-safe` Playwright visual-regression suite (extend `tests/signoff-horizon.spec.ts`
    pattern: fixed clock, scroll-to-section, pixel diff) so this level of craft survives future edits.

**Budget verdict:** ~15–18 engineer-days takes a 9 to a 10. The assets are done; this list is
entirely *conduction* — one scroll authority, one input model, one typographic first beat,
one physics vocabulary. That's the difference between beautiful and inevitable.
