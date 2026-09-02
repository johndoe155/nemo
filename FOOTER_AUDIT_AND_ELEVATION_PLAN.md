# THE NEMOVERSE — Footer & Bottom Section Audit + Elevation Plan

**Audit scope:** `src/sections/Footer.tsx` + every rule touching `.footer*` / `.signoff*` across the stylesheet layers · **Baseline:** `tsc -b` clean · **Protocol:** read-only audit — **no source files modified.** This document is the Phase-1 findings + Phase-2 blueprint; implementation awaits explicit approval.

---

## VERDICT AT A GLANCE

| Dimension | Score (10 = Awwwards SOTD bar) | One-line diagnosis |
|---|---|---|
| Visual pacing & drama | **4.5** | The page's final beat reuses a mid-page marquee verbatim and a centered SaaS-style lockup — no crescendo, no narrative close |
| Typography & hierarchy | **5.5** | Right faces, wrong treatment: one-size all-caps line, three tracking dialects, hardcoded sub-floor sizes |
| Motion & micro-interactions | **4.0** | Zero scroll-driven reveals in the entire footer; ghost numeral bug; no parallax, no easter egg |
| IA & conversion | **5.0** | One good CTA, but orphaned `#connect`, zero socials, no back-to-top, stale hardcoded drop date |
| Responsive execution | **6.0** | Collapses cleanly on mobile; abandons the page entirely on ultra-wide |
| **Overall** | **5.1** | The least ambitious surface on a page whose own average elsewhere is 6.5–8.4 — and it's the *last thing the jury sees* |

---

## PHASE 1 — RUTHLESS AUDIT

### 1.0 Anatomy of the current footer

```
<footer id="connect" class="footer">          ← outside <main>, after Lore
├─ <Marquee>                                   ← same component/items as mid-page marquee
│    "HOLD TO ENTER FIRST" · "ONE CANON…" · "U-007 DROPS AUG 22" · …
├─ .footer__cta                                ← centered block
│   ├─ .ghost-num "U-007"                      ← ⚠ no size class (BUG-1)
│   ├─ h2.display-xl "ENTER THE NEMOVERSE."    ← single-size all-caps line
│   ├─ KineticLink "EXPLORE THE UNIVERSES"     ← magnetic + swap + spark (the one 9/10 element)
│   └─ mono caption "U-007 · THE LAST AURORA · AUG 22 · HOLDERS ENTER FIRST"
├─ .shell > .footer__top                       ← 1.4fr/1fr/1fr grid
│   ├─ brand + prose + "9 UNIVERSES · 7 ARTISTS · CHAIN" line
│   └─ 2 link columns (UNIVERSE / SYSTEMS)
└─ .shell > .footer__bottom                    ← © line · protocol v0.1.0 · "MADE IN THE VOID"
```

Layers touching it: `components.css:422–513` (base), `overhaul.css:615–631` (crescendo), `typography.css:101,108` (Montreal Text prose/legal), `global.css:524` (aurora phase), `audit-gaps.css:74` (scroll-velocity rotation). The ambient scene system already knows the footer — `scenes.ts:145` maps `connect: 'abyss'` (near-black, vignette closing in). The scene is ready; the markup doesn't cash it in.

### 1.1 Visual pacing & drama

**What's earned:** the `abyss` scene darkens the page behind the footer; the velocity-driven ghost-num rotation (`audit-gaps.css:74`) is a nice "hyperdrive" tic; the KineticLink is genuinely luxury-grade.

