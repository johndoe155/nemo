# Master Overhaul Blueprint  
## Phase 0 — Analysis Only / Awaiting Approval

Acknowledged. I will not modify, refactor, delete, rename, or add any code until you explicitly reply **“GO AHEAD.”**

I inspected the current React/Vite/TypeScript application, its sections, design system, assets, animation infrastructure, WebGL/WebGPU stages, tests, and performance safeguards. The existing site is not a bare static implementation—it already contains a substantial cinematic foundation. The opportunity is therefore not to simply “add effects,” but to impose a stronger art direction, narrative rhythm, spatial hierarchy, and visual restraint across the existing system.

---

# 1. Current-State Assessment

## Existing technical foundation

The project currently includes:

- React 18 + TypeScript + Vite
- Framer Motion
- GSAP and ScrollTrigger
- Lenis smooth scrolling
- Three.js / React Three Fiber
- WebGL ambient shader
- WebGL particle field
- WebGPU/WebGL black-hole simulation with static fallback
- Custom cursor and magnetic interactions
- Motion-aware reduced-motion fallbacks
- IntersectionObserver-based off-screen pausing
- Custom font system:
  - PP Neue Machina Inktrap
  - PP Neue Machina Plain
  - PP Neue Montreal
  - Space Grotesk
- Responsive section architecture
- Accessibility and visual-regression coverage
- Existing asset library for hero art, universes, persona model, and particle poses

## Existing content architecture

The current scroll journey is:

1. Loader / typographic morph
2. Hero
3. Nemoverse roster
4. Rotunda / 3D gallery
5. Persona
6. Holder perks
7. POP Pulls
8. Store
9. Artists
10. Lore
11. Sign-off crawl
12. Singularity / black hole
13. Footer and closing CTA

## Current visual language

The current design is primarily:

- Near-black void background
- Cyan, magenta, and gold accents
- Futuristic display typography
- Glass, glow, grain, scanline, and holographic treatments
- “Web3 protocol” interface language
- Many independent interaction systems layered across the page

## Primary opportunity

The current system has many individual cinematic ingredients, but the overall experience risks feeling like a collection of high-production modules rather than one authored film.

The overhaul should prioritize:

- Narrative continuity over isolated effects
- Fewer, more meaningful visual motifs
- Stronger transitions between sections
- More contrast between quiet and explosive moments
- A clearer emotional arc
- More intentional use of color
- Greater visual breathing room
- Better distinction between primary story content and secondary protocol/UI information

---

# 2. Visual & Atmospheric Vision

## Proposed creative direction: **“The Living Archive”**

The site should feel like entering a dormant cosmic archive that gradually becomes sentient.

Rather than presenting the Nemoverse as a conventional Web3 product interface, the page becomes a sequence of discoveries:

1. The archive wakes.
2. The character appears.
3. The canon fractures into infinite universes.
4. The visitor encounters the voice behind the system.
5. Access, ownership, commerce, and authorship are revealed.
6. The archive collapses into its final cosmic state.
7. The visitor is invited to re-enter at the beginning.

The result should feel closer to a cinematic title sequence, museum installation, luxury fashion campaign, and experimental digital product combined.

## Atmospheric qualities

- Deep, almost-black space with zones of controlled color
- Soft atmospheric light rather than constant neon
- Large fields of negative space
- Sparse but significant particle activity
- Interfaces that feel discovered rather than continuously visible
- Typography that behaves like physical material
- Metallic, ink-like, glass-like, and holographic surfaces
- A recurring sense of gravitational pull toward Nemo
- Carefully staged moments of silence between motion sequences

## Color direction

### Core palette

The existing cyan/magenta/gold palette is strong but currently behaves as a broad utility palette. I recommend reducing it into a more cinematic hierarchy:

- **Void** — near-black blue-black foundation
- **Bone / Lunar white** — primary text and archive markings
- **Electric cyan** — system intelligence, navigation, active states
- **Ultraviolet** — dimensional fracture, portals, rare transitions
- **Solar gold** — ownership, rarity, human authorship, value
- **Ember red-orange** — used extremely sparingly for instability or final collapse

### Color choreography by narrative phase

