import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

import { useCursorMode, useQuality } from '../lib/ChapterProvider';
import type { CursorMode } from '../lib/chapters';

/* ============================================================================
   CustomCursor — the cursor's five-word vocabulary.

   The old cursor had one look and a text label, and ~15 components each
   asked for their own label ("VIEW", "DRAG", "CLAIM", "ASK", "PULL",
   "NUDGE" …). That is a component inventory, not a language.

   There are now five STATES, and every interactive surface on the page maps
   to one of them:

     default  a small point of light        — reading, prose, stillness
     explore  an expanding ring             — browsable surfaces you can drag
     inspect  a framing reticle             — artifacts, plates, gallery nodes
     enter    a portal aperture             — links and CTAs into the archive
     hold     a gravitational ring          — pressed / latched / dragging

   Resolution order (highest first):
     1. an explicit `data-cursor-mode` on the hovered element (rare, authored)
     2. a component that claimed a mode through `useCursorMode().set()`
     3. the semantic family of the element (a/button → enter, artifact
        plates → inspect, draggable rails → explore)
     4. the current chapter's default (lib/chapters.ts)

   `data-cursor="LABEL"` still works and still renders its text — the label is
   now an annotation on top of one of five shapes, not a shape of its own.

   Coarse pointers, reduced motion and low tiers get the native pointer and
   keep every focus ring. Nothing here is required for operation.
========================================================================== */

const SPRING_FAST = { stiffness: 900, damping: 50, mass: 0.4 };
const SPRING_SLOW = { stiffness: 170, damping: 24, mass: 0.6 };

/** Semantic → vocabulary. Deliberately coarse: element FAMILIES, not ids. */
/* Order is the priority: an artifact is INSPECTED before it is a button, and
   a latched control HOLDS before it is merely clickable. Families, not ids —
   the whole point of the vocabulary is that fifteen components share five
   states. */
const MODE_SELECTORS: [CursorMode, string][] = [
  ['inspect', '.ucard, .plate, .creditpin, .cg-stage, .bh-frame, .artifact, [data-cursor-mode="inspect"]'],
  ['hold', '[data-cursor-mode="hold"], [aria-pressed="true"], .is-dragging'],
  ['enter', 'a[href], button:not([disabled]), [role="button"], [role="link"]'],
  ['explore', '.roster__rail, .chip, .stamp, [data-cursor], [data-cursor-mode="explore"]'],
];

function modeForElement(el: Element | null): CursorMode | null {
  if (!el) return null;
  const explicit = el.closest('[data-cursor-mode]') as HTMLElement | null;
  if (explicit) {
    const declared = explicit.getAttribute('data-cursor-mode');
    if (
      declared === 'default' ||
      declared === 'explore' ||
      declared === 'inspect' ||
      declared === 'enter' ||
      declared === 'hold'
    ) {
      return declared;
    }
  }
  for (const [mode, selector] of MODE_SELECTORS) {
    if (el.closest(selector)) return mode;
  }
  return null;
}

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');
  const [pressed, setPressed] = useState(false);

  const { mode: chapterMode } = useCursorMode();
  const quality = useQuality();
  const [hover, setHover] = useState<CursorMode | null>(null);
  const hoverRef = useRef<CursorMode | null>(null);

  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, SPRING_FAST);
  const y = useSpring(my, SPRING_FAST);
  const ringX = useSpring(mx, SPRING_SLOW);
  const ringY = useSpring(my, SPRING_SLOW);

  useEffect(() => {
    if (!quality.liveCursor) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    setEnabled(true);
    document.body.classList.add('custom-cursor');

    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setVisible(true);
      const target = e.target as Element | null;
      const next = modeForElement(target ?? null);
      if (next !== hoverRef.current) {
        hoverRef.current = next;
        setHover(next);
      }
      const labelled = (target as Element | null)?.closest('[data-cursor]') as HTMLElement | null;
      const text = labelled?.getAttribute('data-cursor') ?? '';
      setLabel((prev) => (prev === text ? prev : text));
    };
    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove('custom-cursor');
    };
  }, [mx, my, quality.liveCursor]);

  if (!enabled) return null;

  /* Resolution order — see the header. `pressed` promotes to `hold`. */
  const mode: CursorMode = pressed ? 'hold' : (hover ?? chapterMode);

  return (
    <div className="cursor" data-mode={mode} data-visible={visible} aria-hidden="true">
      {/* The ring — the vocabulary lives here: one element, five states,
          each a transform + opacity, never a new node. */}
      <motion.div
        className="cursor__ring"
        style={{ x: ringX, y: ringY }}
        animate={{
          scale: mode === 'default' ? 0 : mode === 'explore' ? 1 : mode === 'inspect' ? 0.82 : mode === 'enter' ? 1.12 : 0.94,
          opacity: visible ? (mode === 'default' ? 0 : 1) : 0,
          rotate: mode === 'inspect' ? 45 : 0,
          borderRadius: mode === 'inspect' ? '2px' : '50%',
        }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* inspect: four corner ticks, revealed by the parent's state */}
        <i className="cursor__tick cursor__tick--tl" />
        <i className="cursor__tick cursor__tick--tr" />
        <i className="cursor__tick cursor__tick--bl" />
        <i className="cursor__tick cursor__tick--br" />
        {/* enter: the aperture — an inner ring that opens on approach */}
        <i className="cursor__iris" />
      </motion.div>

      {/* The point of light — always present, never replaced. */}
      <motion.div
        className="cursor__dot"
        style={{ x, y }}
        animate={{
          scale: mode === 'default' ? 1 : 0.35,
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />

      {label && mode !== 'default' && (
        <motion.div
          className="cursor__label"
          style={{ x, y }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {label}
        </motion.div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   The <Magnetic> wrapper that used to live here has been UNIFIED into
   components/motion/Magnetic.tsx (the single magnetic primitive for the
   whole system). Consumers import from 'components/motion'.
--------------------------------------------------------------------------- */