**What fails:**
- **No transition.** Lore ends mid-timeline; the footer opens with a *marquee* — the same component that follows the hero (`App.tsx:98`). Two identical full-width marquees bookend the page, with overlapping copy ("EVERY PURCHASE PULLS A PIECE", "THE PERSONA IS ALWAYS TEASING", "U-007…AUG 22" appear in *both*). This is the loudest template tell on the page.
- **The crescendo is a re-statement, not a close.** "ENTER THE NEMOVERSE." + primary button is the hero's structure repeated — it re-announces rather than resolves. The canon *wants* a closing beat: the drop countdown, "the persona is always teasing", "MADE IN THE VOID", artists credited forever.
- **Scale contrast is absent.** The ghost "U-007" behind the CTA was clearly *intended* as a giant watermark (the `ghost-num` system, `--fs-ghost` up to 20rem) but renders at ~16px (BUG-1 below). Result: the footer has exactly one visual weight — body type. Compare the hero (three-line kinetic lockup + hollow-stroke words + watermark) or Nemoverse (`ghost-num--huge` numerals per section).
- **Grid abandonment.** `.footer__cta` centers everything, abandoning the site's editorial left-rail/kicker + right ghost-numeral grammar. The `footer__top` 3-column grid is conventional SaaS.
- **Negative space is empty, not composed.** On ≥1920px the whole footer hugs `--max: 1500px`; the void around it carries no watermark, no edge-spanning element (except the marquee), no viewport-scale drama.

### 1.2 Typography & hierarchy

**What's earned:** PP Neue Machina Inktrap 800 for the title (right face), Montreal Text for prose/legal via `typography.css:101,108` — the system's own guidance followed.

**What fails:**
- **TYPO-1 · Single-size lockup.** `ENTER THE NEMOVERSE.` is one all-caps line at one size (`--fs-cta`, max 5rem). The hero splits its title into three lines with size/treatment contrast (solid + hollow + gradient). The footer title should have at least two scale tiers and an accent treatment.
- **TYPO-2 · Three tracking dialects in one footer:** caption 0.28em (inline), column headings 0.3em, bottom bar 0.22em (overridden from 0.12em in `typography.css:108`). No coherent meta hierarchy — everything shouts at the same volume.
- **TYPO-3 · Inline style hardcodes over tokens.** `Footer.tsx:39–41, 47–49` set `fontFamily/fontSize/letterSpacing` inline; `0.66rem` sits just above the system's own floor (`--fs-meta-min: 0.625rem`) with no rationale; the stats line has no `font-variant-numeric: tabular-nums` (the system mandates it for counters, `typography.css:49`); `nemo` is bolded with an inline `color: var(--cyan)`.
- **TYPO-4 · No data-driven numerals.** "9 UNIVERSES · 7 ARTISTS" is hand-written copy even though `UNIVERSES.length` / `ARTISTS.length` are already imported — and the marquee/caption hardcode "AUG 22" (BUG-2).

### 1.3 Motion & micro-interactions

**What's earned:** marquee loop with hover-pause; KineticLink (magnetic `pill` spring 240/17/0.5, KineticLabel swap, `btn-spark`, `data-cursor="ENTER"`); RollText char-cascade on all 7 footer links; gdrift underlines; scroll-velocity rotation on the ghost numeral.

**What fails:**
- **MOT-1 · Zero entrance choreography.** No `Reveal`, no scroll trigger, no stagger anywhere in the footer — while *every* section above it reveals (Hero, cards, Lore stats, timeline rod). The final beat is the only one that just… appears.
- **MOT-2 · The big title is inert.** No hover/focus interplay, no mask reveal, no letter-spacing settle, no split-line wipe. The hero title glitches; the footer title is a static `<h2>`.
- **MOT-3 · No parallax layering.** The ghost numeral rotates with velocity but doesn't drift against the title; no scrub relationship between watermark, title, and CTA. GSAP + ScrollTrigger are already in the bundle and registered in `Lore.tsx` — the footer uses none of it.
- **MOT-4 · No easter egg / signature moment.** The canon is begging: NEMO's star, the persona "always teasing", the countdown, "MADE IN THE VOID". The toast system (`toast()` in `ui.tsx:471`) and custom cursor labels are sitting unused here.
- **MOT-5 · Marquee duplication** (see 1.1) — the closing marquee should be a *credit crawl*, not a re-run of the mid-page ticker.
- **MOT-6 · Link columns** have RollText + underline (good) but no entrance stagger, no cursor labels, no hover on column headings, no magnetic pull on anything but the CTA.

### 1.4 Information architecture & conversion

