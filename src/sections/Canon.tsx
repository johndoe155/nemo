import { SectionHead } from '../components/ui';
import Lore from './Lore';
import Artists from './Artists';

/* ============================================================================
   06 · CANON & CREDITS — beat 6 (zone Z2 → the descent into Z3)

   IDENTITY-SPEC §2.2 merge: the core identity, the canon timeline and the
   permanent public credits are one argument — the character is the constant,
   the artists are the record — so they share a beat. Lore leads (who Nemo is,
   the 60/40 model, the drilling timeline), the credit rod closes the beat and
   hands the page to the trench. Anchors #lore and #artists survive on the
   part wrappers.
============================================================================ */

export default function Canon() {
  return (
    <section className="section canon" id="canon">
      <div className="shell">
        <SectionHead
          num="05"
          kicker="05 · CANON & CREDITS"
          title={
            <>
              One canon. <span className="txt-grad">Signed forever.</span>
            </>
          }
          sub={
            <>
              Who Nemo is, how the universes stay canon, and the public record of every hand that
              has drawn him.
            </>
          }
        />
      </div>
      <Lore />
      <Artists />
    </section>
  );
}