| Phase | Dominant atmosphere |
|---|---|
| Opening | Void, bone, restrained cyan |
| Hero / awakening | Cyan with ultraviolet undertones |
| Universe archive | Cyan, violet, controlled art-specific accent colors |
| Persona | Cooler blue-violet with warmer facial light |
| Holder / store | Gold enters as an ownership signal |
| Artists / lore | Bone, ink, gold, more editorial warmth |
| Singularity | Black, white-hot gold, spectral violet |
| Closing | Nearly monochrome, then one cyan signal |

This avoids every section competing for attention simultaneously.

## Typography pairing

The current type inventory is excellent and should be retained, but its roles should become more editorially disciplined.

### Display voice

**PP Neue Machina Inktrap**

Use for:

- Hero title
- Chapter titles
- Final sign-off statement
- Major numerals
- Singular narrative phrases

### Structural voice

**PP Neue Machina Plain**

Use for:

- Section headings
- Navigation
- Interface titles
- Product and universe names
- Strong short labels

### Reading voice

**PP Neue Montreal / Montreal Text**

Use for:

- Lore
- Artist statements
- Dialog copy
- Longer explanatory content
- Footer prose

### Technical voice

**Space Grotesk**

Use for:

- Metadata
- Coordinates
- Counters
- Dates
- Protocol labels
- Rarity and system information

### Typographic principle

Every section should have:

1. One dominant typographic gesture
2. One secondary reading layer
3. One metadata layer

Currently, some sections contain too many simultaneous label, badge, stat, and interface treatments. The redesign should make the hierarchy instantly legible.

## Motion philosophy

Motion should feel physical, not decorative.

### Core motion behaviors

- **Gravitational pull:** elements subtly drift toward a visual anchor
- **Inertia:** cards, cursor effects, and gallery surfaces continue naturally after input
- **Material response:** glass refracts, text compresses, particles scatter, surfaces flex
- **Delayed revelation:** content arrives in layers rather than all at once
- **Counter-motion:** foreground and background move at different rates
- **Breath:** ambient elements have long, almost imperceptible cycles
- **Impact:** major transitions have a clear beginning, force, and resolution
- **Silence:** some sections should intentionally stop moving

### Motion restraint

The goal is not maximum animation density. The goal is a deliberate relationship between stillness and movement.

I recommend removing or reducing motion when:

- It competes with the primary headline
- It repeats a treatment already used elsewhere
- It exists solely to demonstrate an effect
- It increases GPU cost without improving comprehension
- It makes a section feel like a dashboard instead of a story

---

# 3. Structural & Layout Redesign

## Global journey

The current structure is feature-led. The proposed structure becomes narrative-led.

### Proposed chapters

1. **Wake**
2. **Encounter**
3. **Archive**
4. **Voice**
5. **Access**
6. **Commerce**
7. **Authorship**
8. **Canon**
9. **Collapse**
10. **Return**

The existing functionality can remain, but the visitor should experience it as a connected sequence rather than a list of product modules.

---

## 3.1 Loader — “Wake”

### Current role

Typographic percentage loader morphing into Nemo.

### Redesign direction

Retain the loader concept, but make it feel less like a loading screen and more like an archive activation sequence.

Proposed choreography:

1. Nearly empty void
2. Sparse coordinates or fragments appear
3. Percentage counter behaves like a system heartbeat
4. Numbers lose their mechanical structure
5. Nemo resolves as a living signal
6. The hero does not simply appear—it is revealed through the loader’s residual energy

### Potential additions

- A thin field line or signal trace that continues into the hero
- A single audio-ready interaction state without autoplay
- Loader residue becoming the hero’s first ambient light source
- A more abrupt but elegant handoff rather than a conventional fade

### Non-destructive

This is an enhancement of the existing loader.

---

## 3.2 Navigation — “Archive index”

### Current role

Persistent top navigation, mobile menu, scrollspy, side rail, sound toggle.

### Redesign direction

Make navigation feel like an archival index rather than a standard website header.

Proposed behavior:

- Minimal top bar at rest
- Larger navigation state appears only on interaction or scroll reversal
- Section index becomes a thin vertical signal line
- Active chapter is represented by a changing glyph or light state
- Mobile navigation becomes a full-screen chapter selector with large typographic labels
- The side rail should remain, but become less visually persistent and more instrument-like

### Potential removal/reduction

- Reduce the number of simultaneously visible floating controls
- Consider consolidating the sound toggle, side rail, and cursor hints into a more unified “system chrome” layer

This is a **major chrome restructuring** and requires approval before implementation.

---

## 3.3 Hero — “Encounter”

### Current role

