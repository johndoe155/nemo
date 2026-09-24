/* ============================================================================
   03 · THE STAMP BOOK — beat 3 · zone Z1 (reef)  ·  IDENTITY-SPEC §2.2

   An open book, two pages. The pull machine left the "liquid glass archive"
   behind (shader slabs, holographic nodes, telemetry pods, floating chips) and
   became a stamp press on a workbench:

     · LEFT  — THE PRESS: printed readouts, odds as inked probability bars
               (replacing five per-node WebGL gauges), an ink roller line, and
               the press pad itself (StampPress — CSS, no library).
     · RIGHT — THE SHEET: the stamp sheet where every pull lands as an ink
               impression, with the reveal area the stamp comes down onto.

   The engine (usePullEngine) is untouched: odds, holder bonus, pity on the
   eighth stamp and the set bonus are the same mechanics, re-dressed.
   ========================================================================== */

import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { SectionHead } from '../../components/ui';
import { RARITY, SET_BONUS_AT, STAMP_SLOTS } from '../../lib/data';
import { RARITY_ACCENT, usePullEngine } from './usePullEngine';
import ParticleField from './ParticleField';
import StampPress from './StampPress';
import { FreqLine } from './FreqLine';
import StampCard from './StampCard';
import RevealPlate from './RevealPlate';
import { StatRoll } from './StatRoll';

export default function Pulls() {
  const engine = usePullEngine();
  const sectionRef = useRef<HTMLElement | null>(null);
  const pressRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Stable identity across renders: a fresh array here would tear down and
  // rebuild the whole WebGL particle field on every state change.
  const obstacles = useMemo(() => [pressRef, sheetRef], []);

  const pityLeft = Math.max(0, STAMP_SLOTS - 1 - engine.stamps);

  return (
    <section className="section pulls npx" id="pulls" ref={sectionRef}>
      <ParticleField obstacles={obstacles} sectionRef={sectionRef} />

      <div className="shell npx__shell">
        <SectionHead
          center
          num="02"
          kicker="02 · THE STAMP BOOK"
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

        <motion.div
          className="book"
          initial={{ opacity: 0, y: 42 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* =============================== PAGE 1 · THE PRESS =============================== */}
          <div className="book__page book__page--press">
            <div ref={pressRef} style={{ display: 'grid', gap: 'clamp(0.9rem, 1.6vw, 1.4rem)' }}>
              <header className="press__head">
                <span className="press__title">The Press</span>
                <span className={`press__badge ${engine.bonusReached ? 'is-live' : ''}`}>
                  {engine.bonusReached ? 'GOLDEN GATE OPEN' : `${engine.stamps}/${SET_BONUS_AT} TOWARD SET BONUS`}
                </span>
              </header>

              <div className="press__readouts">
                <div className="press__cell">
                  <StatRoll value={engine.pulls.length} className="press__num" />
                  <span>Total pulls</span>
                </div>
                <div className="press__cell">
                  <StatRoll value={engine.stamps} className="press__num" />
                  <span>Distinct universes</span>
                </div>
                <div className="press__cell">
                  <StatRoll
                    value={engine.pulls.length ? RARITY[engine.best].tier : 0}
                    pad={2}
                    color={engine.pulls.length ? RARITY_ACCENT[engine.best].color : undefined}
                    className="press__num"
                  />
                  <span>
                    Best pull ·{' '}
                    <b style={{ color: engine.pulls.length ? RARITY_ACCENT[engine.best].color : undefined }}>
                      {engine.pulls.length ? RARITY[engine.best].label : 'UNSEALED'}
                    </b>
                  </span>
                </div>
                <div className={`press__cell ${engine.pityActive ? 'is-armed' : ''}`}>
                  <StatRoll value={pityLeft} className="press__num" color="var(--stamp-ink)" />
                  <span>Pity · 8th stamp{engine.pityActive ? ' — ARMED' : ` in ${pityLeft}`}</span>
                </div>
              </div>

              {/* live odds as inked bars (replaces five shader gauges) */}
              <div className="odds" role="group" aria-label="Live pull probability">
                {engine.odds.map((o) => (
                  <div className="odds__row" key={o.rarity}>
                    <span className="odds__label">{RARITY[o.rarity].label}</span>
                    <span className="odds__track">
                      <i
                        className="odds__fill"
                        style={
                          {
                            '--w': `${Math.min(100, o.pct)}%`,
                            '--ink-color': RARITY_ACCENT[o.rarity].color,
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="odds__pct">{o.pct.toFixed(1)}%</span>
                  </div>
                ))}
                {engine.holderBonus && (
                  <div className="odds__row is-bonus">
                    <span className="odds__label">Holder</span>
                    <span className="odds__track">
                      <i className="odds__fill" style={{ '--w': '10%', '--ink-color': 'var(--stamp)' } as React.CSSProperties} />
                    </span>
                    <span className="odds__pct">+10%</span>
                  </div>
                )}
              </div>

              <div className={`press__roller ${engine.phase === 'spinning' ? 'is-spinning' : ''}`}>
                <FreqLine spin={engine.phase === 'spinning'} />
                <p>
                  {engine.phase === 'spinning'
                    ? 'THE SET IS RUNNING THROUGH THE PRESS'
                    : 'THE SHEET IS READY · PRESS WHEN YOU ARE'}
                </p>
              </div>

              <StampPress
                onClick={engine.doPull}
                disabled={engine.phase !== 'idle'}
                spin={engine.phase === 'spinning'}
                label="Press to stamp"
                spinLabel="Pressing…"
              />

              <p className="press__note">
                DEMO MINT — REAL FLOW: SHOPIFY WEBHOOK → MINT ON BASE → WALLET OR EMAIL
              </p>
            </div>
          </div>

          {/* =============================== PAGE 2 · THE SHEET =============================== */}
          <div className="book__page book__page--sheet">
            <div ref={sheetRef} style={{ display: 'grid', gap: 'clamp(0.9rem, 1.6vw, 1.4rem)' }}>
              <header className="sheet__head">
                <span className="sheet__title">The Sheet</span>
                <span className="sheet__meta">
                  {engine.stamps} of {STAMP_SLOTS} stamped · {engine.pulls.length} pulls
                </span>
              </header>

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
            </div>
          </div>
        </motion.div>

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
