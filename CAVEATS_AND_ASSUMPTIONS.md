# Caveats & Assumptions — The OC Universe (Hub Frontend)

Standalone technical debrief for the build delivered alongside this document.
Every deviation from the pitch is listed here explicitly.

---

## 1. Visual identity determination (as instructed)

The pitch contains **no explicit art direction** — no palette, typefaces, or
motion language. Per the execution guardrails, the visual identity was inferred
from the concept itself and locked in as binding rules:

| Axis | Derived rule |
| --- | --- |
| Canvas | Void black `#05050A` — "one canon, infinite versions" ⇒ one dark constant behind every universe |
| Brand gradients | Iris `#8A4DFF` → Cyan `#3FE8FF` → Magenta `#FF3D9A` — "nebula/multiverse" energy; used for display words, buttons, borders |
| Accent | Gold `#FFC857` reserved strictly for rarity/legendary/holder value (mint price, set bonus, epic+ rarity) |
| Display type | **Unbounded Variable** 800, uppercase, `-0.015em` tracking, clamp() fluid scale up to 7.25rem |
| Body type | **Space Grotesk Variable** |
| System voice | **Space Mono** — universe codes, coordinates, metadata, buttons ("the machine that manages the multiverse") |
| Surfaces | Glass panels (`blur(16px)`, 1px gradient borders via background-clip), no flat drop shadows |
| Elevation | Glow, not shadow — colored box-shadows/glows keyed to each element's accent color |
| Motion | expo-out `cubic-bezier(0.16,1,0.3,1)` everywhere; scroll-bound parallax, pinned horizontal roster, marquees, holographic sheen sweeps, word-level reveals, film grain + drifting starfield canvas |

If the client has an existing brand kit, only the token file
(`src/styles/global.css`, `:root` block) needs editing — every component reads
tokens, not hard-coded values.

## 2. The Multiverse content is placeholder canon

