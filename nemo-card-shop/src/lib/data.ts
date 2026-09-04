/* ============================================================================
   THE NEMOVERSE — CARD SHOP DATA LAYER
   Structural contract for the Universe card entities. The types below are
   FIELD-FOR-FIELD identical to the Hub's canonical lib/data.ts so a future
   integration is a straight `import` swap from this module onto the Hub's —
   no data migration. The records themselves reuse the existing Nemoverse canon
   (U-001…U-009), with only the drop-schedule dates nudged so the shop reads as
   live on any given day (see INTEGRATION.md, "Deliberate deviations").
   ========================================================================== */

export const BASE = import.meta.env.BASE_URL;
export const art = (f: string) => `${BASE}art/${f}`;

/* ------------------------------- RARITY ------------------------------- */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'secret';

export const RARITY: Record<
  Rarity,
  { label: string; color: string; weight: number; tier: number; note: string }
> = {
  common: { label: 'COMMON', color: '#c8cfe0', weight: 60, tier: 1, note: 'Open edition of the universe' },
  rare: { label: 'RARE', color: '#3fe8ff', weight: 26, tier: 2, note: 'Includes variant colorway odds' },
  epic: { label: 'EPIC', color: '#8a4dff', weight: 9, tier: 3, note: 'Lower supply, higher chase' },
  legendary: { label: 'LEGENDARY', color: '#ffc857', weight: 3.5, tier: 4, note: 'Single-digit odds on most pulls' },
  secret: { label: 'SECRET', color: '#ff3d9a', weight: 4, tier: 5, note: 'Unannounced universe. Never commissioned.' },
};

export const STATUS_LABEL: Record<Universe['status'], string> = {
  live: 'LIVE',
  'sold-out': 'SOLD OUT',
  upcoming: 'UPCOMING',
  encrypted: 'ENCRYPTED',
  secret: 'SECRET',
};

/* ------------------------------ ARTIST ------------------------------ */

export interface Artist {
  name: string;
  handle: string;
  quote: string;
  initials: string;
  hue: [string, string];
}

export interface Universe {
  id: number;
  code: string;
  name: string;
  world: string;
  lore: string;
  artist: Artist;
  style: string;
  released: string; // ISO date
  status: 'sold-out' | 'live' | 'upcoming' | 'encrypted' | 'secret';
  rarity: Rarity;
  supply: number;
  minted: number;
  price: number; // ETH on Base
  palette: [string, string];
  image: string;
  tags: string[];
  variant?: string;
}

export const ARTISTS: Artist[] = [
  { name: 'Aya Okafor', handle: '@ayaokafor.art', initials: 'AO', hue: ['#f6d47c', '#c98a2e'], quote: '“I painted him the way cathedrals get painted — slowly, and in candlelight.”' },
  { name: 'Kenji “KXM” Matsuda', handle: '@kxm.works', initials: 'KM', hue: ['#3fe8ff', '#8a4dff'], quote: '“Edo never ended. It just changed its electricity.”' },
  { name: 'Mara Volkov', handle: '@maravolkov.studio', initials: 'MV', hue: ['#ff5c5c', '#7a0f0f'], quote: '“Brutalism is honesty. I cut him out of paper so the truth would show through.”' },
  { name: 'DIVINE✧MACHINE', handle: '@divinemachine', initials: 'DM', hue: ['#ff9ad5', '#7a5cff'], quote: '“Mirrors don’t lie. They just repeat you forever.”' },
  { name: 'Sister Amara', handle: '@sister.amara', initials: 'SA', hue: ['#ffc857', '#f6d47c'], quote: '“Gilding NEMO took 214 hours. Worth every second.”' },
  { name: 'NULL//FORM', handle: '@nullform', initials: 'NF', hue: ['#ff3d9a', '#3fe8ff'], quote: '“The signal was already there. I just tuned the antenna.”' },
  { name: 'Ingrid Solvane', handle: '@ingridsolvane', initials: 'IS', hue: ['#7dffb0', '#3fe8ff'], quote: '“He walks where the lights end. I only followed.”' },
];

