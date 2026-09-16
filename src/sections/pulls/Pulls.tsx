/* ============================================================================
   05 · COMMERCE — the ritual
   ----------------------------------------------------------------------------
   The proof-of-purchase simulator was a utility: a control rail with four
   stat tiles, five probability gauges, a frequency line and a pull button all
   visible at once, next to a stage with a reveal plate, a stamp ledger and
   three floating chips. It read as a dashboard for a gacha mechanic.

   It is now a ritual, in three beats:

     SEALED   — one object at the centre of an altar: the sealed fragment.
                Nothing else on the surface. The state line under it is the
                archive's own voice ("THE ARCHIVE IS SHUFFLED").
     BROKEN   — the pull. The fragment turns, the frequency line locks, the
                reveal plate stages the result with a clear crescendo, and a
                light leaks across the stage.
     LEDGERED — the stamp card records the pull as a collectible physical
                ledger, and the room cools back down.

   The odds, the pity counter and the system rules survive — they are real
   information — but they move into an EXPANDABLE INFORMATION STATE instead of
   sitting on the surface competing with the object.

   PERFORMANCE — the existing WebGL implementation stays bounded: the active
   pull state gets a temporary quality elevation (the stage flash, the plate
   bloom) while the idle state is nearly static (the seal's ring is a CSS
   conic gradient, not a canvas, and the particle field is gated off-screen).
   ========================================================================== */

import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';

import { SectionHead } from '../../components/ui';
import { RARITY, SET_BONUS_AT, STAMP_SLOTS } from '../../lib/data';
import { RARITY_ACCENT, usePullEngine } from './usePullEngine';
import ParticleField from './ParticleField';
import LiquidPullButton from './LiquidPullButton';
import { ProbabilityNode } from './LiquidGauge';
import { FreqLine } from './FreqLine';
import StampCard from './StampCard';
import RevealPlate from './RevealPlate';
import { StatRoll } from './StatRoll';

