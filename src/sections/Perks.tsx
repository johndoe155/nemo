import { motion } from 'framer-motion';
import { Reveal, Verified, WalletButton, useMockWallet, MOCK_ADDRESS } from '../components/ui';
import { PERK_TIERS } from '../lib/data';

const CEREMONY = ['ACCESS', 'ADVANTAGE', 'ARTIFACT', 'INVITATION'] as const;

function AccessStep({ tier, index }: { tier: (typeof PERK_TIERS)[number]; index: number }) {
  return (
    <Reveal delay={index * 0.1} y={42} blur={false}>
      <motion.article
        className="access-step"
        style={{ '--pc': tier.color } as React.CSSProperties}
        whileHover={{ x: 8 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      >
        <div className="access-step__number">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <i aria-hidden="true" />
        </div>
        <div className="access-step__identity">
          <small>{CEREMONY[index]}</small>
          <h3>{tier.trait}</h3>
          <span>{tier.tag}</span>
        </div>
        <ul className="access-step__benefits">
          {tier.perks.map((perk) => <li key={perk}>{perk}</li>)}
        </ul>
        <div className="access-step__seal" aria-hidden="true">
          <span>NV</span><i />
        </div>
      </motion.article>
    </Reveal>
  );
}

export default function Perks() {
  const wallet = useMockWallet();

  return (
    <section className="section perks" id="perks">
      <div className="perks__halo" aria-hidden="true" />
      <div className="shell">
        <header className="perks__head">
          <div>
            <span className="kicker">IV · ACCESS CEREMONY</span>
            <h2>Four thresholds.<br /><em>One key.</em></h2>
          </div>
          <div className="perks__intro">
            <p>
              Ownership is not a badge pinned to a dashboard. It is a sequence of doors:
              earlier entry, rarer artifacts and a closer position to the next reality.
            </p>
            <span>THE KEY IS ALREADY IN YOUR WALLET</span>
          </div>
        </header>

        <div className="perks__ladder" aria-label="Holder access levels">
          <span className="perks__ladder-line" aria-hidden="true" />
          {PERK_TIERS.map((tier, index) => (
            <AccessStep key={tier.tag} tier={tier} index={index} />
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className={`perks__verify ${wallet.connected ? 'is-verified' : ''}`}>
            <div className="perks__verify-index" aria-hidden="true">04 / KEY CEREMONY</div>
            <div className="copy">
              <span>WALLET VERIFICATION</span>
              <b>{wallet.connected ? 'THE ARCHIVE RECOGNIZES YOU.' : 'PRESENT THE KEY.'}</b>
              <p>
                The demo makes no signature request. In production, on-chain ownership applies
                access and Shopify benefits automatically.
              </p>
            </div>
            <div className="perks__verify-action">
              {wallet.connected && (
                <motion.span className="holderline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Verified /> VERIFIED · <code>{MOCK_ADDRESS}</code> · LEGENDARY
                </motion.span>
              )}
              <WalletButton connected={wallet.connected} onConnect={wallet.connect} onReset={wallet.disconnect} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