/* ------------------------------------ The shop catalog ------------------------------------ */

export const CATALOG: Universe[] = [
  {
    id: 1,
    code: 'U-001',
    name: 'The Prime Reality',
    world: 'Timeline Zero',
    lore: 'The original thread. Before the split, there was one door, one candle, one choice. Every version of NEMO that will ever exist descends from this moment — and this is the room where the first choice was made.',
    artist: ARTISTS[0],
    style: 'Baroque oil on canvas · chiaroscuro',
    released: '2026-02-14',
    status: 'sold-out',
    rarity: 'common',
    supply: 200,
    minted: 200,
    price: 0.06,
    palette: ['#f6d47c', '#c98a2e'],
    image: art('u001.jpg'),
    tags: ['foundation', 'timeline-zero', 'oil'],
    variant: '3 “Candlewick” alt-colorway variants minted.',
  },
  {
    id: 2,
    code: 'U-002',
    name: 'Neon Shogunate',
    world: 'Edo-2077',
    lore: 'In a city that never saw sunrise, NEMO walks as a masterless ronin. The neon prays to him and the rain runs off his coat like memory. His star-face outshines every sign in the district.',
    artist: ARTISTS[1],
    style: 'Ukiyo-e woodblock × cyberpunk neon',
    released: '2026-03-03',
    status: 'sold-out',
    rarity: 'rare',
    supply: 150,
    minted: 150,
    price: 0.09,
    palette: ['#3fe8ff', '#8a4dff'],
    image: art('u002.jpg'),
    tags: ['ronin', 'neon', 'rain'],
    variant: '5 “Midnight Kimono” variants minted.',
  },
  {
    id: 3,
    code: 'U-003',
    name: 'Hollow Horizon',
    world: 'The Concrete Sea',
    lore: 'A megacity of raw concrete that forgot its architects. NEMO drifts through it like a paper ghost, torn at the edges, printed in ink the city can’t wash off. Brutalism is honesty.',
    artist: ARTISTS[2],
    style: 'Brutalist risograph collage',
    released: '2026-03-24',
    status: 'live',
    rarity: 'common',
    supply: 200,
    minted: 168,
    price: 0.06,
    palette: ['#ff5c5c', '#7a0f0f'],
    image: art('u003.jpg'),
    tags: ['concrete', 'collage', 'halftone'],
    variant: '3 “Blood-Print” misregistration variants minted.',
  },
  {
    id: 4,
    code: 'U-004',
    name: 'Chrome Chapel',
    world: 'Mirror City',
    lore: 'Every surface in Mirror City is polished to worship. NEMO walks its chrome cathedral aisles reflected a thousand times — none of the reflections agree on where he’s going. That’s the point.',
    artist: ARTISTS[3],
    style: 'Vaporwave chrome · art-deco',
    released: '2026-04-11',
    status: 'live',
    rarity: 'rare',
    supply: 150,
    minted: 122,
    price: 0.09,
    palette: ['#ff9ad5', '#7a5cff'],
    image: art('u004.jpg'),
    tags: ['chrome', 'mirror', 'vaporwave'],
    variant: '5 “Rose-Gold Refraction” variants minted.',
  },
  {
    id: 5,
    code: 'U-005',
    name: 'The Gilded Echo',
    world: 'The Reliquary',
    lore: 'In a reliquary between worlds, NEMO is kept as a saint is kept — in gold leaf and sacred geometry, behind glass that pilgrims breathe on. The echo of him is louder than the man.',
    artist: ARTISTS[4],
    style: 'Illuminated manuscript · gold leaf',
    released: '2026-05-02',
    status: 'live',
    rarity: 'epic',
    supply: 100,
    minted: 71,
    price: 0.14,
    palette: ['#ffc857', '#f6d47c'],
    image: art('u005.jpg'),
    tags: ['relic', 'gold', 'geometry'],
    variant: '2 “Black Vellum” variants — the rarest of the set.',
  },
  {
    id: 6,
    code: 'U-006',
    name: 'Signal Garden',
    world: 'The Static Bloom',
    lore: 'A garden that grows antennas instead of flowers. NEMO stands in it while the broadcast eats itself. Somewhere in the static, a version of him is trying to send a message backward.',
    artist: ARTISTS[5],
    style: 'Analog glitch · datamosh',
    released: '2026-05-23',
    status: 'live',
    rarity: 'rare',
    supply: 150,
    minted: 104,
    price: 0.09,
    palette: ['#ff3d9a', '#3fe8ff'],
    image: art('u006.jpg'),
    tags: ['static', 'antenna', 'glitch'],
    variant: '4 “Dead Channel” channel-split variants minted.',
  },
  {
    id: 7,
    code: 'U-007',
    name: 'The Last Aurora',
    world: 'The Tundra At The End',
    lore: 'The tundra at the end of every timeline, where all the lights that ever were come to die in the sky. NEMO walks it alone — for now. Holders cross first. Everyone else waits at the door.',
    artist: ARTISTS[6],
    style: 'Ethereal painterly fantasy',
    released: '2026-09-19T17:00:00Z',
    status: 'upcoming',
    rarity: 'epic',
    supply: 100,
    minted: 0,
    price: 0.14,
    palette: ['#7dffb0', '#3fe8ff'],
    image: art('u007.jpg'),
    tags: ['aurora', 'tundra', 'drop'],
    variant: '2 “Polar Midnight” variants — legendary-trait holders guaranteed.',
  },
  {
    id: 8,
    code: 'U-008',
    name: 'ENCRYPTED',
    world: '▚▚▚▚▚▚▚▚▚',
    lore: 'This universe exists in the registry but not yet in the light. The artist has signed. The lore is sealed. Release cadence: one universe every few weeks — this one is next in line after the aurora.',
    artist: { name: 'REDACTED', handle: '@█████', initials: '??', hue: ['#3d3a52', '#151221'], quote: '“Signed and sealed.”' },
    style: '████████████',
    released: '2026-09-26',
    status: 'encrypted',
    rarity: 'epic',
    supply: 100,
    minted: 0,
    price: 0,
    palette: ['#3d3a52', '#151221'],
    image: '',
    tags: ['encrypted'],
  },
  {
    id: 9,
    code: 'U-009',
    name: 'Unregistered Signal',
    world: 'Nowhere On Record',
    lore: 'It was never commissioned. It has no artist credit because no one drew it — it simply arrived, already numbered, already mintable, already watching. The registry lists it as a pull result. The registry is also afraid.',
    artist: { name: 'REDACTED', handle: '@null_null_null', initials: '×', hue: ['#ff3d9a', '#3a0a1e'], quote: '“i was not drawn. i was received.”' },
    style: 'Corrupted broadcast',
    released: '2026-08-01',
    status: 'secret',
    rarity: 'secret',
    supply: 1,
    minted: 0,
    price: 0,
    palette: ['#ff3d9a', '#3a0a1e'],
    image: art('u009.jpg'),
    tags: ['secret', 'anomaly'],
  },
];

