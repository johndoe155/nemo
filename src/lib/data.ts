/* ============================================================================
   THE NEMOVERSE — CANONICAL DATA LAYER
   Every section renders from this single source of truth. Universe content is
   placeholder canon (the real OC's identity is the client's to supply); the
   structural mechanics — numbered universes, lore blurbs, artist credits,
   edition tier, supply, drop cadence, revenue split — follow the pitch exactly.
   ========================================================================== */

export const BASE = import.meta.env.BASE_URL;
export const art = (f: string) => `${BASE}art/${f}`;

/* ---------------------------- EDITION TIERS ----------------------------

   IDENTITY-SPEC §6.1: the ladder is a PRINT SHOP's ladder, not a game's.
   What used to be "rarity" is how an edition is produced and marked: open
   runs, limited runs, numbered runs, artist proofs, cancelled plates. The
   data keys survive (they are the mechanic's vocabulary in the pull engine)
   and the machinery — weight, tier order, pity rule, set bonus — is
   untouched; what changed is that every surface now names the edition the
   way a printer would. `short` is the rail's chip form, `label` the plate's,
   `treatment` says what the plate does differently. */

export type EditionTier = 'common' | 'rare' | 'epic' | 'legendary' | 'secret';

/* IDENTITY-SPEC §6 — tiers are TREATMENTS, not hues. The weight/tier logic
   below is unchanged (it drives the draw, the pity rule and the set bonus);
   only the colour coupling moved. Each tier's `color` is the ink its seal
   prints in — read straight off src/lib/palette.ts, so the ramp cannot drift
   from the rest of the design system — and `treatment` states what the plate
   does differently for that tier. */
export const TIERS: Record<
  EditionTier,
  { label: string; short: string; color: string; weight: number; tier: number; note: string; treatment: string }
> = {
  common: {
    label: 'OPEN EDITION',
    short: 'OPEN',
    color: 'var(--ink)',
    weight: 60,
    tier: 1,
    treatment: 'BLACK INK ON STOCK',
    note: 'Unlimited run, printed to demand',
  },
  rare: {
    label: 'LIMITED RUN',
    short: 'LIMITED',
    color: 'var(--water-ink)',
    weight: 26,
    tier: 2,
    treatment: 'WATER INK SEAL',
    note: 'Shorter run; carries the colourway odds',
  },
  epic: {
    label: 'NUMBERED RUN',
    short: 'NUMBERED',
    color: 'var(--pink-ink)',
    weight: 9,
    tier: 3,
    treatment: 'PINK INK SEAL',
    note: 'Numbered on the plate; the chase tier',
  },
  legendary: {
    label: 'ARTIST PROOF',
    short: 'PROOF',
    color: 'var(--stamp)',
    weight: 3.5,
    tier: 4,
    treatment: 'MANILA STOCK · FOIL LINE',
    note: 'Proofed before the run; single-digit odds',
  },
  secret: {
    label: 'CANCELLED PLATE',
    short: 'CANCELLED',
    color: 'var(--deep)',
    weight: 4,
    tier: 5,
    treatment: 'SEALED BLACKOUT',
    note: 'Plate struck through. Unannounced, never commissioned.',
  },
};

/* ------------------------------ UNIVERSES ------------------------------ */

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
  tier: EditionTier;
  supply: number;
  minted: number;
  price: number; // ETH on Base
  palette: [string, string];
  image: string;
  tags: string[];
  variant?: string;
}

