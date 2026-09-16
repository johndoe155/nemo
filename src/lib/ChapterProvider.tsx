import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  CHAPTERS,
  CHAPTER_ORDER,
  DEFAULT_CHAPTER,
  applyChapter,
  holdChapter,
  observeChapters,
  type Chapter,
  type ChapterId,
  type CursorMode,
} from './chapters';
import { detectTier, profileFor, type QualityProfile, type QualityTier } from './quality';

/* ============================================================================
   ChapterProvider — the shared transition controller.

   One component owns everything that used to be decided independently by a
   dozen subsystems:

     · which chapter of the story is on the reading line
     · which ambience district paints behind it (via chapters.applyChapter)
     · the cursor's default vocabulary for that chapter
     · the device quality tier every heavy subsystem reads
     · whether the page is still booting (the load sequence holds `wake`)
     · the authored "silence" flag — chapters that deliberately stop moving

   Consumers use `useChapter()`, `useCursorMode()`, `useQuality()` and
   `useBootState()`. Nothing else on the page is allowed to run its own
   section observer for atmosphere: the rails (SideRail/nav scrollspy) keep
   their own focus-management observers because they answer a different
   question (which LINK is current), but the SKY is authored here.
   ========================================================================== */

export interface ChapterState {
  /** Current chapter id. */
  chapter: ChapterId;
  /** Full art-direction record for the current chapter. */
  meta: Chapter;
  /** 0-based position in CHAPTER_ORDER (for progress + the index). */
  step: number;
  /** The previous chapter — transitions can animate out of it. */
  previous: ChapterId;
  /** True while the chapter is the one that intentionally holds still. */
  silence: boolean;
  /** Imperative override, used by the boot sequence. */
  setChapter: (id: ChapterId) => void;
}

export interface CursorState {
  mode: CursorMode;
  set: (mode: CursorMode) => void;
  /** Reset to the current chapter's default. */
  clear: () => void;
}

const ChapterCtx = createContext<ChapterState | null>(null);
const CursorCtx = createContext<CursorState | null>(null);
const QualityCtx = createContext<QualityProfile | null>(null);
const BootCtx = createContext<{ booted: boolean; markBooted: () => void } | null>(null);

export function ChapterProvider({ children }: { children: ReactNode }) {
  const [chapter, setChapterState] = useState<ChapterId>(DEFAULT_CHAPTER);
  const [previous, setPrevious] = useState<ChapterId>(DEFAULT_CHAPTER);
  const [cursorOverride, setCursorOverride] = useState<CursorMode | null>(null);
  const [booted, setBooted] = useState(false);

  /* ---- Device tier — measured once, re-measured on breakpoint hops ------- */
  const [tier, setTier] = useState<QualityTier>(() => detectTier());
  const quality = useMemo(() => profileFor(tier), [tier]);

  useEffect(() => {
    const queries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(max-width: 768px)'),
    ];
    const sync = () => setTier(detectTier());
    queries.forEach((q) => q.addEventListener('change', sync));
    return () => queries.forEach((q) => q.removeEventListener('change', sync));
  }, []);

  /* Publish the tier as a data attribute + token so CSS can degrade without
     JS branching in every section (glass, grain, ambient loops). */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.quality = tier;
    root.style.setProperty('--quality-particle', String(quality.particleDensity));
    root.style.setProperty('--quality-dpr', String(quality.dprCap));
    return () => {
      delete root.dataset.quality;
      root.style.removeProperty('--quality-particle');
      root.style.removeProperty('--quality-dpr');
    };
  }, [tier, quality]);

  /* ---- The one observer --------------------------------------------------- */
  const setChapter = useCallback((id: ChapterId) => {
    setChapterState((prev) => {
      if (prev === id) return prev;
      setPrevious(prev);
      return id;
    });
    applyChapter(id);
  }, []);

  const markBooted = useCallback(() => {
    setBooted(true);
    /* The boot held `wake`. Releasing the override is not enough on its own:
       the chapter IntersectionObserver only fires on a CHANGE, and the hero
       was already intersecting (and was ignored) for the whole boot — so no
       event would ever arrive and the page would stay in chapter 01 forever.
       The boot ends at the top of the page, so resolve to `encounter`
       explicitly; every later chapter arrives on its own crossing. */
    holdChapter(null);
    setChapter('encounter');
  }, [setChapter]);

  useEffect(() => {
    if (!booted) holdChapter('wake');
  }, [booted]);

  useEffect(() => {
    if (!booted) return;
    return observeChapters((id) => {
      setChapterState((prev) => {
        if (prev === id) return prev;
        setPrevious(prev);
        return id;
      });
    });
  }, [booted]);

  /* Mirror the reading position. Skipped while the boot holds `wake`, so a
     reload never offers to resume from a chapter that was never read — and
     note this runs AFTER the snapshot above was taken at module load. */
  useEffect(() => {
    if (!booted || chapter === 'wake') return;
    writeResume(chapter);
  }, [booted, chapter]);

  /* ---- Cursor vocabulary -------------------------------------------------- */
  const setCursor = useCallback((mode: CursorMode) => setCursorOverride(mode), []);
  const clearCursor = useCallback(() => setCursorOverride(null), []);
  const mode: CursorMode = cursorOverride ?? CHAPTERS[chapter].cursor;

  const chapterState = useMemo<ChapterState>(
    () => ({
      chapter,
      meta: CHAPTERS[chapter],
      step: CHAPTER_ORDER.indexOf(chapter),
      previous,
      silence: CHAPTERS[chapter].silence,
      setChapter,
    }),
    [chapter, previous, setChapter],
  );

  const cursorState = useMemo<CursorState>(
    () => ({ mode, set: setCursor, clear: clearCursor }),
    [mode, setCursor, clearCursor],
  );

  const bootState = useMemo(() => ({ booted, markBooted }), [booted, markBooted]);

  return (
    <ChapterCtx.Provider value={chapterState}>
      <CursorCtx.Provider value={cursorState}>
        <QualityCtx.Provider value={quality}>
          <BootCtx.Provider value={bootState}>{children}</BootCtx.Provider>
        </QualityCtx.Provider>
      </CursorCtx.Provider>
    </ChapterCtx.Provider>
  );
}