/* Holder gating: a "gated" card is only fully acquirable to a connected holder
   (early claim on drops). Everything else carries the −25% holder price. */
export const HOLDER_DISCOUNT = 0.25;

/** Given a card's status + holder flag, is this a "gated card"? */
export function isGated(u: Universe): boolean {
  return u.status === 'upcoming';
}

export interface ActionSpec {
  kind: 'add' | 'hold' | 'soon' | 'sold' | 'locked' | 'sealed' | 'released' | 'secret';
  label: string;
  hint?: string;
}

/** Resolve the primary CTA a card should show. Pure function — UI maps it. */
export function cardAction(u: Universe, holder: boolean): ActionSpec {
  switch (u.status) {
    case 'sold-out':
      return { kind: 'sold', label: 'SOLD OUT' };
    case 'upcoming':
      if (holder) return { kind: 'hold', label: 'CLAIM EARLY', hint: 'HOLDER EARLY CLAIM' };
      return { kind: 'soon', label: 'CLAIMS OPEN ON DROP', hint: 'HOLDERS CLAIM FIRST' };
    case 'encrypted':
      return { kind: 'sealed', label: 'ART SEALED' };
    case 'secret':
      return { kind: 'secret', label: 'RECEIVED VIA PULL' };
    case 'live':
      return { kind: 'add', label: holder ? 'ADD TO CART' : 'ADD TO CART' };
    default:
      return { kind: 'released', label: 'ADD TO CART' };
  }
}

