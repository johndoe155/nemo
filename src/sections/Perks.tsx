import { motion } from 'framer-motion';
import { Reveal, SectionHead, Verified, WalletButton, useMockWallet, MOCK_ADDRESS } from '../components/ui';
import { PERK_TIERS } from '../lib/data';

/* ONE TAKE — the four identical tier cards become one access ladder: a
   single gold thread, four rungs. Each rung is a row — index, trait
   (large), tag, and the benefits as quiet text lines — revealed in
   sequence as the reader climbs. The tiers keep every perk and every
   colour; only the shelf changes. */
function PerkRung({ tier, i }: { tier: (typeof PERK_TIERS)[number]; i: number }) {
  return (
    <Reveal delay={i * 0.07} y={26} blur={false}>
      <div
        className="perk-rung"
        style={{ '--card-accent': tier.color, '--pc': tier.color } as React.CSSProperties}
      >
        <span className="perk-rung__node" aria-hidden="true" />
        <span className="perk-rung__idx" aria-hidden="true">
          {String(i + 1).padStart(2, '0')}
        </span>
        <div className="perk-rung__head">
          <h3 className="perk-rung__trait">{tier.trait}</h3>
          <span className="badge" style={{ '--c': tier.color }}>
            {tier.tag}
          </span>
        </div>
        <ul className="perk-rung__list">
          {tier.perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export default function Perks() {
  const wallet = useMockWallet();

  return (
    <section className="section perks" id="perks">
      <div className="shell">
        <SectionHead
          num="06"
          kicker="FIRST DOORS"
          title={
            <>
              Hold the piece. <span className="hl-act">Open the doors first.</span>
            </>
          }
          sub={
            <>
              Holding the OC — or a specific trait tier — opens what the public waits for:
              earlier access, deeper pricing, rarer artifacts. The headline reward is always
              the same: you cross first.
            </>
          }
        />

        <div className="perks__ladder">
          <span className="perks__thread" aria-hidden="true" />
          {PERK_TIERS.map((tier, i) => (
            <PerkRung key={tier.tag} tier={tier} i={i} />
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
                /* ONE TAKE — verification is a STAMP: the confirmation
                   lands with weight and rings out to rest. */
                <motion.span
                  className="holderline"
                  initial={{ opacity: 0, scale: 1.35 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 17 }}
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
    </section>
  );
}
