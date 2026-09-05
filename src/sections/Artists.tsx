import { useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { SectionHead } from '../components/ui';
import { ARTISTS, UNIVERSES } from '../lib/data';

/* ============================================================================
   06 · PERMANENT PUBLIC CREDITS — the credit rod

   ONE centred spine, ONE column. The masonry is replaced by a vertical rod
   running the exact centre of the section's Y-axis (masked so it fades in at
   the top and phases out at the bottom), with the credit plates stacked
   uniformly on top of each other — no left/right stagger; that language
   belongs to the canon timeline.

   THE ROD DISSECTS THE PLATE
     Each plate is centred on the rod, and the plate's own segment boundary is
     placed on that same centre line, so the rod is the divider between the
     two contrasting fills:
       · left  — the detail block  (accent over --abyss): index, avatar,
                 artist, handle, permanent canon credits
       · right — the quote block   (glass panel): the artist's own words
     A circular hole is CUT out of the plate dead centre with a radial-gradient
     mask, so the rod behind is genuinely visible passing through the card —
     entering above it, showing in the hole, exiting below.

   MOTION
     · Entrance — plates still fly in horizontally from alternating sides and
       halt centred on the rod (outer node owns x/opacity).
     · Rest — an alternating static tilt (clockwise / counter-clockwise by
       index), pivoted on the hole so the pin never leaves the rod.
     · Click — an under-damped spring impulse: the plate bobs on its pin and
       rings back down to its resting tilt (inner node owns rotate/y).
   Splitting the two across nested nodes keeps a single framer transform
   authority per element, per styles/motion.css.
   ========================================================================== */

/** Resting tilt, in degrees. CSS-positive = clockwise. */
const TILT = 1.5;
/** Impulse thrown by a click, before the spring rings it out. */
const BOB_ROT = 4.2;
const BOB_LIFT = -12;
const BOB_HOLD = 110;

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

/* The rod's own colour at a given fraction of its length.

   The rod is painted gold → iris (50%) → cyan. The length that passes IN
   FRONT of a plate is a separate element, so it has to be told which slice of
   that ramp it represents — otherwise the front half and the back half of the
   same rod are two different colours. Two chained color-mix()es reproduce the
   three-stop ramp exactly, using nothing but existing palette tokens. */
function rodHueAt(t: number) {
  const first = t < 0.5;
  const from = first ? 'var(--gold)' : 'var(--iris)';
  const to = first ? 'var(--iris)' : 'var(--cyan)';
  const p = ((first ? t : t - 0.5) * 200).toFixed(2);
  return `color-mix(in srgb, ${to} ${p}%, ${from})`;
}

function CreditPlate({ a, i, n }: { a: (typeof ARTISTS)[number]; i: number; n: number }) {
  const reduce = useReducedMotion();
  /* Entrance side only — the layout itself is a centred stack. */
  const from: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
  /* Alternating natural tilt down the stack. */
  const rest = i % 2 === 0 ? TILT : -TILT;

  const credited = UNIVERSES.filter((u) => u.artist.name === a.name);
  const codes = credited.map((u) => u.code).join(' · ') || 'UPCOMING';

  /* --- click physics: an under-damped spring around the resting tilt ------ */
  const rotRaw = useMotionValue(rest);
  const liftRaw = useMotionValue(0);
  const rotate = useSpring(rotRaw, { stiffness: 120, damping: 7.5, mass: 0.9 });
  const y = useSpring(liftRaw, { stiffness: 150, damping: 9, mass: 0.9 });
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const bob = useCallback(() => {
    if (reduce) return;
    window.clearTimeout(timer.current);
    rotRaw.set(rest + (i % 2 === 0 ? -BOB_ROT : BOB_ROT));
    liftRaw.set(BOB_LIFT);
    timer.current = window.setTimeout(() => {
      rotRaw.set(rest);
      liftRaw.set(0);
    }, BOB_HOLD);
  }, [reduce, rest, rotRaw, liftRaw, i]);

  return (
    <div
      className="credits__row"
      style={
        {
          '--ac': a.hue[0],
          '--a1': a.hue[0],
          '--a2': a.hue[1],
          /* Colour of the rod where it crosses THIS plate — the exiting
             length is tinted with it so front and back match exactly. */
          '--rod-hue': rodHueAt(n > 1 ? (i + 0.5) / n : 0.5),
        } as React.CSSProperties
      }
    >
      {/* Collar on the rod, behind the plate — seen THROUGH the punched hole. */}
      <span className="credits__collar" aria-hidden="true" />
      <motion.div
        className="credits__slot"
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: from === 'left' ? -120 : 120 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-90px' }}
        transition={{ duration: 1, ease: EASE_EXPO }}
      >
        <motion.article
          className="creditpin"
          style={{
            '--card-accent': a.hue[0],
            rotate: reduce ? rest : rotate,
            y: reduce ? 0 : y,
          } as React.ComponentProps<typeof motion.article>['style']}
          onClick={bob}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              bob();
            }
          }}
          tabIndex={0}
          aria-label={`${a.name} — ${a.handle}. Canon credit: ${codes}`}
          data-cursor="NUDGE"
        >
          <div className="creditcard sheen">
            {/* Segment A — details, left of the rod. */}
            <div className="creditcard__seg">
              <div className="creditcard__id">
                <span className="creditcard__ava" aria-hidden="true">{a.initials}</span>
                <span className="creditcard__idx">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="creditcard__who">
                <b>{a.name}</b>
                <span className="creditcard__handle">{a.handle}</span>
              </div>
              <span className="creditcard__codes">CANON · {codes}</span>
            </div>
            {/* Segment B — the quote, right of the rod. */}
            <div className="creditcard__main">
              <p className="creditcard__quote">{a.quote}</p>
            </div>
            {/* Bevelled rim of the punched hole (its centre is cut away). */}
            <span className="creditcard__grommet" aria-hidden="true" />
          </div>
        </motion.article>
      </motion.div>
      {/* The rod's exit: from the hole's centre downward the rod is painted
          IN FRONT of the plate (and over its bottom edge), while above the
          hole it stays behind — the two halves read as one rod piercing the
          card. See suspension.css → "3D penetration". */}
      <span className="credits__exit" aria-hidden="true" />
    </div>
  );
}

export default function Artists() {
  return (
    <section className="section artists" id="artists">
      <div className="shell">
        <SectionHead
          num="06"
          kicker="06 · PERMANENT PUBLIC CREDITS"
          kickerGold
          title={
            <>
              Every universe, <span className="txt-gold">credited forever</span>
            </>
          }
          sub={
            <>
              The artists behind the Nemoverse are credited publicly on the Hub and in each
              piece's own metadata. The spotlight is tied directly to Nemoverse credits — the
              collection is only as strong as its canon.
            </>
          }
        />

        <div className="credits">
          <span className="credits__rod" aria-hidden="true" />
          {ARTISTS.map((a, i) => (
            <CreditPlate key={a.name} a={a} i={i} n={ARTISTS.length} />
          ))}
        </div>
      </div>
    </section>
  );
}
