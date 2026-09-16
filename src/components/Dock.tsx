import { useEffect, useState } from 'react';

import { UNIVERSES } from '../lib/data';
import { useChapter, useQuality } from '../lib/ChapterProvider';
import { attractTick, confirmTick, setSoundEnabled } from '../lib/sound';
import { pageScrollTo } from '../lib/scroll';

/* ============================================================================
   Dock — the unified system chrome.

   Three floating controls used to live in three corners with three visual
   languages: a bottom-right sound pill, a top HUD progress bar, and a bottom
   "back to top" link buried in the footer.

   They are now one instrument cluster, bottom right:

     · SOUND     — off by default, persisted, never autoplays. The toggle
                   click IS the user gesture that arms the audio engine.
     · STATUS    — one line of live metadata for the chapter you are in. The
                   only hover-relevant telemetry that survives on the page:
                   everything else was moved to the edges of its own section.
     · REWIND    — the loop back to the beginning, presented as an intentional
                   return rather than a utility link.

   Hidden entirely under reduced motion (sound) and on low tiers (status),
   and it never blocks pointer events outside its own buttons.
   ========================================================================== */

const STORAGE_KEY = 'ocu:sound';
const ATTRACT_TARGETS = 'a, button, [role="button"], .ucard, .chip, .plate-row, .rung';
const CONFIRM_TARGETS = 'a, button, [role="button"]';

export default function Dock() {
  const { chapter, meta } = useChapter();
  const quality = useQuality();
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setSupported(true);
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
      /* storage unavailable — stay off */
    }
    if (stored) {
      setEnabled(true);
      setSoundEnabled(true);
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

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      /* noop */
    }
    if (next) confirmTick();
    window.dispatchEvent(new CustomEvent('ocu:sound', { detail: { enabled: next } }));
  };

  const chapterStatus = STATUS[chapter];

  return (
    <div className="dock" data-chapter={chapter}>
      {quality.tier !== 'low' && (
        <p className="dock__status" aria-hidden="true">
          CH {String(meta.index).padStart(2, '0')} · {meta.title}
          <br />
          <b>{chapterStatus}</b>
        </p>
      )}

      {supported && (
        <button
          type="button"
          className="dock__btn"
          data-on={enabled ? 'true' : 'false'}
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? 'Disable interface sound' : 'Enable interface sound'}
        >
          <span className="dock__wave" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          SOUND {enabled ? 'ON' : 'OFF'}
        </button>
      )}

      <button
        type="button"
        className="dock__btn"
        onClick={() => pageScrollTo(0, { smooth: true, duration: 1.6 })}
        aria-label="Return to the beginning of the archive"
      >
        RETURN ↑
      </button>
    </div>
  );
}

/* One line of live, chapter-specific metadata. Deliberately terse — this is
   an instrument readout, not copy. */
const STATUS: Record<string, string> = {
  wake: 'ARCHIVE COLD',
  encounter: `${UNIVERSES.length} UNIVERSES REGISTERED`,
  archive: 'CANON INDEX OPEN',
  voice: 'PERSONA LISTENING',
  access: 'TIERS LOCKED',
  commerce: 'LEDGER SEALED',
  authorship: `${new Set(UNIVERSES.map((u) => u.artist.name)).size} ARTISTS CREDITED`,
  canon: 'CANON STABLE',
  collapse: 'EVENT HORIZON',
  return: 'CYCLE COMPLETE',
};