/* --------------------------------- hooks --------------------------------- */

/* ---------------------------------------------------------------------------
   READING POSITION — "resume where you left off"

   Ten chapters is a long scroll, and a reload drops the visitor back at the
   top with no way back to where they were. The chapter is mirrored into
   sessionStorage (NOT localStorage: a new tab should start the story again)
   so the archive index can offer a single "continue from" link.

   Writes are throttled to chapter changes only — a handful per session.
--------------------------------------------------------------------------- */

export const RESUME_KEY = 'ocu:chapter';

/* The snapshot has to be taken at MODULE EVALUATION, before React renders
   anything. Read lazily instead and it is already too late: the boot resolves
   to `encounter` and writes that over the stored chapter within a frame of
   mount, so the visitor's place was destroyed by the very reload that was
   supposed to restore it. */
let resumeSnapshot: ChapterId | null = null;
try {
  const raw =
    typeof window !== 'undefined' ? window.sessionStorage.getItem(RESUME_KEY) : null;
  if (raw && raw in CHAPTERS) resumeSnapshot = raw as ChapterId;
} catch {
  /* storage unavailable — the prompt simply never appears */
}

export function writeResume(id: ChapterId): void {
  try {
    window.sessionStorage.setItem(RESUME_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

/** Where the visitor left off, as of the start of this session. */
export function readResume(): ChapterId | null {
  return resumeSnapshot;
}

/** True while the visitor is EARLIER in the story than where they left off —
    the only case in which "continue from" means anything. */
export function isBehindResume(current: ChapterId): boolean {
  if (!resumeSnapshot) return false;
  return CHAPTER_ORDER.indexOf(resumeSnapshot) > CHAPTER_ORDER.indexOf(current);
}

export function useChapter(): ChapterState {
  const ctx = useContext(ChapterCtx);
  if (!ctx) throw new Error('useChapter must be used inside <ChapterProvider>');
  return ctx;
}

export function useCursorMode(): CursorState {
  const ctx = useContext(CursorCtx);
  if (!ctx) throw new Error('useCursorMode must be used inside <ChapterProvider>');
  return ctx;
}

export function useQuality(): QualityProfile {
  const ctx = useContext(QualityCtx);
  if (!ctx) throw new Error('useQuality must be used inside <ChapterProvider>');
  return ctx;
}

export function useBootState(): { booted: boolean; markBooted: () => void } {
  const ctx = useContext(BootCtx);
  if (!ctx) throw new Error('useBootState must be used inside <ChapterProvider>');
  return ctx;
}

/* ---------------------------------------------------------------------------
   useChapterCursor — the ergonomic way for a component to claim a cursor
   state while it is hovered, and give it back on exit. Used instead of the
   old per-component data-cursor→CSS-sprite approach so the whole page speaks
   one five-word language.
--------------------------------------------------------------------------- */
export function useChapterCursor(mode: CursorMode) {
  const cursor = useCursorMode();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const enter = () => cursor.set(mode);
    const leave = () => cursor.clear();
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', enter);
    el.addEventListener('focusout', leave);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', enter);
      el.removeEventListener('focusout', leave);
    };
  }, [cursor, mode]);

  return ref;
}
