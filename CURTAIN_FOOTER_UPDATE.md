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