Full-screen hero with title, art, telemetry, countdown badge, orbiting effects, CTA system, particle field, cursor response, and progress indicators.

### Redesign direction

This should become the emotional centerpiece rather than a dense dashboard.

Recommended composition:

- Full-viewport image or atmospheric art field
- Large title with stronger asymmetry
- One primary CTA
- One secondary invitation
- Minimal telemetry, moved to the edges or revealed on hover
- Nemo or the hero artwork becomes the gravitational center
- Typography and image should not compete at equal opacity

### Proposed animation

- Initial title arrives as if pulled from the center of the image
- Art drifts independently from typography
- Particle field reacts to scroll velocity rather than running continuously at full intensity
- CTA becomes a portal aperture rather than a conventional button
- On scroll, the hero image folds or shears into the first archive section

### Potential destructive change

Reducing or relocating hero telemetry and secondary interface elements is a **major structural simplification**. I recommend it, but will not execute it without approval.

---

## 3.4 Marquee transition — “Signal bleed”

### Current role

Horizontal scrolling announcement strips between major sections.

### Redesign direction

Use marquees less frequently and make each one narratively specific.

Instead of several similar strips, use:

- One high-energy signal after the hero
- One quiet archival notation before the footer
- Optional text fragments that distort or resolve as the user scrolls

The marquee should feel like a transmission crossing the page, not a repeated UI component.

---

## 3.5 Nemoverse roster — “Archive”

### Current role

Pinned horizontal universe roster with filtering, sorting, cards, minimap, dialogs, and countdown.

### Redesign direction

This becomes the primary discovery sequence and should receive the most spatial investment after the hero.

Recommended experience:

- Begin with one singular universe card or “archive door”
- As the user scrolls, the archive expands horizontally
- Cards emerge from darkness with varied depth and vertical offset
- The horizontal roster feels like a hanging exhibition or vault
- Filters become a secondary control layer, not the first visual priority
- Universe cards should behave as artifacts, not product tiles

### Card direction

Each universe card should have:

- Stronger art dominance
- Less visible UI chrome at rest
- Metadata revealed on hover/focus
- A consistent physical metaphor: plate, portal, specimen, or archival print
- One unique accent per universe, contained within the global palette

### Dialog direction

The current dialog is feature-rich. It should become a full-screen “artifact inspection” mode:

- Art expands beyond the card boundary
- Lore appears as a side annotation or editorial column
- Specs are treated as catalog data
- Purchase/claim action remains obvious but visually subordinate to discovery

### Potential destructive change

Transforming the roster from a card rail into an artifact archive is a **major structural paradigm shift**. This should be explicitly approved before code execution.

---

## 3.6 Rotunda — “The physical archive”

### Current role

Draggable 3D image sphere with a flat mobile fallback.

### Redesign direction

The sphere should feel like a rare, special moment—not another continuously interactive object immediately following the roster.

Recommended changes:

- Add a short transition from the horizontal archive into the rotunda
- Introduce a quiet pause before interaction
- Use a more architectural stage: dark museum volume, floor reflection, single overhead light
- Make the sphere rotation slower and heavier
- Let hovering one plate temporarily quiet the surrounding plates
- Use a spotlight inspection state rather than another dialog-heavy interaction

### Potential reduction

The rotunda should not repeat every interaction pattern from the roster. Its purpose should be spatial contemplation, not filtering or browsing efficiency.

---

## 3.7 Persona — “Voice”

### Current role

Persona model, chat interface, typing indicators, quick replies, support text.

### Redesign direction

This should be the first section where the archive feels sentient.

Recommended composition:

- Persona model given more negative space
- Chat interface becomes a floating transmission panel
- System UI becomes more conversational and less form-like
- Typing states and responses should feel like the character is noticing the visitor
- Quick replies should be fewer and more emotionally specific

### Interaction concept

The visitor’s cursor or scroll position subtly changes the persona’s attention direction. This should be highly restrained and disabled under reduced motion.

### Important principle

Do not over-explain Nemo here. Let the persona create intrigue rather than resolve the mythology.

---

## 3.8 Holder perks — “Access”

### Current role

Tiered perk cards and mock wallet verification.

### Redesign direction

This is currently one of the more conventional product sections. It should be reframed as an access ceremony.

Recommended treatment:

- Replace a standard four-card grid with a progressive access ladder
- Each tier unlocks spatially rather than appearing all at once
- Verified holder state becomes a dramatic system confirmation
- Gold becomes the primary accent here
- Benefits can remain, but should be visually categorized as:
  - Access
  - Advantage
  - Artifact
  - Invitation

