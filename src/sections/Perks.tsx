import { motion } from 'framer-motion';

import { RevealLine, RevealMeta, RevealText } from '../components/reveal';
import { Reveal, SectionHead, Verified, WalletButton, useMockWallet, MOCK_ADDRESS } from '../components/ui';
import { PERK_TIERS } from '../lib/data';

/* ============================================================================
   04 · ACCESS — the ceremony

   This used to be a conventional four-card grid: four identical tiles, each
   with a heading, a badge and a bullet list, all arriving at once. It read
   like a pricing table.

   Access is not a table, it is a LADDER: each tier is a rung you step onto,
   each rung hangs off one continuous gold rail, and each one unlocks
   SPATIALLY as the visitor descends — you do not see the whole ladder at
   once, you climb it. The verified holder state is staged as a system
   confirmation rather than printed as a line of text.

   Benefits are categorised rather than listed flat, because a list of nine
   strings does not tell you what KIND of thing you are being given:
     ◇ ACCESS      — you may enter earlier / at all
     ◇ ADVANTAGE   — you pay less, you ship free
     ◇ ARTIFACT    — you receive a physical or on-chain object
     ◇ INVITATION  — you are asked into something
   ========================================================================== */

type BenefitKind = 'ACCESS' | 'ADVANTAGE' | 'ARTIFACT' | 'INVITATION';

/** Classify a benefit line by what it actually GIVES the holder. The copy in
    lib/data.ts is unchanged — this is a reading of it, not a rewrite. */
function classify(perk: string): BenefitKind {
  const p = perk.toUpperCase();
  if (/EARLY|UNLOCKED|BADGE|SKUS/.test(p)) return 'ACCESS';
  if (/DISCOUNT|FREE SHIPPING|ODDS/.test(p)) return 'ADVANTAGE';
  if (/PULL|VARIANT|PIECE/.test(p)) return 'ARTIFACT';
  return 'INVITATION';
}

const KIND_ORDER: BenefitKind[] = ['ACCESS', 'ADVANTAGE', 'ARTIFACT', 'INVITATION'];

function Rung({ tier, i }: { tier: (typeof PERK_TIERS)[number]; i: number }) {
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: tier.perks.filter((p) => classify(p) === kind),
  })).filter((g) => g.items.length > 0);

  return (
    /* RevealPlate owns the settle; the rung's own hover lives in CSS. Depth
       settle, not float — surfaces have weight. */
    <motion.li
      className="rung"
      style={{ '--card-accent': tier.color } as React.CSSProperties}
      initial={{ opacity: 0, y: 46, rotateX: -3 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{
        duration: 1,
        delay: i * 0.14,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div>
        <span className="rung__step">{String(i + 1).padStart(2, '0')}</span>
        <span className="rung__tag">{tier.tag}</span>
      </div>

      <div>
        <RevealText at={0.1 + i * 0.08} className="rung__trait">
          {tier.trait}
        </RevealText>

        <ul className="rung__perks">
          {grouped.flatMap((g) =>
            g.items.map((p) => (
              <li key={p}>
                <span className="vh">{g.kind} — </span>
                {p}
              </li>
            )),
          )}
        </ul>
      </div>
    </motion.li>
  );
}

export default function Perks() {
  const wallet = useMockWallet();

  return (
    <section className="section perks" id="perks">
      <div className="shell">
        <SectionHead
          num="04"
          kicker="04 · ACCESS — TOKEN-GATED PERKS"
          kickerGold
          title={
            <>
              Hold the NFT. <span className="txt-gold">Open the doors in order.</span>
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

        <ol className="ladder" aria-label="Access tiers">
          {PERK_TIERS.map((tier, i) => (
            <Rung key={tier.tag} tier={tier} i={i} />
          ))}
        </ol>

        <Reveal delay={0.15}>
          <div className="access__verify">
            <div className="copy">
              <RevealLine at={0} className="access__verify-label">
                OWNERSHIP VERIFICATION
              </RevealLine>
              <p>
                RainbowKit connect → on-chain ownership check via Alchemy → perks auto-applied at
                Shopify checkout.
              </p>
            </div>
            <div className="access__verify-actions">
              {wallet.connected && (
                <motion.span
                  className="access__confirm"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  role="status"
                >
                  <Verified color="#FFC857" />
                  VERIFIED HOLDER · <code>{MOCK_ADDRESS}</code> · GENESIS · LEGENDARY TRAIT
                </motion.span>
              )}
              <WalletButton
                connected={wallet.connected}
                onConnect={wallet.connect}
                onReset={wallet.disconnect}
              />
            </div>
          </div>
        </Reveal>

        <RevealMeta at={0.6}>
          <p className="perks__foot">
            ◆ Demo wallet state is mocked — no signature is requested. Production wiring:
            WalletConnect/RainbowKit + Alchemy/Moralis + Shopify Admin &amp; Storefront API.
          </p>
        </RevealMeta>
      </div>
    </section>
  );
}
