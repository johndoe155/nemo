import { motion } from 'framer-motion';
import { Reveal, SectionHead, Verified, WalletButton, useMockWallet, MOCK_ADDRESS } from '../components/ui';
import { PERK_TIERS } from '../lib/data';

export default function Perks() {
  const wallet = useMockWallet();

  return (
    <section className="section perks" id="perks">
      <div className="shell">
        <SectionHead
          num="03"
          kicker="03 · PILLAR 2 — TOKEN-GATED PERKS"
          kickerGold
          title={
            <>
              Hold the NFT. <span className="txt-gold">Open the doors first.</span>
            </>
          }
          sub={
            <>
              Connect your wallet at the store. Holding the OC NFT — or a specific trait tier —
              unlocks real perks, with first access to new Nemoverse universes as the headline
              reward.
            </>
          }
        />

        <div className="perks__grid">
          {PERK_TIERS.map((tier, i) => (
            <Reveal key={tier.tag} delay={i * 0.08} y={34}>
              <div className="card perk sheen" style={{ '--pc': tier.color }}>
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
              </div>
            </Reveal>
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
              <WalletButton connected={wallet.connected} onConnect={wallet.connect} />
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
    </section>
  );
}
