# Task: Replace the Hero background with the Nemoverse WebGL particle field

## Objective
Swap the current static image background in the hero section (`src/sections/Hero.tsx`) for the WebGL particle-field effect currently living in the standalone file `nemo-webgl.html` (plus its four data files `data/pose0.json`–`pose3.json`. All in nemosite.zip). This is a **background-only** swap — the scope is limited to what `.hero__bg` currently renders. No other section, component, or piece of the hero's own content/layout should change.

Source files for the effect are attached in this repo drop inside nemosite.zip; they are not yet wired into the app.

## Scope boundary — what "background" means here
In `Hero.tsx`, the only element being replaced is:
```tsx
<motion.div className="hero__bg" style={{ scale: bgScale, y: bgY, x: bgX }}>
  <CardImage src={art('hero.jpg')} alt="" sizes="100vw" eager fade={false} fetchpriority="high" />
</motion.div>
```
Everything else in the hero — `.hero__wash`, `.hero__scanlines`, `.hero__watermark`, `.hero__telemetry`, `.hero__content` (badge/marquee, title lines, lede, CTAs, scroll hint), `.hero__progress` — stays exactly as-is, in the same DOM order, same z-index stacking, same scroll-triggered animations.

## Two things "retain every detail" means — please satisfy both
**1. Fidelity to `nemo-webgl.html`.** Every visual and interactive detail of the original WebGL piece should survive the port into React: the four-pose particle morph/hold cycle, the loading overlay with its status text while the pose JSONs fetch, the no-WebGL fallback message, the vignette, the film-grain SVG filter, the ambient "breathing" radial-gradient layer, the pointer-driven particle interaction, the keyboard handler, and the `prefers-reduced-motion` behavior baked into the original script. Don't drop or simplify any of these while adapting the code — if something seems safe to cut for simplicity, leave it in and flag it to me instead.

**2. Nothing else in the existing hero regresses.** The rest of the hero section's current behavior, styling, and animation timing must be untouched by this change.

## Known integration hazards — please handle these explicitly, not silently
`nemo-webgl.html` was written as a standalone full-page document, so several things in it assume it owns the whole viewport. These all need deliberate adaptation, not a blind copy-paste:

- **Full-viewport assumptions.** `html, body { overflow: hidden }`, `canvas { position: fixed; inset: 0 }`, and the resize handler's use of `window.innerWidth`/`window.innerHeight` all assume the canvas fills the browser window. In the real site, the canvas needs to fill and track the bounds of the `.hero` container only (which is `min-height: 100svh` but scrolls away with the rest of the page). Rework sizing/resize logic to measure the hero container (e.g. `ResizeObserver` on the hero element) rather than `window`.
- **Global style leakage.** The original page's `<style>` block includes resets on `html`/`body` and global classes (`.vignette`, `.grain`, `.bg-breathe`, `#fallback`, `.loading-overlay`, etc.). These need to be scoped (CSS module, unique class prefix, or contained under a wrapper selector) so they can't bleed into the rest of the site's global styles.
- **Duplicate pointer-tracking systems.** `Hero.tsx` already has its own `mousemove` listener (`mx`/`my`) that nudges the old background image a few px opposite the cursor, on top of Framer Motion scroll transforms (`bgScale`, `bgX`, `bgY`). `nemo-webgl.html` *also* has its own `pointermove`/`pointerdown` listeners driving particle-level interaction. Decide how these two systems should relate for the new canvas element — e.g. does the canvas keep the outer Framer Motion scale/translate wrapper for scroll parallax while handling its own internal pointer interaction, or should one system be dropped? Don't silently pick one — tell me the tradeoff and what you chose.
- **Reduced-motion handling exists in both places independently** (`Hero.tsx`'s `prefersReduced` check, and the original script's own `matchMedia` listener). Reconcile so reduced-motion users get a consistent result rather than two competing implementations.
- **Lifecycle/cleanup.** This is a persistent SPA, not a page load. Wrap the WebGL logic so `requestAnimationFrame` loops, event listeners, and the GL context are properly torn down on unmount (and safe under React StrictMode/HMR double-invoke in dev).
- **DPR/perf settings in the original** (devicePixelRatio clamped to 1.5, 150ms debounced resize) should carry over as-is unless you find a reason not to — if so, tell me rather than changing it quietly.

## Suggested (not mandatory) file placement
- Move `pose0.json`–`pose3.json` into `public/` (e.g. `public/nemo-particles/`) so they're fetched the same way other static assets are (see `public/art/` for the existing convention), and update the fetch paths accordingly.
- Extract the inline `<script>` logic from `nemo-webgl.html` into its own module under something like `src/three/nemo-particles/` or as a new component (e.g. `src/components/NemoParticleField.tsx`), mounted inside `.hero__bg` in place of the current `CardImage`.
You're free to structure this differently if it fits the codebase's existing conventions better (see `src/three/blackhole/` for a precedent of how another WebGL piece is organized in this project) — use your judgment, just note what you did and why.

## Testing
- Run the existing test suites (`npm run test:unit`, `npm run test:signoff-horizon`) to confirm nothing else regressed.
- Sanity-check at minimum: initial load (loading overlay → particle field), scroll behavior through the hero, resize behavior, reduced-motion mode, and the no-WebGL fallback path.

## Bug protocol
If you find an actual bug while porting this — in the original `nemo-webgl.html` logic, or introduced by the integration — **do not silently fix or work around it**. Stop and report it to me: what it is, where, and what you'd suggest. The exceptions above (viewport scoping, style scoping, lifecycle cleanup) are expected adaptations for embedding a standalone page into a React app, not bugs — those you should just handle. Everything else, flag first.

## Deliverable
When done, give me:
1. A short summary of what changed and where.
2. Any decisions you made on the "duplicate pointer-tracking" / reduced-motion reconciliation points above, and why.
3. Any bugs found, per the protocol above.
4. Confirmation that the existing test suites pass.
5. Only after everything is taken care of, push the updated codebase to your branch of the repo
