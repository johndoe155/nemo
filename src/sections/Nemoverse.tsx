import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import UniverseCard from '../components/UniverseCard';
import UniverseDialog from '../components/UniverseDialog';
import { Countdown, Reveal, SortDropdown, type SortMode } from '../components/ui';
import { KineticLink, Magnetic, MagneticButton, RollText } from '../components/motion';
import type { Rarity, Universe } from '../lib/data';
import { RARITY, UNIVERSE_DROP_ISO, UNIVERSES, visibleUniverses } from '../lib/data';
import { useCountdown, useCountUp } from '../lib/hooks';

const SORTS: Record<SortMode, (a: Universe, b: Universe) => number> = {
  newest: (a, b) => new Date(b.released).getTime() - new Date(a.released).getTime(),
  oldest: (a, b) => new Date(a.released).getTime() - new Date(b.released).getTime(),
  rarity: (a, b) => RARITY[b.rarity].tier - RARITY[a.rarity].tier,
  price: (a, b) => b.price - a.price,
};

export default function Nemoverse() {
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [selected, setSelected] = useState<Universe | null>(null);

  const rosterRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  /* Drag rides a motion value — the old per-mousemove setState re-rendered
     the section + all 10 cards on every pointer event. State now flips only
     twice per drag (start/end); pixels go straight to the compositor. */
  const dragX = useMotionValue(0);
  const dragBase = useRef(0);
  const dragStartX = useRef(0);
  const dragMoved = useRef(false);

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

  // Drag support for roster rail (P0.5) — compositor-only, with a 6px
  // threshold that separates "drag the rail" from "click a card".
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || isMobile) return;

    const onDown = (e: MouseEvent) => {
      dragBase.current = x.get();
      dragStartX.current = e.clientX;
      dragMoved.current = false;
      dragX.set(dragBase.current);
      setIsDragging(true);
      rail.style.cursor = 'grabbing';
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const diff = e.clientX - dragStartX.current;
      if (Math.abs(diff) > 6) dragMoved.current = true;
      dragX.set(dragBase.current + diff);
    };
    const onUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      rail.style.cursor = '';
      // Hand the dragged position back to the scroll-driven transform so the
      // rail doesn't snap: solve scrollYProgress for the current dragX value.
      if (maxX > 0) {
        const rect = rosterRef.current?.getBoundingClientRect();
        if (rect) {
          const startY = rect.top + window.scrollY;
          const span = rect.height - window.innerHeight;
          const frac = Math.min(1, Math.max(0, -dragX.get() / maxX));
          const p = 0.06 + frac * 0.88; // mirror of useTransform's [0.06, 0.94]
          window.scrollTo({ top: startY + p * span, behavior: 'auto' });
        }
      }
    };
    // A drag that crossed the threshold must never open a card dialog.
    const onClickCapture = (e: MouseEvent) => {
      if (dragMoved.current) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved.current = false;
      }
    };

    rail.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    rail.addEventListener('click', onClickCapture, true);
    return () => {
      rail.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      rail.removeEventListener('click', onClickCapture, true);
    };
  }, [isDragging, isMobile, maxX, dragX, x]);

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
    <section className="section mv" id="nemoverse">
      <div className="shell">
        <div className="mv__head">
          <div>
            <span className="kicker">01 · THE ANCHOR FEATURE</span>
            <h2 className="display" style={{ fontSize: 'var(--fs-h2)' }}>
              <Reveal>
                The <span className="txt-grad">Nemoverse</span>
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
              <StatTicker value={visibleUniverses.length} label="UNIVERSES" />
            </div>
            <div className="mv__stat">
              <StatTicker value={totalMinted} label="PIECES MINTED" />
            </div>
            <div className="mv__stat">
              <b>1/2WKS</b>
              <span>DROP CADENCE</span>
            </div>
          </div>
        </div>

        <div className="mv__filters">
          {rarityChips.map((c) => (
            <MagneticButton
              key={c.id}
              preset="chrome"
              className={`chip ${filter === c.id ? 'active' : ''}`}
              style={{ '--c': c.id === 'all' ? 'var(--cyan)' : RARITY[c.id as Rarity].color } as React.CSSProperties}
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
            >
              {c.id !== 'all' && <span className="dot" />}
              <RollText text={c.label} />
            </MagneticButton>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            <SortDropdown value={sort} onChange={setSort} />
          </span>
        </div>
      </div>

      {!isMobile ? (
        <div className="roster" ref={rosterRef}>
          <div className="roster__sticky">
            <div className="roster__ghost ghost-text" aria-hidden="true">
              NEMOVERSE
            </div>
            <motion.div className="roster__rail" ref={railRef} style={{ x: isDragging ? dragX : x, opacity: railOpacity }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {list.map((u, i) => (
                  <UniverseCard key={u.id} u={u} index={i} onClick={setSelected} />
                ))}
                <DropTeaserCard key="drop-teaser" />
              </AnimatePresence>
            </motion.div>
            <div className="roster__counter">
              <span>SCROLL TO TRAVERSE</span>
              <div className="progress roster__progress" aria-label="roster progress">
                <i style={{ ['--p' as string]: progress }} />
              </div>
              <span>
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="roster__controls" role="group" aria-label="Step through universes">
              <Magnetic preset="chrome">
                <button
                  className="roster__arrow"
                  onClick={() => goToCard(activeCard - 1)}
                  disabled={activeCard <= 0}
                  aria-label="Previous universe"
                  data-cursor="PREV"
                >
                  <span className="roster__arrow-track" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none">
                      <path d="M11.5 7h-9m4.2-4.2L2.5 7l4.2 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <svg viewBox="0 0 14 14" fill="none">
                      <path d="M11.5 7h-9m4.2-4.2L2.5 7l4.2 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              </Magnetic>
              <Magnetic preset="chrome">
                <button
                  className="roster__arrow"
                  onClick={() => goToCard(activeCard + 1)}
                  disabled={activeCard >= cardCount - 1}
                  aria-label="Next universe"
                  data-cursor="NEXT"
                >
                  <span className="roster__arrow-track" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7h9M7.3 2.8 11.5 7l-4.2 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <svg viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7h9M7.3 2.8 11.5 7l-4.2 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              </Magnetic>
            </div>
            {/* Real focusable controls — the aria-hidden wrapper that used to
                cloak these buttons (a WCAG focusable-inside-hidden violation)
                has been removed; bars are named and current-state-exposed. */}
            <div className="roster__minimap" role="group" aria-label="Jump to a universe">
              {list.map((u, i) => (
                <button
                  key={u.id}
                  className={i === activeCard ? 'active' : ''}
                  onClick={() => goToCard(i)}
                  aria-label={`Jump to ${u.code} — ${u.name}`}
                  aria-current={i === activeCard ? 'true' : undefined}
                >
                  <span aria-hidden="true">{u.code}</span>
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
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((u, i) => (
                <UniverseCard key={u.id} u={u} index={i} onClick={setSelected} />
              ))}
              <DropTeaserCard key="drop-teaser" />
            </AnimatePresence>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && <UniverseDialog u={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </section>
  );
}

function StatTicker({ value, label }: { value: number; label: string }) {
  const { ref, val, started } = useCountUp(value, { duration: 1200 });
  return (
    <>
      <b ref={ref as React.Ref<HTMLElement>} style={{ lineHeight: 1, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.4rem, 1rem + 1.8vw, 2.3rem)' }}>
        {started ? val : value}
      </b>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{label}</span>
    </>
  );
}

/* ---- Teaser card pinned to the end of the rail: the next drop ---- */

/* Date label derives from the drop ISO — the hardcoded "AUG 22" drifted
   from the live countdown whenever the data moved. */
const DROP_LABEL = new Date(UNIVERSE_DROP_ISO)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  .toUpperCase()
  .replace(' ', ' ');

function DropTeaserCard() {
  const t = useCountdown(UNIVERSE_DROP_ISO);
  return (
    <motion.div
      className="ucard"
      layout
      style={{ '--card-accent': 'var(--gold)', width: 'clamp(280px, 26vw, 380px)' }}
      transition={{ layout: { type: 'spring', stiffness: 240, damping: 26 } }}
    >
      <div className="ucard__media" style={{ background: 'radial-gradient(70% 60% at 50% 40%, rgba(255,200,87,0.12), transparent 70%)', display: 'grid', placeItems: 'center' }}>
        <div className="ucard__lock" style={{ textAlign: 'center' }}>
          <div className="ring orbit spin" style={{ width: 80, height: 80, margin: '0 auto 1.1rem', borderColor: 'rgba(255,200,87,0.4)' }} />
          <div className="q" style={{ color: 'var(--gold)' }}>U-007</div>
          <p>THE LAST AURORA</p>
        </div>
      </div>
      <div className="ucard__body" style={{ textAlign: 'center' }}>
        <h3 className="ucard__name" style={{ fontSize: '0.95rem' }}>
          {t.done ? 'U-007 IS LIVE' : `NEXT DROP — ${DROP_LABEL}`}
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
        <KineticLink
          href="#perks"
          className="btn btn-gold"
          style={{ width: '100%' }}
          block
          cursor="ENTER"
          label={t.done ? 'CLAIM THE LAST AURORA' : 'HOLD TO ENTER FIRST'}
          swap={t.done ? 'ENTER THE DROP' : 'HOLDERS CROSS FIRST'}
        />
      </div>
    </motion.div>
  );
}
