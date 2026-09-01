import { useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { SectionHead } from '../components/ui';
import { ARTISTS, UNIVERSES } from '../lib/data';

/* ============================================================================
   06 · PERMANENT PUBLIC CREDITS — the credit rod

   The masonry of quote cards is replaced by a single spine: one vertical rod
   running the exact centre of the section's Y-axis at EVERY breakpoint
   (masked so it fades in at the top and phases out at the bottom), with
   dual-segment credit plates skewered onto it, alternating left and right.

   Each plate is two segments in contrasting palette fills:
     · a narrow vertical block (the details: avatar, canon credit codes, index)
       always facing the rod, filled with the artist's accent over --abyss
     · the wide block (the quote itself) on the standard glass panel

   THE PIN
     The plate's inner edge overhangs the centre line by exactly --hole-inset,
     and a circular hole is CUT out of the plate there with a radial-gradient
     mask — so the rod behind is genuinely visible through the card, not faked
     with a drawn circle. The elevation shadow lives on an unmasked pin
     wrapper (a mask would clip it), and the plate rotates about that hole, so
     no tilt or bob can ever knock it off the rod.

   MOTION
     · Entrance — the plate slides in horizontally from its own side and comes
       to rest against the rod (outer node owns x/opacity).
     · Rest — a static alternating tilt: plates right of the rod sit
       counter-clockwise (angling up to the right), plates left of it sit
       clockwise (angling up to the left).
     · Click — an under-damped spring impulse: the plate bobs on its pin and
       rings back down to its resting tilt (inner node owns rotate/y).
   Splitting the two across nested nodes keeps a single framer transform
   authority per element, per styles/motion.css.
   ========================================================================== */

/** Resting tilt, in degrees. CSS-positive = clockwise. */
const TILT = 1.7;
/** Impulse thrown by a click, before the spring rings it out. */
const BOB_ROT = 4.6;
const BOB_LIFT = -12;
const BOB_HOLD = 110;

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

function CreditPlate({ a, i }: { a: (typeof ARTISTS)[number]; i: number }) {
  const reduce = useReducedMotion();
  const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
  /* Left of the rod → clockwise (up to the left). Right of it → counter-
     clockwise (up to the right). */
  const rest = side === 'left' ? TILT : -TILT;

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
    rotRaw.set(rest + (side === 'left' ? -BOB_ROT : BOB_ROT));
    liftRaw.set(BOB_LIFT);
    timer.current = window.setTimeout(() => {
      rotRaw.set(rest);
      liftRaw.set(0);
    }, BOB_HOLD);
  }, [reduce, rest, rotRaw, liftRaw, side]);

  return (
    <div
      className={`credits__row credits__row--${side}`}
      style={{ '--ac': a.hue[0], '--a1': a.hue[0], '--a2': a.hue[1] } as React.CSSProperties}
    >
      {/* Collar on the rod, behind the plate — seen THROUGH the punched hole. */}
      <span className="credits__collar" aria-hidden="true" />
      <motion.div
        className="credits__slot"
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: side === 'left' ? -110 : 110 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-90px' }}
        transition={{ duration: 1, ease: EASE_EXPO, delay: (i % 2) * 0.08 }}
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
            <div className="creditcard__seg">
              <span className="creditcard__ava" aria-hidden="true">{a.initials}</span>
              <span className="creditcard__vert" title={`CANON CREDIT · ${codes}`}>
                CANON · {codes}
              </span>
              <span className="creditcard__idx">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div className="creditcard__main">
              <p className="creditcard__quote">{a.quote}</p>
              <div className="creditcard__by">
                <b>{a.name}</b>
                <span>{a.handle}</span>
              </div>
              {/* Compact rig: the canon codes move out of the vertical block
                  and under the byline where there is room to read them. */}
              <span className="creditcard__codes">CANON · {codes}</span>
            </div>
            {/* Bevelled rim of the punched hole (its centre is cut away). */}
            <span className="creditcard__grommet" aria-hidden="true" />
          </div>
        </motion.article>
      </motion.div>
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
            <CreditPlate key={a.name} a={a} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
