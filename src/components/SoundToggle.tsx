import { useEffect, useState } from 'react';
import { attractTick, confirmTick } from '../lib/sound';
import { MagneticButton, RollText } from './motion';

/* ---------------------------------------------------------------------------
   SoundToggle — fixed "SOUND ON/OFF" pill (DESIGN_AUDIT P2.5). Off by
   default, persisted in localStorage. While enabled, delegated listeners
   play an attract tick on hovering interactive targets and a confirm tick
   on activation. Hidden entirely under prefers-reduced-motion.
--------------------------------------------------------------------------- */

const STORAGE_KEY = 'ocu:sound';
const ATTRACT_TARGETS = 'a, button, [role="button"], .ucard, .chip';
const CONFIRM_TARGETS = 'a, button, [role="button"]';

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setSupported(true);
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'on');
    } catch {
      /* storage unavailable — stay off */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  if (!supported) return null;

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      /* noop */
    }
    if (next) confirmTick();
    // Notify ambient audio-visual layers (e.g. the 04 · PILLAR 3 frequency
    // line) that the ambient sound state changed.
    window.dispatchEvent(new CustomEvent('ocu:sound', { detail: { enabled: next } }));
  };

  return (
    /* The button itself is the magnetic element — wrapping a position:fixed
       node in a transformed ancestor would re-root its containing block, so
       the physics live directly on the control. */
    <MagneticButton
      type="button"
      preset="chrome"
      className="soundtoggle"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Disable interface sound' : 'Enable interface sound'}
    >
      <span className="soundtoggle__wave" data-on={enabled} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <RollText text={`SOUND ${enabled ? 'ON' : 'OFF'}`} />
    </MagneticButton>
  );
}