### Potential structural change

A sequential access ladder replacing the grid is a **major layout change** requiring approval.

---

## 3.9 POP Pulls — “Commerce as ritual”

### Current role

Interactive proof-of-purchase simulator with rarity odds, pity system, stamps, bonus sets, and pull interaction.

### Redesign direction

This should become a tactile ritual rather than a utility simulator.

Recommended experience:

- More vertical breathing room
- A central pull object or “sealed fragment”
- Rarity results staged as a reveal
- The stamp card appears as a collectible physical ledger
- The odds and system rules remain accessible, but move into an expandable information state
- The result should have a clear emotional crescendo and cooldown

### Performance direction

The existing WebGL implementation should remain bounded, but the active pull state can receive temporary quality elevation while idle state becomes nearly static.

---

## 3.10 Store — “Artifacts”

### Current role

Product grid with hero product, wallet state, holder pricing, and gated SKUs.

### Redesign direction

Shift away from generic ecommerce presentation.

Recommended composition:

- One editorial hero artifact
- Product stack presented like catalog plates or museum objects
- Product information appears as annotations around the object
- Price and holder state remain clear and accessible
- Product images should receive stronger lighting and shadow treatment
- Cards should not all have identical visual weight

### Potential removal

Standard product-grid conventions, repeated button treatments, and excessive card framing should be reduced. This is a **visual restructuring**, not necessarily a data or functionality deletion.

---

## 3.11 Artists — “Authorship”

### Current role

Hanging artist credit cards.

### Redesign direction

This is an ideal place for a slower, more human section.

Recommended treatment:

- Larger artist names
- More editorial quote treatment
- Less dense metadata at first glance
- Credits can feel like suspended physical works or credits in a film
- Use the gold accent sparingly to indicate provenance and authorship
- Animate the “credit” relationship rather than only the card entrance

### Narrative purpose

This section should make the ecosystem feel human after the technology-heavy sections.

---

## 3.12 Lore — “Canon”

### Current role

Explanatory copy, stats, 60/40 revenue model, timeline.

### Redesign direction

Make this the clearest editorial section on the site.

Recommended changes:

- Fewer competing panels
- Larger text measure and stronger reading rhythm
- Timeline becomes a vertical narrative spine
- Stats become embedded into the story rather than isolated dashboard tiles
- Revenue model is visualized as a simple, elegant proportion
- Use less glow and more contrast

This should feel like the page exhaling.

---

## 3.13 Singularity — “Collapse”

### Current role

Live WebGPU/WebGL black hole with static fallback, positioned at the seam before the closing experience.

### Redesign direction

Retain this as the climax. It is already conceptually strong.

Recommended adjustments:

- Build more anticipation before the section
- Reduce surrounding UI immediately before it
- Ensure the black hole is allowed to exist in silence
- Let the preceding timeline visually lose cohesion into the singularity
- Treat the transition as the collapse of the archive itself
- Keep the static fallback visually authored, not merely functional

### Important constraint

The black hole stage is heavily tested and technically sensitive. It should be treated as a protected subsystem. Visual integration around it can change; the underlying simulation should not be casually rewritten.

---

## 3.14 Footer — “Return”

### Current role

Closing sign-off, crawl, social links, identity, CTA, and back-to-top loop.

### Redesign direction

The footer should feel like the end of a film and the beginning of another cycle.

Recommended composition:

- Nearly monochrome opening
- One closing statement with maximum scale
- Social and navigation links treated as credits
- Final CTA presented as a re-entry point into the Nemoverse
- Back-to-top interaction becomes an intentional loop, not a utility link
- Preserve accessibility and ordinary anchor navigation beneath the cinematic layer

---

# 4. Technical & Interaction Stack

## Recommended implementation stack

The existing stack is appropriate. I do not recommend introducing a new framework or replacing the animation architecture.

### Scroll orchestration

- Continue using Lenis as the single smooth-scroll authority
- Continue routing ScrollTrigger updates through the existing bridge
- Avoid multiple independent scroll loops
- Keep touch scrolling native and avoid trapping mobile scroll
- Preserve existing scroll-lock behavior for dialogs and modal states

### Animation responsibilities

#### GSAP

Use for:

