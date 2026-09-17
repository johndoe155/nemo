import { motion, useScroll } from 'framer-motion';

/* ---------------------------------------------------------------------------
   ScrollProgress — global top HUD rail.

   It used to run a second spring over scrollYProgress — a chase-cam on top
   of Lenis's own smoothing, which made the bar visibly lag the page it
   measures. Lenis (lib/scroll.ts) is the one easing layer now; the bar
   consumes the raw 0..1 progress and is continuous by construction while
   the engine runs, instant where it doesn't.
--------------------------------------------------------------------------- */

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <div className="scrollprog" aria-hidden="true">
      <div className="scrollprog__bar">
        <motion.i style={{ scaleX: scrollYProgress }} />
      </div>
    </div>
  );
}
