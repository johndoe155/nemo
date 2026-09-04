# Task: Integrate the WebGPU black hole simulation into the homepage

## Objective

Extract the black hole simulation from `webgpu-black-hole-config-driven.zip` (root of this
project) and mount it as a live section on the homepage, positioned exactly between the
timeline/lore section ("U-007 — THE LAST AURORA" card with the vertical rail and pink glowing
node) and the scrolling marquee ("...DERS WALK IN FIRST ✳ EVERY..."). Separately, adjust the
site's existing background system so the sections immediately above and below this new section
blend visually into it. This is a high-visibility homepage feature — treat correctness,
performance, and graceful degradation as first-class requirements, not polish.

## Hard constraint: the shader is extracted verbatim

The zip contains `blackhole.js`, `blackhole-shader.js`, `blackhole.config.js`, and
`camera-animation.js`. These four files ARE the shader/simulation. They must be copied into the
project **byte-for-byte identical** — no refactors, no "cleanup," no renaming exports, no
swapping `three/webgpu` or `three/tsl` imports for alternatives, no touching the math, and no
changing values in `blackhole.config.js` (it is documented as the single source of truth for
every tunable parameter — leave it alone). If TypeScript, ESLint, or the bundler complain about
these files, fix it via config (e.g. an override/ignore for that folder) — never by editing the
files themselves.

What you're allowed — even expected — to write yourself is the **glue code**: a new React
mounting layer, since `main.js` from the zip is a standalone Vite entry point (it appends a
fullscreen canvas to `document.body` and listens on `window` resize) and cannot be dropped into
a React component tree as-is. Rewriting that orchestration is not the same as rewriting the
shader — keep that distinction explicit in your work.

## Step 1 — Discover the actual insertion point (don't guess paths)

This project's source tree isn't known ahead of time. Locate it by searching the codebase for
the literal strings `"U-007"`, `"THE LAST AURORA"`, and the marquee text fragment
`"DERS WALK IN FIRST"` (likely `"...RAIDERS WALK IN FIRST"` or similar, wrapping with `✳`).
Identify:
- The component/file rendering the timeline section, and where it ends in the homepage's JSX.
- The component/file rendering the marquee, and where it begins.
- The parent homepage file that lays these out in sequence (e.g. `Home.jsx`, `App.jsx`, or a
  page composition file).

Confirm the exact insertion point is the gap between those two components before writing any
code.

## Step 2 — Port the simulation files

1. Copy `blackhole.js`, `blackhole-shader.js`, `blackhole.config.js`, and `camera-animation.js`
   verbatim into a new dedicated folder, e.g. `src/three/blackhole/`.
2. Check `public/cloud.png` in the zip — confirm whether it's actually referenced anywhere in
   the four files above (a quick grep shows it currently is not used by the shader code). If
   unused, you don't need to carry it over; if you do find a reference, copy it to the project's
   static asset path and preserve the relative path it expects.
3. Reconcile dependencies: the zip requires `three@^0.181.1` and uses `three/webgpu`, `three/tsl`,
   and `three/addons/*` subpath exports (TSL node-based rendering, not classic
   `WebGLRenderer`/`ShaderMaterial`). Check the main project's existing `three` version and any
   existing usage (the homepage's own starfield background may already depend on `three` or
   `@react-three/fiber`, visible in the reference screenshot). If versions conflict:
   - Prefer upgrading the project's `three` to a version that still satisfies the existing
     starfield code AND exposes `three/webgpu` + `three/tsl` (these subpath exports require a
     reasonably recent `three`, in the r170+ range).
   - If the existing background is built on `@react-three/fiber`, verify which `three` version
     that r3f version expects before upgrading, so you don't break the existing background.
   - Do not fork/vendor a second copy of `three` to dodge this — resolve it as a real version
     decision and flag the tradeoff if one exists.
4. This app has **no built-in WebGL fallback** — its own README states it requires
   Chrome/Edge 113+ with WebGPU. Add a feature-detection guard (`navigator.gpu` check, plus a
   try/catch around renderer init) in your new wrapper component. On unsupported browsers,
   render a static fallback (e.g. a still frame / poster image capturing the look in the
   reference screenshot) instead of a blank gap or a crash. This fallback logic lives in your
   glue code, not in the shader files.

## Step 3 — Build the React mount wrapper