- Timeline-based chapter transitions
- Scroll-linked pinning and staged reveals
- Loader morphing
- Complex DOM choreography
- Section transitions with clear start/end states

#### Framer Motion

Use for:

- Component-local state transitions
- Cursor springs
- Card hover/focus feedback
- Dialog entry/exit
- Small interaction-driven transforms

#### CSS

Use for:

- Ambient breathing
- Decorative opacity and color transitions
- Static states
- Reduced-motion fallbacks
- Compositor-safe transforms and opacity

#### WebGL / Three.js

Reserve for:

- Hero particles
- Ambient background
- Portal CTA
- Rotunda
- Persona model
- Black-hole climax

Do not add WebGL merely to replace a CSS transition.

## Proposed new interaction layer

### 1. Chapter transition system

A shared transition controller can coordinate:

- Current section / narrative chapter
- Ambient scene palette
- Typography intensity
- Grain strength
- Cursor mode
- Background particle density
- Audio-ready state
- Navigation state

This would make the page feel like one continuous experience rather than independently mounted sections.

### 2. Cursor state language

The custom cursor should have a limited vocabulary:

- Default: small light point
- Explore: expanding ring
- Inspect: crosshair or framing reticle
- Enter: portal aperture
- Hold / active: gravitational ring
- Reduced motion/coarse pointer: native pointer and accessible focus states

Avoid assigning a different cursor effect to every component.

### 3. Shared reveal system

Create a consistent reveal grammar:

- Text: clip/reveal or vertical tracking shift
- Image: crop expansion and light bloom
- Metadata: delayed fade/slide
- Cards: depth settle
- Chapter transitions: scene-level wipe or atmospheric shift

This should replace ad hoc reveal behaviors where possible.

### 4. Ambient scene controller

The existing scene-aware `Ambience` system is a strong foundation. It should be extended carefully to support:

- Chapter-specific color temperature
- Intensity modulation
- Scroll velocity response
- User interaction response
- Device quality tier
- Reduced-motion static scene states

### 5. Quality tiers

Recommended quality modes:

#### High

- Full ambient shader
- Particle field enabled
- Persona model enabled
- Rotunda animation enabled
- Black hole live where supported
- Full cursor feedback

#### Balanced

- Reduced particle density
- Lower render scale
- Slower or simplified shader motion
- Persona model may use lower-cost mode
- Rotunda interaction retained

#### Low / mobile

- CSS ambient washes
- Static or sparse particles
- No expensive model preloading
- Flat gallery fallback
- Simplified interaction effects

#### Reduced motion

- No continuous animation loops unless essential
- Static shader frames only
- No cursor springs or magnetic movement
- No cinematic camera movement
- Instant or short opacity-based transitions
- Full keyboard and focus accessibility retained

## Performance controls

Preserve and extend the existing protections:

- IntersectionObserver pauses for off-screen canvases
- DPR caps for GPU rendering
- Render scale adaptation
- WebGL/WebGPU feature detection
- Static visual fallbacks
- Cleanup on unmount and context loss
- Lazy loading for non-critical 3D assets
- No autoplay audio
- Avoid layout properties in continuous animation
- Prefer transforms, opacity, CSS variables, and shader uniforms
- Maintain the existing build and visual regression gates

## Asset strategy

The existing asset library is adequate for the first overhaul phase.

I recommend:

- Continue using AVIF variants as the default image format
- Reserve JPG for fallback paths
- Audit hero and universe image crops for consistent art direction
- Add only targeted new assets if the narrative requires them
- Avoid adding large model or texture payloads until the revised composition is proven
- Keep generated outputs out of Git unless required by the existing build pipeline

---

# 5. Incremental Execution Roadmap

## Milestone 0 — Approval and design lock

No code changes before approval.

After approval:

- Confirm which destructive structural proposals are accepted
- Define the final chapter order
- Confirm whether the current content/data model remains intact
- Establish screenshot references and target viewport sizes
- Record performance and accessibility baselines

## Milestone 1 — Art direction foundation

Scope:

- Refine global color hierarchy
- Establish chapter scene tokens
- Tune typography scale and spacing
- Define shared atmospheric variables
- Reduce visual competition between utility layers
- Document motion durations and easing roles

Deliverable:

- Stable visual foundation without major JSX restructuring

Risk:

- Low to moderate

## Milestone 2 — Global chrome and narrative scaffolding

Scope:

- Navigation refinement
- Side rail integration
- Cursor state system
- Shared chapter transition primitives
- Scroll progress and ambient scene coordination
- Loader-to-hero handoff

