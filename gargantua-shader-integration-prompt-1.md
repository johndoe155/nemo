# Task: Integrate Gargantua Black Hole Shader Into Nemoverse Landing Page

## Context
- Root of the project contains `Gargantua.zip`, a separate Vite + React project containing a black hole shader component.
- The main project is also Vite + React.
- Target insertion point is a specific, narrow section of the homepage — between the **timeline card section** (the "U-007 — THE LAST AURORA" card with the vertical timeline rail and pink glowing node) and the **scrolling marquee** (the diagonal strip reading "...DERS WALK IN FIRST ✳ EVERY...").
- Reference screenshot of this exact region is attached — use it to confirm you've located the right DOM boundary before editing anything.

## Objective
Extract the black hole shader component from `Gargantua.zip` **verbatim** (no rewrites, no "improvements," no dependency swaps) and mount it in the main project, positioned exactly in the gap between the timeline section and the marquee section shown in the screenshot.

## Constraints — read before writing any code

1. **Verbatim extraction only.**
   - Unzip `Gargantua.zip` into a scratch directory first. Do not extract directly over existing project files.
   - Identify the shader component and its dependencies (GLSL/WGSL files, shader material wrapper, any custom hooks, textures/assets it references, and its required npm packages — e.g. `three`, `@react-three/fiber`, `@react-three/drei`, `postprocessing`, etc.).
   - Copy the component file(s) and shader source **byte-for-byte**. Do not reformat, rename variables, or "clean up" the shader code, even if it looks messy or unconventional. If it compiles and renders correctly as-is, leave it exactly as-is.
   - If the donor project's React/Three.js/fiber versions differ from the main project's, flag the version delta explicitly before deciding whether to upgrade/downgrade — do not silently rewrite the component to match a different API surface.

2. **Locate the exact insertion point.**
   - Find the component that renders the timeline/card section (containing "U-007 — THE LAST AURORA" and the vertical rail with the pink node).
   - Find the component that renders the marquee ("...WALK IN FIRST ✳ EVERY...").
   - The shader component must be mounted as a new section **between these two**, as its own component — do not merge its markup into either neighboring component.
   - Do not reorder, resize, or restyle the timeline or marquee sections themselves. Their existing layout, spacing, and behavior must be unaffected except for the new section appearing between them.

3. **Dependency hygiene.**
   - Add only the packages the shader component actually needs to the main project's `package.json`, matching versions as closely as possible to the donor project's `package.json`/lockfile to avoid subtle rendering differences.
   - Do not introduce global CSS resets or overrides from the donor project that could bleed into the rest of the site. Scope any shader-specific styles (CSS Modules, styled-components, or a uniquely-named class) so nothing leaks.

4. **Performance and safety.**
   - This is a WebGL/canvas element on a marketing page — it must not block initial page render. Lazy-load it (`React.lazy` + `Suspense`, or dynamic import) if the donor component doesn't already do this.
   - Respect `prefers-reduced-motion` if the shader animates continuously; provide a static fallback frame or pause the animation loop for users with that preference set, unless the donor component already handles this.
   - Ensure the canvas correctly disposes of its WebGL context on unmount (no leaked contexts if the user navigates within an SPA).

5. **No scope creep.**
   - Do not touch the "SOUND OFF" control, the "ENTER THE NEMOVERSE" hero text, or any other section not explicitly named above.
   - Do not add new global routes, new nav items, or modify `Gargantua.zip`'s original files in place.

## Verification steps (do these before reporting done)
1. Run the dev server and visually confirm the shader renders in the correct position, matching the gap shown in the reference screenshot.
2. Confirm the timeline section above and marquee below are pixel-unaffected (no shift in position/size).
3. Check the browser console for shader compile errors, missing texture 404s, or React warnings introduced by the merge.
4. Confirm no unused dependencies were left in `package.json` from a failed integration attempt.
5. Report back exactly which files were added/modified, and call out anything from the donor project that had to be adapted (versions, import paths, etc.) rather than copied verbatim — this needs a human decision, not a silent fix.

## Deliverable
A working dev build with the Gargantua shader mounted as its own section between the timeline and marquee, plus a short summary of: files added, files modified, dependencies added, and any verbatim-extraction exceptions that had to be made (with reasoning).
