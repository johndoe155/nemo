import { useEffect, useRef, useState } from 'react';
import { motion, useScroll } from 'framer-motion';
import { attractTick, confirmTick, setSoundEnabled } from '../lib/sound';
import { useChapter, ACT_NAMES } from '../lib/chapters';
import type { Act } from '../lib/chapters';

/* ---------------------------------------------------------------------------
   Console — the page's one standing instrument (ONE TAKE).

   Replaces the four separate pieces of standing chrome — side rail dots,
   scroll progress bar, fixed sound pill, and the velocity layer's visible
   work — with a single thin left-edge instrument:

     · three act marks (I / II / III) + a coda diamond; the live act is lit
       in the live act accent (the film knows where you are, and so does
       the chrome)
     · a 30vh progress filament — the whole take, one line
     · the sound glyph (same engine, storage and event contract as the old
       SoundToggle: 'ocu:sound' still fires, FreqLine and friends are
       untouched)

   It breathes with the take: 42% opacity at rest, full presence while the
   reader scrolls (a scroll event lights it; 700ms of stillness lets it
   fade back). Desktop fine-pointer only — on touch the film IS the chrome.
   Reduced motion: present, but it stops breathing (no transitions).
--------------------------------------------------------------------------- */

const STORAGE_KEY = 'ocu:sound';
const ATTRACT_TARGETS = 'a, button, [role="button"], .ucard, .chip';
const CONFIRM_TARGETS = 'a, button, [role="button"]';

const ACT_MARKS: Array<{ act: Act; label: string }> = [
  { act: 'i', label: 'I' },
  { act: 'ii', label: 'II' },
  { act: 'iii', label: 'III' },
];

export default function Console() {
  const { act } = useChapter();
  const { scrollYProgress } = useScroll();
  const [scrolling, setScrolling] = useState(false);
  const [sound, setSound] = useState(false);
  const [supported, setSupported] = useState(false);
  const idleTimer = useRef<number>(0);

  /* Presence: a scroll event lights the instrument; 700ms of stillness
     lets it fade back to rest. */
  useEffect(() => {
    const onScroll = () => {
      setScrolling(true);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setScrolling(false), 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  /* Sound engine — the exact contract the old SoundToggle kept (same
     storage key, same gesture semantics, same 'ocu:sound' event the
     pulls frequency line listens for). */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setSupported(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) === 'on';
      if (stored) {
        setSound(true);
        setSoundEnabled(true);
      }
    } catch {
      /* storage unavailable — stay off */
    }
  }, []);

  useEffect(() => {
    if (!sound) return;
    let lastHover: Element | null = null;
    const onOver = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.(ATTRACT_TARGETS) ?? null;
      if (el && el !== lastHover) attractTick();
      lastHover = el;
    };
    const onClick = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(CONFIRM_TARGETS)) confirmTick();
    };
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('click', onClick, true);
    };
  }, [sound]);

  const toggle = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      /* noop */
    }
    if (next) confirmTick();
    window.dispatchEvent(new CustomEvent('ocu:sound', { detail: { enabled: next } }));
  };

  return (
    <div className={`console ${scrolling ? 'is-scrolling' : ''}`} aria-hidden={supported ? undefined : 'true'}>
      <div className="console__acts" role="status" aria-label={`Current act: ${ACT_NAMES[act]}`}>
        {ACT_MARKS.map((m) => (
          <span key={m.act} className={`console__act ${act === m.act ? 'is-active' : ''}`}>
            {m.label}
          </span>
        ))}
        <span
          className={`console__act console__act--coda ${act === 'coda' ? 'is-active' : ''}`}
          aria-hidden="true"
        >
          ◆
        </span>
      </div>
      <div className="console__filament" aria-hidden="true">
        <motion.i style={{ scaleY: scrollYProgress }} />
      </div>
      {supported && (
        <button
          type="button"
          className="console__sound"
          onClick={toggle}
          aria-pressed={sound}
          aria-label={sound ? 'Disable interface sound' : 'Enable interface sound'}
          data-cursor="SOUND"
        >
          <span className="wave" aria-hidden="true">
            <i /><i /><i />
          </span>
        </button>
      )}
    </div>
  );
}