**What's earned:** exactly one primary CTA (conversion hygiene is correct), clean prose, sensible column names, "MADE IN THE VOID" microcopy.

**What fails:**
- **IA-1 · `#connect` is orphaned.** The footer's own id is a link target for nobody: nav has 7 links (no Lore, no connect), SideRail scans `main section[id]` only, the CTA targets `#nemoverse`. The "connect" intent is dead.
- **IA-2 · Zero social/community touchpoints.** For a Web3 pitch (chain: Base/Polygon, holders, artists), no X/Discord/OpenSea links anywhere — the page ends with no outbound path.
- **IA-3 · No back-to-top mechanism.** Nav brand → `#top` exists, but the closing screen itself has no "rewind" affordance; on a long page the last thing a user hits is a dead end.
- **IA-4 · Stale, duplicated drop data.** "AUG 22" hardcoded at `Footer.tsx:14` and `:42` while `Nemoverse.tsx:384–386` exists precisely because the hardcoded date drifted — the footer re-introduces the bug the team already fixed once. (`UNIVERSE_DROP_ISO` is `2026-08-22`; today is 2026-09-02 — the copy is already stale.)
- **IA-5 · Link columns are arbitrary.** UNIVERSE col links to Nemoverse/Core Identity/Artists/Persona; SYSTEMS to Perks/Pulls/Store. No Lore, no Rotunda, no home — the grouping looks randomized.
- **IA-6 · No urgency element.** The drop countdown exists as a component (`Countdown` in `ui.tsx`, `useCountdown` with a `done` state) and is the site's strongest conversion hook — the footer doesn't use it.

### 1.5 Responsive execution

- **RESP-1 · ≤860px:** `footer__top` collapses to 1 column cleanly (`components.css:507–512`). But the CTA stays centered while the rest of the page is left-rail editorial — the footer is the only section that inverts its alignment grammar on mobile.
- **RESP-2 · Ultra-wide ≥1920px:** the weakest mode. Everything clamps at 1500px; the marquee is the only edge-to-edge element; the CTA is a narrow centered column floating in void with no viewport-scale element to anchor the composition.
- **RESP-3 · Mobile:** the ghost watermark is invisible at any size (BUG-1), so the one intended scale-drama element is absent everywhere; the long tracked caption wraps awkwardly at 0.28em on 375px.

### 1.6 A11y, performance & code hygiene

- **A11Y-1 · Marquee duplicated for screen readers.** `Marquee` renders two identical rows (`ui.tsx:105–116`) with no `aria-hidden` — assistive tech reads the whole closing list twice. Should be `aria-hidden` + one visually-hidden caption.
- **A11Y-2 ·** Focus states on links are good (underline + RollText cascade via `:focus-visible` in `motion.css`); KineticLink handles focus. No new regressions — but the plan must keep this parity.
- **PERF-1 ·** Footer is cheap today (no box-shadow transitions, transform-only marquee) — *good.* The elevation must keep the additions composited: transform/opacity/clip-path only, no filter or box-shadow transitions, no new canvases (Ambience already owns the void), gsap scoped in a `gsap.context` + killed on unmount.
- **HYG-1 ·** `Marquee` `speed="44s"` vs mid-page `"38s"` with overlapping items — a shared-item drift risk if copy changes in one place.
- **HYG-2 ·** Ghost-numeral size bug (BUG-1) and date drift (BUG-2) are the two *verified* code defects.

---

## PHASE 2 — ELEVATION PLAN: **"THE SIGN-OFF"**

### 2.0 Design concept & vibe

**The footer becomes the closing credits of the Nemoverse film — the page collapses into the void, and NEMO signs off.**

One canon, infinite versions. The page opens as a transmission (`arrival`), travels its districts, and the `abyss` scene has already dimmed the lights. The footer should resolve the story, not re-announce it: a giant kinetic "ENTER THE / NEMOVERSE." close-up, a live drop countdown ticking to the next universe, credits that name the universe and artist counts, and a sign-off line — *"END OF TRANSMISSION · NEMO SEES YOU OUT"* — with the persona's parting tease as a hidden easter egg.

