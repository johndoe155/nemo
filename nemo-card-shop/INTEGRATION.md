# Nemoverse Card Shop — Integration notes

The Card Shop is a **standalone** Vite + React + TS project. This file is
documentation only — no integration action has been taken. It describes exactly
what a future merge needs so that dropping the shop into the Hub
(`nemo-main/`) is a copy-paste job, not a rewrite.

## 1. What the shop expects the host to supply

The shop ships **self-contained design tokens** on its own root (`.nemo-shop`)
so it runs alone today. Because those tokens use the *exact* names and values
of the Hub's `:root` system, the shop is pixel-identical with or without the
host. The only things it genuinely expects from a host are:

| Item | Shop fallback | Host (Hub) supplies |
| --- | --- | --- |
| `--font-display` PP Neue Machina Inktrap | system-ui fallback | hosted `.woff2` in `nemo-main/src/assets/fonts/` |
| `--font-heading` PP Neue Machina Plain | system-ui fallback | same (hosted) |
| `--font-body` / `--font-body-text` PP Neue Montreal (+Text) | system-ui fallback | same (hosted) |
| `--font-accent` Space Grotesk | `@fontsource-variable/space-grotesk` (bundled) | bundled via the same npm package |

The shop declares PP family names **first** in each stack with the same variable
names the Hub uses. It does **not** vendor the commercial `.woff2` files. The
moment the component renders inside `nemo-main`, those fonts resolve
automatically — zero code changes. Space Grotesk is open source and bundled, so
it works in both contexts.

Every shop rule is scoped under a single `.nemo-shop` ancestor (classes are
`nshop-*`, keyframes `nshop-*`, tokens declared on `.nemo-shop`, not `:root`),
so mounting it inside the Hub introduces **no global selector or class
collisions** and no `html`/`body` restyling.

## 2. Clean mount surface

- `src/CardShop.tsx` exports `export default function CardShop()` — the one
  component to import.
- `src/main.tsx` is the standalone bootstrap (`#root`), used for local dev.

```tsx
// inside nemo-main, later:
import CardShop from './card-shop/src/CardShop';
// ... <CardShop /> in a route
```

The Card Shop brings its own `shop.css` (imported by `CardShop.tsx`) and does
not depend on any Hub CSS being loaded.

## 3. Data layer

The shop's data types live in `src/lib/data.ts`. They are **structurally
identical** to the Hub's `nemo-main/src/lib/data.ts`:

- `Rarity`, `Artist`, `Universe` — same fields, same names.
- `RARITY` map — same keys/values.
- Records reuse the Nemoverse canon U-001…U-009 (same `public/art/` sources).

To point the shop at the real data source, swap imports:

| File | Currently | Replace with |
| --- | --- | --- |
| `src/lib/data.ts` (types + `RARITY`) | self-declared | `import { RARITY } from '…/lib/data'` (Hub) |
| `src/CardShop.tsx` (`CATALOG`) | local canon list | Hub's `UNIVERSES` (via a small adapter selecting the shopable statuses / sorting) |
| `src/lib/art-variants.ts` | generated AVIF/LQIP table | the Hub's generated module (same shape) |
| `src/components/CardImage.tsx` | local `CardImage` | the Hub's `CardImage` (same props) |

### Deliberate deviation from the Hub data

The Hub stores U-007 (`The Last Aurora`) with `released` = the single canon
drop date `UNIVERSE_DROP_ISO` and keeps it `upcoming`. Because a shop needs a
**live countdown**, this shop nudges that record's `released` to a rolling
near-future date (`2026-09-19T17:00:00Z`) and treats `upcoming` as a
holder-gated early-claim drop. Everything else is verbatim canon.

## 4. Wallet stub → real

`src/lib/wallet.ts` exports `useWallet()` returning
`{ connected, address, connect, disconnect }`, persisted in `localStorage`
under `nemo-shop-holder`. It is clearly marked with:

```ts
// TODO: replace with real wallet connect.
```

A real integration swaps `connect()` for an injected-provider flow
(e.g. wagmi / RainbowKit, matching the Hub). Pricing reacts to the boolean
`connected` everywhere via `HOLDER_DISCOUNT = 0.25` in `src/lib/data.ts`.

## 5. Cart / checkout stub

Cart state lives in `CardShop.tsx` (persisted to `localStorage`). The checkout
CTA only toasts `"DEMO CHECKOUT — NO REAL PAYMENT"` and clears the cart. A real
backend mint/basket is the replacement target.

## 6. Deep links

Card detail uses the History API directly (no router lib): open → `?card=U-005`
is `pushState`d; `popstate` reconciles Back/Forward; refresh on `?card=…`
reopens the dialog. No routing dependency to reconcile.

## 7. Production wiring (mirroring the Hub's table)

| Surface | Stub | Replace with |
| --- | --- | --- |
| Wallet | `useWallet()` (src/lib/wallet.ts) | wagmi / RainbowKit connect |
| Holder pricing | `HOLDER_DISCOUNT` boolean toggle | Alchemy / Moralis ownership check |
| Catalog data | local `CATALOG` in data.ts | Hub `UNIVERSES` import |
| Card art | copied `public/art/` AVIF/LQIP | Hub `art-variants.ts` + `public/art/` |
| Checkout | toasts + clears cart | real mint / order API |
| Filter/sort state | local `useState` | keep (host-agnostic) |
| Fonts | self-declared stacks + bundled Space Grotesk | host `@font-face` PP files |

## 8. Running standalone

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # tsc --noEmit && vite build → dist/
```

The zip excludes `node_modules/` and `dist/`.
