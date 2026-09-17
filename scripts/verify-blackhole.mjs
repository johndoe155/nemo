/**
 * verify-blackhole.mjs — re-checkable invariants for the section 09 integration.
 *
 *   node scripts/verify-blackhole.mjs
 *
 * No dependencies, no browser, no GPU. It verifies the two things that can
 * silently rot and that the acceptance checklist cares about most:
 *
 *   1 · VERBATIM   the four vendored simulation files are still byte-identical
 *                  to webgpu-black-hole-config-driven.zip. They are the shader;
 *                  nothing in this repo is allowed to edit them, and a
 *                  well-meaning "cleanup" would not break the build — it would
 *                  just quietly change the physics.
 *   2 · COMPAT     the vendored simulation actually runs against the version of
 *                  three this project ships. Upstream targets three ^0.181.1;
 *                  this project is on a newer release, and TSL is a young API.
 *                  Every symbol blackhole-shader.js imports is resolved, the
 *                  full raymarch node graph is built, the simulation and the
 *                  cinematic camera are instantiated and ticked, and the bloom
 *                  chain is constructed — all CPU-side, which is everything
 *                  except the GPU itself.
 *
 * Exits non-zero on any failure, so it is safe to wire into CI.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src/three/blackhole');
const ZIP = join(ROOT, 'webgpu-black-hole-config-driven.zip');
const ZIP_MEMBER = 'webgpu-black-hole-main';

/* Expected digests of the upstream files, recorded at integration time. */
const FILES = {
  'blackhole.js': '357f91e42ec8aaed865ec9d3c885c23f5ac50a7172df7e35af334e53ed618d1a',
  'blackhole-shader.js': '8e22de459e83445969ab9694655cd3bc3cc6ee28203871aebd6cb3353c18c1e5',
  'blackhole.config.js': 'dfae8afd955a6804a0c40d0b2da22d8b190f1ffcce82b8dc32d08c89329aff64',
  'camera-animation.js': 'e27ef2383a97c0c326f1d3b672929ad711f1bb85919a1f42061f117a851ad949',
};

/* Every symbol the vendored shader + upstream orchestration import from TSL. */
const TSL_SYMBOLS = [
  'vec2', 'vec3', 'vec4', 'float', 'Fn', 'length', 'normalize', 'cross', 'dot',
  'sin', 'cos', 'atan', 'asin', 'sqrt', 'pow', 'fract', 'clamp', 'smoothstep',
  'mix', 'floor', 'step', 'sign', 'abs', 'exp', 'Loop', 'Break', 'If',
  'screenUV', 'uniform', 'pass',
];

let failures = 0;
const ok = (name, detail = '') => console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
const bad = (name, detail = '') => {
  failures++;
  console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/* ---------------------------------------------------------------- 1 · verbatim */
console.log('\n1 · the vendored simulation is verbatim');

for (const [name, want] of Object.entries(FILES)) {
  const path = join(DIR, name);
  if (!existsSync(path)) {
    bad(name, 'missing from src/three/blackhole/');
    continue;
  }
  const got = sha256(readFileSync(path));
  if (got === want) ok(name, got.slice(0, 16) + '…');
  else bad(name, `digest ${got.slice(0, 16)}… ≠ expected ${want.slice(0, 16)}… — the file was edited`);
}

/* If the zip is still in the repo, diff against it directly rather than
   trusting the recorded digests alone. `unzip` is optional — its absence is
   not a failure, the digests above are the real check. */
if (existsSync(ZIP)) {
  let unzipAvailable = true;
  for (const name of Object.keys(FILES)) {
    let upstream;
    try {
      upstream = execFileSync('unzip', ['-p', ZIP, `${ZIP_MEMBER}/${name}`], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      unzipAvailable = false;
      break;
    }
    const same = sha256(upstream) === sha256(readFileSync(join(DIR, name)));
    if (same) ok(`byte-identical to the zip: ${name}`);
    else bad(`differs from the zip: ${name}`);
  }
  if (!unzipAvailable) console.log('  SKIP  direct zip diff (`unzip` not on PATH) — digest check above still applies');
} else {
  console.log('  SKIP  zip no longer present at the repo root — digest check above still applies');
}

/* --------------------------------------------------------------- 2 · compat */
console.log('\n2 · the simulation runs against this project’s three');

/* blackhole.js reads window.innerWidth once while building its resolution
   uniform. Stub the minimum so the modules can be evaluated outside a browser
   — nothing here is a substitute for a real GPU, it just lets the CPU-side
   graph build run. */
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 2,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.document = {
  createElementNS: () => ({ style: {}, getContext: () => null }),
  createElement: () => ({ style: {}, getContext: () => null, width: 0, height: 0 }),
  body: { appendChild() {} },
};
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'verify-blackhole', maxTouchPoints: 0 },
  configurable: true,
});
globalThis.self = globalThis;

