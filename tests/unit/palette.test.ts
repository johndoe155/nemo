import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* ---------------------------------------------------------------------------
   IDENTITY-SPEC §10 — "a unit test asserting that lib/palette.ts and the
   emitted :root / [data-scene] custom properties agree — the regression that
   prevents a repeat of the five-sources-of-truth failure."

   Three claims, each one a bug this repo actually had:

   1. Every hex in global.css exists in the palette table. (Before the
      overhaul, four stylesheets and five files' worth of shader literals each
      carried their own neon palette; this is the tripwire.)
   2. The core tokens are DECLARED in global.css with the palette's values —
      not merely "somewhere in the file", which is how a token quietly stops
      being the source of truth.
   3. Every section id observeScenes() watches corresponds to a real zone in
      the palette table, and every zone has a tint pair — the class of drift
      that silently drops a section out of the dive.
--------------------------------------------------------------------------- */

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const paletteSrc = readFileSync(join(repo, 'src/lib/palette.ts'), 'utf8');
const cssSrc = readFileSync(join(repo, 'src/styles/global.css'), 'utf8');
const scenesSrc = readFileSync(join(repo, 'src/lib/scenes.ts'), 'utf8');

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function hexes(src: string): string[] {
  return (src.match(HEX) ?? []).map((h) => h.toLowerCase());
}

/** Pull `key: '#hex'` pairs out of a palette.ts object literal. */
function paletteEntries(block: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(?:'([a-z0-9-]+)'|([a-z][a-z0-9]*))\s*:\s*'(#[0-9a-fA-F]{3,8})'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.set(m[1] ?? m[2], m[3].toLowerCase());
  return out;
}

const PALETTE_BLOCK = paletteSrc.slice(
  paletteSrc.indexOf('export const PALETTE'),
  paletteSrc.indexOf('export type PaletteKey'),
);
const DERIVED_BLOCK = paletteSrc.slice(
  paletteSrc.indexOf('export const DERIVED'),
  paletteSrc.indexOf('/* -------', paletteSrc.indexOf('export const DERIVED')),
);

const palette = paletteEntries(PALETTE_BLOCK);
const derived = paletteEntries(DERIVED_BLOCK);
const allKnown = new Set([...palette.values(), ...derived.values()]);

test('palette.ts exposes the full core palette', () => {
  const required = [
    'paper',
    'paper-2',
    'manila',
    'ink',
    'pink',
    'mint',
    'sky',
    'water',
    'deep',
    'bio-cyan',
    'stamp',
  ];
  for (const key of required) {
    assert.ok(palette.has(key), `palette is missing "${key}"`);
    assert.match(palette.get(key)!, /^#[0-9a-f]{6}$/, `${key} must be a 6-digit hex`);
  }
  assert.ok(derived.size >= 10, 'derived ramp should carry the text/stock steps');
});

test('every hex in global.css is a palette value (single source of truth)', () => {
  /* #000 / #fff are stencil values inside mask-image gradients — they are not
     colours on the page, so they are exempt from the palette rule. */
  const STENCILS = new Set(['#000', '#fff', '#000000', '#ffffff']);
  const strays = [...new Set(hexes(cssSrc))].filter(
    (h) => !allKnown.has(h) && !STENCILS.has(h),
  );
  assert.deepEqual(
    strays,
    [],
    `global.css declares hexes that do not exist in src/lib/palette.ts: ${strays.join(', ')}`,
  );
});

test('core tokens are declared with the palette values, not merely nearby', () => {
  for (const [key, hex] of palette) {
    const re = new RegExp(`--${key}\\s*:\\s*${hex}\\s*;`, 'i');
    assert.ok(re.test(cssSrc), `global.css must declare --${key}: ${hex}`);
  }
});

test('every derived step used by the CSS is a palette value', () => {
  // The derived ramp is referenced through var() in the stylesheets; if a
  // consumer names a step the table does not define, the token silently falls
  // back to nothing.
  const used = new Set(
    (cssSrc.match(/var\(\s*--(?:pink|water|mint|sky|stamp|ink|paper|deep|bio)[a-z0-9-]*\s*\)/g) ??
      []).map((m) => m.replace(/var\(\s*--/, '').replace(/\s*\)$/, '')),
  );
  const core = new Set([
    ...palette.keys(),
    ...derived.keys(),
    // structural tokens declared in the same :root block
    'ink-dim',
    'ink-faint',
    'ink-faint-decor',
    'ink-faint', // legacy decor alias kept for non-text paint
    'paper-ink',
    'paper-ink-dim',
    'paper-ink-faint',
    'paper-ink-decor',
    'panel-dark',
    'line-dark',
    'line-strong-dark',
    'shadow-print-1',
    'shadow-print-2',
    'shadow-print-3',
    'shadow-print-4',
    'deep-2',
    'deep-3',
    'mid-ground',
  ]);
  const missing = [...used].filter((t) => !core.has(t));
  assert.deepEqual(missing, [], `CSS references undefined palette steps: ${missing.join(', ')}`);
});

test('the dive is complete: every observed section maps to a real zone', () => {
  const zoneBlock = paletteSrc.slice(paletteSrc.indexOf('export const ZONES'));
  const zones = new Set([...zoneBlock.matchAll(/^  ([a-z]+):\s*\{/gm)].map((m) => m[1]));
  assert.deepEqual([...zones].sort(), ['midwater', 'reef', 'surface', 'trench']);

  const sectionBlock = paletteSrc.slice(
    paletteSrc.indexOf('export const SECTION_ZONE'),
    paletteSrc.indexOf('/* ------', paletteSrc.indexOf('export const SECTION_ZONE')),
  );
  const entries = [...sectionBlock.matchAll(/([a-z-]+):\s*'([a-z]+)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(entries.length >= 8, 'SECTION_ZONE should map every live section id');
  for (const [id, zone] of entries) {
    assert.ok(zones.has(zone), `section "${id}" maps to unknown zone "${zone}"`);
  }

  // scenes.ts must remain a thin mapping — no colour values of its own.
  const sceneHexes = [...new Set(hexes(scenesSrc))].filter((h) => !allKnown.has(h));
  assert.deepEqual(
    sceneHexes,
    [],
    `scenes.ts must not carry colours the palette does not own: ${sceneHexes.join(', ')}`,
  );

  // every zone needs a tint pair for the CSS-shell drift
  for (const zone of zones) {
    assert.match(
      scenesSrc,
      new RegExp(`${zone}:\\s*\\{\\s*bg:`),
      `SCENE_TINTS is missing a tint for zone "${zone}"`,
    );
  }
});