export const ARTISTS: Artist[] = [
  { name: 'Aya Okafor', handle: '@ayaokafor.art', initials: 'AO', hue: ['var(--manila)', 'var(--stamp)'], quote: '“I painted him the way cathedrals get painted — slowly, and in candlelight.”' },
  { name: 'Kenji “KXM” Matsuda', handle: '@kxm.works', initials: 'KM', hue: ['var(--sky)', 'var(--water)'], quote: '“Edo never ended. It just changed its electricity.”' },
  { name: 'Mara Volkov', handle: '@maravolkov.studio', initials: 'MV', hue: ['var(--stamp)', 'var(--stamp-ink)'], quote: '“Brutalism is honesty. I cut him out of paper so the truth would show through.”' },
  { name: 'DIVINE✧MACHINE', handle: '@divinemachine', initials: 'DM', hue: ['var(--pink)', 'var(--sky)'], quote: '“Mirrors don’t lie. They just repeat you forever.”' },
  { name: 'Sister Amara', handle: '@sister.amara', initials: 'SA', hue: ['var(--manila)', 'var(--pink)'], quote: '“Gilding NEMO took 214 hours. Worth every second.”' },
  { name: 'NULL//FORM', handle: '@nullform', initials: 'NF', hue: ['var(--pink)', 'var(--bio-cyan)'], quote: '“The signal was already there. I just tuned the antenna.”' },
  { name: 'Ingrid Solvane', handle: '@ingridsolvane', initials: 'IS', hue: ['var(--mint)', 'var(--water)'], quote: '“He walks where the lights end. I only followed.”' },
];

/* ------------------------------ DROP CLOCK ------------------------------
   The canon drop date is 2026-08-22T17:00Z. A demo cannot hardcode a date:
   the moment it passes, the page starts contradicting itself — the hero
   ticker and the roster teaser flip to "U-007 IS LIVE · NOW MINTING" while
   the Lore stat still counts down to it and U-007's own card and dialog stay
   `status: 'upcoming'` with 0/100 minted.

   So the drop clock ROLLS. While the canon date is still ahead it is used
   verbatim; once it passes, the target rolls forward to keep the next drop
   four days out. Every consumer (hero ticker, teaser countdown, dialog,
   Lore stat, persona brain) derives from these two exports, so the whole
   page holds one consistent story at any date without further edits — and
   the moment the data layer marks U-007 `live`, the countdown retires
   itself everywhere at once.

   To pin a real launch date instead, set CANON_DROP_ISO to it and delete
   the roll: DROP_ISO = CANON_DROP_ISO. */
const CANON_DROP_ISO = '2026-08-22T17:00:00Z';
const DAY_MS = 86_400_000;
/** Days from "now" the placeholder countdown sits at when the canon date has passed. */
const ROLL_DAYS = 4;

function rollDropIso(): string {
  const canon = new Date(CANON_DROP_ISO).getTime();
  if (Number.isNaN(canon)) return CANON_DROP_ISO;
  if (canon - Date.now() > 0) return CANON_DROP_ISO;
  return new Date(Date.now() + ROLL_DAYS * DAY_MS).toISOString();
}

export const UNIVERSE_DROP_ISO = rollDropIso();

/** Short label ("AUG 22") derived from the live ISO so the hero copy, the
    teaser card and the Lore stat can never drift from the countdown. */
export const DROP_LABEL = new Date(UNIVERSE_DROP_ISO)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  .toUpperCase();

/** Long label ("AUGUST 22") for prose — the persona brain writes sentences,
    and "august 22" should follow the roll instead of going stale. */
export const DROP_LABEL_LONG = new Date(UNIVERSE_DROP_ISO)
  .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  .toLowerCase();



export interface FooterNavGroup {
  label: string;
  links: Array<{ label: string; href: string }>;
}

/** Footer link groups — "The Sign-Off" credits. Re-grouped so every major
    district is reachable from the closing screen. */
export const FOOTER_NAV: FooterNavGroup[] = [
  {
    label: 'UNIVERSE',
    links: [
      { label: 'The Nemoverse', href: '#nemoverse' },
      { label: 'The Rotunda', href: '#rotunda' },
      { label: 'Artists', href: '#artists' },
      { label: 'Lore', href: '#lore' },
    ],
  },
  {
    label: 'SYSTEMS',
    links: [
      { label: 'Holder Perks', href: '#perks' },
      { label: 'POP Pulls', href: '#pulls' },
      { label: 'Store', href: '#store' },
      { label: 'The Persona', href: '#persona' },
    ],
  },
];

