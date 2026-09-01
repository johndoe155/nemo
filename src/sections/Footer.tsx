import { Marquee } from '../components/ui';
import { KineticLink, RollText } from '../components/motion';
import { ARTISTS, UNIVERSES } from '../lib/data';
import { LOGO_SRC } from '../lib/assets';

export default function Footer() {
  return (
    <footer className="footer" id="connect">
      <Marquee
        items={[
          'HOLD TO ENTER FIRST',
          'ONE CANON · INFINITE VERSIONS',
          'EVERY PURCHASE PULLS A PIECE',
          'U-007 DROPS AUG 22',
          'ARTISTS CREDITED FOREVER',
          'THE PERSONA IS ALWAYS TEASING',
        ]}
        speed="44s"
      />
      <div className="footer__cta">
        <span className="ghost-num" aria-hidden="true">U-007</span>
        <h2 className="display-xl">
          ENTER THE <span className="txt-grad chroma" data-text="NEMOVERSE.">NEMOVERSE.</span>
        </h2>
        <KineticLink
          href="#nemoverse"
          className="btn btn-primary"
          cursor="ENTER"
          label="EXPLORE THE UNIVERSES"
          swap="ENTER THE VOID"
        />
        <p
          style={{
            marginTop: '1.6rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.66rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          U-007 · THE LAST AURORA · AUG 22 · HOLDERS ENTER FIRST
        </p>
      </div>
      <div className="shell" style={{ paddingTop: '4rem' }}>
        <div className="footer__top">
          <div>
            <div className="footer__brand">
              <img src={LOGO_SRC} alt="Logo" width={48} height={48} />
            </div>
            <p>
              A connected Web3 ecosystem anchored by the Nemoverse — for the character, the
              collectors, and the store. Built for{' '}
              <b style={{ color: 'var(--cyan)' }}>nemo</b> · pitched by Skippy Rizzo · July 2026.
            </p>
            <p style={{ marginTop: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              {UNIVERSES.length} UNIVERSES REGISTERED · {ARTISTS.length} ARTISTS CREDITED · CHAIN:
              BASE / POLYGON
            </p>
          </div>
          <div className="footer__col">
            <h4>UNIVERSE</h4>
            <a href="#nemoverse"><RollText text="The Nemoverse" /></a>
            <a href="#lore"><RollText text="Core Identity" /></a>
            <a href="#artists"><RollText text="Artists" /></a>
            <a href="#persona"><RollText text="The Persona" /></a>
          </div>
          <div className="footer__col">
            <h4>SYSTEMS</h4>
            <a href="#perks"><RollText text="Holder Perks" /></a>
            <a href="#pulls"><RollText text="POP Pulls" /></a>
            <a href="#store"><RollText text="Store" /></a>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© 2026 THE NEMOVERSE · CONCEPT PITCH DEMO</span>
          <span>NEMOVERSE PROTOCOL v0.1.0</span>
          <span>MADE IN THE VOID</span>
        </div>
      </div>
    </footer>
  );
}
