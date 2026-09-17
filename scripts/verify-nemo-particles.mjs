/**
 * verify-nemo-particles.mjs — re-checkable invariants for the hero particle
 * field integration.
 *
 *   node scripts/verify-nemo-particles.mjs
 *
 * No dependencies, no browser, no GPU. The engine in src/three/nemo-particles/
 * is a port of the inline <script> of nemo-webgl.html (nemosite.zip), and a
 * port can rot in two directions: someone "tidies" a physics constant, or
 * someone edits the shader and quietly re-breaks the GPU/CPU agreement that the
 * formation-loss bug was all about. Neither would fail the build. So:
 *
 *   1 · POSE DATA   public/nemo-particles/pose0-3.json are byte-identical to
 *                   the zip's data/. They are the shapes; nothing may edit them.
 *   2 · SHADERS     8 of the 9 shader sources are still character-identical to
 *                   the donor. VS_PARTICLE is the documented exception (the
 *                   uToIndex fix) and is checked positively: it must select the
 *                   two morph endpoints independently and must NOT contain the
 *                   donor's hard-wired pose[i] -> pose[(i+1)%4] pairing.
 *   3 · CONSTANTS   every numeric tuning constant in the donor script exists in
 *                   the port with the same value.
 *   4 · FUNCTIONS   every function the donor declares still exists.
 *   5 · INVARIANT   the engine is then actually run headlessly (stub GL, real
 *                   pose JSONs, virtual clock) through a hostile session —
 *                   random clicks, arrow keys, tab-hide gaps, pause/resume —
 *                   and EVERY frame must send the GPU the same (from, to) pair
 *                   the CPU springs are targeting. That is the formation-loss
 *                   bug, asserted absent rather than merely described.
 *
 * Exits non-zero on any failure, so it is safe to wire into CI.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNemoParticleField } from '../src/three/nemo-particles/nemo-particles.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = join(ROOT, 'nemosite.zip');
const ZIP_MEMBER = 'nemosite';
const ENGINE = join(ROOT, 'src/three/nemo-particles/nemo-particles.js');
const POSE_OUT = join(ROOT, 'public/nemo-particles');

const POSE_SHA = {
  'pose0.json': '64bd0f0cde8528baaba816f892a249c6543020bad88227d27cd93a6dc757f9a9',
  'pose1.json': 'fc1cedbb1d0b051d96863faa1514bdfd2c48294c36f21a933359654c4849df78',
  'pose2.json': '34c909095609bf05314a6b706b7257beb5d5be73e33d6a2c208f4626b9f78e96',
  'pose3.json': '0f10f6faa2500acc1ee477988f58f318892d2fbc31cec38f02b02a2f6a770c5a',
};

let failures = 0;
const ok = (label, detail = '') => console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
const bad = (label, detail) => {
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
};

/* ------------------------------------------------------------------ zip ---- */
if (!existsSync(ZIP)) {
  console.error(`nemosite.zip is missing from the repo root (${ZIP}); cannot verify provenance.`);
  process.exit(1);
}
const TMP = '/tmp/verify-nemo-particles';
execFileSync('rm', ['-rf', TMP]);
execFileSync('mkdir', ['-p', TMP]);
execFileSync('unzip', ['-o', '-q', ZIP, '-d', TMP]);
const donorHtml = readFileSync(join(TMP, ZIP_MEMBER, 'nemo-webgl.html'), 'utf8');
const donorScript = donorHtml.split('<script>')[1].split('</script>')[0];
const port = readFileSync(ENGINE, 'utf8');

console.log('\n1 · pose data verbatim');
for (const [name, want] of Object.entries(POSE_SHA)) {
  const buf = readFileSync(join(POSE_OUT, name));
  const got = createHash('sha256').update(buf).digest('hex');
  const donorBuf = readFileSync(join(TMP, ZIP_MEMBER, 'data', name));
  if (got !== want) bad(name, `sha256 ${got} != recorded ${want}`);
  else if (!buf.equals(donorBuf)) bad(name, 'differs from the zip copy');
  else ok(name, `${buf.length} bytes, byte-identical to ${ZIP_MEMBER}/data/`);
}

