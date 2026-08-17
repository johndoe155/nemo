import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import UniverseCard from '../components/UniverseCard';
import UniverseDialog from '../components/UniverseDialog';
import { Countdown, Reveal } from '../components/ui';
import type { Rarity, Universe } from '../lib/data';
import { RARITY, UNIVERSE_DROP_ISO, UNIVERSES, visibleUniverses } from '../lib/data';
import { useCountdown } from '../lib/hooks';

type SortMode = 'newest' | 'oldest' | 'rarity';

const SORTS: Record<SortMode, (a: Universe, b: Universe) => number> = {
  newest: (a, b) => new Date(b.released).getTime() - new Date(a.released).getTime(),
  oldest: (a, b) => new Date(a.released).getTime() - new Date(b.released).getTime(),
  rarity: (a, b) => RARITY[b.rarity].tier - RARITY[a.rarity].tier,
};

export default function Multiverse() {
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [selected, setSelected] = useState<Universe | null>(null);

  const rosterRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [maxX, setMaxX] = useState(0);
  const [progress, setProgress] = useState(0);
  const [activeCard, setActiveCard] = useState(0);

  // Pinned-roster geometry: how far the rail can travel horizontally.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const measure = () => {
      setIsMobile(mq.matches);
      if (railRef.current) {
        setMaxX(Math.max(0, railRef.current.scrollWidth - window.innerWidth + 80));
      }
    };
    measure();
    mq.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    return () => {
      mq.removeEventListener('change', measure);
      window.removeEventListener('resize', measure);
    };
  }, [filter, sort]);

  const { scrollYProgress } = useScroll({
    target: rosterRef,
    offset: ['start start', 'end end'],
  });
  const x = useTransform(scrollYProgress, [0.06, 0.94], [0, -maxX]);
  const railOpacity = useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0.25, 1, 1, 0.3]);

  useMotionValueEvent(scrollYProgress, 'change', (v) =>
    setProgress(Math.min(1, Math.max(0, (v - 0.06) / 0.88))),
  );

  const list = visibleUniverses.filter((u) => filter === 'all' || u.rarity === filter).sort(SORTS[sort]);
  const cardCount = list.length + 1; // + DropTeaserCard

  useEffect(() => {
    setActiveCard(Math.round(progress * (cardCount - 1)));
  }, [progress, cardCount]);

  // Jump the pinned rail to a specific card by scrolling the window.
  const goToCard = (index: number) => {
    const el = rosterRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startY = rect.top + window.scrollY;
    const endY = rect.bottom + window.scrollY;
    const range = Math.max(0, endY - startY - window.innerHeight);
    const frac = cardCount <= 1 ? 0 : Math.min(1, Math.max(0, index / (cardCount - 1)));
    window.scrollTo({ top: startY + range * frac, behavior: 'smooth' });
  };

  const totalMinted = UNIVERSES.reduce((s, u) => s + u.minted, 0);

  const rarityChips: Array<{ id: Rarity | 'all'; label: string }> = [
    { id: 'all', label: 'ALL' },
    { id: 'common', label: 'COMMON' },
    { id: 'rare', label: 'RARE' },
    { id: 'epic', label: 'EPIC' },
    { id: 'legendary', label: 'LEGENDARY' },
    { id: 'secret', label: 'SECRET' },
  ];

  return (
    <section className="section mv" id="multiverse">
      <div className="shell">
        <div className="mv__head">
          <div>
            <span className="kicker">01 · THE ANCHOR FEATURE</span>
            <h2 className="display" style={{ fontSize: 'var(--fs-h2)' }}>
              <Reveal>
                The <span className="txt-grad">Multiverse</span>
              </Reveal>
            </h2>
            <Reveal delay={0.1}>
              <p className="sub" style={{ color: 'var(--ink-dim)', maxWidth: '44rem', marginTop: '0.8rem' }}>
                One canon collection. Infinite versions of the OC — every commissioned artist creates
                their own official, numbered universe. Browse by artist, release date, or rarity.
              </p>
            </Reveal>
          </div>
          <div className="mv__stats">
            <div className="mv__stat">
              <b>{visibleUniverses.length}</b>
              <span>UNIVERSES</span>
            </div>
            <div className="mv__stat">
              <b>{totalMinted}</b>
              <span>PIECES MINTED</span>
            </div>
            <div className="mv__stat">
              <b>1/2WKS</b>
              <span>DROP CADENCE</span>
            </div>
          </div>
        </div>

        <div className="mv__filters">
          {rarityChips.map((c) => (
            <button
              key={c.id}
              className={`chip ${filter === c.id ? 'active' : ''}`}
              style={{ '--c': c.id === 'all' ? 'var(--cyan)' : RARITY[c.id as Rarity].color }}
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
            >
              {c.id !== 'all' && <span className="dot" />}
              {c.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label="Sort universes"
            >
              <option value="newest">NEWEST FIRST</option>
              <option value="oldest">OLDEST FIRST</option>
              <option value="rarity">BY RARITY</option>
            </select>
          </span>
        </div>
      </div>

      {!isMobile ? (
        <div className="roster" ref={rosterRef}>
          <div className="roster__sticky">
            <div className="roster__ghost ghost-text" aria-hidden="true">
              MULTIVERSE
            </div>
            <motion.div className="roster__rail" ref={railRef} style={{ x, opacity: railOpacity }}>
              {list.map((u, i) => (
                <UniverseCard key={u.id} u={u} index={i} onClick={setSelected} />
              ))}
              <DropTeaserCard />
            </motion.div>
            <div className="roster__counter">
              <span>SCROLL TO TRAVERSE</span>
              <div className="progress roster__progress" aria-label="roster progress">
                <i style={{ width: `${progress * 100}%` }} />
              </div>
              <span>
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="roster__controls" aria-label="Step through universes">
              <button
                className="roster__arrow"
                onClick={() => goToCard(activeCard - 1)}
                disabled={activeCard <= 0}
                aria-label="Previous universe"
              >
                ←
              </button>
              <button
                className="roster__arrow"
                onClick={() => goToCard(activeCard + 1)}
                disabled={activeCard >= cardCount - 1}
                aria-label="Next universe"
              >
                →
              </button>
            </div>
            <div className="roster__minimap" aria-hidden="true">
              {list.map((u, i) => (
                <button
                  key={u.id}
                  className={i === activeCard ? 'active' : ''}
                  onClick={() => goToCard(i)}
                  title={`${u.code} — ${u.name}`}
                >
                  <span>{u.code}</span>
                </button>
              ))}
            </div>
            <div className="roster__hint">
              HORIZONTAL DRIFT <span className="arr">→</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="shell" style={{ marginTop: '2.4rem' }}>
          <div className="roster__rail--wrap" style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {list.map((u, i) => (
              <UniverseCard key={u.id} u={u} index={i} onClick={setSelected} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && <UniverseDialog u={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </section>
  );
}

/* ---- Teaser card pinned to the end of the rail: the next drop ---- */

function DropTeaserCard() {
  const t = useCountdown(UNIVERSE_DROP_ISO);
  return (
    <div className="ucard" style={{ '--card-accent': 'var(--gold)', width: 'clamp(280px, 26vw, 380px)' }}>
      <div className="ucard__media" style={{ background: 'radial-gradient(70% 60% at 50% 40%, rgba(255,200,87,0.12), transparent 70%)', display: 'grid', placeItems: 'center' }}>
        <div className="ucard__lock" style={{ textAlign: 'center' }}>
          <div className="ring orbit spin" style={{ width: 80, height: 80, margin: '0 auto 1.1rem', borderColor: 'rgba(255,200,87,0.4)' }} />
          <div className="q" style={{ color: 'var(--gold)' }}>U-007</div>
          <p>THE LAST AURORA</p>
        </div>
      </div>
      <div className="ucard__body" style={{ textAlign: 'center' }}>
        <h3 className="ucard__name" style={{ fontSize: '0.95rem' }}>
          {t.done ? 'U-007 IS LIVE' : 'NEXT DROP — AUG 22'}
        </h3>
        <div style={{ margin: '0.8rem 0' }}>
          {t.done ? (
            <span className="live-pill">NOW MINTING</span>
          ) : (
            <Countdown target={UNIVERSE_DROP_ISO} />
          )}
        </div>
        <p className="ucard__lore" style={{ minHeight: 0 }}>
          Holders cross first — up to 96 hours early, at a discount. Legendary traits get guaranteed
          variants.
        </p>
        <a href="#perks" className="btn btn-gold" style={{ width: '100%' }}>
          {t.done ? 'CLAIM THE LAST AURORA' : 'HOLD TO ENTER FIRST'}
        </a>
      </div>
    </div>
  );
}
