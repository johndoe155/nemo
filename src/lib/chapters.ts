/* ============================================================================
   chapters — "THE LIVING ARCHIVE" narrative spine.

   The page is no longer a list of feature modules: it is ten chapters of one
   authored sequence. This module is the single source of truth for that
   sequence, and the ChapterProvider (src/lib/ChapterProvider.tsx) is the only
   thing that observes the scroll to advance it.

   WHAT A CHAPTER OWNS
     · scene       — which ambience district (lib/scenes.ts) paints behind it
     · accent(s)   — the one or two hues allowed to speak in that chapter
     · glow/grain  — atmospheric intensity (light + film grain)
     · tint        — typographic intensity (how much the type is allowed to be
                     "material" — gradient ink, chroma, stroke)
     · density     — background particle budget (0 = silence, 1 = full field)
     · vignette    — how hard the frame closes in
     · cursor      — the default cursor vocabulary for the chapter
     · silence     — chapters that deliberately STOP moving

   The chapter controller writes these onto <html> as CSS custom properties
   (--chapter-*) plus data-chapter, so every layer — CSS, shader, WebGL
   particle budget, cursor — reads ONE authored value instead of inventing its
   own. Nothing in here is decorative: it exists so that no two sections
   compete for the same part of the visitor's attention at the same time.

   MAPPING: several DOM sections can belong to one chapter (the roster and the
   rotunda are both "Archive"; pulls and the store are both "Commerce"). One
   chapter, one atmosphere, many rooms.
   ========================================================================== */

import { applyScene, type SceneId } from './scenes';

/* ---- Cursor vocabulary (see components/Cursor.tsx) ------------------------
   A deliberately small language. Five states, not one per component:
     default  a small point of light
     explore  an expanding ring          (browsing, dragging)
     inspect  a framing reticle          (artifacts, plates, gallery)
     enter    a portal aperture          (CTAs, links into the archive)
     hold     a gravitational ring       (pressed / latched state)          */
export type CursorMode = 'default' | 'explore' | 'inspect' | 'enter' | 'hold';

export type ChapterId =
  | 'wake'
  | 'encounter'
  | 'archive'
  | 'voice'
  | 'access'
  | 'commerce'
  | 'authorship'
  | 'canon'
  | 'collapse'
  | 'return';

export interface Chapter {
  /** 01 … 10 in the authored order. */
  index: number;
  /** The display name — one word, all caps. */
  title: string;
  /** Numeral used by the archive index. */
  numeral: string;
  /** One line of intent, for the index and for the printed chapter card. */
  intent: string;
  /** Ambience district. */
  scene: SceneId;
  /** Dominant hue of the chapter. */
  accent: string;
  /** The one secondary hue allowed in. */
  accent2: string;
  /** Ambient light 0..1. */
  glow: number;
  /** Film grain 0..1. */
  grain: number;
  /** Typographic intensity 0..1 (gradient ink / chroma / stroke strength). */
  tint: number;
  /** Background particle budget 0..1. */
  density: number;
  /** Frame closure 0..1. */
  vignette: number;
  /** Default cursor state while this chapter is on the reading line. */
  cursor: CursorMode;
  /** Chapters that intentionally hold still. */
  silence: boolean;
}

/* ---- Palette, by name ---------------------------------------------------
   These are the SAME hues as the design system (global.css). They are named
   here so the art direction reads as a sentence: void / bone / cyan /
   ultraviolet / gold / ember — six voices, choreographed, never all at once. */
const BONE = 'var(--bone)';
const CYAN = 'var(--cyan)';
const ULTRA = 'var(--ultraviolet)';
const IRIS = 'var(--iris)';
const GOLD = 'var(--gold)';
const VOID = 'var(--void-core)';