export interface SocialLink {
  label: string;
  href: string;
  handle: string;
}

/** Demo stubs — replace with live community handles before shipping. */
export const SOCIALS: SocialLink[] = [
  { label: 'X / TWITTER', href: '#', handle: '@thenemoverse' },
  { label: 'DISCORD', href: '#', handle: 'discord.gg/nemoverse' },
  { label: 'OPENSEA', href: '#', handle: 'opensea.io/nemoverse' },
  { label: 'EMAIL', href: 'mailto:void@thenemoverse.xyz', handle: 'void@thenemoverse.xyz' },
];

export const UNIVERSES: Universe[] = [
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
    tier: 'common',
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
    tier: 'rare',
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
    tier: 'common',
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
    tier: 'rare',
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
    tier: 'epic',
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
    tier: 'rare',
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
    released: UNIVERSE_DROP_ISO,
    status: 'upcoming',
    tier: 'epic',
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
    lore: 'This universe exists in the registry but not yet in the light. The artist has signed. The lore is sealed. Release cadence: one universe every few weeks — this one is next in line.',
    artist: { name: 'REDACTED', handle: '@█████', initials: '??', hue: ['var(--paper-4)', 'var(--ink)'], quote: '“Signed and sealed.”' },
    style: '████████████',
    released: '2026-09-05',
    status: 'encrypted',
    tier: 'epic',
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
    artist: { name: 'REDACTED', handle: '@null_null_null', initials: '×', hue: ['var(--pink)', 'var(--deep)'], quote: '“i was not drawn. i was received.”' },
    style: 'Corrupted broadcast',
    released: '0000-00-00',
    status: 'secret',
    tier: 'secret',
    supply: 1,
    minted: 0,
    price: 0,
    palette: ['#ff3d9a', '#3a0a1e'],
    image: art('u009.jpg'),
    tags: ['secret', 'anomaly'],
  },
];

export const visibleUniverses = UNIVERSES.filter((u) => u.status !== 'secret');

/* ------------------------- CANON FACT LINES ------------------------------
   One formatter for every sentence that quotes a live count, so no line of
   copy can disagree with a card, a chip or the registry. Declared here, after
   the collections it measures — the persona brain and the Lore stat cards
   further down the file both read it. */
const numberWord = (n: number) =>
  ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);

export const CANON_TALLY = {
  universes: visibleUniverses.length,
  secrets: UNIVERSES.length - visibleUniverses.length,
  artists: ARTISTS.length,
};
const tallyLine = `${numberWord(CANON_TALLY.universes)} registered universes and ${numberWord(
  CANON_TALLY.secrets,
)} that don’t want to be known`;
const artistLine = `${numberWord(CANON_TALLY.artists)} canon artists so far`;
export const byId = (id: number) => UNIVERSES.find((u) => u.id === id);

/* --------------------------- GALLERY PLATES ---------------------------- */
/* Rotunda plate model RETIRED (IDENTITY-SPEC §7) with the sphere itself. */

/* --------------------------- HOLDER PERK TIERS --------------------------- */

export interface PerkTier {
  trait: string;
  tag: string;
  color: string;
  perks: string[];
}

export const PERK_TIERS: PerkTier[] = [
  {
    trait: 'ANY OC NFT',
    tag: 'GENESIS',
    color: 'var(--ink)',
    perks: [
      'HOLDER BADGE ACROSS THE HUB',
      '48H EARLY CLAIM ON EVERY NEW UNIVERSE',
      '15% DISCOUNT AUTO-APPLIED AT CHECKOUT',
    ],
  },
  {
    trait: 'UNCOMMON TRAIT',
    tag: 'T2',
    color: 'var(--water-ink)',
    perks: ['EVERYTHING IN GENESIS', 'FREE SHIPPING ON ALL ORDERS', 'POP PULL ODDS: +10% RARE'],
  },
  {
    trait: 'RARE TRAIT',
    tag: 'T3',
    color: 'var(--pink-ink)',
    perks: ['EVERYTHING ABOVE', 'HOLDER-ONLY SKUS UNLOCKED', 'DISCOUNT RAISED TO 20%', '72H EARLY CLAIM'],
  },
  {
    trait: 'LEGENDARY TRAIT',
    tag: 'T4',
    color: 'var(--stamp)',
    perks: ['EVERYTHING ABOVE', 'GUARANTEED VARIANT PULL ON NEXT UNIVERSE', 'DISCOUNT RAISED TO 25%', '96H EARLY CLAIM'],
  },
];

