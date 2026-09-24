import { motion } from 'framer-motion';
import { Reveal, Verified, WalletButton, useMockWallet, MOCK_ADDRESS } from '../components/ui';
import { useTilt } from '../components/motion';
import { PERK_TIERS } from '../lib/data';

/* Tier cards share the flagship physics family at reduced throw — one
   motion language across the page instead of two products. */
function PerkCard({ tier, i }: { tier: (typeof PERK_TIERS)[number]; i: number }) {
  const tilt = useTilt<HTMLDivElement>({ maxDeg: 1.4, lift: -4 });
  return (
    <Reveal delay={i * 0.08} y={34} blur={false}>
      <motion.div
        ref={tilt.ref}
        className="card perk sheen"
        style={{ '--card-accent': tier.color, '--pc': tier.color, ...tilt.style }}
        {...tilt.handlers}
      >
        <div className="perk__head">
          <h3 className="perk__trait">{tier.trait}</h3>
          <span className="badge" style={{ '--c': tier.color }}>
            {tier.tag}
          </span>
        </div>
        <ul className="perk__list">
          {tier.perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </motion.div>
    </Reveal>
  );
}

export default function Perks() {
  const wallet = useMockWallet();

  return (
    <div className="perks" id="perks">
      <div className="shell">
        <header className="part-head">
          <span className="part-head__kicker">TOKEN-GATED PERKS</span>
          <h3 className="part-head__title">Four trait tiers, escalating windows</h3>
        </header>

        <div className="perks__grid">
          {PERK_TIERS.map((tier, i) => (
            <PerkCard key={tier.tag} tier={tier} i={i} />
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="perks__verify">
            <div className="copy">
              <b>Wallet verification</b>
              <span>
                RainbowKit connect → on-chain ownership check via Alchemy → perks auto-applied at
                Shopify checkout.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {wallet.connected && (
                <motion.span
                  className="holderline"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Verified />
                  VERIFIED HOLDER · <code>{MOCK_ADDRESS}</code> · GENESIS · LEGENDARY TRAIT
                </motion.span>
              )}
              <WalletButton connected={wallet.connected} onConnect={wallet.connect} onReset={wallet.disconnect} />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p
            style={{
              marginTop: '1.6rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.66rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
            }}
          >
            ◆ Demo wallet state is mocked — no signature is requested. Production wiring:
            WalletConnect/RainbowKit + Alchemy/Moralis + Shopify Admin & Storefront API.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