export const CHAPTERS: Record<ChapterId, Chapter> = {
  /* 01 — the archive powers on. Nothing is shown; something is listening. */
  wake: {
    index: 1,
    title: 'WAKE',
    numeral: 'I',
    intent: 'The archive registers a visitor.',
    scene: 'arrival',
    accent: BONE,
    accent2: CYAN,
    glow: 0.18,
    grain: 0.9,
    tint: 0.2,
    density: 0.12,
    vignette: 0.95,
    cursor: 'default',
    silence: true,
  },

  /* 02 — first contact. Cyan with ultraviolet undertones, one focal point. */
  encounter: {
    index: 2,
    title: 'ENCOUNTER',
    numeral: 'II',
    intent: 'One canon. Infinite versions.',
    scene: 'arrival',
    accent: CYAN,
    accent2: ULTRA,
    glow: 0.62,
    grain: 0.55,
    tint: 1,
    density: 1,
    vignette: 0.5,
    cursor: 'explore',
    silence: false,
  },

  /* 03 — the canon fractures into universes. Cyan + violet, art-led. */
  archive: {
    index: 3,
    title: 'ARCHIVE',
    numeral: 'III',
    intent: 'Every version, hung and numbered.',
    scene: 'registry',
    accent: CYAN,
    accent2: ULTRA,
    glow: 0.48,
    grain: 0.6,
    tint: 0.72,
    density: 0.42,
    vignette: 0.62,
    cursor: 'inspect',
    silence: false,
  },

  /* 04 — the archive notices you. Cooler, with one warm light on a face. */
  voice: {
    index: 4,
    title: 'VOICE',
    numeral: 'IV',
    intent: 'Something in here is awake.',
    scene: 'signal',
    accent: 'var(--persona-cool)',
    accent2: GOLD,
    glow: 0.44,
    grain: 0.5,
    tint: 0.58,
    density: 0.3,
    vignette: 0.66,
    cursor: 'default',
    silence: false,
  },

  /* 05 — gold enters. Ownership is the only story told here. */
  access: {
    index: 5,
    title: 'ACCESS',
    numeral: 'V',
    intent: 'The doors open in order.',
    scene: 'vault',
    accent: GOLD,
    accent2: ULTRA,
    glow: 0.56,
    grain: 0.45,
    tint: 0.8,
    density: 0.28,
    vignette: 0.58,
    cursor: 'enter',
    silence: false,
  },

  /* 06 — commerce as ritual. Gold holds; the room stays cool around it. */
  commerce: {
    index: 6,
    title: 'COMMERCE',
    numeral: 'VI',
    intent: 'Every purchase pulls a piece.',
    scene: 'vault',
    accent: GOLD,
    accent2: IRIS,
    glow: 0.5,
    grain: 0.42,
    tint: 0.66,
    density: 0.34,
    vignette: 0.54,
    cursor: 'hold',
    silence: false,
  },

  /* 07 — the human hand. Bone, ink, a thread of gold for provenance. */
  authorship: {
    index: 7,
    title: 'AUTHORSHIP',
    numeral: 'VII',
    intent: 'Credited forever.',
    scene: 'constellation',
    accent: BONE,
    accent2: GOLD,
    glow: 0.34,
    grain: 0.62,
    tint: 0.5,
    density: 0.18,
    vignette: 0.6,
    cursor: 'default',
    silence: false,
  },

  /* 08 — the exhale. The clearest, quietest reading room on the page. */
  canon: {
    index: 8,
    title: 'CANON',
    numeral: 'VIII',
    intent: 'One story, told once.',
    scene: 'abyss',
    accent: BONE,
    accent2: GOLD,
    glow: 0.24,
    grain: 0.7,
    tint: 0.34,
    density: 0.1,
    vignette: 0.82,
    cursor: 'default',
    silence: true,
  },

  /* 09 — collapse. The frame closes; the simulation is left alone. */
  collapse: {
    index: 9,
    title: 'COLLAPSE',
    numeral: 'IX',
    intent: 'The archive falls into itself.',
    scene: 'singularity',
    accent: VOID,
    accent2: GOLD,
    glow: 0.2,
    grain: 0.85,
    tint: 0.24,
    density: 0.06,
    vignette: 0.9,
    cursor: 'default',
    silence: true,
  },

  /* 10 — nearly monochrome, then one cyan signal: the cycle restarts. */
  return: {
    index: 10,
    title: 'RETURN',
    numeral: 'X',
    intent: 'The end is another threshold.',
    scene: 'abyss',
    accent: BONE,
    accent2: CYAN,
    glow: 0.16,
    grain: 0.78,
    tint: 0.3,
    density: 0.08,
    vignette: 0.86,
    cursor: 'enter',
    silence: false,
  },
};

/** The authored order — the archive index reads from this, not from the DOM. */
export const CHAPTER_ORDER: ChapterId[] = [
  'wake',
  'encounter',
  'archive',
  'voice',
  'access',
  'commerce',
  'authorship',
  'canon',
  'collapse',
  'return',
];