/* ------------------------------ STORE (MOCK) ------------------------------ */

export interface Product {
  sku: string;
  name: string;
  kind: string;
  price: number;
  image: string;
  gated: boolean;
  note: string;
}

export const PRODUCTS: Product[] = [
  {
    sku: 'SKU-0141',
    name: '“THE PRIME REALITY” FINE ART PRINT',
    kind: 'A2 giclée · numbered & embossed',
    price: 85,
    image: art('u001.jpg'),
    gated: false,
    note: 'Each order includes a Proof-of-Purchase pull from the Nemoverse.',
  },
  {
    sku: 'SKU-0272',
    name: 'UNIVERSE HEAVYWEIGHT TEE',
    kind: 'Apparel · limited run',
    price: 45,
    image: art('u004.jpg'),
    gated: false,
    note: 'Every purchase mints a random Nemoverse pull.',
  },
  {
    sku: 'SKU-0399',
    name: 'NEON SHOGUNATE ENAMEL PIN',
    kind: 'Holder-exclusive SKU',
    price: 18,
    image: art('u002.jpg'),
    gated: true,
    note: 'Unlocks for holders of the OC NFT. Rare traits unlock early.',
  },
];

/* ----------------------------- X FEED (MOCK) ----------------------------- */

export interface Tweet {
  handle: string;
  name: string;
  initials: string;
  verified?: boolean;
  hue: [string, string];
  time: string;
  body: string;
  stats: { replies: number; reposts: number; likes: number };
  replyTo?: boolean;
  thread?: boolean;
}

export const TWEETS: Tweet[] = [
  {
    handle: '@NEMO_UNIVERSE',
    name: 'NEMO',
    initials: 'N',
    verified: true,
    hue: ['var(--pink)', 'var(--sky)'],
    time: '2h',
    body: 'a version of me you haven’t met is already in the archive. #007 does not knock. it arrives.',
    stats: { replies: 214, reposts: 1180, likes: 6210 },
  },
  {
    handle: '@NEMO_U002',
    name: 'NEMO — NEON SHOGUNATE',
    initials: 'N2',
    verified: true,
    hue: ['var(--sky)', 'var(--water)'],
    time: '2h',
    body: 'you think your timeline is loud. try sleeping in mine.',
    stats: { replies: 89, reposts: 540, likes: 2904 },
    replyTo: true,
    thread: true,
  },
  {
    handle: '@NEMO_UNIVERSE',
    name: 'NEMO',
    initials: 'N',
    verified: true,
    hue: ['var(--pink)', 'var(--sky)'],
    time: '2h',
    body: 'you’re literally me.',
    stats: { replies: 312, reposts: 1904, likes: 11200 },
    replyTo: true,
  },
  {
    handle: '@kaydravin',
    name: 'kaydravin.eth',
    initials: 'K',
    hue: ['#ffc857', '#ff9ad5'],
    time: '1d',
    body: 'just pulled UNIVERSE #004 from my merch order. the chrome chapel one. i’m never recovering.',
    stats: { replies: 41, reposts: 96, likes: 1302 },
  },
  {
    handle: '@sister_amara',
    name: 'Sister Amara',
    initials: 'SA',
    hue: ['var(--manila)', 'var(--pink)'],
    time: '3d',
    body: 'gilding NEMO took 214 hours. worth every second. #TheGildedEcho',
    stats: { replies: 67, reposts: 302, likes: 2108 },
  },
];

