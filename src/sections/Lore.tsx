import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Reveal, SectionHead } from '../components/ui';
import { useTilt } from '../components/motion';
import { LORE_STATS, LORE_TIMELINE } from '../lib/data';
import { useCountUp } from '../lib/hooks';

gsap.registerPlugin(ScrollTrigger);

/* Per-node accent. These hues belong to the CARDS (their edge, collar, meta
   type) — the rod itself is colour-agnostic and never reads one of them. */
const NODE_HUES = ['var(--gold)', 'var(--iris)', 'var(--cyan)', 'var(--iris)', 'var(--magenta)'];

function LoreStat({ value, suffix, label, note, delay }: (typeof LORE_STATS)[number] & { delay: number }) {
  const { ref, val } = useCountUp(value, { duration: 1400 });
  const tilt = useTilt<HTMLDivElement>({ maxDeg: 1.2, lift: 0 });
  return (
    <Reveal delay={delay} y={22} blur={false}>
      <motion.div
        ref={tilt.ref}
        className="lorestat sheen"
        style={tilt.style}
        {...tilt.handlers}
      >
        <b ref={ref as React.Ref<HTMLElement>}>
          {val}
          {suffix}
        </b>
        <span>{label}</span>
        <em>{note}</em>
      </motion.div>
    </Reveal>
  );
}

/* ============================================================================
   CANON TIMELINE — the drilling rod

   The text list is rebuilt as rectangular node cards alternating either side
   of the centre axis, each pinned to the axis by a connector arm and a node.

   THE ROD IS DRAWN TWICE (the threading rig)
     One bar, one paint, two z-layers. `.ctl__rail--back` sits UNDER the cards
     (the length the rod is still entering); `.ctl__rail--front` sits OVER them
     (the length already through). The front rail is a single full-height
     element, so its gradient is pixel-identical to the back one at any given
     y — the two halves cannot drift apart in colour. What makes it thread is
     the front rail's MASK: one window per row, opening exactly on the hole's
     centre line (the handoff) and closing half a gap past the card's bottom
     edge. Above the handoff the rod is behind the card; below it, the rod is
     in front — over the card's lower half and over its bottom edge. Row
     heights are content-driven, so the windows are measured in JS, not
     guessed, and re-measured by a ResizeObserver.

   The rod is GSAP ScrollTrigger territory (framer owns the card entrances):
     · One scrubbed trigger scales BOTH fills from 0 → 1 along the Y-axis,
       anchored so the rod's TIP always sits on the same viewport line (65%).
       Scrolling down literally drives the rod deeper into the section — and
       because the front half is the same tween, it emerges through each card
       in exact lockstep with the tip instead of fading in on a class.
     · The glowing drill head rides that tip, on its own layer above the cards
       (it is smaller than the punch, so it is only ever seen THROUGH it).
     · Because the tip line is fixed, each node can own a second trigger on
       exactly the same line — so a node lights up (and starts catching the
       rod's cast shadow) at the precise frame the rod penetrates it.
   All of it is registered inside a gsap.context + matchMedia so reduced-motion
   visitors get the finished state instantly and cleanup is automatic.
   ========================================================================== */