/* ----------------------------- Filter vocabulary ----------------------------- */

export interface TagInfo {
  id: string;
  label: string;
}

/** Ordered tag set (label = humanized). */
export const TAG_SET: TagInfo[] = [
  { id: 'foundation', label: 'FOUNDATION' },
  { id: 'timeline-zero', label: 'TIMELINE ZERO' },
  { id: 'ronin', label: 'RONIN' },
  { id: 'neon', label: 'NEON' },
  { id: 'concrete', label: 'CONCRETE' },
  { id: 'collage', label: 'COLLAGE' },
  { id: 'chrome', label: 'CHROME' },
  { id: 'mirror', label: 'MIRROR' },
  { id: 'vaporwave', label: 'VAPORWAVE' },
  { id: 'relic', label: 'RELIC' },
  { id: 'gold', label: 'GOLD' },
  { id: 'static', label: 'STATIC' },
  { id: 'glitch', label: 'GLITCH' },
  { id: 'aurora', label: 'AURORA' },
  { id: 'tundra', label: 'TUNDRA' },
  { id: 'drop', label: 'NEXT DROP' },
  { id: 'encrypted', label: 'ENCRYPTED' },
  { id: 'secret', label: 'SECRET' },
  { id: 'anomaly', label: 'ANOMALY' },
];

export const STATUS_ORDER: Universe['status'][] = ['live', 'upcoming', 'sold-out', 'encrypted', 'secret'];

export type SortKey = 'code' | 'priceAsc' | 'priceDesc' | 'rarity' | 'release' | 'minted';

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'code', label: 'NUMBER · A→Z' },
  { value: 'release', label: 'NEWEST FIRST' },
  { value: 'rarity', label: 'RARITY · HIGH→LOW' },
  { value: 'priceAsc', label: 'PRICE · LOW→HIGH' },
  { value: 'priceDesc', label: 'PRICE · HIGH→LOW' },
  { value: 'minted', label: 'MOST MINTED' },
];

export function sortCatalog(list: Universe[], key: SortKey): Universe[] {
  const copy = [...list];
  const byDate = (a: Universe, b: Universe) =>
    new Date(a.released === '0000-00-00' ? '1970' : a.released).getTime() -
    new Date(b.released === '0000-00-00' ? '1970' : b.released).getTime();
  switch (key) {
    case 'code':
      return copy.sort((a, b) => a.id - b.id);
    case 'release':
      return copy.sort((a, b) => -byDate(a, b));
    case 'rarity':
      return copy.sort((a, b) => RARITY[b.rarity].tier - RARITY[a.rarity].tier || a.id - b.id);
    case 'priceAsc':
      return copy.sort((a, b) => a.price - b.price || a.id - b.id);
    case 'priceDesc':
      return copy.sort((a, b) => b.price - a.price || a.id - b.id);
    case 'minted':
      return copy.sort((a, b) => b.minted - a.minted || a.id - b.id);
    default:
      return copy;
  }
}
