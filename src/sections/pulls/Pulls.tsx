/* ============================================================================
   04 · PILLAR 3 — PROOF-OF-PURCHASE COLLECTIBLES
   ----------------------------------------------------------------------------
   The Awwwards-grade rebuild. A rigid two-column card stack becomes an
   asymmetric floating canvas:

     · LEFT  — sticky high-contrast control rail (the Pull Simulator):
               oversized roll-up numerals, kinetic probability nodes with
               liquid shader gauges, the audio-visual frequency line, and the
               Three.js liquid-glass PULL CTA with GSAP magnetic physics.
     · RIGHT — a perspective-skewed interactive 3D canvas (perspective(1400px)
               rotateY(-6deg)) holding the holographic reveal plate and the
               obsidian-etched stamp ledger with spring-flip unlocks.
     · UNDER — a WebGL particle field that bends around both panels on cursor
               velocity and gravity vectors.
   ========================================================================== */

import { useRef } from 'react';
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

  const pityLeft = Math.max(0, STAMP_SLOTS - 1 - engine.stamps);

  return (
    <section className="section pulls npx" id="pulls" ref={sectionRef}>
      <ParticleField obstacles={[railRef, stageRef]} sectionRef={sectionRef} />

      <div className="shell npx__shell">
        <SectionHead
          center
          num="04"
          kicker="04 · PILLAR 3 — PROOF-OF-PURCHASE COLLECTIBLES"
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

        <div className="npx__layout">
          {/* ============================ CONTROL RAIL ============================ */}
          <motion.aside
            className="npx__rail"
            ref={railRef}
            initial={{ opacity: 0, y: 42, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="npx__plate npx__pullsim">
              <span className="npx__plate-borderglow" aria-hidden="true" />

              <div className="npx__plate-head">
                <div>
                  <span className="npx__plate-title">PULL SIMULATOR</span>
                </div>
                <span className={`npx__badge ${engine.bonusReached ? 'is-live' : ''}`}>
                  {engine.bonusReached ? 'GOLDEN GATE OPEN' : `${engine.stamps}/${SET_BONUS_AT} TOWARD SET BONUS`}
                </span>
              </div>

              <div className="npx__stats">
                <div className="npx__stat">
                  <StatRoll value={engine.pulls.length} className="npx__stat-num" />
                  <span>TOTAL PULLS</span>
                </div>
                <div className="npx__stat">
                  <StatRoll value={engine.stamps} className="npx__stat-num" />
                  <span>DISTINCT UNIVERSES</span>
                </div>
                <div className="npx__stat npx__stat--best">
                  <StatRoll
                    value={engine.pulls.length ? RARITY[engine.best].tier : 0}
                    pad={2}
                    color={engine.pulls.length ? RARITY_ACCENT[engine.best].color : undefined}
                    className="npx__stat-num"
                  />
                  <span>
                    BEST PULL ·{' '}
                    <b style={{ color: engine.pulls.length ? RARITY_ACCENT[engine.best].color : undefined }}>
                      {engine.pulls.length ? RARITY[engine.best].label : 'UNSEALED'}
                    </b>
                  </span>
                </div>
                <div className={`npx__stat npx__stat--pity ${engine.pityActive ? 'is-armed' : ''}`}>
                  <StatRoll value={pityLeft} className="npx__stat-num" color="#3fe8ff" />
                  <span>
                    PITY · 8TH STAMP{engine.pityActive ? ' — ARMED' : ` IN ${pityLeft}`}
                  </span>
                </div>
              </div>

              <div className="npx__odds" role="group" aria-label="Live pull probability nodes">
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

              <div className={`npx__indicator ${engine.phase === 'spinning' ? 'is-spinning' : ''}`}>
                <FreqLine spin={engine.phase === 'spinning'} />
                <p>
                  {engine.phase === 'spinning'
                    ? 'THE ARCHIVE IS SPLITTING — SIGNAL LOCK IN PROGRESS'
                    : 'THE ARCHIVE IS SHUFFLED'}
                </p>
              </div>

              <LiquidPullButton
                onClick={engine.doPull}
                disabled={engine.phase !== 'idle'}
                spin={engine.phase === 'spinning'}
                label="PULL FROM THE NEMOVERSE"
                spinLabel="ARCHIVE SPLITTING…"
              />

              <p className="npx__mock">
                DEMO MINT — REAL FLOW: SHOPIFY WEBHOOK → MINT ON <b>BASE</b> → WALLET OR EMAIL
              </p>
            </div>
          </motion.aside>

          {/* ============================ 3D CANVAS ============================ */}
          <motion.div
            className="npx__stage"
            ref={stageRef}
            initial={{ opacity: 0, y: 56, filter: 'blur(10px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 1.1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="npx__stage-tilt">
              <RevealPlate
                phase={engine.phase}
                spinIdx={engine.spinIdx}
                result={engine.result}
                onPull={engine.doPull}
                onDone={engine.done}
              />
              <StampCard
                stamps={engine.stamps}
                distinct={engine.distinct}
                latestUid={engine.latestUid}
                phase={engine.phase}
                bonusReached={engine.bonusReached}
                pulls={engine.pulls}
                onReset={engine.reset}
              />
              <div className="npx__float-chips" aria-hidden="true">
                <span className="npx__float-chip is-a">LIVE ODDS · BOUND TO THE ARCHIVE</span>
                <span className="npx__float-chip is-b">LOW-FEE CHAIN · POLYGON / BASE</span>
                <span className="npx__float-chip is-c">METADATA ON IPFS</span>
              </div>
            </div>
            <StageFlash n={engine.flash} />
          </motion.div>
        </div>

        <p className="npx__foot">
          SHOPIFY WEBHOOK TRIGGERS THE MINT AFTER CHECKOUT · DRAWING FROM THE LIVE NEMOVERSE
          CATALOG
          <br />
          MINTED TO THE BUYER'S WALLET — OR CLAIMABLE VIA EMAIL · LOW-FEE CHAIN: POLYGON / BASE ·
          METADATA ON IPFS
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
