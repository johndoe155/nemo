/**
 * verify-nemo-loader.mjs — replays the launch loader's morph through the real
 * MorphSVGPlugin, in Node, with no browser.
 *
 *   node scripts/verify-nemo-loader.mjs
 *   node scripts/verify-nemo-loader.mjs --dump /tmp/nemo-morph.json
 *
 * MorphSVG is the one part of the loader that cannot be unit-tested in the
 * abstract: before it animates anything it *normalises* both sides of the
 * tween, and that normalisation is allowed to reorder subpaths (it sorts by
 * segment count), rotate closed shapes onto their closest anchor, and fabricate
 * segments where the two sides disagree.  Any of those would silently break the
 * loader's hand-built pairing — piece i would grow out of piece j, and the
 * character would assemble out of the wrong fragments.
 *
 * So this script hands the generated pair to the plugin's own `normalizeStrings`
 * (the function the tween runs) with the options the loader passes —
 * shapeIndex: 0, map: 'complexity' — and asserts:
 *
 *   1 · PIECES       both sides survive with the same subpath count.
 *   2 · ORDER        subpath i of the normalised side still begins where
 *                    subpath i of the input began (numerals and character):
 *                    the plugin reordered nothing.
 *   3 · FABRICATION  no anchor left its own piece of ink: the intervals
 *                    MorphSVG fabricated are all subdivisions, not borrowings
 *                    from a neighbouring shape.
 *   4 · EQUALITY     after normalisation both sides carry the same coordinate
 *                    count per subpath, so the tween interpolates anchor for
 *                    anchor.
 *   5 · LANDING      the end of the tween is byte-for-byte the character path
 *                    the loader hands over at ratio 1.
 *
 * esbuild (which ships with Vite) bundles the plugin for Node — gsap's ESM
 * entry cannot be require()d.  Exits non-zero on any failure, so it is safe to
 * wire into CI.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(ROOT, 'node_modules/gsap/MorphSVGPlugin.js');
const DATA = join(ROOT, 'src/lib/nemoLoaderData.ts');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

const dumpIndex = process.argv.indexOf('--dump');
const dumpPath = dumpIndex > -1 ? process.argv[dumpIndex + 1] : null;

let failures = 0;
const ok = (name, detail = '') => console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
const bad = (name, detail = '') => {
  failures++;
  console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nNEMO LOADER — morph pairing through MorphSVGPlugin\n');

const work = mkdtempSync(join(tmpdir(), 'nemo-loader-verify-'));
const probe = join(work, 'probe.mjs');
const bundle = join(work, 'probe.bundle.mjs');

writeFileSync(
  probe,
  `import MorphSVGPlugin from ${JSON.stringify(PLUGIN)};
import { DIGIT_MORPH_D, CHAR_MORPH_D, MORPH_PAIRING } from ${JSON.stringify(DATA)};

const { stringToRawPath, rawPathToString, normalizeStrings } = MorphSVGPlugin;
const round = (n) => Math.round(n * 1000) / 1000;

/* The loader's own call.  shapeIndex must be an ARRAY of zeros, not the number
   0: gsap only reads shapeIndices[i] and falls back to "auto" for every subpath
   the array does not cover — with a scalar 0, subpath 1 onward gets rotational
   matching and the pairing's start anchors get moved onto other anchors of the
   same contour.  An array of zeros keeps every anchor exactly where it was
   authored.  map 'complexity' keeps the sort cheap and skips the size-based
   segment splicing entirely. */
const NO_ROTATION = new Array(MORPH_PAIRING.pieces).fill(0);
const [start, end] = normalizeStrings(DIGIT_MORPH_D, CHAR_MORPH_D, {
  shapeIndex: NO_ROTATION,
  map: 'complexity',
});

const inputStart = stringToRawPath(DIGIT_MORPH_D);
const inputEnd = stringToRawPath(CHAR_MORPH_D);
const normStart = stringToRawPath(start);
const normEnd = stringToRawPath(end);

/** Distance from a point to a cubic, refined — anchors added by subdivision
    must land *on* the original curve, and the original curve is not its own
    anchor polygon. */
const at = (cubic, t) => {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  return [
    a * cubic[0] + b * cubic[2] + d * cubic[4] + e * cubic[6],
    a * cubic[1] + b * cubic[3] + d * cubic[5] + e * cubic[7],
  ];
};

const distToCubic = (cubic, p) => {
  const N = 40;
  let bestT = 0;
  let best = Infinity;
  for (let k = 0; k <= N; k++) {
    const q = at(cubic, k / N);
    const d = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
    if (d < best) {
      best = d;
      bestT = k / N;
    }
  }
  let lo = Math.max(0, bestT - 1 / N);
  let hi = Math.min(1, bestT + 1 / N);
  for (let i = 0; i < 40; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    const qa = at(cubic, a);
    const qb = at(cubic, b);
    const da = (p[0] - qa[0]) * (p[0] - qa[0]) + (p[1] - qa[1]) * (p[1] - qa[1]);
    const db = (p[0] - qb[0]) * (p[0] - qb[0]) + (p[1] - qb[1]) * (p[1] - qb[1]);
    if (da < db) hi = b;
    else lo = a;
  }
  const q = at(cubic, (lo + hi) / 2);
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
};