/* --------------------------------------------------------------- shaders --- */
const SHADERS = [
  'VS_PARTICLE', 'FS_POINT', 'FS_LINE', 'VS_STAR', 'FS_STAR',
  'VS_QUAD', 'FS_BRIGHT', 'FS_BLUR', 'FS_COMPOSITE',
];
const shaderOf = (src, name) => {
  const m = src.match(new RegExp(`var ${name} = \\[([\\s\\S]*?)\\]\\.join`));
  if (!m) return null;
  return m[1].match(/'((?:[^'\\]|\\.)*)'/g).map((s) => s.slice(1, -1)).join('\n');
};

console.log('\n2 · shader sources');
for (const name of SHADERS) {
  const a = shaderOf(donorScript, name);
  const b = shaderOf(port, name);
  if (a === null || b === null) {
    bad(name, 'not found in one of the two files');
  } else if (name !== 'VS_PARTICLE') {
    a === b ? ok(name, 'character-identical') : bad(name, 'differs from the donor');
  } else if (a === b) {
    bad(name, 'still the donor version — the formation-loss fix is missing');
  } else {
    const hasTo = /uniform int uToIndex;/.test(b) && /if\(uToIndex==0\)\{ pTo=aPoseAB\.xy; cTo=aColA; \}/.test(b);
    const noOldPairing = !/pFrom=aPoseAB\.xy; pTo=aPoseAB\.zw/.test(b);
    if (!hasTo) bad(name, 'uToIndex endpoint selection missing');
    else if (!noOldPairing) bad(name, "still contains the hard-wired pose[i] -> pose[(i+1)%4] pairing");
    else ok(name, 'differs only by the documented uToIndex fix');
  }
}

/* ------------------------------------------------------------- constants --- */
const constantsOf = (src) => {
  const out = new Map();
  for (const m of src.matchAll(/([A-Z][A-Z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)/g)) {
    if (!out.has(m[1])) out.set(m[1], m[2]);
  }
  return out;
};

console.log('\n3 · tuning constants');
const donorConst = constantsOf(donorScript);
const portConst = constantsOf(port);
let constChecked = 0;
for (const [name, value] of donorConst) {
  if (!portConst.has(name)) bad(name, `missing from the port (donor: ${value})`);
  else if (portConst.get(name) !== value) bad(name, `${portConst.get(name)} != donor ${value}`);
  else constChecked++;
}
ok(`${constChecked} constants`, 'same values as the donor');

/* ------------------------------------------------------------- functions --- */
console.log('\n4 · function parity');
const funcsOf = (src) => new Set([...src.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]));
const donorFns = funcsOf(donorScript);
const portFns = funcsOf(port);
let missing = 0;
for (const fn of donorFns) {
  if (!portFns.has(fn)) {
    missing++;
    bad(fn, 'declared by the donor but missing from the port');
  }
}
if (!missing) ok(`${donorFns.size} functions`, 'every donor function is still present');

/* --------------------------------------------------- 5 · the invariant ----- */
console.log('\n5 · GPU/CPU pair invariant under a hostile session');

function makeGL(sink) {
  const impl = {
    createShader: () => ({}), getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), getProgramParameter: () => true, getProgramInfoLog: () => '',
    getUniformLocation: (_p, n) => ({ u: n }), getAttribLocation: () => 0,
    createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}),
    getExtension: () => ({ loseContext() {} }),
  };
  return new Proxy(impl, {
    get(t, p) {
      if (p in t) return t[p];
      if (typeof p === 'string' && /^[A-Z0-9_]+$/.test(p)) return 1;
      return (...a) => {
        if (p === 'uniform1i') sink.set(a[0].u, a[1]);
        return undefined;
      };
    },
  });
}