Create a component (e.g. `BlackHoleSection.jsx`) that:
- Renders a container `div` with a `ref`, sized to fill its section (not the full viewport —
  `main.js` currently sizes off `window.innerWidth/innerHeight` and appends to `document.body`;
  your wrapper should instead size off the container's own bounding box via `ResizeObserver`,
  and append the renderer's canvas into the container `div`, not `document.body`).
- In a `useEffect`, feature-detects WebGPU, then instantiates `THREE.WebGPURenderer`, the
  `BlackHoleSimulation`, and `CameraAnimation` exactly as `main.js` does, adapted only for
  scoped sizing/mounting.
- Cleans up fully on unmount: cancel the animation frame loop, dispose the renderer
  (`renderer.dispose()`), dispose the WebGPU context, remove the resize observer, and remove the
  canvas from the DOM. This matters because React (especially in dev with `StrictMode`, which
  double-invokes effects) will otherwise leak a second WebGPU context or double-init the sim —
  verify this specifically, don't just assume single-mount behavior.
- Pauses the render loop when the section is off-screen using an `IntersectionObserver`, so this
  isn't burning GPU/battery while the user is scrolled elsewhere on the page. Resume on
  re-entry.
- Respects `prefers-reduced-motion`: if set, skip starting `CameraAnimation`'s cinematic
  auto-orbit (`config.cinematicMode`) even though the config enables it, and consider disabling
  `OrbitControls` damping/inertia too.
- Handles touch input deliberately. `OrbitControls` captures drag gestures to orbit the camera —
  on a touch device this will fight with vertical page-scroll the moment the user's thumb lands
  on the canvas mid-page. Given the reference screenshots are a mobile browser, this is not an
  edge case, it's the primary case. Either scope `OrbitControls` to require a more deliberate
  interaction (e.g. two-finger drag) or disable drag-to-orbit on touch and keep only the
  cinematic auto-camera, and note which you chose.
- Guards against SSR/build-time execution if the framework does anything beyond pure client-side
  rendering (referencing `window`/`document` at module scope will break a build step that
  imports this file outside the browser) — keep all renderer/DOM access inside the effect.

## Step 4 — Insert into the homepage

Place `<BlackHoleSection />` in the homepage's JSX in the exact gap identified in Step 1, between
the timeline component and the marquee component. Give it its own section wrapper with sensible
height (match the framing in the reference screenshot — the black hole roughly centered with
generous space above/below) and confirm it doesn't push the marquee's scroll animation or the
timeline's layout in ways that weren't already responsive.

## Step 5 — Background transition (main project code only — nothing from the zip)

The black hole's canvas already paints its own full-bleed procedural starfield/nebula
background internally (see `blackhole.config.js`: `stars.starBackgroundColor: "#000000"`,
`nebula.nebula1Color: "#071f44"`, `nebula.nebula2Color: "#010615"`, plus the disk's warm tones
`diskInnerColor: "#a84b23"` / `diskOuterColor: "#7f1b00"`). The visual problem to solve is the
seam between the host page's own background and this canvas's self-contained background — not
recreating the shader's background.

The homepage already varies its cosmos background color per section (confirmed by the reference
screenshot's blue/purple gradient). Find that existing background/theming system rather than
hand-rolling a new gradient. In the section immediately above the black hole insertion and the
section immediately below it, tune that system's color stops to ease toward the black hole's own
palette — deep near-black navy (`#010615`–`#071f44` range) with a hint of warm amber
(`#7f1b00`–`#a84b23`) near the seam — so the transition into and out of the canvas reads as
continuous rather than a hard cut. Do this with the site's existing mechanism (CSS custom
properties, gradient stops, per-section theme config, whatever it turns out to be) rather than
introducing a parallel background system.

## Acceptance checklist

- [ ] `blackhole.js`, `blackhole-shader.js`, `blackhole.config.js`, `camera-animation.js` are
      byte-identical to the zip's versions (diff them to confirm).
- [ ] The black hole renders in the correct homepage gap, sized to its section, not fullscreen.
- [ ] No console errors from a duplicated/leaked WebGPU context on hot-reload or remount.
- [ ] Unsupported-WebGPU browsers get a graceful fallback, not a blank section or crash.
- [ ] Touch-scrolling past the section on mobile does not get hijacked by `OrbitControls`.
- [ ] The render loop pauses when the section scrolls out of view.
- [ ] `prefers-reduced-motion` is respected.
- [ ] The sections directly above/below show a visible, intentional gradient toward the black
      hole's palette — no hard seam.
- [ ] Existing homepage sections (timeline, marquee, and the pre-existing starfield background)
      are unaffected/unbroken.

## Do not

- Do not alter any value inside `blackhole.config.js`.
- Do not rewrite or "optimize" `blackhole-shader.js` or `blackhole.js`.
- Do not swap `three/webgpu`/`three/tsl` for a different rendering approach.
- Do not append the canvas to `document.body` — it must be scoped to its section container.
- Do not skip the touch/scroll-conflict handling — this is a mobile-first site per the reference
  screenshots.
