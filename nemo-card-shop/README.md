# Nemoverse Card Shop

A standalone, full-featured marketplace for the Nemoverse `Universe` collectible
cards — built as a second, independent Vite + React + TypeScript project that
is visually and technically consistent with the Hub (`nemo-main`), so a later
integration is a copy-paste, not a rewrite.

**One canon, infinite versions.** Browse U-001…U-009, filter by rarity /
status / tag, sort, search, open a deep-linkable detail dialog, add to cart,
and toggle holder-gated pricing — everything the embedded Hub `Store` (3 merch
SKUs) and the scroll-jacked Nemoverse rail don't give a collector today.

## Features

- Responsive catalog grid (1 col mobile → 4 desktop) with reserved aspect
  ratios — zero layout shift from image loading.
- Filter by rarity, status (`live` / `upcoming` / `sold-out` / `encrypted` /
  `secret`) and tag; sort by price / rarity tier / release / most-minted.
- Debounced search across name, code, world, artist, style.
- Deep-linkable detail dialog via the History API (`?card=U-005`), full
  keyboard operability, focus trap + return, `Escape` to close.
- Holder-gated pricing (`−25%`) with a mock `useWallet()` (`// TODO: replace
  with real wallet connect`).
- Cart drawer with quantity, running total and a clearly-labelled
  **demo checkout — no real payment**.
- Skeleton loading, a designed empty state, and an error boundary around the
  catalog grid.
- AVIF/WebP responsive art with blur-up LQIP placeholders (mirrors the Hub's
  `CardImage` pattern).
- Every style scoped under `.nemo-shop` — no global selector collisions.
- `prefers-reduced-motion` respected end to end (CSS + `MotionConfig`).

## Quick start

```bash
npm install
npm run dev      # dev server → http://localhost:5174
npm run build    # type-check + production build → dist/
npm run preview  # serve the build
```

## Notes

- PP Neue Machina / Montreal are commercial fonts and are **not** vendored
  here; stacks reference them first and fall back to `system-ui`. Inside the
  Hub they resolve automatically. Space Grotesk is bundled via
  `@fontsource-variable/space-grotesk`.
- Data reuses Nemoverse canon (see `src/lib/data.ts`). Only U-007's release is
  nudged to a future date so the upcoming drop countdown reads live.
- See `INTEGRATION.md` for the full future-merge map.