/** How far any normalised anchor sits from the ink of the subpath it came from. */
const maxStray = (input, norm) => {
  let worst = 0;
  for (let i = 0; i < Math.min(input.length, norm.length); i++) {
    const cubics = [];
    let p0 = [input[i][0], input[i][1]];
    for (let k = 0; k + 7 < input[i].length; k += 6) {
      cubics.push([
        p0[0],
        p0[1],
        input[i][k + 2],
        input[i][k + 3],
        input[i][k + 4],
        input[i][k + 5],
        input[i][k + 6],
        input[i][k + 7],
      ]);
      p0 = [input[i][k + 6], input[i][k + 7]];
    }
    // Anchors only (every 6th number): MorphSVG also interpolates control
    // points, and those are not supposed to sit on the curve.
    for (let k = 0; k < norm[i].length; k += 6) {
      const p = [norm[i][k], norm[i][k + 1]];
      let best = Infinity;
      for (const cubic of cubics) {
        const d = distToCubic(cubic, p);
        if (d < best) best = d;
      }
      if (best > worst) worst = best;
    }
  }
  return worst;
};

const sameAnchor = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
const orderOk = (input, norm) =>
  input.length === norm.length && input.every((s, i) => sameAnchor([s[0], s[1]], [norm[i][0], norm[i][1]]));

const report = {
  pieces: MORPH_PAIRING.pieces,
  inputPieces: [inputStart.length, inputEnd.length],
  normPieces: [normStart.length, normEnd.length],
  startOrderOk: orderOk(inputStart, normStart),
  endOrderOk: orderOk(inputEnd, normEnd),
  strayStart: maxStray(inputStart, normStart),
  strayEnd: maxStray(inputEnd, normEnd),
  segmentParity: normStart.every((seg, i) => seg.length === normEnd[i].length),
  firstCoords: [normStart[0].length, normEnd[0].length],
  landingExact: rawPathToString(normEnd) === rawPathToString(stringToRawPath(CHAR_MORPH_D)),
  departure: normStart.slice(0, 3).map((s) => [round(s[0]), round(s[1])]),
  arrival: normEnd.slice(0, 3).map((s) => [round(s[0]), round(s[1])]),
};

${
  dumpPath
    ? `{
  const fs = await import('node:fs');
  fs.writeFileSync(${JSON.stringify(dumpPath)}, JSON.stringify({
    pieces: MORPH_PAIRING.pieces,
    start: normStart,
    end: normEnd,
  }));
}`
    : '/* pass --dump <file> to write the equalised arrays for the renderer */'
}

console.log('__REPORT__' + JSON.stringify(report));
`,
);

execFileSync(ESBUILD, [probe, '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`], {
  stdio: ['ignore', 'ignore', 'pipe'],
});

const stdout = execFileSync('node', [bundle], { encoding: 'utf8', maxBuffer: 1 << 28 });
const line = stdout.split('\n').find((l) => l.startsWith('__REPORT__'));
if (!line) {
  console.error(stdout);
  bad('probe produced no report');
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}
const r = JSON.parse(line.slice('__REPORT__'.length));

/* ------------------------------------------------------------------ checks */

if ([r.pieces, r.pieces].every((n, i) => r.inputPieces[i] === n && r.normPieces[i] === n)) {
  ok('PIECES', `${r.pieces} subpaths on both sides, before and after normalisation`);
} else {
  bad(
    'PIECES',
    `input ${r.inputPieces.join('/')}, normalised ${r.normPieces.join('/')}, expected ${r.pieces}`,
  );
}

if (r.startOrderOk) ok('ORDER · numerals', 'normalised subpath i still starts at input subpath i');
else bad('ORDER · numerals', 'MorphSVG reordered the digit pieces');

if (r.endOrderOk) ok('ORDER · character', 'normalised subpath i still starts at input subpath i');
else bad('ORDER · character', 'MorphSVG reordered the character pieces');

const STRAY_TOL = 0.05; // viewBox units — subdivision rounding only
if (r.strayStart <= STRAY_TOL && r.strayEnd <= STRAY_TOL) {
  ok(
    'FABRICATION',
    `every anchor stayed on its own ink (numerals ${r.strayStart.toFixed(4)}u, character ${r.strayEnd.toFixed(
      4,
    )}u)`,
  );
} else {
  bad('FABRICATION', `anchors strayed ${r.strayStart.toFixed(3)}u / ${r.strayEnd.toFixed(3)}u`);
}

if (r.segmentParity) {
  ok('EQUALITY', `both sides carry ${r.firstCoords[0]} / ${r.firstCoords[1]} coordinates per piece`);
} else {
  bad('EQUALITY', 'segment counts disagree after normalisation — the tween would distort');
}

if (r.landingExact) ok('LANDING', 'the tween lands on exactly the character path it is handed');
else bad('LANDING', 'the normalised end shape differs from CHAR_MORPH_D');

console.log(
  `\n  morph: ${r.pieces} pieces · departures ${JSON.stringify(r.departure)} → arrivals ${JSON.stringify(
    r.arrival,
  )}`,
);
console.log(`  dump:  ${dumpPath ?? '(none — pass --dump <file> for the filmstrip renderer)'}\n`);

rmSync(work, { recursive: true, force: true });

console.log(failures === 0 ? 'LOADER MORPH VERIFIED\n' : `${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
