/* ============================================================================
   palette.ts — THE single source of truth for colour (IDENTITY-SPEC §3.3)

   Before this module the site had five independent palette sources of truth
   (global.css :root, lib/scenes.ts float triplets, pulls.css's private block,
   shader literals in four files, and a vendored config). This module is the
   one table every renderer reads:

     · CSS      — global.css :root and the [data-scene] zone blocks mirror
                  these hexes verbatim; tests/unit/palette.test.ts fails the
                  build if they ever drift (SPEC §10).
     · WebGL    — scenes.ts builds its uniform triplets from `floats()`.
     · Shaders  — VortexStage reads ZONES.trench; the hero field reads
                  HERO_FIELD.

   Names and roles are final. Hexes are PROVISIONAL (SPEC §3.2): sampled from
   the five reference artworks of 2026-09-24, to be re-swatched against the
   full final art set. Edit here, everywhere updates.
============================================================================ */

export const PALETTE = {
  /* grounds & stock */
  paper: '#F2EEE2',
  'paper-2': '#E5DECC',
  manila: '#E3CD9C',
  ink: '#0C0B0E',
  /* the character */
  pink: '#E46FA5',
  mint: '#93E2A4',
  sky: '#7CC9E8',
  water: '#25B4E4',
  /* depth */
  deep: '#06202F',
  'bio-cyan': '#5FE3FF',
  /* rationed accents */
  stamp: '#D8452E',
} as const;

export type PaletteKey = keyof typeof PALETTE;
export type DerivedKey = keyof typeof DERIVED;
export type ColorKey = PaletteKey | DerivedKey;

/* Derived steps — hover/pressed states and the Z2 cooling ramp. Kept here so
   the CSS derived ramps and any shader that needs them cannot disagree. */
export const DERIVED = {
  'pink-deep': '#C64E86',
  'mint-deep': '#5FBF77',
  'water-deep': '#128AB4',
  'sky-deep': '#4FA3C9',
  'deep-2': '#04141D',
  'deep-3': '#020A10',
  /* mid-water ground: dark enough for paper-ink body text (≈9:1), blue
     enough to read as water, not as the retired void. */
  'mid-ground': '#0B3548',
  /* text-on-dark ramp: the only alpha ramp allowed on dark grounds
     (SPEC §3.2). Mirrors the old ink/ink-dim/ink-faint discipline. */
  'paper-ink': '#F2EEE2',
  'paper-ink-dim': 'rgba(242, 238, 226, 0.72)',
  'paper-ink-faint': 'rgba(242, 238, 226, 0.60)',
  /* contrast-safe accents for text/graphics ON PAPER (>=4.5:1 on --paper).
     The saturated cel colours are surfaces at display size; these are their
     ink equivalents for body-size text and hairlines on light grounds. */
  'pink-ink': '#A83A6B',
  'water-ink': '#0B6A8C',
  'mint-ink': '#2F7A46',
  'sky-ink': '#2C6E8A',
  'stamp-ink': '#B03A22',
  /* paper stock steps (card wells, sunken panels) */
  /* paper seen through a metre of water — the reef zone's ground */
  'paper-water': '#EEF0E4',
  'paper-3': '#EAE4D3',
  'paper-4': '#E0D9C5',
  /* text-on-light ramp */
  'ink-dim': 'rgba(12, 11, 14, 0.74)',
  'ink-faint': 'rgba(12, 11, 14, 0.62)',
  'ink-faint-decor': 'rgba(12, 11, 14, 0.38)',
  /* light-ground panel/line steps (temperature, not alpha glow) */
  'panel-light': 'rgba(12, 11, 14, 0.045)',
  'line-light': 'rgba(12, 11, 14, 0.18)',
  'line-strong-light': 'rgba(12, 11, 14, 0.34)',
  /* dark-ground panel/line steps */
  'panel-dark': 'rgba(242, 238, 226, 0.06)',
  'line-dark': 'rgba(242, 238, 226, 0.20)',
  'line-strong-dark': 'rgba(242, 238, 226, 0.36)',
} as const;