function CanonTimeline() {
  const scope = useRef<HTMLDivElement | null>(null);
  const head = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const rail = el.querySelector<HTMLElement>('.ctl__rail--back');
    const thread = el.querySelector<HTMLElement>('.ctl__rail--front');
    const fills = gsap.utils.toArray<HTMLElement>('.ctl__fill', el);
    const rows = gsap.utils.toArray<HTMLElement>('.ctl__row', el);
    const mm = gsap.matchMedia();

    /* ---- measure the front half's windows --------------------------------
       One `linear-gradient` mask, one window per row, in rail-space
       percentages: open on the hole's centre (row centre — the collar, the
       punch and the handoff all share that line), close half a row-gap past
       the card's bottom edge, which is where the rod rejoins the length
       behind. A 1px feather keeps the handoff from aliasing without softening
       the read. Everything is derived from offsetTop/offsetHeight, so it is
       immune to scroll position and cheap enough to re-run on any reflow. */
    const paintThread = () => {
      if (!thread || !rail) return;
      const h = rail.offsetHeight;
      if (!h) return;

      /* The back half fades out over the rail's first/last 6% so the rod
         materialises instead of butting into the section edge. The front half
         has to fade with it — same curve, baked into the window stops — or the
         rod would re-brighten over the last card while the shaft behind it is
         already gone. */
      const fade = (y: number) => {
        const p = Math.min(1, Math.max(0, y / h)); /* 0..1 down the rail */
        return Math.max(0, Math.min(1, p / 0.06, (1 - p) / 0.06));
      };
      const pct = (px: number) => Math.min(100, Math.max(0, (px / h) * 100)).toFixed(3);
      const ink = (y: number) => `rgba(0, 0, 0, ${fade(y).toFixed(3)})`;
      const stops: string[] = ['transparent 0%'];

      rows.forEach((row) => {
        const gap = parseFloat(getComputedStyle(row).marginBottom) || 0;
        const enter = row.offsetTop + row.offsetHeight / 2;
        const exit = row.offsetTop + row.offsetHeight + gap / 2;
        if (exit <= enter) return;
        stops.push(
          `transparent calc(${pct(enter)}% - 1px)`,
          `${ink(enter)} calc(${pct(enter)}% + 1px)`,
          `${ink(exit)} calc(${pct(exit)}% - 1px)`,
          `transparent calc(${pct(exit)}% + 1px)`,
        );
      });

      stops.push('transparent 100%');
      thread.style.setProperty('--thread-mask', `linear-gradient(180deg, ${stops.join(', ')})`);
    };

    /* Cards reflow on font load, on resize and on breakpoint hops — the
       windows ride along. Setting a custom property cannot change layout, so
       the observer can never feed itself. */
    const ro = new ResizeObserver(paintThread);
    ro.observe(el);
    rows.forEach((r) => ro.observe(r));
    paintThread();

    /* Everything this timeline animates is a composited property — scaleY on
       the two rod halves, y/autoAlpha on the drill head, class toggles for the
       nodes. No width/height/top tween anywhere, so nothing in here can
       trigger layout. force3D pins them to a 3D matrix (GPU layer) rather than
       letting GSAP drop back to a 2D matrix once a tween settles. */
    gsap.defaults({ force3D: true });

    /* Reduced motion: the rod is simply already driven all the way home, so
       every window is already threaded. */
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(fills, { scaleY: 1, force3D: true });
      gsap.set(head.current, { autoAlpha: 0 });
      rows.forEach((r) => r.classList.add('is-pierced'));
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!rail) return;

      gsap.set(fills, { scaleY: 0, transformOrigin: '50% 0%', force3D: true });
      gsap.set(head.current, { y: 0, autoAlpha: 0, force3D: true });

      /* The rod grows while the section travels from tip-line to tip-line —
         the tip is therefore pinned to 65% of the viewport at all times. One
         tween, both halves: the length behind the cards and the length in
         front of them advance together, frame for frame. */
      gsap
        .timeline({
          scrollTrigger: {
            trigger: rail,
            start: 'top 65%',
            end: 'bottom 65%',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefresh: paintThread,
          },
        })
        .fromTo(fills, { scaleY: 0 }, { scaleY: 1, ease: 'none', force3D: true }, 0)
        .fromTo(
          head.current,
          { y: 0, autoAlpha: 0 },
          { y: () => rail.offsetHeight, autoAlpha: 1, ease: 'none', force3D: true },
          0,
        );

      /* Each node fires the moment the tip reaches it — same viewport line,
         so the light-up (and the cast shadow the card starts catching) is
         frame-accurate instead of eyeballed. */
      rows.forEach((row) => {
        const node = row.querySelector<HTMLElement>('.ctl__node');
        if (!node) return;
        ScrollTrigger.create({
          trigger: node,
          start: 'center 65%',
          onEnter: () => row.classList.add('is-pierced'),
          onLeaveBack: () => row.classList.remove('is-pierced'),
        });
      });
    });

    /* Fonts/art land after mount and move the rows — re-measure once settled. */
    const refresh = () => {
      paintThread();
      ScrollTrigger.refresh();
    };
    const t = window.setTimeout(refresh, 400);
    window.addEventListener('load', refresh);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('load', refresh);
      ro.disconnect();
      mm.revert();
    };
  }, []);

  return (
    <div className="ctl" ref={scope}>
      {/* BACK half — the shaft, and the drilled length still entering. Under
          the cards (z 0): seen in the gaps and through each punched hole. */}
      <div className="ctl__rail ctl__rail--back" aria-hidden="true">
        <span className="ctl__fill" />
      </div>

      {/* FRONT half — the same bar on the same axis, promoted over the cards
          (z 4) and masked to each row's lower half, so the rod comes out of
          the hole and threads OVER the card's bottom edge. */}
      <div className="ctl__rail ctl__rail--front" aria-hidden="true">
        <span className="ctl__fill" />
      </div>

      {/* Drill head — own layer (z 5). Smaller than the punch, so the bit is
          only ever seen through the hole; just its halo lands on the card. */}
      <span className="ctl__head" ref={head} aria-hidden="true" />

      {LORE_TIMELINE.map((t, i) => {
        const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
        return (
          <div
            key={t.when}
            className={`ctl__row ctl__row--${side}`}
            style={{ '--tc': NODE_HUES[i % NODE_HUES.length] } as React.CSSProperties}
          >
            {/* Node collar on the rod, behind the card — the rod is seen
                through the card's punched hole as it drills past. */}
            <span className="ctl__node" aria-hidden="true" />
            <motion.div
              className="ctl__slot"
              initial={{ opacity: 0, x: side === 'left' ? -90 : 90 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <article className="ctlpin">
                <div className="ctlcard sheen">
                  <time>{t.when}</time>
                  <b>{t.title}</b>
                  <p>{t.body}</p>
                  <span className="ctlcard__edge" aria-hidden="true" />
                  <span className="ctlcard__grommet" aria-hidden="true" />
                </div>
              </article>
            </motion.div>
            {/* The rod's cast shadow on the half it has already exited is the
                row's own ::after — it grows down from the handoff line the
                moment .is-pierced lands, biased towards the card it falls on. */}
          </div>
        );
      })}
    </div>
  );
}

export default function Lore() {
  return (
    <section className="section lore" id="lore">
      <div className="shell lore__grid">
        <div className="lore__copy">
          <SectionHead
            kicker="THE CORE IDENTITY"
            title={
              <>
                Who is <span className="txt-grad">NEMO</span>?
              </>
            }
          />
          <Reveal delay={0.08}>
            <p>
              <b>NEMO is one canon character</b> — a wanderer between timelines whose face is a
              small, radiant star. He is not a hero and not quite a ghost: he is the{' '}
              <span className="hl">constant</span> that every timeline keeps re-discovering, and
              the variable that every artist keeps re-drawing.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <p>
              Every commissioned artwork is not fan art — it is an <span className="hl">official,
              numbered universe</span>: its own timeline, world, and lore blurb, tied back to the
              character's existing story. The artist gets a permanent canon credit and a{' '}
              <span className="hl-gold">60/40 revenue split</span> on every minted edition.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p>
              New universes release on a set cadence — <span className="hl">one every few weeks</span> —
              instead of whenever a commission happens to wrap. Fans anticipate drops. Holders enter
              first. Every purchase pulls a piece back out. The Nemoverse{' '}
              <span className="hl-gold">funds its own growth</span>.
            </p>
          </Reveal>

          <div className="lore__stats">
            {LORE_STATS.map((s, i) => (
              <LoreStat key={s.label} {...s} delay={0.08 + i * 0.05} />
            ))}
          </div>
        </div>
      </div>

      <div className="shell lore__timeline">
        <SectionHead center kicker="CANON TIMELINE" title={<>The story so far</>} />
        <CanonTimeline />
      </div>
    </section>
  );
}