/* -------------------------- THE PERSONA (MOCK BRAIN) -------------------------- */

export interface ChatRule {
  match: RegExp;
  reply: string[];
}

export const PERSONA_GREETING =
  `you’ve reached NEMO — the wanderer between. i know all ${tallyLine}. ask me anything in canon.`;

export const CHAT_RULES: ChatRule[] = [
  {
    match: /(hello|hi|hey|yo|sup)\b/i,
    reply: ['you found me. most people never look past the first portal.'],
  },
  {
    match: /(universe|version)\s*#?\s*0*1\b|#\s*0*1\b/i,
    reply: ['U-001, THE PRIME REALITY — timeline zero. aya okafor painted it in oil and candlelight. it’s where every version of me begins.'],
  },
  {
    match: /(universe|version)\s*#?\s*0*2\b|#\s*0*2\b/i,
    reply: ['U-002, NEON SHOGUNATE. edo-2077. a masterless ronin under neon that never sleeps. kxm carved it like a woodblock and wired it like a server.'],
  },
  {
    match: /(universe|version)\s*#?\s*0*3\b|#\s*0*3\b/i,
    reply: ['U-003, HOLLOW HORIZON. a concrete sea that forgot its architects. mara volkov cut me out of torn paper — brutalism is honesty.'],
  },
  {
    match: /(universe|version)\s*#?\s*0*4\b|#\s*0*4\b/i,
    reply: ['U-004, CHROME CHAPEL. mirror city, where i’m reflected a thousand times and none of the reflections agree. divine machine polished every surface to worship.'],
  },
  {
    match: /(universe|version)\s*#?\s*0*5\b|#\s*0*5\b/i,
    reply: ['U-005, THE GILDED ECHO. the reliquary keeps me in gold leaf like a saint. sister amara spent 214 hours gilding. i owe her a timeline.'],
  },
  {
    match: /(universe|version)\s*#?\s*0*6\b|#\s*0*6\b/i,
    reply: ['U-006, SIGNAL GARDEN. antennas instead of flowers. null//form tuned the static until i answered.'],
  },
  {
    match: /(next|when|drop|007|seven|august|aug)\b/i,
    reply: ['UNIVERSE #007 — THE LAST AURORA — arrives AUG 22. holders walk through first, at a discount. everyone else waits at the door. i like it that way.'],
  },
  {
    match: /(who|artist|drew|made|painted|commissioned)\b/i,
    reply: [`${artistLine}, credited permanently on the hub and in each piece’s metadata. every brush writes a new law of physics for me.`],
  },
  {
    match: /(secret|hidden|locked|encrypted|009|008)/i,
    reply: ['there are universes even i haven’t visited yet. #008 is encrypted — signed, sealed, waiting. and #009… #009 was never commissioned. it just arrived.'],
  },
  {
    match: /(banter|yourself|other you|talk to yourself)/i,
    reply: [
      'fine. one moment.',
      '[ U-002 — NEON SHOGUNATE ]: “you think your timeline is loud. try sleeping in mine.”',
      'he’s me. i hate him. we’re fine.',
    ],
  },
  {
    match: /(price|cost|mint|buy|eth|edition)/i,
    reply: ['each universe mints as a limited run — 50 to 200 pieces. the artist gets their cut on every sale. that’s the only way a nemoverse stays honest.'],
  },
  {
    match: /(wallet|nft|holder|perk|discount|claim)/i,
    reply: ['connect your wallet on the hub. if you hold the genesis NFT, doors open early — legendary traits open them first. hold to unlock the next universe.'],
  },
  {
    match: /(who are you|what are you|your name|nemo)/i,
    reply: ['NEMO. one canon, infinite versions. every artist who draws me rewrites the universe around me.'],
  },
];

export const CHAT_FALLBACKS = [
  `the nemoverse has ${tallyLine}. ask me about #002, or about the drop on ${DROP_LABEL_LONG}.`,
  'i only speak in canon. ask me about a universe — any universe.',
  'somewhere, a version of you is asking a version of me a better question.',
];