export default function Pulls() {
  const engine = usePullEngine();
  const sectionRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Stable identity across renders: a fresh array here would tear down and
  // rebuild the whole WebGL particle field on every state change.
  const obstacles = useMemo(() => [railRef, stageRef], []);

  const pityLeft = Math.max(0, STAMP_SLOTS - 1 - engine.stamps);
  const spinning = engine.phase === 'spinning';

  return (
    <section className="section pulls npx" id="pulls" ref={sectionRef}>
      <ParticleField obstacles={obstacles} sectionRef={sectionRef} />

      <div className="shell npx__shell">
        <SectionHead
          center
          num="05"
          kicker="05 · COMMERCE — PROOF-OF-PURCHASE COLLECTIBLES"
          title={
            <>
              Every purchase <em className="npx__serif">pulls a piece</em> of the Nemoverse
            </>
          }
          sub={
            <>
              Buy anything — merch or a universe edition — and a random pull from the current
              Nemoverse set mints to your wallet. No generic receipt art: a genuine, numbered
              piece of the collection.
            </>
          }
        />

        <div className="ritual" data-phase={engine.phase}>
          {/* ==================== THE ALTAR ==================== */}
          <motion.aside
            className="ritual__altar"
            ref={railRef}
            initial={{ opacity: 0, y: 42 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* The sealed fragment — the object itself, not a panel about it. */}
            <div className="ritual__seal" data-spin={spinning ? 'true' : 'false'} aria-hidden="true">
              <span className="ritual__seal-glyph">
                {engine.pulls.length === 0 ? '▚' : String(engine.pulls.length).padStart(2, '0')}
              </span>
            </div>

            <p className="ritual__state" role="status">
              {spinning
                ? 'THE ARCHIVE IS SPLITTING — SIGNAL LOCK IN PROGRESS'
                : engine.bonusReached
                  ? 'GOLDEN GATE OPEN'
                  : 'THE ARCHIVE IS SHUFFLED'}
            </p>

            <LiquidPullButton
              onClick={engine.doPull}
              disabled={engine.phase !== 'idle'}
              spin={spinning}
              label="PULL FROM THE NEMOVERSE"
              spinLabel="ARCHIVE SPLITTING…"
            />

            {/* The signal — the only live indicator on the surface. */}
            <div className={`ritual__indicator ${spinning ? 'is-spinning' : ''}`}>
              <FreqLine spin={spinning} />
            </div>

            {/* THE EXPANDABLE INFORMATION STATE. The odds, the pity counter
                and the holder bonus are real information, so they are one
                deliberate disclosure away — never on the surface. */}
            <details className="ritual__disclosure">
              <summary>
                <span>ODDS · PITY · SYSTEM RULES</span>
              </summary>
              <div className="ritual__disclosure-body">
                <div className="ritual__odds" role="group" aria-label="Live pull probability nodes">
                  {engine.odds.map((o, i) => (
                    <ProbabilityNode key={o.rarity} rarity={o.rarity} pct={o.pct} index={i} />
                  ))}
                  {engine.holderBonus && (
                    <span className="npx__node npx__node--holder">
                      <span className="npx__node-orb" aria-hidden="true">
                        <i />
                      </span>
                      <span className="npx__node-tag">
                        HOLDER <b>+10%</b>
                      </span>
                    </span>
                  )}
                </div>

                <dl className="ritual__facts">
                  <div>
                    <dt>TOTAL PULLS</dt>
                    <dd>
                      <StatRoll value={engine.pulls.length} />
                    </dd>
                  </div>
                  <div>
                    <dt>DISTINCT UNIVERSES</dt>
                    <dd>
                      <StatRoll value={engine.stamps} />
                    </dd>
                  </div>
                  <div>
                    <dt>BEST PULL</dt>
                    <dd
                      style={{
                        color: engine.pulls.length
                          ? RARITY_ACCENT[engine.best].color
                          : undefined,
                      }}
                    >
                      {engine.pulls.length ? RARITY[engine.best].label : 'UNSEALED'}
                    </dd>
                  </div>
                  <div>
                    <dt>PITY · 8TH STAMP</dt>
                    <dd>{engine.pityActive ? 'ARMED' : `IN ${pityLeft}`}</dd>
                  </div>
                  <div>
                    <dt>SET BONUS</dt>
                    <dd>
                      {engine.stamps}/{SET_BONUS_AT}
                    </dd>
                  </div>
                </dl>

                <p className="ritual__fine">
                  DEMO MINT — REAL FLOW: SHOPIFY WEBHOOK → MINT ON <b>BASE</b> → WALLET OR EMAIL.
                  Drawing from the live Nemoverse catalog; metadata on IPFS.
                </p>
              </div>
            </details>
          </motion.aside>

          {/* ==================== THE LEDGER ==================== */}
          <motion.div
            className="ritual__ledger"
            ref={stageRef}
            initial={{ opacity: 0, y: 56 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 1.1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ritual__stage">
              <RevealPlate
                phase={engine.phase}
                spinIdx={engine.spinIdx}
                result={engine.result}
                onPull={engine.doPull}
                onDone={engine.done}
              />
              <StageFlash n={engine.flash} />
            </div>

            <StampCard
              stamps={engine.stamps}
              distinct={engine.distinct}
              latestUid={engine.latestUid}
              phase={engine.phase}
              bonusReached={engine.bonusReached}
              pulls={engine.pulls}
              onReset={engine.reset}
            />
          </motion.div>
        </div>

        <p className="npx__foot">
          SHOPIFY WEBHOOK TRIGGERS THE MINT AFTER CHECKOUT · DRAWING FROM THE LIVE NEMOVERSE
          CATALOG
          <br />
          MINTED TO THE BUYER&rsquo;S WALLET — OR CLAIMABLE VIA EMAIL · LOW-FEE CHAIN: POLYGON /
          BASE · METADATA ON IPFS
        </p>
      </div>
    </section>
  );
}

/* ------------------- gold light-leak flash on unlock ------------------- */

function StageFlash({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <motion.div
      key={n}
      className="npx__stage-flash"
      aria-hidden="true"
      initial={{ opacity: 0.85, scale: 0.9 }}
      animate={{ opacity: 0, scale: 1.25 }}
      transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
