import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
   Interlude — the film's title card (ONE TAKE).

   150vh of scroll with a pinned 100vh card: the take pauses, the ambient
   systems hold still (html[data-still] — see styles/chapters.css), and one
   enormous line of Inktrap is revealed line by line. No links, no chrome,
   no UI. The card is a real <section> with a real <h2>, so the heading
   ladder and the axe gate stay intact.

   The pin is plain CSS sticky — it composes with Lenis and degrades to a
   static card without JS. Reduced motion: the lines render in place.
--------------------------------------------------------------------------- */

export interface InterludeProps {
  /** DOM id — must exist in lib/chapters' CHAPTER_MAP (stillness zone). */
  id: string;
  /** CSS modifier for the accent treatment: 'canon' | 'doors'. */
  act: 'canon' | 'doors';
  /** The index line above the title, e.g. "ACT II · THE CANON". */
  actLabel: string;
  /** Two display lines, in reveal order. Wrap the accent period in
   *  <span className="interlude__period">. */
  lines: [ReactNode, ReactNode];
  /** One quiet reading line beneath the title (optional). */
  sub?: string;
  /** Accessible full title, if the visual lines use decorative nodes. */
  ariaTitle: string;
}

export default function Interlude({
  id,
  act,
  actLabel,
  lines,
  sub,
  ariaTitle,
}: InterludeProps) {
  const reduce = useReducedMotion();

  const lineMotion = (i: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { y: '112%' },
          whileInView: { y: 0 },
          viewport: { once: true, margin: '-15% 0px -15% 0px' },
          transition: { duration: 1.3, delay: 0.12 + i * 0.22, ease: [0.16, 1, 0.3, 1] },
        };

  return (
    <section className={`interlude interlude--${act}`} id={id}>
      <div className="interlude__pin">
        <div className="interlude__card">
          <span className="interlude__index">{actLabel}</span>
          <h2 className="interlude__title display" aria-label={ariaTitle}>
            {lines.map((line, i) => (
              <motion.span className="interlude__line" key={i} {...lineMotion(i)}>
                <span aria-hidden="true">{line}</span>
              </motion.span>
            ))}
          </h2>
          {sub && (
            <motion.p
              className="interlude__sub"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={reduce ? undefined : { once: true, margin: '-10% 0px' }}
              transition={{ duration: 1.1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {sub}
            </motion.p>
          )}
        </div>
      </div>
    </section>
  );
}