function runInvariantCheck() {
  let now = 1000;
  let frame = null;
  let frameId = 0;
  const winL = new Map();
  const hostL = new Map();
  const add = (map) => (t, fn) => {
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(fn);
  };
  const uniforms = new Map();
  const win = {
    devicePixelRatio: 2,
    performance: { now: () => now },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (cb) => { frame = cb; return ++frameId; },
    cancelAnimationFrame: (i) => { if (i === frameId) frame = null; },
    addEventListener: add(winL),
    removeEventListener: (t, fn) => {
      const l = winL.get(t);
      const i = l ? l.indexOf(fn) : -1;
      if (i >= 0) l.splice(i, 1);
    },
  };
  const host = {
    addEventListener: add(hostL),
    removeEventListener: (t, fn) => {
      const l = hostL.get(t);
      const i = l ? l.indexOf(fn) : -1;
      if (i >= 0) l.splice(i, 1);
    },
  };
  const canvas = {
    width: 1, height: 1,
    ownerDocument: { defaultView: win },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 900 }),
    getContext: () => makeGL(uniforms),
  };

  const field = createNemoParticleField(canvas, {
    baseUrl: '/nemo-particles',
    host,
    fetchImpl: (url) => Promise.resolve({
      ok: true, status: 200,
      json: async () => JSON.parse(readFileSync(join(POSE_OUT, url.split('/').pop()), 'utf8')),
    }),
  });
  field.resize(1280, 900);

  /* Deterministic PRNG so a failure is reproducible. */
  let seed = 0x2f6e2b1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let frames = 0;
  let brokenFrames = 0;
  let twoStepFrames = 0;
  let worstExample = null;

  const stepFrame = (dt) => {
    now += dt;
    const cb = frame;
    frame = null;
    uniforms.clear(); // only uniforms set during THIS frame count
    if (cb) cb(now);
    frames++;
    const s = field.getState();
    if (!uniforms.has('uToIndex')) return; // nothing was drawn (paused / pre-data)
    if (uniforms.get('uFromIndex') !== s.fromPose || uniforms.get('uToIndex') !== s.toPose) {
      brokenFrames++;
      if (!worstExample) {
        worstExample = `frame ${frames}: GPU was told ${uniforms.get('uFromIndex')}->${uniforms.get('uToIndex')} while the physics targeted ${s.fromPose}->${s.toPose}`;
      }
    }
    if (s.toPose !== (s.fromPose + 1) % 4) twoStepFrames++;
  };

  return new Promise((resolve) => {
    setTimeout(() => {
      /* ~a minute of frames: random clicks (which schedule the delayed advance
         that produces two-step pairs), arrow keys, tab-hide gaps, pause/resume.
         3000 frames x 20 000 particles is already ~6e7 spring updates. */
      for (let f = 0; f < 3000; f++) {
        const r = rnd();
        if (r < 0.01) {
          for (const fn of [...(hostL.get('pointerdown') ?? [])]) fn({ clientX: 200 + rnd() * 900, clientY: 100 + rnd() * 700 });
        } else if (r < 0.014) {
          for (const fn of [...(winL.get('keydown') ?? [])]) {
            fn({ key: rnd() < 0.5 ? 'ArrowRight' : 'ArrowLeft', preventDefault() {}, target: { tagName: 'BODY' } });
          }
        } else if (r < 0.016) {
          stepFrame(3000 + rnd() * 40000); // tab hidden, then one huge rAF gap
          continue;
        } else if (r < 0.018) {
          field.setVisible(false);
          field.setVisible(true);
        }
        stepFrame(8 + rnd() * 26); // 8..34 ms frames, i.e. 30..120 fps
      }
      field.destroy();
      resolve({ frames, brokenFrames, twoStepFrames, worstExample });
    }, 0);
  });
}

const { frames, brokenFrames, twoStepFrames, worstExample } = await runInvariantCheck();
if (brokenFrames > 0) {
  bad('pair invariant', `${brokenFrames}/${frames} frames disagreed — ${worstExample}`);
} else {
  ok(`${frames} frames`, `GPU and CPU agreed on every one (${twoStepFrames} frames ran a two-step pair)`);
}
if (twoStepFrames === 0) bad('scenario coverage', 'no two-step pair ever occurred, so nothing was proven');

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