export const QUICK_REPLIES = [
  'Tell me about #004',
  'When is the next drop?',
  'Who drew #005?',
  'Any secrets?',
  'Banter with yourself',
];

/* ------------------------------ PULL LOGIC ------------------------------ */

export const STAMP_SLOTS = 8;
export const SET_BONUS_AT = 6; // distinct universes needed for the "Golden Gate" set bonus

export function pullOdds(opts: { stamps: number; secretUnlocked: boolean; holderBonus: boolean }) {
  const pool: { tier: EditionTier; weight: number }[] = [];
  const pity = opts.stamps >= STAMP_SLOTS - 1; // 8th stamp → guaranteed rare+
  for (const r of Object.keys(TIERS) as EditionTier[]) {
    if (r === 'secret' && !opts.secretUnlocked) continue;
    let w = TIERS[r].weight;
    if (pity && (r === 'common')) w = 0;
    if (pity && r === 'rare') w = 60;
    if (r === 'rare' && opts.holderBonus) w *= 1.1;
    if (r === 'secret' && opts.holderBonus) w *= 1.25;
    if (r === 'legendary' && pity) w = 9;
    pool.push({ tier: r, weight: w });
  }
  return pool;
}

export function rollTier(pool: { tier: EditionTier; weight: number }[]): EditionTier {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.tier;
  }
  return 'common';
}

export function universeForPull(tier: EditionTier): Universe {
  const candidates = UNIVERSES.filter(
    (u) => u.tier === tier && u.status !== 'encrypted' && u.status !== 'upcoming',
  );
  if (candidates.length === 0) {
    return UNIVERSES.filter((u) => u.status === 'live' || u.status === 'sold-out')[0];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/* ------------------------------ STATS / LORE ------------------------------ */

export interface LoreStatDef {
  value: number;
  suffix: string;
  label: string;
  note: string;
  /** This tile renders the LIVE drop countdown as its number, so the Lore
      card, the hero ticker and the roster teaser can never quote different
      figures. Lore.tsx owns the hook; the flag only marks which tile. */
  clock?: boolean;
}

export const LORE_STATS: LoreStatDef[] = [
  { value: visibleUniverses.length, suffix: '', label: 'REGISTERED UNIVERSES', note: `${UNIVERSES.length - visibleUniverses.length} encrypted` },
  { value: ARTISTS.length, suffix: '', label: 'CANON ARTISTS', note: 'credited forever' },
  { value: UNIVERSES.reduce((s, u) => s + u.supply, 0), suffix: '', label: 'TOTAL SUPPLY', note: 'across all runs' },
  { value: 1214, suffix: '', label: 'HOLDERS', note: 'genesis NFT' },
  { value: 0, suffix: 'D', label: 'NEXT DROP', note: `U-007 · ${DROP_LABEL.toLowerCase()}`, clock: true },
];

export const LORE_TIMELINE = [
  { when: '2025 · Q4', title: 'THE FIRST COMMISSION', body: 'A single artist’s reinterpretation of the OC — the instinct that started everything. No system, no numbering, just one piece that felt different.' },
  { when: '2026 · JAN', title: 'THE IDEA OF A NEMOVERSE', body: 'The scattered commissions become a canon: every artist gets a universe, every universe gets a number, every number gets a drop date.' },
  { when: '2026 · FEB 14', title: 'U-001 — THE PRIME REALITY', body: 'The first numbered universe mints 200/200. The chase — and the revenue split with the artist — begins.' },
  { when: '2026 · MAY', title: 'U-005 GOES LEGENDARY', body: 'The Gilded Echo proves the chase mechanic: epic supply, instant secondary demand, and the first “pull bragging” posts on X.' },
  { when: '2026 · AUG 22', title: 'U-007 — THE LAST AURORA', body: 'First drop fully token-gated: holders claim 96 hours early, legendary traits get guaranteed variants. The loop is closed.' },
];