This synthesizes all three directions you floated, deliberately:
- **Massive kinetic typography reveal** → the two-line split lockup with per-line mask wipes and a scrubbed parallax watermark (direction 1 as the hero moment).
- **Dark-mode immersive anchor** → the `abyss` scene is leaned into: vignette closes fully, the footer band drops to near-black with a faint iris ember, the only chroma is the gradient ink and gold countdown (direction 2 as the atmosphere).
- **Asymmetrical editorial grid** → the credits grid (brand/stats + 3 nav groups + socials) is left-anchored, off-center by design, with a full-bleed ribbon to close (direction 3 as the structure).

**Vibe anchors:** film end-credits on a void screen · NASA mission-control sign-off ("this concludes the transmission") · a record label's back cover. Not a footer — a *curtain call*.

### 2.1 Layout & component breakdown

**Proposed DOM (additive rebuild of `Footer.tsx`):**

```
<footer id="connect" class="footer signoff">
  ├─ .signoff__curtain                       ← transition zone (fades in as Lore exits)
  │    "END OF TRANSMISSION" kicker + pulse dot   ·  hairline top border that "draws" on scroll
  ├─ <Marquee variant="credits" items={…}/>  ← credit crawl: slower (≈110s), larger, outlined,
  │                                            reversed direction vs. mid-page, aria-hidden+sr-only
  ├─ .signoff__anchor                        ← THE big beat
  │   ├─ .ghost-num.ghost-num--huge "NEMO"   ← FIX BUG-1; new --fs-signoff scale; parallax layer
  │   ├─ .signoff__kicker                    ← "U-007 · THE LAST AURORA" (data-derived)
  │   ├─ h2.signoff__title                   ← TWO mask-reveal lines:
  │   │     line 1: "ENTER THE"   (tracked, dim, small — the breath before the drop)
  │   │     line 2: "NEMOVERSE."  (max scale, txt-grad + chroma, hollow "NEMO" accent)
  │   ├─ <Countdown class="countdown--signoff" target={UNIVERSE_DROP_ISO}/>  ← gold "NEXT DROP IN"
  │   │     (done → swaps to "TRANSMISSION LIVE" pulse — the persona takes over)
  │   ├─ KineticLink primary  "EXPLORE THE UNIVERSES" / swap "ENTER THE VOID"  (unchanged physics)
  │   └─ KineticLink ghost    "REPLAY THE LOOP" + GhostArrow (↑ #top)           (back-to-top alt)
  ├─ .shell > .signoff__credits              ← asymmetric editorial grid
  │   ├─ identity col (logo + prose + stats strip, tabular-nums, data-driven counts)
  │   ├─ UNIVERSE col   (Nemoverse · Rotunda · Artists · Lore)        ← re-grouped
  │   ├─ SYSTEMS col    (Perks · Pulls · Store · The Persona)
  │   └─ SIGNALS col    (NEW: X · Discord · OpenSea · Email — demo stubs, aria-labelled)
  └─ .signoff__ribbon                       ← full-bleed close
       © line · "NEMOVERSE PROTOCOL v0.1.0" · "MADE IN THE VOID" · [REWIND ↑] magnetic button
```