The pitch describes *a specific OC that belongs to the client* ("the character
is something you personally identify with"), but deliberately names nothing.
Therefore:

- The character is presented as **NEMO, a wanderer between timelines whose face
  is a small radiant star** — a fully original stand-in. Replace in one file:
  `src/lib/data.ts` (plus `PERSONA_GREETING`/`CHAT_RULES` voice patterns).
- Universe names, lore blurbs, artist names, quotes, drop dates, and the
  timeline are invented **demo canon** exercising every pitch mechanic
  (numbering, lore blurbs, permanent artist credits, cadence, rarity, supply,
  revenue split, variant pulls, encrypted/secret universes).
- The pitch's "one every few weeks" cadence ⇒ 7 numbered universes
  (U-001…U-007) + U-008 ENCRYPTED (unrevealed, no artwork file) + U-009
  SECRET (the pitch's "unannounced secret universe" chase mechanic; a
  pull-only anomaly, 1/1, 4% base odds).
- All 10 artwork images are **AI-generated placeholders** (1 hero, 8 card
  portraits in distinct artist styles, 1 secret). Replace
  `public/art/*.jpg` with real commissions; data URLs live in `data.ts`.

## 3. Mocked integrations (deliberate, clearly labeled in-UI)

| Pitch requirement | Demo behavior | Production path |
| --- | --- | --- |
| Wallet connect (RainbowKit/WalletConnect) | `useMockWallet()` — one click, no signature, persisted in `localStorage` | Swap the button for RainbowKit; feed `account` into the same state |
| On-chain ownership check (Alchemy/Moralis) | Simulated: any connected wallet shows "VERIFIED HOLDER · LEGENDARY TRAIT" | One Alchemy `getNFTs` call replaces the flag |
| Shopify storefront / discount auto-apply | 3-SKU demo catalog; holder "−25%" readout only | Real SKUs + Shopify Storefront/Admin API; gating per tier |
| Proof-of-Purchase mint (webhook → Base/Polygon mint) | Client-side pull simulator with rarity weights, pity on 8th stamp, set bonus at 6; results in `localStorage` | Webhook + mint service; the odds/pity/bonus logic in `data.ts` ports as-is |
| X live embed | Styled mock feed (teasers, banter thread, pull brag) | Drop-in: official X embed or API feed; card CSS is feed-agnostic |
| AI Persona (Claude API) | Canned in-canon brain: regex intents + scripted replies + fallbacks + typing indicators | Replace `replyFor()` with a Claude call; guardrail + rate-limit notes already in copy |

Every mocked surface carries a visible "DEMO" note so the prototype never
reads as a live transactional site.

## 4. Date handling

- The pitch is dated **July 2026**; today is August 2026, so the narrative
  timeline starts "2025 Q4 → Aug 22 2026".
- **U-007 "drops" Aug 22, 2026** and the countdowns run against that date
  (`UNIVERSE_DROP_ISO` in `data.ts`). After that date they show `00D 00H`.
  Production would drive this from a CMS/registry.
- Static "released" dates are ISO strings; a real registry would add
  timezone-aware display.

## 5. Technical limitations & unhandled edge cases

- **This is a frontend demo, not the production system.** No SSR/ISR (Vite SPA
  + `base: './'` for sub-path or IPFS deployment). SEO/social unfurls would
  require Next.js (the pitch names Next.js) — the component architecture ports
  directly.
- **Pull persistence is local** (`localStorage`, key `ocu-pulls-v1`). Incognito
  or cleared storage resets stamps; the rarity "pity" resets with it.
- **Odds math** lives in `pullOdds()` and is deterministic/weight-based, but the
  "stamp card guarantees a rare pull" rule is simplified to *8th stamp ⇒
  rare-or-better* (pitch says "milestone purchase guarantees a rare pull" —
  milestone count is an assumption; change `STAMP_SLOTS` in `data.ts`).
- **Reduced-motion** is respected globally (all animations/transitions
  collapse); the starfield stops drifting; the roster falls back to a static
  horizontal scroll on very narrow screens — but the pinned-scroll effect is
  desktop/tablet-only by design.
- **The roster pin** measures the rail once per filter/resize; if fonts load
  slowly the first measurement can be slightly off (a `ResizeObserver` +
  `document.fonts.ready` re-measure covers most cases, not all).
- **Performance:** one fixed canvas (viewport-sized) for the starfield,
  `content-visibility`-safe lazy images on cards past index 2, marquees are
  GPU-composited transforms. The pull spinner intentionally re-mounts imgs at
  ~12fps (slot-machine feel) — it is the heaviest interaction.
- **Accessibility:** skip link, focus-visible rings, Esc/backdrop dialog close,
  aria labels on interactive cards, `aria-live` chat, `prefers-reduced-motion`.
  Not yet: full keyboard roster navigation, screen-reader walkthrough, WCAG
  audit.
- **`color-mix()` / `background-clip: text` / `backdrop-filter`** require
  modern evergreen browsers (Chrome 111+, Safari 16.2+). No legacy fallbacks.

## 6. Dependencies

- `react` 18.3 / `react-dom` 18.3 — React 19 is fine too; 18 was chosen for
  the widest ecosystem compatibility with the wallet libs named in the pitch.
- `framer-motion` 11 — scroll-bound cinematic motion (`useScroll`/`useTransform`
  for parallax + the pinned roster; `AnimatePresence` for dialog/pull states).
- `vite` 5 + `@vitejs/plugin-react` + `typescript` 5 (strict,
  `noUnusedLocals`) — zero-type-error build (`tsc -b && vite build`).
- `@fontsource-variable/unbounded`, `@fontsource-variable/space-grotesk`,
  `@fontsource/space-mono` — self-hosted fonts, no CDN, no external requests
  at runtime.
- Deliberately **not** installed: RainbowKit/Wagmi, Alchemy SDK, Shopify
  clients, Claude SDK (mock layer stands in — see §3).

## 7. Architectural compromises

- **Mock layer centralized, not scattered:** all demo state (wallet, pulls,
  products, tweets, persona brain) routes through `src/lib/data.ts` +
  `components/ui.tsx` (`useMockWallet`), so production integration is a
  replace-the-hook job, not a rewrite.
- **CSS custom properties as the theming channel** — rarity/accent colors flow
  through `--c`, `--card-accent`, `--a1/--a2` tokens (a TS module augmentation
  in `src/vite-env.d.ts` types them) instead of prop-drilled class names.
- **One stylesheet pair** (`global.css` = tokens/system, `components.css` =
  component rules) rather than CSS modules — chosen for token coherence and
  fast iteration; split per-component if the team prefers.
- **Single-page narrative order** follows the pitch's own "How It Connects"
  loop: Multiverse → Persona → Perks → Pulls → Store → Artists → Lore → Loop.

## 8. Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle into dist/
```
