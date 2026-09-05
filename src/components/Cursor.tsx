import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/* ---------------------------------------------------------------------------
   CustomCursor — spring-following crosshair dot + blending glow, plus a
   context label for interactive targets (data-cursor="VIEW"). Hidden on
   coarse pointers and under prefers-reduced-motion.
--------------------------------------------------------------------------- */

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [label, setLabel] = useState('');

  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const dotX = useSpring(mx, { stiffness: 900, damping: 50, mass: 0.4 });
  const dotY = useSpring(my, { stiffness: 900, damping: 50, mass: 0.4 });
  const glowX = useSpring(mx, { stiffness: 160, damping: 24, mass: 0.6 });
  const glowY = useSpring(my, { stiffness: 160, damping: 24, mass: 0.6 });

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setEnabled(true);
    document.body.classList.add('custom-cursor');

    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setVisible(true);
      const target = e.target as Element | null;
      const interactive = target?.closest(
        'a, button, [role="button"], .ucard, .chip, .stamp',
      );
      setHovering(!!interactive);
      const labelled = target?.closest('[data-cursor]') as HTMLElement | null;
      setLabel(labelled?.getAttribute('data-cursor') ?? '');
    };
    const onLeave = () => setVisible(false);

    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove('custom-cursor');
    };
  }, [mx, my]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        className="cursor-glow"
        data-hover={hovering}
        style={{ x: glowX, y: glowY }}
        /* rest scale 0.418 = the old 46px rest size at the constant 110px
           authored geometry; hover blooms to full size on one transform */
        animate={{ scale: hovering ? 1 : 0.418, opacity: visible ? (hovering ? 0.9 : 0.7) : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
      <motion.div
        className="cursor-dot"
        data-hover={hovering}
        style={{ x: dotX, y: dotY }}
        animate={{ scale: hovering ? 1 : 0.667, opacity: visible ? 1 : 0 }} /* 8px at rest */
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
      {label && (
        <motion.div
          className="cursor-label"
          style={{ x: dotX, y: dotY }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
        >
          {label}
        </motion.div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
   The <Magnetic> wrapper that used to live here has been UNIFIED into
   components/motion/Magnetic.tsx (the single magnetic primitive for the
   whole system). Consumers import from 'components/motion'.
--------------------------------------------------------------------------- */