/* ---- DOM section → chapter ------------------------------------------------
   `top` is the hero (header#top). `connect` is the footer, which sits OUTSIDE
   <main> and is therefore looked up with getElementById like every other id.
   The rotunda (#rotunda) is a room inside Archive; pulls + store are the two
   rooms of Commerce. Singularity is omitted on phones (see sections/
   Singularity.tsx) — the observer filters it out the same way lib/scenes.ts
   does, so the chapter index and the ambience never disagree. */
export const SECTION_CHAPTER: Record<string, ChapterId> = {
  top: 'encounter',
  nemoverse: 'archive',
  rotunda: 'archive',
  persona: 'voice',
  perks: 'access',
  pulls: 'commerce',
  store: 'commerce',
  artists: 'authorship',
  lore: 'canon',
  singularity: 'collapse',
  connect: 'return',
};

/** Which DOM section each chapter is anchored to (for the index links). */
export const CHAPTER_ANCHOR: Record<ChapterId, string> = {
  wake: 'top',
  encounter: 'top',
  archive: 'nemoverse',
  voice: 'persona',
  access: 'perks',
  commerce: 'pulls',
  authorship: 'artists',
  canon: 'lore',
  collapse: 'singularity',
  return: 'connect',
};

export const DEFAULT_CHAPTER: ChapterId = 'wake';

/* ---------------------------------------------------------------------------
   applyChapter — the ONLY writer of the chapter layer on <html>.

   Everything downstream (CSS chrome, reveal grammar, grain, particle budget,
   cursor default, ambience district) reads these custom properties. One
   writer, one frame, no competing authorities.
--------------------------------------------------------------------------- */

let currentChapter: ChapterId | null = null;

export function applyChapter(id: ChapterId): void {
  const root = document.documentElement;
  const c = CHAPTERS[id];
  if (!c) return;
  const changed = id !== currentChapter;
  currentChapter = id;

  root.dataset.chapter = id;
  root.style.setProperty('--chapter-accent', c.accent);
  root.style.setProperty('--chapter-accent-2', c.accent2);
  root.style.setProperty('--chapter-glow', String(c.glow));
  root.style.setProperty('--chapter-grain', String(c.grain));
  root.style.setProperty('--chapter-tint', String(c.tint));
  root.style.setProperty('--chapter-density', String(c.density));
  root.style.setProperty('--chapter-vignette', String(c.vignette));
  root.style.setProperty('--chapter-index', String(c.index));
  root.dataset.silence = c.silence ? 'true' : 'false';

  /* The ambience district follows the chapter — one controller, one sky. */
  if (changed) applyScene(c.scene);
}

/** Imperative override (the boot sequence holds `wake` until it releases). */
let override: ChapterId | null = null;
export function holdChapter(id: ChapterId | null): void {
  override = id;
  if (id) applyChapter(id);
}
export function chapterOverride(): ChapterId | null {
  return override;
}

export function resetChapterState(): void {
  currentChapter = null;
  override = null;
}

/* ---------------------------------------------------------------------------
   observeChapters — a SINGLE IntersectionObserver over the mapped sections,
   using the same centre-band technique as the section rails (-38% / -52%) so
   a chapter changes exactly when its section crosses the reading line.

   Returns a cleanup function. Nothing in here starts a scroll loop.
--------------------------------------------------------------------------- */

const MOBILE_CHAPTER_QUERY = '(max-width: 768px)';

export function observeChapters(onChapter?: (id: ChapterId) => void): () => void {
  const root = document.documentElement;

  const write = (id: ChapterId) => {
    if (override) return; // the boot sequence owns the chapter while it holds
    if (id === currentChapter) return;
    applyChapter(id);
    onChapter?.(id);
  };

  applyChapter(DEFAULT_CHAPTER);
  onChapter?.(DEFAULT_CHAPTER);

  if (typeof IntersectionObserver === 'undefined') {
    return () => {
      delete root.dataset.chapter;
      delete root.dataset.silence;
      currentChapter = null;
    };
  }

  const isMobile =
    typeof window !== 'undefined' && window.matchMedia(MOBILE_CHAPTER_QUERY).matches;

  const els = Object.keys(SECTION_CHAPTER)
    .filter((id) => !(isMobile && id === 'singularity'))
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const next = SECTION_CHAPTER[(e.target as HTMLElement).id];
          if (next) write(next);
          return;
        }
      }
    },
    { rootMargin: '-38% 0px -52% 0px' },
  );
  els.forEach((el) => io.observe(el));

  return () => {
    io.disconnect();
    delete root.dataset.chapter;
    delete root.dataset.silence;
    currentChapter = null;
  };
}