Deliverable:

- The page starts feeling like one continuous experience

Risk:

- Moderate

## Milestone 3 — Hero transformation

Scope:

- Recompose hero hierarchy
- Reduce telemetry competition
- Refine title animation
- Rework CTA portal treatment
- Choreograph hero exit into archive

Deliverable:

- Stronger first impression and cinematic opening

Risk:

- Moderate

## Milestone 4 — Archive transformation

Scope:

- Rework Nemoverse roster composition
- Refine universe cards
- Reframe dialog as artifact inspection
- Adjust desktop/mobile relationship
- Coordinate transition into Rotunda

Deliverable:

- The core Nemoverse becomes the primary discovery experience

Risk:

- High if the card rail paradigm is replaced

## Milestone 5 — Rotunda and Persona

Scope:

- Create museum-like Rotunda stage
- Reduce interaction repetition
- Give Persona more negative space
- Refine chat as character transmission
- Coordinate model loading and scene transitions

Deliverable:

- A spatial and emotional midpoint

Risk:

- Moderate to high due to 3D systems

## Milestone 6 — Access, Pulls, and Store

Scope:

- Convert perks into access ceremony
- Reframe POP Pulls as ritual
- Transform store cards into artifact catalog
- Preserve all wallet, rarity, pricing, and gating behavior

Deliverable:

- Functional commerce becomes part of the narrative rather than a visual interruption

Risk:

- Moderate

## Milestone 7 — Artists and Lore

Scope:

- Editorialize artist credits
- Simplify lore layout
- Improve reading rhythm
- Integrate revenue model and timeline into a more human story

Deliverable:

- Emotional grounding and clear comprehension

Risk:

- Low to moderate

## Milestone 8 — Singularity and closing loop

Scope:

- Improve pre-singularity anticipation
- Refine surrounding transition
- Protect live/fallback simulation behavior
- Rework footer as cinematic return point
- Validate the complete loop from closing CTA back to archive

Deliverable:

- A coherent final act

Risk:

- High around existing sign-off and horizon mechanics; implementation should be surgical

## Milestone 9 — Hardening and validation

Scope:

- Run TypeScript build
- Run unit tests
- Run accessibility tests
- Run visual regression suite
- Test desktop, tablet, mobile, touch, coarse pointers, reduced motion, no WebGL, and no WebGPU
- Test keyboard-only navigation
- Validate dialog focus management and scroll locking
- Check GPU frame behavior and off-screen teardown

Deliverable:

- Production-ready cinematic overhaul without sacrificing resilience

---

# 6. Destructive / Major Structural Changes Requiring Explicit Approval

The following proposals are intentionally flagged before implementation:

1. Replacing the current card-led Nemoverse roster with an artifact/archive interaction model
2. Reducing or relocating hero telemetry and secondary interface elements
3. Consolidating or restructuring floating chrome such as the side rail, sound toggle, and cursor hints
4. Replacing the four-card perks grid with a sequential access ladder
5. Reframing the POP Pulls simulator from a dashboard into a ritualized reveal
6. Reworking the standard store grid into an editorial artifact catalog
7. Changing section order or merging narrative chapters
8. Removing any existing user-facing feature, control, CTA, wallet state, rarity system, or accessibility behavior
9. Rewriting the black-hole or sign-off subsystems rather than styling their surrounding composition
10. Introducing additional heavy 3D or shader assets beyond the existing performance budget

My recommendation is to approve the visual and narrative direction first, then approve these structural changes individually or as a group.

---

# 7. Success Criteria

The overhaul will be considered successful when:

- The page reads as one authored cinematic journey rather than a set of feature sections
- The hero has a clear emotional focal point
- Every major section has a distinct narrative purpose
- Motion reinforces hierarchy instead of competing with it
- Color changes communicate narrative phase
- The visitor understands what to do without losing the sense of discovery
- The Nemoverse, artists, commerce, and lore feel connected
- The singularity feels earned as the climax
- Reduced motion remains respectful and complete
- Mobile feels intentionally designed rather than compressed
- Accessibility, performance, and existing functional behavior remain intact
- The experience has visual restraint alongside spectacle

---

## Awaiting sign-off

No files have been modified.

When you are ready for execution, reply:

> **GO AHEAD**

If you want to constrain the direction first, you can also specify which flagged structural changes are approved or rejected.
