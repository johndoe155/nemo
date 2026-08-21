/* ---------------------------------------------------------------------------
   ScrambleText — "generative" reveal for persona replies.

   Characters resolve left→right on an eased curve; a short window of glyph
   noise runs ahead of the resolve point (the text is *being computed*), while
   the not-yet-revealed tail stays in the DOM at zero opacity so the bubble
   never reflows or jumps as it fills.

   The full string is always exposed to assistive tech via a hidden node; the
   animating glyphs are aria-hidden.
--------------------------------------------------------------------------- */

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const GLYPHS = '01<>/\\[]{}#$%&*+=~^:;∆ΞΨΩ▚▞░▒█/';
const NOISE_WINDOW = 5;

const noise = (source: string) =>
  source
    .split('')
    .map((ch) => (ch === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
    .join('');

export interface ScrambleTextProps {
  text: string;
  /** Start the reveal. When false the text renders instantly, fully resolved. */
  active?: boolean;
  /** Fires on every animation frame — used to keep the transcript pinned. */
  onUpdate?: () => void;
  onDone?: () => void;
}

export function ScrambleText({ text, active = true, onUpdate, onDone }: ScrambleTextProps) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(() => (active && !reduce ? 0 : text.length));

  useEffect(() => {
    if (!active || reduce) {
      setCount(text.length);
      onDone?.();
      return;
    }

    setCount(0);
    const duration = Math.min(2400, Math.max(620, text.length * 15));
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 1.8);
      setCount(Math.round(eased * text.length));
      onUpdate?.();
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone?.();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active, reduce]);

  const lines = text.split('\n');
  let offset = 0;

  return (
    <>
      <span className="nchat-sr">{text}</span>
      <span aria-hidden="true">
        {lines.map((line, i) => {
          const start = offset;
          offset += line.length + 1;

          const local = Math.max(0, Math.min(line.length, count - start));
          const resolved = line.slice(0, local);
          const scrambling =
            count >= start && local < line.length
              ? line.slice(local, Math.min(line.length, local + NOISE_WINDOW))
              : '';
          const pending = line.slice(local + scrambling.length);
          const isSystem = line.startsWith('[ ');

          return (
            <span className={isSystem ? 'nmsg__sys' : 'nmsg__line'} key={i}>
              {resolved}
              {scrambling && <span className="nmsg__noise">{noise(scrambling)}</span>}
              {pending && <span className="nmsg__pending">{pending}</span>}
            </span>
          );
        })}
      </span>
    </>
  );
}

/** Static counterpart — same line/system-line treatment, no animation. */
export function StaticText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span className={line.startsWith('[ ') ? 'nmsg__sys' : 'nmsg__line'} key={i}>
          {line}
        </span>
      ))}
    </>
  );
}
