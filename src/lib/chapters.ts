/* ============================================================================
   chapters — ONE TAKE: the chapter director.

   The page is one continuous take in three acts + a coda. This module is
   the authority that knows WHICH part of the film the reader is in: as
   sections cross the viewport centre band (the same band technique as
   lib/scenes.ts and the side rail), it stamps

     · html[data-act]   — 'i' | 'ii' | 'iii' | 'coda'; styles/chapters.css
                          promotes the act's hue into --act-accent
     · html[data-still] — present while a stillness zone (an interlude or
                          the void) occupies the band: every ambient system
                          has its static contract keyed off this flag
                          (starfield parks, grain holds, marquees pause,
                          the ambience nebula freezes, the credits crawl
                          holds its breath)

   and, once per ACT boundary, fires the fog — a single Web-Animations light
   sweep across the frame (styles/chapters.css .fog). No page cut, no second
   scroll loop, no new rAF: the observer is a plain IntersectionObserver and
   the fog is one WAAPI call.

   Singleton by design: any number of components may subscribe via
   onChapterChange(), but there is exactly one observer, so the scene
   system (lib/scenes.ts) and the chapter system can never disagree about
   where the film is.
   ========================================================================== */
import { useEffect, useState } from 'react';

export type Act = 'i' | 'ii' | 'iii' | 'coda';

export const ACT_NAMES: Record<Act, string> = {
  i: 'THE SIGNAL',
  ii: 'THE CANON',
  iii: 'THE DEAL',
  coda: 'THE COLLAPSE',
};

export interface ChapterInfo {
  /** Section id currently in the centre band. */
  id: string;
  act: Act;
  /** True while a stillness zone (interlude / void) is in the band. */
  still: boolean;
}

/** Section id → act + stillness. Ids match the live DOM after the ONE TAKE
 *  re-order (see App.tsx). The interludes and the void are stillness zones;
 *  the singularity itself is NOT still — the collapse is the one place the
 *  film goes fastest. */
const CHAPTER_MAP: Record<string, { act: Act; still?: boolean }> = {
  // ACT I — THE SIGNAL
  top: { act: 'i' },
  persona: { act: 'i' },
  // ACT II — THE CANON
  nemoverse: { act: 'ii' },
  rotunda: { act: 'ii' },
  lore: { act: 'ii' },
  artists: { act: 'ii' },
  'interlude-canon': { act: 'ii', still: true },
  // ACT III — THE DEAL
  perks: { act: 'iii' },
  pulls: { act: 'iii' },
  store: { act: 'iii' },
  'interlude-doors': { act: 'iii', still: true },
  // CODA — THE COLLAPSE
  void: { act: 'coda', still: true },
  singularity: { act: 'coda' },
  connect: { act: 'coda' },
};

const DEFAULT_ACT: Act = 'i';

type Listener = (info: ChapterInfo) => void;

interface State {
  current: ChapterInfo;
  listeners: Set<Listener>;
  stop: () => void;
}

let state: State | null = null;

function emit(listeners: Set<Listener>, info: ChapterInfo) {
  listeners.forEach((fn) => fn(info));
}

function fireFog() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fog = document.querySelector<HTMLElement>('.fog');
  if (!fog) return;
  /* One light sweep per act boundary — the take never cuts. */
  fog.animate(
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.42 },
      { opacity: 0, offset: 1 },
    ],
    { duration: 950, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  );
}

function ensureObserver(): State {
  if (state) return state;

  const root = document.documentElement;
  const listeners = new Set<Listener>();
  let currentId: string | null = null;
  let currentAct: Act = DEFAULT_ACT;
  let current: ChapterInfo = { id: 'top', act: DEFAULT_ACT, still: false };

  const apply = (id: string) => {
    if (id === currentId) return;
    const ch = CHAPTER_MAP[id];
    if (!ch) return;
    currentId = id;
    const actChanged = ch.act !== currentAct;
    currentAct = ch.act;
    root.dataset.act = ch.act;
    if (ch.still) root.dataset.still = 'true';
    else delete root.dataset.still;
    if (actChanged) fireFog();
    current = { id, act: ch.act, still: Boolean(ch.still) };
    emit(listeners, current);
  };

  /* Initial stamp — the film opens in Act I. Runs before observers attach,
     so no fog on boot. */
  root.dataset.act = DEFAULT_ACT;

  if (typeof IntersectionObserver === 'undefined') {
    const s: State = { current, listeners, stop: () => delete root.dataset.still };
    state = s;
    return s;
  }

  const els = Object.keys(CHAPTER_MAP)
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          apply((e.target as HTMLElement).id);
          return;
        }
      }
    },
    { rootMargin: '-38% 0px -52% 0px' },
  );
  els.forEach((el) => io.observe(el));

  state = {
    current,
    listeners,
    stop: () => {
      io.disconnect();
      delete root.dataset.act;
      delete root.dataset.still;
    },
  };
  return state;
}

/** Subscribe to chapter changes. Idempotent: one shared observer. */
export function onChapterChange(fn: Listener): () => void {
  const s = ensureObserver();
  s.listeners.add(fn);
  fn(s.current);
  return () => {
    s.listeners.delete(fn);
  };
}

/** Current chapter (for one-shot reads). */
export function chapterNow(): ChapterInfo {
  return ensureObserver().current;
}

/** React binding. */
export function useChapter(): ChapterInfo {
  const [info, setInfo] = useState<ChapterInfo>(() => chapterNow());
  useEffect(() => onChapterChange(setInfo), []);
  return info;
}
