/**
 * subset-fonts.mjs — GENERATOR for src/assets/fonts/pp-fonts.css
 *
 * P0.1 of DESIGN_AUDIT: the webfont layer used to ship 25 @font-face files
 * (both Machina cuts × 3 weights × 2 styles, Montreal × 5 weights × 2 styles,
 * Text × 2). A full inventory of `font-weight` / `font-style` declarations
 * across src/styles proved that only nine faces are reachable:
 *
 *   Machina Inktrap  · regular + ultrabold, normal only (hero, display H2s,
 *                      numerals, ghost text; the only two `em` sites in the
 *                      display context are explicitly `font-style: normal`)
 *   Machina Plain    · regular + ultrabold, normal only (nav, H3/badges — a
 *                      700 request resolves to the 400 face under CSS weight
 *                      matching, same as before this pass; the 300 light face
 *                      was never requestable, no rule asks for it)
 *   Montreal         · regular + semibold + extrabold, regular also in italic
 *                      (the three `.quote` rules); light/hairline have zero
 *                      weight-300/100 references, italics of the heavier cuts
 *                      are synthesized if ever requested
 *   Montreal Text    · book, normal only (dense reading — italic is not used)
 *
 * Each kept face is subset to the codepoints this site actually paints with
 * (Latin + Latin-1 + general punctuation + arrows + geometric shapes + dingbats
 * — covers · — ↑ ↓ ▼ ✕ ✓), and the `ss01`–`ss03` alternates are pulled in so
 * `.hero__title { font-feature-settings: 'ss01','ss02','ss03' }` keeps
 * resolving instead of silently falling back to default forms.
 *
 * WOFF2 encoding is fontkit's own (no native toolchain). A face is only
 * replaced by its subset when that subset is meaningfully smaller (< 85% of
 * the original file); otherwise the original woff2 is referenced as-is.
 * The originals always stay on disk: scripts/generate-nemo-loader.mjs reads
 * the Ultrabold outline from there, so this script never deletes anything.
 *
 * The CSS below is GENERATED — edit the spec table in this file and re-run:
 *   node scripts/subset-fonts.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');
const subsetFont = require('subset-font');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'src/assets/fonts');
const OUT_CSS = path.join(FONTS, 'pp-fonts.css');
const SUBSET_DIR = path.join(FONTS, 'subset');

/** The nine faces that survive the usage audit. `file` = source woff2 (kept),
 *  `face` = the emitted subset name. */
const FACES = [
  { dir: 'pp-neue-machina', file: 'pp-neue-machina-inktrap-regular-normal', family: 'PP Neue Machina Inktrap', weight: '400', style: 'normal' },
  { dir: 'pp-neue-machina', file: 'pp-neue-machina-inktrap-ultrabold-normal', family: 'PP Neue Machina Inktrap', weight: '800', style: 'normal' },
  { dir: 'pp-neue-machina', file: 'pp-neue-machina-plain-regular-normal', family: 'PP Neue Machina Plain', weight: '400', style: 'normal' },
  { dir: 'pp-neue-machina', file: 'pp-neue-machina-plain-ultrabold-normal', family: 'PP Neue Machina Plain', weight: '800', style: 'normal' },
  { dir: 'pp-neue-montreal', file: 'pp-neue-montreal-regular-normal', family: 'PP Neue Montreal', weight: '400', style: 'normal' },
  { dir: 'pp-neue-montreal', file: 'pp-neue-montreal-regular-italic', family: 'PP Neue Montreal', weight: '400', style: 'italic' },
  { dir: 'pp-neue-montreal', file: 'pp-neue-montreal-semibold-normal', family: 'PP Neue Montreal', weight: '600', style: 'normal' },
  { dir: 'pp-neue-montreal', file: 'pp-neue-montreal-extrabold-normal', family: 'PP Neue Montreal', weight: '800', style: 'normal' },
  { dir: 'pp-neue-montreal', file: 'pp-neue-montreal-text-book-normal', family: 'PP Neue Montreal Text', weight: '400', style: 'normal' },
];

/** Codepoints the page paints with. Deliberately wider than "Latin" so the
 *  arrow glyphs (↑ ↓ in hints/rewind), the ▼ scroll cue, the ✕ dialog close,
 *  the · separator and the — em dash never trigger a fallback swap. */
const RANGES = [
  [0x20, 0x7e], // basic latin
  [0xa0, 0xff], // latin-1 supplement (·, °, ±, é…)
  [0x2000, 0x206f], // general punctuation (— “ ” ‘ ’ …)
  [0x20ac, 0x20ac], // €
  [0x2122, 0x2122], // ™
  [0x2190, 0x21ff], // arrows (↑ ↓)
  [0x2212, 0x2212], // − minus
  [0x25a0, 0x25ff], // geometric shapes (▼ ▲)
  [0x2700, 0x27bf], // dingbats (✕ ✓)
];

const FEATURES = ['ss01', 'ss02', 'ss03'];

