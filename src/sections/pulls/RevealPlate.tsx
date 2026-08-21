/* ============================================================================
   RevealPlate — the holographic reveal stage of the 3D canvas.

   idle    → sealed archive slate, ghost watermark, idle scan sweep.
   spinning→ fast-cycling universe portraits with glitch tearing + scanlines.
   done    → the pulled piece materialises: chromatic-aberration entrance,
             rarity rim light, light leaks, mint roll-up, next actions.
   ========================================================================== */

import { AnimatePresence, motion } from 'framer-motion';
import { RARITY } from '../../lib/data';
import { RARITY_ACCENT, spinPool, type PullPhase, type PullResult } from './usePullEngine';
import { StatRoll } from './StatRoll';

interface RevealPlateProps {
  phase: PullPhase;
  spinIdx: number;
  result: PullResult | null;
  onPull: () => void;
  onDone: () => void;
}

export default function RevealPlate({ phase, spinIdx, result, onPull, onDone }: RevealPlateProps) {
  return (
    <div className={`npx__reveal is-${phase}`}>
      <span className="npx__reveal-corners" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="npx__reveal-scan" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div
            key="idle"
            className="npx__reveal-idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.4 }}
          >
            <span className="npx__reveal-seal" aria-hidden="true">
              ✦
            </span>
            <p>ARCHIVE SEALED</p>
            <em>THE NEXT PIECE IS ALREADY NUMBERED. PULL TO BREAK THE SEAL.</em>
          </motion.div>
        )}

        {phase === 'spinning' && (
          <motion.div
            key="spin"
            className="npx__reveal-spin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="npx__reveal-wheel">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={spinIdx}
                  src={spinPool[spinIdx].image}
                  alt=""
                  initial={{ opacity: 0.25, scale: 0.92, rotate: -3, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, rotate: 3, filter: 'blur(8px)' }}
                  transition={{ duration: 0.12 }}
                />
              </AnimatePresence>
              <span className="npx__reveal-glitch" aria-hidden="true" />
            </div>
            <p className="npx__reveal-status">REVEALING FROM THE ARCHIVE…</p>
          </motion.div>
        )}

        {phase === 'done' && result && (
          <motion.div
            key="done"
            className={`npx__reveal-done ${result.r === 'common' ? 'is-common' : ''}`}
            initial={{ opacity: 0, scale: 0.82, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ '--rr': RARITY_ACCENT[result.r].color } as React.CSSProperties}
          >
            <span className="npx__reveal-burst" aria-hidden="true" />
            <span className="npx__reveal-leak" aria-hidden="true" />
            <div className="npx__reveal-portrait">
              <img src={result.u.image} alt={`${result.u.name} pull`} />
              <span className="npx__reveal-rim" aria-hidden="true" />
            </div>
            <span className="npx__reveal-badge">
              {RARITY[result.r].label}
              {result.r === 'secret' ? ' · ANOMALY' : ''}
            </span>
            <span className="npx__reveal-name">{result.u.name}</span>
            <span className="npx__reveal-code">
              {result.u.code} · MINT <StatRoll value={parseInt(result.mintNo, 10) || 0} pad={3} /> / {result.u.supply}
            </span>
            <div className="npx__reveal-actions">
              <button type="button" className="npx__cta-mini" onClick={onPull}>
                <span aria-hidden="true">✦</span> PULL AGAIN
              </button>
              <button type="button" className="npx__ghostbtn" onClick={onDone}>
                DONE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
