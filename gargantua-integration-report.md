# Gargantua Shader Integration — Report

The donor black-hole shader from `Gargantua.zip` is mounted as its own section between the
Canon Timeline (the **U-007 — THE LAST AURORA** card / drilling-rod rail, last band of `<main>`)
and the footer's tilted credit-crawl marquee ("…DERS WALK IN FIRST ✳ EVERY…").

> Note: the task mentions a reference screenshot "attached" — no image file was present in the
> workspace. The insertion point was located by its unique text markers instead (only one
> timeline section and one credits marquee exist on the page), and the mount position was
> verified against those markers in a real browser.

## Files added — donor code, copied byte-for-byte (sha256-verified)

| File | Purpose |
| --- | --- |
| `src/components/ShaderCanvas.tsx` | the donor React component (canvas + rAF loop) |
| `src/hooks/usePointerState.ts` | donor hook — drag/orbit pointer state |
| `src/hooks/useDocumentVisibility.ts` | donor hook — pause rAF when tab hidden |
| `src/hooks/useDeviceCapabilities.ts` | donor hook — DPR/mobile detection |
| `src/lib/gargantuaRenderer.ts` | donor three.js multipass driver (A→B→C→D→Image) |
| `src/lib/shaderSource.ts` | donor shader/texture module registry |
| `src/lib/renderScale.ts` | donor adaptive mobile render-scale controller |
| `src/lib/device.ts` | donor device detection |
| `src/lib/shaders/bufferA.glsl` … `image.glsl` (5 files) | donor GLSL, untouched |
| `src/assets/color_noise.png`, `src/assets/london.png` | donor iChannel textures, untouched |

Not copied from the donor project: `index.html`, `main.tsx`, `index.css` (donor-app shell;
`index.css` also contains global `html/body/#root` resets that must not bleed into the site),
`vite.config.ts` / `tsconfig*` (donor-app config), **`.env.local` (contains a Vercel OIDC token)
and `.vercel/`** (deployment metadata — secrets/artifacts that don't belong in this repo),
`package-lock.json`, `favicon.svg`.

## Files added — integration layer (new code, not donor)

| File | Purpose |
| --- | --- |
| `src/sections/Gargantua.tsx` | wrapper section: `React.lazy` + `Suspense` code-split, IntersectionObserver mount/unmount gating (~±½ viewport), `prefers-reduced-motion` static fallback |
| `src/styles/gargantua.css` | the donor's two component rules (`.shader-root`, `.shader-canvas`) **verbatim** (its global resets excluded), plus scoped `.gargantua…` integration styles |

## Files modified

- `src/App.tsx` — import + mount `<Gargantua />` as the last child of `<main>`, after `<Lore />`
  (the footer with the crawl marquee follows `</main>` unchanged). Neighbour sections untouched.
- `src/main.tsx` — import `./styles/gargantua.css` (house pattern: central CSS imports).
- `vite.config.ts` — additive `resolve.alias` `'@' → src` (donor files import through `@/`; no
  pre-existing import in the project used `@`).
- `tsconfig.json` — matching `baseUrl`/`paths` for `'@/*'` (additive).

## Dependencies added

**None.** The donor's only runtime dependencies are `react`, `react-dom`, `three` — all already
present. `package.json` is unchanged.

## Version deltas — flagged, human decision (nothing was silently rewritten)

| Package | Donor | Main project | Outcome |
| --- | --- | --- | --- |
| react | ^19.0.0 | ^18.3.1 | Donor component uses only stable hook APIs; typechecked + runs fine on 18. |
| three | ^0.172.0 | ^0.185.1 | **Verified empirically**: the donor app was run under three 0.185.1 and renders pixel-equivalent to 0.172 (incl. the internal `renderer.properties` access used by `verifyPrograms`). Kept 0.185.1 — downgrading would risk `Pulls`/`Starfield`/`Ambience`. |
| vite | ^6.0.7 | ^5.4.11 | Donor uses only `?raw` GLSL imports + PNG asset imports — identical in Vite 5. |

## Verbatim-extraction exceptions (all in *new* files; donor files untouched)

0. **Background de-black pass (follow-up task)** — the shader section originally
   carried the donor's black shell. Fixed with **Option B** (matching/transparent
   background — *not* a transparent canvas): the donor renderer keeps
   `alpha: false` + black clear color because its bloom/tonemap pipeline
   composites against black and the donor files must stay verbatim; instead every
   *wrapper-level* black in `gargantua.css` was removed (`.gargantua` background,
   `.shader-root` background via a scoped override, placeholder/still gradient
   stops) so the section reveals the site's real backdrop — `body { var(--void) }`
   + the fixed `.starfield` — exactly like every neighbouring section. The
   `.gargantua__still::after` black disc remains (it is the black hole, not a
   background).

1. **Donor CSS re-anchoring** — `.shader-root` is `position: fixed; inset: 0` (a full-viewport
   app). Inside the section it is overridden to `position: absolute` via the scoped selector
   `.nemo-gargantua .shader-root` (higher specificity; the verbatim rule above it is untouched).
2. **`touch-action`** — donor sets `touch-action: none` (canvas = whole page in the donor app).
   Embedded mid-scroll, a band eating vertical swipes would trap mobile scrolling, so the scoped
   override `.nemo-gargantua .shader-canvas { touch-action: pan-y }` lets vertical pans scroll
   the page while horizontal drags still orbit (the donor already handles the resulting
   `pointercancel`). Delete the override to restore strict donor behaviour.
3. **Donor global CSS not copied** — `html/body/#root` height/overflow/overscroll resets would
   hijack the marketing site's shell.
4. **Path alias** — donor files import via `@/…`; the alias was added to the main project's
   Vite/tsconfig instead of rewriting donor import paths.

## Performance & safety (wrapper-level; donor code unmodified)

- **Lazy**: shader chunk (three already split into `webgl` chunk) streams only when the section
  approaches the viewport — hero shell unaffected (`ShaderCanvas-*.js` ≈ 34 kB gzip ≈ 10 kB).
- **Intersection-gated**: canvas mounts ~½ viewport before entering, unmounts (donor `dispose()`
  → render targets, materials, textures, renderer) ~½ viewport after leaving. Also scopes the
  donor's window-level arrow-key orbit listeners to the stretch of page where the band is
  visible — note the donor **does** `preventDefault()` arrow keys while mounted (flagged as
  inherited behaviour; mitigated, not changed).
- **prefers-reduced-motion**: static CSS eclipse frame, no animation loop.
- Verified in-browser: no `[gargantua]` console errors, no shader compile/link failures, no
  404s (both textures 200), no React warnings introduced; canvas unmounts off-screen.

## Verification summary (headless Chromium + SwiftShader WebGL2, dev server)

1. DOM order: `#lore → #gargantua → footer.signoff` (crawl marquee first element of footer). ✔
2. Removing the band moves the marquee by exactly the band height (420.0px); Lore's box is
   pixel-identical — no margin/spacing side-effects on neighbours. ✔
3. Shader mounts on approach, renders, and converges to the same image as the standalone donor
   app run side-by-side (donor ≈ 97 mean luma; integrated tracks it; earlier "blown-out"
   readings were an artifact of a CPU-starved test run, reproduced and ruled out). ✔
4. Reduced-motion: `.gargantua__still` renders, no canvas. ✔
5. `npm run build` (tsc -b + vite) passes; lazy chunk + texture assets emitted. ✔