function codepoints() {
  const set = new Set();
  for (const [lo, hi] of RANGES) for (let c = lo; c <= hi; c++) set.add(c);
  return set;
}

/** The subset payload: every codepoint in the ranges above, as a string. */
function subsetChars() {
  const cps = codepoints();
  return [...cps].map((c) => String.fromCodePoint(c)).join('');
}

const main = async () => {
  const chars = codepoints();
  if (!existsSync(SUBSET_DIR)) mkdirSync(SUBSET_DIR);

  const lines = [];
  const total = { before: 0, after: 0 };

  lines.push(
    [
      '/**',
      ' * PP NEUE MACHINA / PP NEUE MONTREAL — GENERATED @font-face layer.',
      ' * Source of truth: scripts/subset-fonts.mjs (run: npm run generate:fonts).',
      ' *',
      ' * Nine faces only — every removed cut was unreachable by any',
      ' * font-weight / font-style declaration in src/styles (audited',
      ' * 2026-09). Each face is subset to the codepoints this site actually',
      ' * paints with; the originals stay on disk for the loader-outline',
      ' * generator. unicode-range mirrors the subset ranges so browsers',
      ' * never even request a face for out-of-range text.',
      ' *',
      ' * NOTE ON PRELOADING: assets referenced from src CSS are content-',
      ' * hashed at build, so a static <link rel="preload"> in index.html',
      ' * cannot survive `base: "./"` deployments. The critical faces are',
      ' * instead awaited inside the boot sequence itself (lib/fonts.ts →',
      ' * components/Loader.tsx), which gates the loader handoff until they',
      ' * are ready — strictly stronger than a preload, since it removes',
      ' * the swap, not just the request latency.',
      ' */',
      '',
      '/* Raw family tokens (see styles/global.css for the semantic mapping).',
      '   Declared before the faces so every url() below resolves the vars. */',
      ':root {',
      "  --font-pp-machina-inktrap: 'PP Neue Machina Inktrap', ui-sans-serif, system-ui, sans-serif;",
      "  --font-pp-machina-plain: 'PP Neue Machina Plain', ui-sans-serif, system-ui, sans-serif;",
      "  --font-pp-montreal: 'PP Neue Montreal', ui-sans-serif, system-ui, sans-serif;",
      "  --font-pp-montreal-text: 'PP Neue Montreal Text', 'PP Neue Montreal', ui-sans-serif, system-ui, sans-serif;",
      '}',
      '',
    ].join('\n'),
  );

  const URANGE =
    'U+0020-007E, U+00A0-00FF, U+2000-206F, U+20AC, U+2122, U+2190-21FF, U+2212, U+25A0-25FF, U+2700-27BF';

  const CHARS = subsetChars();

  for (const face of FACES) {
    const srcPath = path.join(FONTS, face.dir, `${face.file}.woff2`);
    const srcBuf = readFileSync(srcPath);
    const out = await subsetFont(srcBuf, CHARS, { targetFormat: 'woff2' });

    // Round-trip check: the subset must be a valid font AND keep the glyphs
    // the site cannot render without (A, the ▼ cue, the ✕ close, the — dash).
    const verify = fontkit.create(Buffer.from(out));
    for (const probe of ['A', '▼', '✕', '—']) {
      if (!verify.glyphForCodePoint(probe.codePointAt(0))) {
        throw new Error(`${face.file}: probe glyph ${probe} missing from subset`);
      }
    }

    let useSubset = out.length < srcBuf.length * 0.85;
    if (useSubset) {
      writeFileSync(path.join(SUBSET_DIR, `${face.file}.woff2`), out);
    }

    const rel = useSubset ? `./subset/${face.file}.woff2` : `./${face.dir}/${face.file}.woff2`;
    const bytes = useSubset ? out.length : srcBuf.length;
    total.before += srcBuf.length;
    total.after += bytes;

    lines.push(
      [
        `/* ${face.family} — ${face.weight}/${face.style} — ${Math.round(bytes / 1024)}kB${useSubset ? '' : ' (subset not smaller; original shipped)'} */`,
        '@font-face {',
        `  font-family: '${face.family}';`,
        `  src: url('${rel}') format('woff2');`,
        `  font-weight: ${face.weight};`,
        `  font-style: ${face.style};`,
        '  font-display: swap;',
        `  unicode-range: ${URANGE};`,
        '}',
        '',
      ].join('\n'),
    );

    console.log(
      `${useSubset ? 'subset' : 'orig  '}  ${face.file}  ${(srcBuf.length / 1024).toFixed(1)}kB -> ${(bytes / 1024).toFixed(1)}kB (${verify.numGlyphs} glyphs)`,
    );
  }

  writeFileSync(OUT_CSS, lines.join('\n'));
  console.log(
    `\npp-fonts.css written: ${FACES.length} faces, ${(total.before / 1024).toFixed(0)}kB -> ${(total.after / 1024).toFixed(0)}kB on disk (was ~1.9MB / 25 faces).`,
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
