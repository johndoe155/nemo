# NEMO — THE WANDERER BETWEEN · Persona Chat Overhaul

A ground-up rebuild of the canon-only persona chat element on the Hub
(`#persona`). The old widget (`.chat` / `.msg` in `components.css`) has been
retired; the new component owns its own namespace and stylesheet.

```
src/components/NemoChat.tsx      the panel (state, choreography, parallax, rail fade)
src/components/ScrambleText.tsx  generative reveal + static line renderer
src/lib/magnetic.tsx             useMagnetic() spring-physics hook + <MagneticButton/>
src/styles/nemo-chat.css         .nchat / .nmsg / .npill design layer
```

---

## 1 · Architectural reshaping & spacing

| Audit finding | Fix |
| --- | --- |
| Claustrophobic layout | Fluid CSS Grid (`grid-template-columns: minmax(0,1fr)`, five explicit rows: header · transcript · suggestions · composer · meta). Internal padding raised from ~17px to `clamp(22px, 2.4vw, 42px)` — **+24px minimum on every side** — with `clamp(16px, 1.7vw, 26px)` row rhythm. |
| Suggested prompts bleeding off-screen | The rail bleeds edge-to-edge (negative inline margins) under a `mask-image: linear-gradient(90deg …)` whose `--fade-l` / `--fade-r` stops are driven by live scroll position. Pills dissolve into the glass instead of being guillotined — no scrollbar, an obvious swipe affordance. |
| Input text clipped ("…in cano") | Composer is a `minmax(0,1fr)` grid track with `text-overflow: ellipsis`, and the placeholder swaps to a compact form under 620px. |
| Solid black divider above the input | Deleted. Separation is now negative space + material: the composer sits on a denser plate (`blur(28px) saturate(160%)`) and the transcript fades out under a vertical mask. No hard geometry anywhere in the panel. |
| Panel floats in dead space | The transcript is bottom-anchored (`justify-content: flex-end`) and the panel height is adaptive (`min-height: clamp(170px,22vh,220px)` → `max-height: min(380px,44vh)`). |

## 2 · Advanced materiality (next-gen glassmorphism)

Four discrete layers instead of one flat purple fill:

0. **`.nchat__mesh`** — animated mesh gradient (iris / cyan / magenta blobs) that
   *breathes* on a 19s + 27s counter-rotating loop and re-centres toward the
   pointer — or the gyroscope on mobile — through lerped `--mx` / `--my` custom
   properties. It sits **behind** the panel so it is genuinely refracted.
1. **`.nchat__glass`** — `backdrop-filter: blur(24px) saturate(150%)` over a deep
   scrim so chroma bleeds through the glass instead of flooding it.
   (`isolation` is deliberately omitted: an isolated stacking context becomes a
   backdrop root and would stop the starfield behind the section from blurring.)
2. **`.nchat__edge`** — a true 1px *inside* border painted with a 135° white →
   transparent → iris → cyan gradient (mask-composite trick), so light reads as
   landing on the top-left edge of the pane.
3. **`.nchat__specular`** — screen-blended specular highlight tracking the
   pointer across the surface.

A `@supports not (backdrop-filter)` fallback swaps in an opaque tinted plate so
contrast never collapses.

**Button refinement.** The loud cyan/purple gradient is gone. `SEND` is now a
frosted translucent pill with a high-contrast white mono label; proximity and
hover bleed a cyan/iris/magenta glow *outward* via a pseudo-element whose
opacity is driven by the magnetic field's `--pull` value — the button never
fills in.

## 3 · Typographic orchestration

* **Mono (Space Mono)** is reserved for metadata: `NEMO · 00:24` timestamps, the
  `ONLINE · IN CHARACTER` status, `SUGGESTED`, the character counter, the footer
  warning and the `SEND` label.
* **Geometric sans (Inter Variable, new dependency)** carries all conversational
  text — chat bubbles and the composer input — via the new `--font-ui` token.
* Primary conversation text is **100% white**; the bubble surface drops to
  `rgba(255,255,255,.032)` so the words pop off the material.
* Tracking on the suggestion pills is now `0.015em` (was `0.18em` uppercase —
  "T E L L  M E  A B O U T"), sentence case preserved.
* The footer warning went from `0.38` alpha ghost text to `0.62` at a larger
  size with tighter tracking; timestamps sit at `0.5`.

## 4 · Physics-based micro-interactions

* **Magnetic controls** — `useMagnetic()` measures the cursor's distance to the
  element *rectangle*; inside the field (24–28px) the shell is pulled on a
  critically-damped spring (`stiffness 260 / damping 20`) while the label drifts
  at 0.34× for internal parallax. Proximity is published as `--pull` for the
  glow. Fine pointers only, disabled under reduced motion.
* **Fluid mounting** — on scroll-into-view the panel scales `0.95 → 1` and lifts
  26px on an expo curve while its `backdrop-filter` blur interpolates
  `0px → 24px` (motion value → `useMotionTemplate`), with the five internal rows
  stagger-fading (75ms apart, 220ms delay).
* **Generative typing** — replies resolve left-to-right on an eased curve with a
  five-glyph cyan noise window running ahead of the resolve point, under a
  `mask-position` sweep on the bubble. The untouched tail stays in the DOM at
  zero opacity so nothing reflows, and the complete string is exposed to screen
  readers immediately.

## Accessibility & motion safety

* `role="log"` + `aria-live="polite"` transcript; scrambling glyphs are
  `aria-hidden`, full text mirrored in a visually-hidden node.
* Visible `:focus-visible` rings on every control; the composer plate lights up
  on `:focus-within`.
* `prefers-reduced-motion: reduce` kills the mesh breathing, the mask sweeps,
  the scramble, the magnetism and the mount choreography — the panel simply
  appears, fully blurred and fully legible.
