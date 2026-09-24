#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   budget — the measurement half of DESIGN_AUDIT P5.19, made permanent.

   "Measure first" as a one-shot Lighthouse run is advice that dies; this is
   the same question asked at every build: what does the FIRST load actually
   pay? It parses dist/index.html's module graph seeds (the entry script +
   every modulepreload), gzips those exact assets, and fails if the initial
   graph re-includes something that must stay lazy — above all html2canvas
   (via lib/captureSignoff), which may only ever be pulled by the Sign-off's
   proximity-armed dynamic import.

   Lighthouse/WebPageTest themselves need a real device lab; numbers from a
   sandbox would be theater. What IS reproducible here is the payload graph,
   so that is what gets gated. Run after `npm run build`.
--------------------------------------------------------------------------- */
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');

/* the entry module and everything it tells the browser to preload eagerly */
const eager = new Set();
for (const m of html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\brel="modulepreload"[^>]*\bhref)="([^"]+)"/g)) {
  eager.add(m[1].replace(/^\.?\//, ''));
}
if (eager.size === 0) {
  console.error('budget: found no eager script/preload tags in dist/index.html — wrong build?');
  process.exit(1);
}

const rows = [];
let totalGz = 0;
for (const asset of [...eager].sort()) {
  const file = path.join(dist, asset);
  const buf = readFileSync(file);
  const gz = gzipSync(buf).length;
  totalGz += gz;
  rows.push([asset, `${(statSync(file).size / 1024).toFixed(1)} kB`, `${(gz / 1024).toFixed(1)} kB`]);
}
/* The non-negotiable gate: these must never be in the eager graph. Since the
   phase-6 port (raw WebGL particle field, `three` deleted) the eager set is
   just framework + animation + entry + one stylesheet — no 3D runtime is
   statically reachable from anything any more. Adding ANOTHER eager island,
   or re-merging these under a new name, gets caught below by the ratchet. */
const LAZY = ['captureSignoff', 'html2canvas'];
const leaked = LAZY.filter((name) => [...eager].some((asset) => asset.includes(name)));

const cssMatch = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/);
let cssGz = 0;
if (cssMatch) {
  const cssFile = path.join(dist, cssMatch[1].replace(/^\.?\//, ''));
  cssGz = gzipSync(readFileSync(cssFile)).length;
  rows.push([cssMatch[1].replace(/^\.?\//, ''), `${(statSync(cssFile).size / 1024).toFixed(1)} kB`, `${(cssGz / 1024).toFixed(1)} kB`]);
}

const table = { 'asset': 0, 'raw': 0, 'gzip': 0 };
for (const r of rows) table.asset = Math.max(table.asset, r[0].length), table.raw = Math.max(table.raw, r[1].length), table.gzip = Math.max(table.gzip, r[2].length);
console.log('budget · initial-load graph (dist/index.html eager set)');
for (const [a, raw, gz] of rows) console.log(`  ${a.padEnd(table.asset)}  ${raw.padStart(table.raw)}  ${gz.padStart(table.gzip)}`);
console.log(`  ${'TOTAL JS (eager)'.padEnd(table.asset)}  ${'—'.padStart(table.raw)}  ${(totalGz / 1024).toFixed(1)} kB`);
console.log(`  lazy islands kept lazy: ${LAZY.filter((l) => !leaked.includes(l)).join(', ') || '—'}`);

/* Ratchet, not a wish — every time the number drops, the ratchet follows.
   2026-09-15: 643 kB gz (framework 45 + animation 53 + entry 175 + two three
   builds). After the phase-6 three deletion the graph measures 248.7 kB gz
   (framework 44.9 + animation 53.3 + entry 150.4), which finally clears the
   §6 target of < 250 kB gz eager. Budget = measured + 3.7% headroom: real
   movement must be *measured* and this constant lowered with it, and an
   unexplained +10 kB cannot silently become the new baseline. */
const BUDGET_JS_KB = 258;
if (totalGz > BUDGET_JS_KB * 1024) {
  console.error(`budget: eager JS ${(totalGz / 1024).toFixed(1)} kB gz exceeds ${BUDGET_JS_KB} kB — the ratchet moved without a measurement note in DESIGN_AUDIT.`);
  process.exit(1);
}
if (leaked.length) {
  console.error(`budget: LAZY ISLANDS IN THE EAGER GRAPH: ${leaked.join(', ')}`);
  console.error('  captureSignoff/html2canvas may only arrive via the Sign-off arm() dynamic import (audit 5.19).');
  process.exit(1);
}
console.log('budget: ok');
