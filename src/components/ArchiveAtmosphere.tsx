/* The quiet connective tissue of the Living Archive.
   lib/scenes.ts already owns chapter detection and stamps `data-scene` on the
   root. This component gives that one state a page-wide physical surface:
   light, a travelling meridian and the fine registration marks that continue
   through every chapter. No second observer or animation loop is introduced. */
export default function ArchiveAtmosphere() {
  return (
    <div className="archive-atmosphere" aria-hidden="true">
      <span className="archive-atmosphere__aura" />
      <span className="archive-atmosphere__meridian" />
      <span className="archive-atmosphere__registration archive-atmosphere__registration--a" />
      <span className="archive-atmosphere__registration archive-atmosphere__registration--b" />
    </div>
  );
}