/* ---------------------------------------------------------------------------
   Depth zones (SPEC §2.1). The page is a dive; scroll is depth. Each zone
   owns a ground, a text regime and an ambience palette. `floats` triplets
   feed the Ambience shader's three colour fields; `vig` is edge darkening;
   `caustic` is the strength of the light-sheet term (0 on dry paper).
--------------------------------------------------------------------------- */
export type ZoneId = 'surface' | 'reef' | 'midwater' | 'trench';

export interface Zone {
  /** light-ground? decides the text regime in CSS */
  light: boolean;
  fields: readonly [
    { c: ColorKey; gain: number; pos: readonly [number, number]; rad: number },
    { c: ColorKey; gain: number; pos: readonly [number, number]; rad: number },
    { c: ColorKey; gain: number; pos: readonly [number, number]; rad: number },
  ];
  vig: number;
  caustic: number;
}

export const ZONES: Record<ZoneId, Zone> = {
  /* Dry paper: the ambience is almost off — paper is FLAT. A whisper of
     warm light top-left so the stock doesn't read as a flat scan. */
  surface: {
    light: true,
    fields: [
      { c: 'manila', gain: 0.05, pos: [0.12, -0.1], rad: 0.85 },
      { c: 'sky', gain: 0.03, pos: [0.95, 0.15], rad: 0.6 },
      { c: 'paper-2', gain: 0.04, pos: [0.5, 1.15], rad: 0.9 },
    ],
    vig: 0.12,
    caustic: 0,
  },
  /* The reef: saturated water light playing over the paper stock. */
  reef: {
    light: true,
    fields: [
      { c: 'water', gain: 0.16, pos: [0.85, 0.1], rad: 0.75 },
      { c: 'mint', gain: 0.1, pos: [0.08, 0.85], rad: 0.7 },
      { c: 'sky', gain: 0.12, pos: [0.5, -0.15], rad: 0.8 },
    ],
    vig: 0.2,
    caustic: 0.55,
  },
  /* Mid-water: the paper is gone; the ground is water going deep. */
  midwater: {
    light: false,
    fields: [
      { c: 'water-deep', gain: 0.2, pos: [0.5, -0.1], rad: 0.9 },
      { c: 'sky', gain: 0.1, pos: [0.15, 0.2], rad: 0.65 },
      { c: 'deep', gain: 0.4, pos: [0.5, 1.1], rad: 1.0 },
    ],
    vig: 0.55,
    caustic: 0.35,
  },
  /* The trench: bioluminescence only. */
  trench: {
    light: false,
    fields: [
      { c: 'deep', gain: 0.5, pos: [0.5, 0.5], rad: 0.95 },
      { c: 'bio-cyan', gain: 0.07, pos: [0.5, 0.62], rad: 0.5 },
      { c: 'mint', gain: 0.04, pos: [0.2, 0.9], rad: 0.55 },
    ],
    vig: 0.9,
    caustic: 0.15,
  },
};

export const DEFAULT_ZONE: ZoneId = 'surface';

/* Section id → zone. Ids match the live DOM (Hero renders header#top; the
   footer is #connect and sits outside <main>). The footer is the coda: the
   page surfaces, so it returns to paper (SPEC §2.1). */
export const SECTION_ZONE: Record<string, ZoneId> = {
  top: 'surface',
  nemoverse: 'reef',
  pulls: 'reef',
  persona: 'midwater',
  holder: 'midwater',
  canon: 'midwater',
  singularity: 'trench',
  connect: 'surface',
};

/* ---------------------------------------------------------------------------
   Helpers for GPU consumers.
--------------------------------------------------------------------------- */

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Any palette or derived hex as a 0..1 triplet for uniforms. */
export function floats(key: ColorKey): [number, number, number] {
  const hex =
    (PALETTE as Record<string, string>)[key] ?? (DERIVED as Record<string, string>)[key];
  if (!hex || hex.startsWith('rgba')) {
    throw new Error(`palette.floats: ${key} is not a hex colour`);
  }
  return hexToRgb01(hex);
}

/* The hero particle field's formation colours (SPEC §7: the field stays —
   it is character-led — but its palette joins the table). Ink-outlined
   cel colours instead of the old neon-on-void ramp. */
export const HERO_FIELD = {
  a: floats('mint'),
  b: floats('sky'),
  c: floats('pink'),
  line: floats('water'),
} as const;
