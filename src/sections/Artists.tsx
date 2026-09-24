import { useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { ARTISTS, UNIVERSES } from '../lib/data';

/* ============================================================================
   06b · THE SIGNED PRINTS WALL — beat 6 (zone Z2 → the descent)

   ONE centred spine, ONE column — the credit rod. That rig was always the
   best-engineered furniture on the page (a masked rod that genuinely passes
   THROUGH each plate via a punched hole, plates that fly in from alternating
   sides, halt on the rod, and ring off an under-damped spring when nudged), so
   the physics is untouched and only the plate changed:

     · the plate is now a SIGNED PRINT: an index number and the artist's
       stamped initials, the canon codes printed as a row of ink stamps, the
       artist's own words under a quote rule, and a signature line with the
       SIGNED seal at the foot.
     · the rod is a steel cable: ink, with the length that crosses a plate
       tinted by that print's own accent (the ramp is ink → pink → water now,
       not gold → iris → cyan).
     · the wall behind them is ruled like a gallery hanging plan.

   The rod's own measurement contract survives: the collar behind the hole, the
   exit length in front of the plate, and the punched grommet are the same
   elements with the same class names.
   ========================================================================== */

/** Resting tilt, in degrees. CSS-positive = clockwise. */
const TILT = 1.5;
/** Impulse thrown by a click, before the spring rings it out. */
const BOB_ROT = 4.2;
const BOB_LIFT = -12;
const BOB_HOLD = 110;

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

/* The rod's own colour at a given fraction of its length (IDENTITY-SPEC §3):
   ink at the top, the character's pink through the middle, water at the foot.
   The length that passes IN FRONT of a plate is a separate element, so it has
   to be told which slice of the ramp it represents — otherwise the front half
   and the back half of the same rod are two different colours. */
function rodHueAt(t: number) {
  const first = t < 0.5;
  const from = first ? 'var(--ink)' : 'var(--pink)';
  const to = first ? 'var(--pink)' : 'var(--water)';
  const p = ((first ? t : t - 0.5) * 200).toFixed(2);
  return `color-mix(in srgb, ${to} ${p}%, ${from})`;
}

/** The hand voice (SPEC §4.3): a drawn signature, inline SVG, never a font. */
function Signature({ id }: { id: string }) {
  return (
    <svg className="print__signature" viewBox="0 0 132 26" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M2 19c7-1 9-13 14-13s3 12 8 12 8-9 13-9 4 8 10 8 9-11 15-11 5 9 11 9 8-6 12-6 5 4 9 4 8-3 12-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CreditPlate({ a, i, n }: { a: (typeof ARTISTS)[number]; i: number; n: number }) {
  const reduce = useReducedMotion();
  /* Entrance side only — the layout itself is a centred stack. */
  const from: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
  /* Alternating natural tilt down the stack. */
  const rest = i % 2 === 0 ? TILT : -TILT;

  const credited = UNIVERSES.filter((u) => u.artist.name === a.name);
  const codes = credited.map((u) => u.code) || ['UPCOMING'];

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
          onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              bob();
            }
          }}
          tabIndex={0}
          aria-label={`${a.name} — ${a.handle}. Canon credit: ${codes.join(', ')}`}
          data-cursor="NUDGE"
        >
          <div className="creditcard print">
            {/* Segment A — the print's identity, left of the rod. */}
            <div className="creditcard__seg">
              <div className="print__index">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <em>/{String(n).padStart(2, '0')}</em>
              </div>
              <div className="print__who">
                <span className="print__stamp" aria-hidden="true">{a.initials}</span>
                <span className="print__who-text">
                  <b>{a.name}</b>
                  <em>{a.handle}</em>
                </span>
              </div>
              <div className="print__canon">
                <span className="print__canon-label">CANON</span>
                <span className="print__canon-codes">
                  {codes.map((c) => (
                    <i key={c}>{c}</i>
                  ))}
                </span>
              </div>
            </div>

            {/* Segment B — the artist's own words, right of the rod. */}
            <div className="creditcard__main">
              <blockquote className="print__quote">{a.quote}</blockquote>
              <div className="print__footer">
                <Signature id={`sig-${i}`} />
                <span className="print__seal" aria-hidden="true">
                  SIGNED
                </span>
              </div>
            </div>

            {/* Bevelled rim of the punched hole (its centre is cut away). */}
            <span className="creditcard__grommet" aria-hidden="true" />
          </div>
        </motion.article>
      </motion.div>
      {/* The rod's exit: from the hole's centre downward the rod is painted
          IN FRONT of the plate (and over its bottom edge), while above the
          hole it stays behind — the two halves read as one rod piercing the
          card. See credits.css → the sleeve. */}
      <span className="credits__exit" aria-hidden="true" />
    </div>
  );
}

export default function Artists() {
  return (
    <div className="artists" id="artists">
      <div className="shell">
        <header className="part-head">
          <span className="part-head__kicker">PERMANENT PUBLIC CREDITS</span>
          <h3 className="part-head__title">Every universe, credited forever</h3>
        </header>

        <div className="credits">
          <span className="credits__rod" aria-hidden="true" />
          {ARTISTS.map((a, i) => (
            <CreditPlate key={a.name} a={a} i={i} n={ARTISTS.length} />
          ))}
        </div>
      </div>
    </div>
  );
}
