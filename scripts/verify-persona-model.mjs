/**
 * verify-persona-model.mjs — re-checkable fidelity invariants for PILLAR 4.
 *
 * It proves the shipped GLB/HDR remain byte-identical to nemosite.zip and the
 * scene's donor section still differs only by the small, documented module
 * integration substitutions recorded in src/three/persona-model/PROVENANCE.md.
 * A real browser/GPU is still required to paint-test the WebGL shader.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = join(ROOT, 'nemosite.zip');
const VENDORED_SCENE = join(ROOT, 'src/three/persona-model/scene.jsx');
const ASSET_DIR = join(ROOT, 'public/models/persona-model');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

let failures = 0;
const pass = (name) => console.log(`  PASS  ${name}`);
const fail = (name, detail) => {
  failures += 1;
  console.log(`  FAIL  ${name} — ${detail}`);
};

if (!existsSync(ZIP)) {
  console.error(`nemosite.zip is missing (${ZIP}); provenance cannot be verified.`);
  process.exit(1);
}

function zipMember(member) {
  try {
    return execFileSync('unzip', ['-p', ZIP, member], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // The GLB is ~29 MB; Node's 1 MB exec buffer default would turn a valid
      // byte comparison into an ENOBUFS false negative.
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`zip member ${member}`, detail);
    return null;
  }
}

console.log('\n1 · donor assets are byte-identical');
for (const name of ['model.glb', 'studio_small_08_1k.hdr']) {
  const donor = zipMember(`Model/${name}`);
  const destination = join(ASSET_DIR, name);
  if (!donor) continue;
  if (!existsSync(destination)) {
    fail(name, `missing ${destination}`);
    continue;
  }
  const shipped = readFileSync(destination);
  if (!donor.equals(shipped)) {
    fail(name, `sha256 ${sha256(shipped)} differs from donor ${sha256(donor)}`);
  } else {
    pass(`${name} (${shipped.length.toLocaleString()} bytes)`);
  }
}

console.log('\n2 · scene/model/shader body matches the donor');
const donorHtml = zipMember('Model/index.html')?.toString('utf8');
if (!donorHtml || !existsSync(VENDORED_SCENE)) {
  fail('scene.jsx', 'donor HTML or vendored scene is missing');
} else {
  const donor = donorHtml
    .split("import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';\n", 2)[1]
    .split('\nfunction LoadingOverlay() {', 1)[0];
  const vendored = readFileSync(VENDORED_SCENE, 'utf8')
    .split("import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';\n", 2)[1]
    .replace("const MODEL_URL = `${import.meta.env.BASE_URL}models/persona-model/model.glb`;", "const MODEL_URL = './model.glb';")
    .replace('export const BASE_FOV = 32;', 'const BASE_FOV = 32;')
    .replace('export function ResponsiveRig() {', 'function ResponsiveRig() {')
    .replace('export function Scene() {', 'function Scene() {')
    .replace('files={`${import.meta.env.BASE_URL}models/persona-model/studio_small_08_1k.hdr`}', 'files="./studio_small_08_1k.hdr"')
    .replace(/^\n/, '');

  if (donor.replace(/[\t ]+$/gm, '') === vendored.replace(/[\t ]+$/gm, '')) {
    pass('scene.jsx differs only by documented imports, exports, BASE_URL asset paths, and whitespace normalization');
  } else {
    fail('scene.jsx', 'the scene/model/shader body no longer matches the donor after documented substitutions');
  }
}

console.log(`\n${failures === 0 ? 'PERSONA MODEL INTEGRATION VERIFIED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
