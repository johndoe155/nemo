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
   parallax, live countdown badge, scroll progress rail.
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
9. **The Loop** — the pitch's "How It All Connects" as an orbital diagram
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
  sections/                # one component per page section
  App.tsx / main.tsx
public/art/                # placeholder AI-generated canon art (replaceable)
```

**Theming:** every color, type, and motion value is a CSS custom property in
`global.css:root`. Rarity/accent colors propagate via `--c` / `--card-accent`
style tokens.

**Content:** swap the placeholder canon (NEMO, universes, artists, tweets,
products) in `src/lib/data.ts` — the UI renders whatever the data layer says.

**Motion:** expo-out easing everywhere; scroll-bound parallax (hero), a
420vh pinned horizontal roster (desktop/tablet), marquee tickers, sheen
sweeps, word-level reveals, film grain, and a drifting starfield canvas.
`prefers-reduced-motion` collapses all of it.

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
