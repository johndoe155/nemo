import { Marquee } from '../components/ui';
import { Magnetic } from '../components/Cursor';
import { ARTISTS, UNIVERSES } from '../lib/data';

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
          ENTER THE <span className="txt-grad chroma" data-text="MULTIVERSE.">MULTIVERSE.</span>
        </h2>
        <Magnetic>
          <a href="#multiverse" className="btn btn-primary" data-cursor="ENTER">
            <span className="btn-spark" />
            EXPLORE THE UNIVERSES
          </a>
        </Magnetic>
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
              OC<span className="txt-grad">UNIVERSE</span>
            </div>
            <p>
              A connected Web3 ecosystem anchored by the Multiverse — for the character, the
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
            <a href="#multiverse">The Multiverse</a>
            <a href="#lore">Core Identity</a>
            <a href="#artists">Artists</a>
            <a href="#persona">The Persona</a>
          </div>
          <div className="footer__col">
            <h4>SYSTEMS</h4>
            <a href="#perks">Holder Perks</a>
            <a href="#pulls">POP Pulls</a>
            <a href="#store">Store</a>
            <a href="#loop">The Loop</a>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© 2026 THE OC UNIVERSE · CONCEPT PITCH DEMO</span>
          <span>MULTIVERSE PROTOCOL v0.1.0</span>
          <span>MADE IN THE VOID</span>
        </div>
      </div>
    </footer>
  );
}
