import { motion, useScroll, useSpring } from 'framer-motion';

/* ---------------------------------------------------------------------------
   ScrollProgress — global top HUD rail, spring-smoothed on 0..1.
--------------------------------------------------------------------------- */

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.5 });

  return (
    <div className="scrollprog" aria-hidden="true">
      <div className="scrollprog__bar">
        <motion.i style={{ scaleX }} />
      </div>
    </div>
  );
}
