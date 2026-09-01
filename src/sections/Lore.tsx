import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Reveal, SectionHead } from '../components/ui';
import { useTilt } from '../components/motion';
import { LORE_STATS, LORE_TIMELINE } from '../lib/data';
import { useCountUp } from '../lib/hooks';

gsap.registerPlugin(ScrollTrigger);

/* Per-node accent, walked across the canon spine (gold → magenta) so the rod
   reads as one continuous gradient passing through the cards. */
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

   The rod is GSAP ScrollTrigger territory (framer owns the card entrances):
     · One scrubbed trigger scales the rod fill from 0 → 1 along the Y-axis,
       anchored so the rod's TIP always sits on the same viewport line (65%).
       Scrolling down literally drives the rod deeper into the section.
     · The glowing drill head rides that tip.
     · Because the tip line is fixed, each node can own a second trigger on
       exactly the same line — so a node lights up at the precise frame the
       rod penetrates it. No timing guesswork, no drift on resize.
   All of it is registered inside a gsap.context + matchMedia so reduced-motion
   visitors get the finished state instantly and cleanup is automatic.
   ========================================================================== */
function CanonTimeline() {
  const scope = useRef<HTMLDivElement | null>(null);
  const fill = useRef<HTMLSpanElement | null>(null);
  const head = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const rows = gsap.utils.toArray<HTMLElement>('.ctl__row', el);
    const mm = gsap.matchMedia();

    /* Reduced motion: the rod is simply already driven all the way home. */
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(fill.current, { scaleY: 1 });
      gsap.set(head.current, { autoAlpha: 0 });
      rows.forEach((r) => r.classList.add('is-pierced'));
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const rail = el.querySelector<HTMLElement>('.ctl__rail');
      if (!rail) return;

      gsap.set(fill.current, { scaleY: 0, transformOrigin: '50% 0%' });
      gsap.set(head.current, { y: 0, autoAlpha: 0 });

      /* The rod grows while the section travels from tip-line to tip-line —
         the tip is therefore pinned to 65% of the viewport at all times. */
      gsap
        .timeline({
          scrollTrigger: {
            trigger: rail,
            start: 'top 65%',
            end: 'bottom 65%',
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        })
        .fromTo(fill.current, { scaleY: 0 }, { scaleY: 1, ease: 'none' }, 0)
        .fromTo(
          head.current,
          { y: 0, autoAlpha: 0 },
          { y: () => rail.offsetHeight, autoAlpha: 1, ease: 'none' },
          0,
        );

      /* Each node fires the moment the tip reaches it — same viewport line,
         so the light-up is frame-accurate instead of eyeballed. */
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
    const refresh = () => ScrollTrigger.refresh();
    const t = window.setTimeout(refresh, 400);
    window.addEventListener('load', refresh);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('load', refresh);
      mm.revert();
    };
  }, []);

  return (
    <div className="ctl" ref={scope}>
      <div className="ctl__rail" aria-hidden="true">
        <span className="ctl__fill" ref={fill} />
        <span className="ctl__head" ref={head} />
      </div>

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
