import { useCallback, useEffect, useState } from 'react';

import { confirmTick, setSoundEnabled } from './sound';

/* ============================================================================
   useInterfaceSound — ONE source of truth for the interface-sound switch.

   The sound toggle used to live entirely inside <Dock>, which was fine while
   the dock was the only place it appeared. Moving it into the mobile chapter
   sheet too (so the dock can shrink to a single button on phones) would have
   produced two components with two independent `enabled` states that disagree
   the moment either is clicked.

   So the switch is lifted here: one module-level value, one localStorage key,
   a listener set, and a `toggle` that broadcasts. Every consumer renders what
   it reads, so N toggles stay in lockstep without a provider.

   Off by default and never autoplayed: the click that turns it on IS the user
   gesture that arms the audio engine (autoplay policy).
============================================================================ */

const STORAGE_KEY = 'ocu:sound';

let current = false;
let hydrated = false;
const listeners = new Set<(on: boolean) => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function write(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable — the session simply does not persist */
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  current = read();
  if (current) setSoundEnabled(true);
}

function publish(on: boolean): void {
  for (const fn of [...listeners]) fn(on);
}

/** True when the switch may be shown at all (sound is motion-adjacent). */
export function soundSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useInterfaceSound(): {
  supported: boolean;
  enabled: boolean;
  toggle: () => void;
} {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    if (!soundSupported()) return;
    setSupported(true);
    hydrate();
    const fn = (on: boolean) => setEnabledState(on);
    listeners.add(fn);
    setEnabledState(current);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !current;
    current = next;
    setSoundEnabled(next);
    write(next);
    if (next) confirmTick();
    publish(next);
    window.dispatchEvent(new CustomEvent('ocu:sound', { detail: { enabled: next } }));
  }, []);

  return { supported, enabled, toggle };
}