**Grid grammar (aligns with the site's editorial system):**
- `.signoff__credits`: `grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: clamp(2rem, 4vw, 4.5rem)` — asymmetric on purpose; identity column carries the weight.
- Column headings reuse the `.kicker` grammar (rule + tracked label, cyan) instead of the current flat `<h4>`; each heading gets a faint ghost section numeral (`01`…`04`) — or the footer's numeral is **`∞`** (infinite versions) as the section's ghost numeral, echoing `sechead__num`.
- `.signoff__ribbon`: full-bleed, hairline top rule, `justify-content: space-between`, wraps; `REWIND` is a `MagneticButton` (chrome preset) with an up-rotated `GhostArrow`, `data-cursor="TOP"`.
- **Ultra-wide:** `.signoff__anchor` spans the viewport (`--fs-signoff: clamp(7rem, 22vw, 26rem)` for the watermark, title at `clamp(3rem, 10vw, 9rem)`), credits grid maxes at 1600px, ribbon edge-to-edge. The watermark sits off-center (x: 62% / 38%) so ultra-wide reads as composition, not centering.
- **≤980px:** credits → 2 columns (identity spans full row); anchor title keeps the two-line split at clamp sizes; countdown wraps inline.
- **≤560px:** credits → 1 column; ribbon stacks with `REWIND` as a full-width ghost button; ghost watermark drops to `--fs-secnum` and moves *behind* the title at low opacity (never collides with text).

### 2.2 Motion & interaction choreography

| Moment | Trigger | Motion | Easing / Physics |
|---|---|---|---|
| Curtain | Scroll into view (`ScrollTrigger` on `.signoff__curtain`, scrub 0.4) | Top hairline `scaleX 0→1`; kicker fades + pulse dot blinks in; whole band `yPercent 8→0` | `power3.out`, scrub |
| Credit crawl | CSS loop | `Marquee variant="credits"` — outlined type (`-webkit-text-stroke`), ~2.5× slower than mid-page, **reverse** direction | `linear`, 110s |
| Watermark | Scroll scrub (`ScrollTrigger`, start `top bottom` → `top top`) | `yPercent -18→6` counter-parallax vs. title (`yPercent 0→-10`) — true depth; existing `--scroll-vel` rotation retained | `none` (scrubbed), `invalidateOnRefresh` |
| Title line 1 | `whileInView` (framer, margin `-80px`) | `clip-path: inset(0 0 100% 0) → inset(0)` + `y: 40% → 0` + `opacity` — mask wipe | `--ease-expo`, 1.1s |
| Title line 2 | +0.14s delay | same wipe + gradient/`txt-grad` already alive (`gdrift` 16s) + letter-spacing settle `0.08em → -0.02em` (via `--ls` custom prop, composited) | `--ease-expo`, 1.2s |
| Countdown cells | after title (0.5s) | gold cell borders draw `scaleY`; digits use existing tabular-nums tick | stagger 0.04s |
| CTA | 0.7s | Existing KineticLink (magnetic pill 240/17/0.5, label swap, spark) — **keep as-is**, it's already 9/10; add `data-cursor="ENTER"` glow bleed via `useCursorGlow`'s `--mx/--my` | unchanged |
| Credits columns | `whileInView` | each column `y: 24 → 0` + fade, 0.06s stagger; links keep RollText cascade + gdrift underline | `--ease-expo`, 0.8s |
| Ribbon | +0.3s | fade + `y: 12 → 0`; `REWIND` button magnetic (chrome 320/24/0.5) with `whileTap` squash | `--ease-expo`, 0.6s |
| **Easter egg** | press & hold NEMO star logo ≥ 1.2s | logo glow intensifies + cursor label "NEMO SEES YOU"; on release → `toast("you made it to the end. i always knew you would.")` — the persona signs off | 1.2s hold timer, spring glow |
| Countdown done | `useCountdown().done` | chip swaps to "TRANSMISSION LIVE" with `pulse-dot` (existing hero pattern) — the footer becomes alive | — |

**Physics contract (house rules):** entrances `cubic-bezier(0.16, 1, 0.3, 1)`; exits `(0.76, 0, 0.24, 1)`; scrubbed GSAP `ease: 'none'`; springs only on pointer-driven systems (magnetic). All motion on `transform` / `opacity` / `clip-path` — zero layout or paint per frame. GSAP scoped in a `gsap.context` + `matchMedia`, killed on unmount; framer `useReducedMotion` + the existing CSS `prefers-reduced-motion` block collapse everything to final state.

### 2.3 Content & data changes

- `src/lib/data.ts` (or a small local helper following `Nemoverse.tsx:384–386`): derive `DROP_LABEL` from `UNIVERSE_DROP_ISO` once, reuse in marquee + kicker + caption → **kills BUG-2**. Add `FOOTER_NAV` (the re-grouped columns) and `SOCIALS` (demo stubs: X / Discord / OpenSea / Email, `href="#"`, marked in code as replace-with-live-handles).
- Marquee items become data-driven: `{UNIVERSES.length} UNIVERSES REGISTERED` · `{ARTISTS.length} ARTISTS CREDITED` · `NEXT DROP {DROP_LABEL}` · `HOLDERS ENTER FIRST` · `NEMOVERSE PROTOCOL v0.1.0` — no hand-written numbers, no duplicated copy between the two marquees.
- Keep: "MADE IN THE VOID", the © line, the demo disclaimer — they're good microcopy.

### 2.4 A11y & performance contract

- **A11Y:** `Marquee` rows get `aria-hidden` + one visually-hidden caption listing the items (fixes the double-read); link groups become `<nav aria-label="UNIVERSE">` landmarks; `REWIND` and socials get clear `aria-label`s; `:focus-visible` parity on every new interactive (underline + glow like the rest of the site); countdown keeps `role="timer"`; contrast: outlined credit-crawl type at stroke alpha ≥ 0.35 on void; all new targets ≥ 44px (hit-slop where needed); easter egg is *bonus only* — never blocks the logo's link function (logo remains a normal link; hold-to-toast is additive on top… if the logo is a link, make the toast trigger the link's `onClick` via long-press detection and still navigate — simplest: logo is not a link today in the footer (it's a `<div>`), so long-press toast is safe).
- **PERF:** no new canvases / shaders (Ambience owns the void); no filter/box-shadow transitions; watermark + title parallax are two composited layers (browser promotes them once); countdown re-renders at ≤1Hz (existing hook); gsap triggers `invalidateOnRefresh` + killed on unmount; credit crawl reuses the existing transform-based marquee mechanism (no new raster). Target: footer entrance = one paint frame for the reveal + zero steady-state cost.

### 2.5 Implementation roadmap

| Step | File(s) | Change | Gate |
|---|---|---|---|
| 0 | `src/lib/data.ts` | `DROP_LABEL`, `FOOTER_NAV`, `SOCIALS` exports | `tsc -b` clean |
| 1 | `src/sections/Footer.tsx` | BUG-1 fix (`ghost-num--huge` + `--fs-signoff`) and BUG-2 fix (data-driven date/items) in the *current* structure first — small, verifiable wins | build + visual check |
| 2 | `src/components/ui.tsx` | `Marquee` gains `variant="default \| 'credits'"` + sr-only/aria-hidden contract | keyboard + SR check |
| 3 | `src/sections/Footer.tsx` | Rebuild into `signoff` DOM (curtain → crawl → anchor → credits → ribbon) using existing primitives only: `Reveal`, `Countdown`, `KineticLink`, `MagneticButton`, `RollText`, `GhostArrow` | tsc + render |
| 4 | `src/styles/overhaul.css` + `components.css` | `signoff` layer: tokens (`--fs-signoff`), grid grammar, credit-crawl type, ribbon, responsive blocks (1600/980/560), reduced-motion block | visual pass @ 375/768/1440/2560 |
| 5 | `Footer.tsx` (+ `motion.css` if needed) | Choreography: framer `whileInView` wipes + stagger; gsap `context` for watermark/title scrub parallax; countdown `done → LIVE` swap | perf trace (no layout thrash) |
| 6 | `Footer.tsx` + `global.css` (easter-egg styles) | Hold-to-toast on the logo via existing `toast()` | manual QA |
| 7 | — | A11y + reduced-motion + keyboard-only + Lighthouse audit (LCP unchanged, CLS 0, footer idle cost ≈ 0) | sign-off |

Each step is independently shippable; steps 1–2 are pure fixes that improve the current footer even if the full concept is deferred.

### 2.6 Acceptance criteria (what "done" means)

- The footer is the page's **third unforgettable moment** (after Hero, after the roster) — a first-time visitor who reaches it should *feel* the film ending.
- Zero layout thrash; footer idle cost ≈ 0; LCP/CLS unchanged; no new bundle weight beyond tokens.
- Full parity: keyboard, screen reader, `prefers-reduced-motion`, coarse pointer, 375px → 2560px.
- All copy derives from data (`UNIVERSE_DROP_ISO`, `UNIVERSES.length`, `ARTISTS.length`) — the "AUG 22" class of bug cannot recur.
- Target scores: pacing 4.5 → **9.0** · type 5.5 → **9.0** · motion 4.0 → **9.3** · IA 5.0 → **8.8** · responsive 6.0 → **9.0** · overall 5.1 → **~9.1**.

---

## ADDENDUM — IMPLEMENTATION COMPLETE (approved 2026-09-02)

All seven roadmap steps are implemented on `arena/01a05fb5-nemo`. Verified: `tsc -b` clean, `vite build` ✓ (4.1s), dev-server HMR clean.

**Shipped**
- `src/lib/data.ts` — `DROP_LABEL` (derived from `UNIVERSE_DROP_ISO`, matching the Nemoverse pattern), `FOOTER_NAV` (re-grouped UNIVERSE/SYSTEMS), `SOCIALS` demo stubs.
- `src/components/ui.tsx` — `Marquee` gains `variant="credits"` + `aria-hidden` rows with a single visually-hidden caption (fixes the double-announcement site-wide).
- `src/sections/Footer.tsx` — full Sign-Off rebuild: curtain (scrubbed label + hairline draw), credit crawl (data-driven), anchor (BUG-1 ghost watermark fix, two-line mask title, gold drop clock → TRANSMISSION LIVE, KineticLink CTAs), credits grid with staggered entrance, full-bleed ribbon + magnetic REWIND, and the hold-the-star easter egg (`toast('you made it to the end. i always knew you would.')`).
- `src/styles/overhaul.css` — `--fs-signoff` token + the complete `.signoff__*` layer (responsive 1920/980/560 + reduced-motion collapse).
- `src/styles/components.css` / `typography.css` — legacy `.footer__*` rules removed; type roles repointed at `.signoff__prose` / `.signoff__ribbon`.

**Deviations from the blueprint (deliberate)**
1. CSS consolidated into `overhaul.css` instead of splitting across `global.css`/`motion.css` — one additive layer, easier to audit.
2. The title's letter-spacing "settle" was dropped in favour of the mask wipe + parallax: letter-spacing animation reflows per frame, violating the plan's own compositing contract.
3. The drop clock reuses `useCountdown` + the existing `.countdown__cell` markup locally instead of extending the shared `Countdown` — zero churn on shared components (only `Marquee` gained a prop).
4. The ribbon is full-bleed (hairline spans the viewport, content inset by `--gutter`).

**Sandbox note (not committed):** this environment's vendored `node_modules` was missing the linux-x64 rollup binary (npm optional-deps bug, npm/cli#4828), which broke both `dev` and `build` before any code changed. Repaired locally with `npm i --no-save @rollup/rollup-linux-x64-gnu@4`; the repo diff contains only source changes.

---

## APPENDIX — File touch map (for approval)

| File | Nature | Risk |
|---|---|---|
| `src/sections/Footer.tsx` | Rewrite (structure only, primitives reused) | Low |
| `src/components/ui.tsx` | `Marquee` variant prop + a11y contract (additive) | Low |
| `src/lib/data.ts` | 3 additive exports | None |
| `src/styles/overhaul.css` | Additive `signoff` layer + 1 token | Low |
| `src/styles/components.css` | Supersede `.footer*` base rules with `signoff` equivalents (remove dead rules) | Medium |
| `src/styles/global.css` | Easter-egg + credit-crawl type rules | Low |
| `src/styles/typography.css` | Meta-floor alignment for signoff captions | Low |
| `src/sections/Nav.tsx` / `SideRail.tsx` | **Untouched** (out of scope) | — |

**Alternatives considered:** (a) *full-bleed dark anchor only* — cheaper but leaves the type flat; (b) *brutalist asymmetric grid only* — strong structure, weak narrative close; (c) *minimal polish of current layout* — honest but lands ~6.5, not SOTD. "The Sign-Off" wins because it uses the existing scene system, existing primitives, and the canon's own story to make the final screen inevitable, not decorative.
