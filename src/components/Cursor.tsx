import { useEffect, useRef, useState, type ReactNode } from 'react';
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
        style={{ x: glowX, y: glowY, opacity: visible ? 0.7 : 0 }}
        aria-hidden="true"
      />
      <motion.div
        className="cursor-dot"
        data-hover={hovering}
        style={{ x: dotX, y: dotY, opacity: visible ? 1 : 0 }}
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
   Magnetic — pulls its child toward the cursor within a radius, springs back
   on leave. Reduced-motion safe.
--------------------------------------------------------------------------- */

export function Magnetic({
  children,
  strength = 0.35,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 180, damping: 18, mass: 0.5 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, display: 'inline-block' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
