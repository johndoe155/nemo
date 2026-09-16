/* ============================================================================
   Atmosphere — the three layers that give the page one climate.

   They exist because the overhaul needs a single place that owns "how the
   archive feels right now", driven entirely by the chapter controller:

     · .la-wash   a very soft accent wash (the archive's temperature)
     · .la-frame  the authored vignette (how hard the frame closes in)

   Grain already exists (App renders `.grain`); this module does not own it,
   it only makes sure the frame sits above the ambience and below every
   control.

   All three are fixed, pointer-transparent, and animate opacity/transform
   only — no filter, no layout, and nothing that can be invalidated by
   scrolling. Under reduced motion they are static: the chapter still changes
   the values, the CSS transition is simply turned off by the global
   reduced-motion rules.
   ========================================================================== */

export default function Atmosphere() {
  return (
    <>
      <div className="la-wash" aria-hidden="true" />
      <div className="la-frame" aria-hidden="true" />
    </>
  );
}
