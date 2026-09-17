import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import HangingCard from '../components/HangingCard';
import UniverseCard from '../components/UniverseCard';
import UniverseDialog from '../components/UniverseDialog';
import { Countdown, Reveal, SortDropdown, type SortMode } from '../components/ui';
import { KineticLink, Magnetic, MagneticButton, RollText } from '../components/motion';
import type { Rarity, Universe } from '../lib/data';
import { DROP_LABEL, RARITY, UNIVERSE_DROP_ISO, UNIVERSES, visibleUniverses } from '../lib/data';
import { useCountdown, useCountUp } from '../lib/hooks';
import { pageScrollTo } from '../lib/scroll';
import { rodRing } from '../lib/sound';

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
  /* P2.9 — the last few pointer positions, time-stamped: release velocity
     for the inertia handoff (px per ms, rAF-windowed by construction). */
  const dragSamples = useRef<{ t: number; x: number }[]>([]);
  /* Card count mirror for the release-time snap (the list is computed below
     this effect; the ref keeps the closure honest without a TDZ). */
  const cardCountRef = useRef(1);

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
  /* Page scroll — the weak "gust" channel every hanger listens to, so the rack
     reacts to being scrolled past even when the carriage itself is still. */
  const { scrollY: pageScroll } = useScroll();
  const x = useTransform(scrollYProgress, [0.06, 0.94], [0, -maxX]);
  const railOpacity = useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0.25, 1, 1, 0.3]);

  useMotionValueEvent(scrollYProgress, 'change', (v) =>
    setProgress(Math.min(1, Math.max(0, (v - 0.06) / 0.88))),
  );

  /* ---- Suspension carriage -------------------------------------------------
     The rail is driven by two different motion values (scroll-bound `x`, and
     `dragX` while a drag is live). The hanging cards need ONE continuous
     position to differentiate for their pendulum physics, so both sources
     mirror into `carriage`. Velocity of this value = how hard the rod is
     being yanked, which is exactly the force the cards swing against. */
  const carriage = useMotionValue(0);
  useMotionValueEvent(x, 'change', (v) => {
    if (!isDragging) carriage.set(v);
  });
  useMotionValueEvent(dragX, 'change', (v) => {
    if (isDragging) carriage.set(v);
  });
  /* P4.15 (audit 3.4): |carriage velocity|, smoothed over the last few
     events — "how hard the rod is being yanked". Same source the pendulums
     feel; the rod ring reads it so the press sounds like the motion it
     interrupted. */
  const carriageSpeed = useRef(0);
  const lastCarriage = useRef({ v: 0, t: 0 });
  useMotionValueEvent(carriage, 'change', (v) => {
    const now = performance.now();
    const dt = now - lastCarriage.current.t;
    if (dt > 0 && dt < 120) {
      const inst = Math.abs(v - lastCarriage.current.v) / dt; // px per ms
      carriageSpeed.current = carriageSpeed.current * 0.65 + inst * 0.35;
    } else {
      carriageSpeed.current = 0;
    }
    lastCarriage.current = { v, t: now };
  });

  /* Mobile carriage — the touch rack's own scroll position. Native momentum
     scrolling keeps firing scroll events as it decays, so useVelocity reads a
     real flick curve and the cards keep swinging after the finger lifts. */
  const mTrackRef = useRef<HTMLDivElement | null>(null);
  const mCarriage = useMotionValue(0);
  useEffect(() => {
    const el = mTrackRef.current;
    if (!el) return;
    const onScroll = () => mCarriage.set(-el.scrollLeft);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isMobile, mCarriage]);

  // Drag support for roster rail (P0.5) — compositor-only, with a 6px
  // threshold that separates "drag the rail" from "click a card".
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || isMobile) return;

    const onDown = (e: MouseEvent) => {
      dragBase.current = x.get();
      dragStartX.current = e.clientX;
      dragMoved.current = false;
      dragSamples.current = [{ t: e.timeStamp, x: e.clientX }];
      dragX.set(dragBase.current);
      setIsDragging(true);
      rail.style.cursor = 'grabbing';
      /* The grab of a still-moving rail is a rod struck mid-swing: a short
         filtered noise burst, pitched by the yank (registry owns the map;
         0.05 px/ms floor = below walking-speed drift). Fresh timestamp
         check so an idle rail never rings on stale velocity. */
      if (performance.now() - lastCarriage.current.t < 120 && carriageSpeed.current > 0.05) {
        rodRing(carriageSpeed.current);
      }
      /* The custom cursor reads labels off data-cursor on every move —
         swapping it mid-gesture is the whole "grabbed" state change. */
      rail.setAttribute('data-cursor', 'RELEASE');
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const diff = e.clientX - dragStartX.current;
      if (Math.abs(diff) > 6) dragMoved.current = true;
      dragX.set(dragBase.current + diff);
      const samples = dragSamples.current;
      samples.push({ t: e.timeStamp, x: e.clientX });
      // A 4-sample window (~60ms of events) reads the throw, not the start.
      if (samples.length > 4) samples.shift();
    };
    const onUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      rail.style.cursor = '';
      rail.setAttribute('data-cursor', 'DRAG');
      /* P2.9 — release physics. The old handoff was a dead stop: correct,
         but the pendulum cards were still ringing from a throw the carriage
         didn't honor. Now: project the throw (v × inertia constant), snap
         the projection to the card grid, and hand ONE glide to the scroll
         authority — deceleration and the magnetic settle share the same
         easing curve the wheel uses. Under Lenis the rail rides this exact
         scroll, so scroll→rail→pendulum stays one continuous chain. */
      if (maxX > 0) {
        const rect = rosterRef.current?.getBoundingClientRect();
        if (rect) {
          const samples = dragSamples.current;
          let vx = 0;
          if (samples.length >= 2) {
            const first = samples[0];
            const last = samples[samples.length - 1];
            const dt = Math.max(1, last.t - first.t);
            vx = (last.x - first.x) / dt; // px per ms (screen-space throw)
          }
          const current = -dragX.get();
          const count = cardCountRef.current; // live count, mirrored at render
          const pitch = maxX / Math.max(1, count - 1);
          const projected = current - vx * 240; // rail offset px (drag is 1:1)
          const snapped = Math.round(projected / pitch) * pitch;
          const target = Math.max(0, Math.min(maxX, snapped));
          const frac = target / maxX;
          const p = 0.06 + frac * 0.88; // mirror of useTransform's [0.06, 0.94]
          const startY = rect.top + window.scrollY;
          const span = rect.height - window.innerHeight;
          const travel = Math.abs(target - current) / maxX;
          const duration = Math.min(1.2, 0.42 + travel * 1.5);
          pageScrollTo(startY + p * span, { smooth: true, duration });
        }
      }
      dragSamples.current = [];
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
  cardCountRef.current = cardCount;

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
    /* Animated card-jump through the scroll authority — same curve the
       wheel uses, so a nav jump and a hand-spun scroll feel identical. */
    pageScrollTo(startY + range * frac, { smooth: true, duration: 0.9 });
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
            <span className="sechead__index" aria-hidden="true">
              <span className="sechead__index-num">02</span>
              <span>THE REGISTRY</span>
            </span>
            <h2 className="display" style={{ fontSize: 'var(--fs-h2)' }}>
              <Reveal>
                The <span className="hl-act">Nemoverse</span>
              </Reveal>
            </h2>
            <Reveal delay={0.1}>
              <p className="sub" style={{ color: 'var(--ink-dim)', maxWidth: '44rem', marginTop: '0.8rem' }}>
                One canon collection — every commissioned artist creates their own official,
                numbered universe. Browse by rarity, release date, or claim.
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
            {/* Suspension rod — the roster hangs off this. Mounted to the
                section walls, it spans the full sticky width and the cards
                ride it on sliding carriages. */}
            <div className="hangrod" aria-hidden="true">
              <span className="hangrod__mount hangrod__mount--l" />
              <span className="hangrod__bar" />
              <span className="hangrod__mount hangrod__mount--r" />
            </div>
            <motion.div
              className="roster__rail"
              ref={railRef}
              data-cursor={isDragging ? 'RELEASE' : 'DRAG'}
              style={{ x: isDragging ? dragX : x, opacity: railOpacity }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {list.map((u, i) => (
                  <HangingCard key={u.id} index={i} drive={carriage} gust={pageScroll}>
                    <UniverseCard u={u} index={i} onClick={setSelected} lifted={selected?.id === u.id} />
                  </HangingCard>
                ))}
                <HangingCard key="drop-teaser" index={list.length} drive={carriage} gust={pageScroll}>
                  <DropTeaserCard />
                </HangingCard>
              </AnimatePresence>
            </motion.div>
            <div className="roster__counter">
              <span>SCROLL TO TRAVERSE</span>
              {/* `aria-label` is prohibited on a bare div (axe
                  `aria-prohibited-attr`) — a container has no role to name.
                  As a progressbar it gains the role the label implies, and
                  the value was already sitting right there in the counter. */}
              <div
                className="progress roster__progress"
                role="progressbar"
                aria-label="Roster position"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
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
        /* Mobile rig — the SAME suspension: a full-bleed rod across the top of
           the section with the rack hanging off it, swipeable. The physics
           carriage is the track's own scrollLeft, so a flick (and its native
           momentum) throws the cards exactly like the desktop rail drag. */
        <div className="mrail">
          <div className="hangrod" aria-hidden="true">
            <span className="hangrod__mount hangrod__mount--l" />
            <span className="hangrod__bar" />
            <span className="hangrod__mount hangrod__mount--r" />
          </div>
          <div className="mrail__track" ref={mTrackRef}>
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((u, i) => (
                <HangingCard key={u.id} index={i} drive={mCarriage} gust={pageScroll}>
                  <UniverseCard u={u} index={i} onClick={setSelected} lifted={selected?.id === u.id} />
                </HangingCard>
              ))}
              <HangingCard key="drop-teaser" index={list.length} drive={mCarriage} gust={pageScroll}>
                <DropTeaserCard />
              </HangingCard>
            </AnimatePresence>
          </div>
          <div className="mrail__hint">
            SWIPE THE RACK <span className="arr">→</span>
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

function DropTeaserCard() {
  const t = useCountdown(UNIVERSE_DROP_ISO);
  return (
    <motion.div
      className="ucard"
      layout
      /* Width is owned by the rig (.roster__rail/.mrail .ucard) so the teaser
         hangs at exactly the same scale as the roster it closes. */
      style={{ '--card-accent': 'var(--gold)' }}
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
