import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Reveal, SectionHead, useMockWallet } from '../components/ui';
import type { Rarity, Universe } from '../lib/data';
import { useCountUp } from '../lib/hooks';
import {
  RARITY,
  SET_BONUS_AT,
  STAMP_SLOTS,
  UNIVERSES,
  pullOdds,
  rollRarity,
  universeForPull,
} from '../lib/data';

function MintNo({ value, total }: { value: number; total: number }) {
  const { ref, val } = useCountUp(value, { duration: 900 });
  return (
    <span className="code" ref={ref as React.Ref<HTMLSpanElement>}>
      MINT #{String(val).padStart(3, '0')} / {total}
    </span>
  );
}

interface StoredPull {
  uid: string;
  ts: number;
  rarity: Rarity;
}

const STORAGE_KEY = 'ocu-pulls-v1';

function loadPulls(): StoredPull[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPull[];
    return Array.isArray(parsed) ? parsed.filter((p) => p && p.uid) : [];
  } catch {
    return [];
  }
}

const spinPool = UNIVERSES.filter((u) => u.image && u.status !== 'secret');

export default function Pulls() {
  const wallet = useMockWallet();
  const [pulls, setPulls] = useState<StoredPull[]>(loadPulls);
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');
  const [spinIdx, setSpinIdx] = useState(0);
  const [result, setResult] = useState<{ u: Universe; r: Rarity; mintNo: string } | null>(null);
  const timers = useRef<number[]>([]);

  const distinct = useMemo(() => new Set(pulls.map((p) => p.uid)), [pulls]);
  const stamps = distinct.size;
  const pityActive = stamps >= STAMP_SLOTS - 1;
  const bonusReached = stamps >= SET_BONUS_AT;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pulls));
    } catch {
      /* storage unavailable */
    }
  }, [pulls]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const odds = useMemo(
    () => pullOdds({ stamps, secretUnlocked, holderBonus: wallet.connected }),
    [stamps, secretUnlocked, wallet.connected],
  );

  const doPull = () => {
    if (phase !== 'idle') return;
    setPhase('spinning');
    setResult(null);

    const spin = window.setInterval(() => setSpinIdx((i) => (i + 1) % spinPool.length), 80);
    const finish = window.setTimeout(() => {
      window.clearInterval(spin);
      const r = rollRarity(odds);
      const u = universeForPull(r);
      // Plausible mint number within the edition supply (demo stand-in for the
      // real contract-assigned token id).
      const mintNo = String(Math.floor(Math.random() * Math.max(1, u.supply)) + 1).padStart(3, '0');
      setResult({ u, r, mintNo });
      setPhase('done');
      setPulls((p) => [...p, { uid: String(u.id), ts: Date.now(), rarity: r }]);
      if (r === 'secret') setSecretUnlocked(true);
    }, 1900);
    timers.current.push(finish);
  };

  const reset = () => {
    if (phase === 'spinning') return;
    setPulls([]);
    setResult(null);
    setPhase('idle');
    setSecretUnlocked(false);
  };

  const maxRarity = (): Rarity => {
    const tier = Math.max(...pulls.map((p) => RARITY[p.rarity].tier), 0);
    const r = (Object.keys(RARITY) as Rarity[]).find((k) => RARITY[k].tier === tier);
    return r ?? 'common';
  };
  const best = maxRarity();

  return (
    <section className="section pulls" id="pulls">
      <div className="gridplane" />
      <div className="shell">
        <SectionHead
          center
          num="04"
          kicker="04 · PILLAR 3 — PROOF-OF-PURCHASE COLLECTIBLES"
          title={
            <>
              Every purchase <span className="txt-grad">pulls a piece</span> of the Nemoverse
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

        <div className="pulls__grid">
          {/* ------------------------------ PULL MACHINE ------------------------------ */}
          <Reveal y={36}>
            <div className="card pullboard brackets">
              <div className="pullboard__top">
                <span className="kicker">PULL SIMULATOR</span>
                <span className="badge" style={{ '--c': 'var(--gold)' }}>
                  {bonusReached ? '✦ GOLDEN GATE UNLOCKED' : `${stamps}/${SET_BONUS_AT} TOWARD SET BONUS`}
                </span>
              </div>

              <div className="pullboard__stats">
                <div className="pullboard__stat">
                  <b>{pulls.length}</b>
                  <span>TOTAL PULLS</span>
                </div>
                <div className="pullboard__stat">
                  <b>{stamps}</b>
                  <span>DISTINCT UNIVERSES</span>
                </div>
                <div className="pullboard__stat">
                  <b style={{ color: RARITY[best].color }}>{RARITY[best].label}</b>
                  <span>BEST PULL</span>
                </div>
                <div className="pullboard__stat">
                  <b>{pityActive ? 'ACTIVE' : '—'}</b>
                  <span>PITY (8TH STAMP)</span>
                </div>
              </div>

              <div className="pullboard__odds">
                {odds.map((o) => (
                  <span
                    key={o.rarity}
                    className="chip"
                    style={{ '--c': RARITY[o.rarity].color, cursor: 'default' }}
                  >
                    <span className="dot" />
                    {RARITY[o.rarity].label} {o.weight}%
                  </span>
                ))}
                {wallet.connected && (
                  <span className="chip" style={{ '--c': 'var(--gold)', cursor: 'default' }}>
                    HOLDER ODDS +10%
                  </span>
                )}
              </div>

              <div className="pullboard__stage">
                <AnimatePresence mode="wait">
                  {phase === 'idle' && (
                    <motion.div
                      key="idle"
                      className="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                    >
                      <div className="orbs">
                        <span />
                        <span />
                        <span />
                      </div>
                      <p>THE ARCHIVE IS SHUFFLED</p>
                      <button className="btn btn-primary" onClick={doPull}>
                        <span className="btn-spark" />
                        PULL FROM THE NEMOVERSE
                      </button>
                      <p className="mock">
                        DEMO MINT — REAL FLOW: SHOPIFY WEBHOOK → MINT ON <b>BASE</b> → WALLET OR EMAIL
                      </p>
                    </motion.div>
                  )}

                  {phase === 'spinning' && (
                    <motion.div
                      key="spin"
                      className="pull-result"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <AnimatePresence mode="popLayout">
                        <motion.img
                          key={spinIdx}
                          src={spinPool[spinIdx].image}
                          alt=""
                          initial={{ opacity: 0.4, scale: 0.94, rotate: -2 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.08 }}
                          style={{ '--rr': 'var(--iris)' }}
                        />
                      </AnimatePresence>
                      <span className="code" style={{ color: 'var(--ink-faint)' }}>
                        REVEALING FROM THE ARCHIVE…
                      </span>
                    </motion.div>
                  )}

                  {phase === 'done' && result && (
                    <motion.div
                      key="done"
                      className={`pull-result ${result.r === 'common' ? 'shake-common' : ''}`}
                      initial={{ opacity: 0, scale: 0.85, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                      style={{ '--rr': RARITY[result.r].color }}
                    >
                      <span className="burst" aria-hidden="true" />
                      <img src={result.u.image} alt={`${result.u.name} pull`} />
                      <span className="badge" style={{ '--c': RARITY[result.r].color }}>
                        {RARITY[result.r].label}
                        {result.r === 'secret' ? ' · ANOMALY' : ''}
                      </span>
                      <span className="name">{result.u.name}</span>
                      <span className="code">{result.u.code} ·{' '}</span>
                      <MintNo value={parseInt(result.mintNo, 10) || 0} total={result.u.supply} />
                      <div className="pullboard__resultmeta">
                        <button className="btn btn-primary" onClick={doPull}>
                          PULL AGAIN
                        </button>
                        <button className="btn btn-ghost" onClick={() => setPhase('idle')}>
                          DONE
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Reveal>

          {/* ------------------------------ STAMP CARD ------------------------------ */}
          <Reveal y={36} delay={0.1}>
            <div className="card stampcard">
              <div className="stampcard__head">
                <span className="kicker">STAMP CARD</span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.6rem' }}
                  onClick={reset}
                  disabled={phase === 'spinning' || pulls.length === 0}
                >
                  RESET
                </button>
              </div>

              <div className="stampcard__grid">
                {Array.from({ length: STAMP_SLOTS }, (_, i) => {
                  const filled = i < stamps;
                  const next = i === stamps;
                  const uid = Array.from(distinct)[i];
                  const u = uid ? UNIVERSES.find((x) => String(x.id) === uid) : undefined;
                  return (
                    <div
                      key={i}
                      className={`stamp ${filled ? 'stamp--filled' : ''} ${next ? 'stamp--next' : ''}`}
                      style={{ '--sr': u ? RARITY[u.rarity].color : undefined }}
                      title={u ? `${u.code} — ${u.name}` : next ? 'next stamp' : 'empty'}
                    >
                      {filled && u ? (
                        <>
                          <img src={u.image} alt={u.name} loading="lazy" />
                          <span className="stamp__code">{u.code}</span>
                        </>
                      ) : next ? (
                        <span>NEXT PULL LANDS HERE</span>
                      ) : (
                        <span>○</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="stampcard__progress">
                <div className="labels">
                  <span>SET PROGRESS</span>
                  <span>
                    {stamps}/{STAMP_SLOTS}
                  </span>
                </div>
                <div className="progress">
                  <i style={{ width: `${(stamps / STAMP_SLOTS) * 100}%` }} />
                </div>
              </div>

              <div className="stampcard__bonus">
                <span className="ic">✦</span>
                <div>
                  <b>GOLDEN GATE SET BONUS</b>
                  <p>
                    {bonusReached
                      ? 'You hold a piece from 6+ universes — the Golden Gate is open. (Demo: bonus is simulated.)'
                      : `Collect a piece from ${SET_BONUS_AT}+ distinct universes to unlock the bonus reward — plus, the 8th stamp guarantees a RARE-or-better pull.`}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <p
            style={{
              marginTop: '2.2rem',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.64rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              lineHeight: 2,
            }}
          >
            ◆ SHOPIFY WEBHOOK TRIGGERS THE MINT AFTER CHECKOUT · DRAWING FROM THE LIVE NEMOVERSE CATALOG
            <br />◆ MINTED TO THE BUYER'S WALLET — OR CLAIMABLE VIA EMAIL · LOW-FEE CHAIN: POLYGON / BASE ·
            METADATA ON IPFS
          </p>
        </Reveal>
      </div>
    </section>
  );
}
