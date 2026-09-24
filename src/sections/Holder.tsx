import { SectionHead } from '../components/ui';
import Perks from './Perks';
import Store from './Store';

/* ============================================================================
   05 · HOLDER ECONOMICS — beat 5 (zone Z2 · MID-WATER)

   IDENTITY-SPEC §2.2 merge: the perks tiers and the storefront are one
   economic argument — hold the piece, and the whole machine opens — so they
   share one beat, one section shell and one scene handoff. The two parts keep
   their own shells, anchors (#perks, #store) and internal hierarchy under
   part-head labels; nothing pitch-required was deleted, only re-homed.
============================================================================ */

export default function Holder() {
  return (
    <section className="section holder zone-water" id="holder">
      <div className="shell">
        <SectionHead
          num="04"
          kicker="04 · HOLDER ECONOMICS"
          title={
            <>
              Hold the piece. <span className="txt-grad">The doors open first.</span>
            </>
          }
          sub={
            <>
              Trait tiers gate early-claim windows, discounts and SKU unlocks; the storefront
              applies them at checkout. One wallet, one canon, every advantage.
            </>
          }
        />
      </div>
      <Perks />
      <Store />
    </section>
  );
}
