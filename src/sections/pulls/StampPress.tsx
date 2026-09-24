import { useEffect, useRef } from 'react';

/* ============================================================================
   StampPress — the pull CTA (IDENTITY-SPEC §2.2 beat 3, §8)

   Was LiquidPullButton: a Three.js fragment-shader slab (liquid-glass
   refraction, metallic gold rim, chromatic split, shockwave) — the retired
   material language and the project's last eager-fetchable use of the three
   build. It is now a physical stamp press: a chunky ink-pad slab with a
   printed shadow that, when pressed, drives DOWN (shadow collapses, 2% squash)
   and rings back on the material easing — stamp thud, not liquid shimmer.

   No WebGL, no library, no canvas: the material is CSS, so the button paints
   on the first frame and costs one compositor layer when pressed.
============================================================================ */

interface Props {
  onClick: () => void;
  disabled?: boolean;
  /** Live render of the engine's spinning phase: the pad reports PRESSING. */
  spin?: boolean;
  label: string;
  spinLabel?: string;
}

export default function StampPress({ onClick, disabled, spin, label, spinLabel }: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  /* A real stamp leaves the page: the ink-pad class stays applied for one
     beat after the press so the thud reads even on a fast click. */
  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    let t = 0;
    const press = () => {
      btn.classList.add('is-pressing');
      window.clearTimeout(t);
      t = window.setTimeout(() => btn.classList.remove('is-pressing'), 220);
    };
    btn.addEventListener('pointerdown', press);
    return () => {
      window.clearTimeout(t);
      btn.removeEventListener('pointerdown', press);
    };
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      className={`stamp-press ${spin ? 'is-spinning' : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-cursor={spin ? 'INKING' : 'PRESS'}
      aria-live="polite"
    >
      <span className="stamp-press__pad" aria-hidden="true" />
      <span className="stamp-press__face">
        <span className="stamp-press__seal" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2.6 14.9 9l6.9.5-5.3 4.4 1.7 6.7-6.2-3.8-6.2 3.8 1.7-6.7L2.2 9.5 9.1 9z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="stamp-press__label">{spin ? spinLabel ?? label : label}</span>
        <span className="stamp-press__sub">
          {spin ? 'THE PRESS IS READING THE SET' : 'MERCH OR EDITION · ONE RANDOM PIECE'}
        </span>
      </span>
      <span className="stamp-press__roller" aria-hidden="true" />
    </button>
  );
}