const THREE = await import('three/webgpu');
ok('three/webgpu imports', `r${THREE.REVISION}`);
for (const ctor of ['WebGPURenderer', 'PostProcessing', 'RenderPipeline', 'MeshBasicNodeMaterial', 'Scene', 'PerspectiveCamera']) {
  if (typeof THREE[ctor] === 'function') ok(`THREE.${ctor} present`);
  else bad(`THREE.${ctor} missing from three/webgpu`);
}

const tsl = await import('three/tsl');
const missing = TSL_SYMBOLS.filter((s) => !(s in tsl));
if (missing.length === 0) ok('three/tsl exports every symbol the shader imports', `${TSL_SYMBOLS.length} symbols`);
else bad('three/tsl is missing symbols the shader imports', missing.join(', '));

const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
if (typeof bloom === 'function') ok('three/addons/tsl/display/BloomNode.js → bloom');
else bad('bloom addon not resolvable');
if (typeof OrbitControls === 'function') ok('three/addons/controls/OrbitControls.js → OrbitControls');
else bad('OrbitControls addon not resolvable');

const { BlackHoleSimulation } = await import('../src/three/blackhole/blackhole.js');
const { CameraAnimation } = await import('../src/three/blackhole/camera-animation.js');
const { flatSimulationConfig: config } = await import('../src/three/blackhole/blackhole.config.js');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const sim = new BlackHoleSimulation(scene);
sim.createBlackHole(); // builds the complete TSL raymarch graph
const mesh = sim.blackHoleMesh;
if (mesh?.material?.colorNode && mesh.geometry?.attributes?.position) {
  ok('raymarch node graph builds', `${mesh.material.type} · ${mesh.geometry.attributes.position.count} verts`);
} else {
  bad('raymarch node graph did not build');
}

const camera = new THREE.PerspectiveCamera(60, 1280 / 720, 0.1, 1000);
camera.position.set(0, -5, 20);
camera.lookAt(0, 0, 0);
const camAnim = new CameraAnimation(camera, { target: new THREE.Vector3(), enabled: true });
camAnim.start();
camAnim.update(1 / 60);
sim.update(1 / 60, camera);
if (camAnim.playing && sim.uniforms.time.value > 0) {
  ok('simulation + cinematic camera tick', `time=${sim.uniforms.time.value.toFixed(4)} · loop=${camAnim.totalDuration}s`);
} else {
  bad('simulation or cinematic camera did not tick');
}

/* The bloom chain, wired exactly as the stage wires it. */
try {
  const scenePass = tsl.pass(scene, camera);
  const color = scenePass.getTextureNode();
  const b = bloom(color);
  b.threshold.value = config.bloomThreshold;
  b.strength.value = config.bloomStrength;
  b.radius.value = config.bloomRadius;
  const out = color.add(b);
  if (out) ok('bloom post-processing chain constructs', `strength ${config.bloomStrength} · radius ${config.bloomRadius} · threshold ${config.bloomThreshold}`);
  else bad('bloom chain returned nothing');
} catch (err) {
  bad('bloom chain threw', err.message);
}

/* The config is the single source of truth — prove it is still unread-altered
   in the ways the section depends on. */
if (config.cinematicMode === false) ok('config.cinematicMode still ships false (glue starts the orbit itself)');
else bad('config.cinematicMode changed — the vendored config must not be edited');
for (const [key, want] of [['starBackgroundColor', '#000000'], ['nebula1Color', '#071f44'], ['nebula2Color', '#010615']]) {
  if (config[key] === want) ok(`config.${key} = ${want} (the seam palette in lib/scenes.ts reads these)`);
  else bad(`config.${key} changed`, `${config[key]} ≠ ${want}`);
}

console.log(`\n${failures === 0 ? 'BLACK HOLE INTEGRATION VERIFIED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
