/* ============================================================================
   RevealPlate — the area of the sheet the stamp comes down onto.

   Was the "holographic reveal stage": a radar sweep over a barrel-tilted grid,
   glitch tearing, chromatic aberration, a light-leak burst. That is the retired
   material language. Now:

     idle     → a sealed page: the stamp position is marked as a dashed CUT
                LINE, with the page's ghost word set behind it.
     spinning → the set cycles through a reading slit that travels down the
                plate (the press is reading the sheet, not glitching).
     done     → the impression LANDS: overshoot + settle on the material
                easing (stamp thud), with the tier, the name and the mint
                serial printed beneath it.

   The action contract is unchanged (onPull / onDone), as is the phase machine.
============================================================================ */

import { AnimatePresence, motion } from 'framer-motion';
import { RARITY } from '../../lib/data';
import { RARITY_ACCENT, spinPool, type PullPhase, type PullResult } from './usePullEngine';
import { StatRoll } from './StatRoll';
import CardImage from '../../components/CardImage';
import { plateSerial } from '../../lib/serials';

interface RevealPlateProps {
  phase: PullPhase;
  spinIdx: number;
  result: PullResult | null;
  onPull: () => void;
  onDone: () => void;
}

export default function RevealPlate({ phase, spinIdx, result, onPull, onDone }: RevealPlateProps) {
  return (
    <div className={`reveal is-${phase}`}>
      <span className="reveal__watermark" aria-hidden="true">
        STAMPED
      </span>

      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div
            key="idle"
            className="reveal__idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <span className="reveal__cutline" aria-hidden="true">
              CUT HERE
            </span>
            <p>The sheet is unmarked</p>
            <em>
              The next piece is already numbered. Press the stamp and it lands here.
            </em>
          </motion.div>
        )}

        {phase === 'spinning' && (
          <motion.div
            key="spin"
            className="reveal__spin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="reveal__wheel">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={spinIdx}
                  src={spinPool[spinIdx].image}
                  alt=""
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                />
              </AnimatePresence>
            </div>
            <p className="reveal__status">READING THE SET…</p>
          </motion.div>
        )}

        {phase === 'done' && result && (
          <motion.div
            key="done"
            className="reveal__done"
            style={{ '--rr': RARITY_ACCENT[result.r].color } as React.CSSProperties}
          >
            <div className={`reveal__portrait${result.u.image ? '' : ' reveal__portrait--sealed'}`}>
              {result.u.image ? (
                <CardImage src={result.u.image} alt={`${result.u.name} pull`} eager sizes="300px" />
              ) : (
                <span>SEALED</span>
              )}
            </div>
            <span className="reveal__tier">
              {RARITY[result.r].label}
              {result.r === 'secret' ? ' · ANOMALY' : ''}
            </span>
            <span className="reveal__name">{result.u.name}</span>
            <span className="reveal__serial">
              {plateSerial(result.u.code)} · MINT{' '}
              <StatRoll value={parseInt(result.mintNo, 10) || 0} pad={3} /> / {result.u.supply}
            </span>
            <div className="reveal__actions">
              <button type="button" onClick={onPull} data-cursor="STAMP">
                STAMP AGAIN
              </button>
              <button type="button" onClick={onDone} data-cursor="DONE">
                KEEP THE PAGE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
