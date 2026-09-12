#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import {
  applyStaticModelTransform,
  boundsFromBox,
} from '../src/three/persona-model/normalization.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MODEL_PATH = resolve(ROOT, 'public/models/persona-model/model.glb');
const OUTPUT_PATH = resolve(ROOT, 'public/models/persona-model/persona-points.json');
const POINT_COUNT = 12_000;
const DECIMALS = 5;

// GLTFLoader only needs image objects to finish constructing materials. Surface
// sampling reads geometry exclusively, so a one-pixel stand-in avoids decoding
// the embedded textures in Node without changing the loaded mesh hierarchy.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

function seededRandom(seed = 0x4e454d4f) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function triangleAreaTotal(geometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const triangle = new THREE.Triangle();
  let area = 0;
  const count = index ? index.count : position.count;

  for (let i = 0; i < count; i += 3) {
    const ai = index ? index.getX(i) : i;
    const bi = index ? index.getX(i + 1) : i + 1;
    const ci = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(position, ai);
    b.fromBufferAttribute(position, bi);
    c.fromBufferAttribute(position, ci);
    area += triangle.set(a, b, c).getArea();
  }

  return area;
}

function allocatePointBudgets(entries, total) {
  const totalArea = entries.reduce((sum, entry) => sum + entry.area, 0);
  const allocations = entries.map((entry) => {
    const exact = (entry.area / totalArea) * total;
    return { ...entry, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let remaining = total - allocations.reduce((sum, entry) => sum + entry.count, 0);
  allocations.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining; i += 1) allocations[i % allocations.length].count += 1;
  return allocations;
}

function parseGltf(arrayBuffer) {
  return new Promise((resolvePromise, rejectPromise) => {
    new GLTFLoader().parse(arrayBuffer, '', resolvePromise, rejectPromise);
  });
}

const bytes = await readFile(MODEL_PATH);
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const gltf = await parseGltf(arrayBuffer);
const scene = gltf.scene.clone(true);
scene.updateMatrixWorld(true);

const sourceBox = new THREE.Box3().setFromObject(scene);
const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
applyStaticModelTransform(scene, sourceCenter);

const transformedBounds = boundsFromBox(new THREE.Box3().setFromObject(scene));
const meshes = [];
scene.traverse((child) => {
  if (!child.isMesh || !child.geometry?.getAttribute('position')) return;
  const geometry = child.geometry.clone();
  geometry.applyMatrix4(child.matrixWorld);
  const area = triangleAreaTotal(geometry);
  if (area > 0) meshes.push({ geometry, area, name: child.name || 'mesh' });
});

if (meshes.length === 0) throw new Error('No sampleable meshes were found in model.glb.');

const random = seededRandom();
const point = new THREE.Vector3();
const positions = [];
for (const entry of allocatePointBudgets(meshes, POINT_COUNT)) {
  const mesh = new THREE.Mesh(entry.geometry);
  const sampler = new MeshSurfaceSampler(mesh).setRandomGenerator(random).build();
  for (let i = 0; i < entry.count; i += 1) {
    sampler.sample(point);
    positions.push(
      Number(point.x.toFixed(DECIMALS)),
      Number(point.y.toFixed(DECIMALS)),
      Number(point.z.toFixed(DECIMALS)),
    );
  }
  entry.geometry.dispose();
}

const output = {
  name: 'NEMO Persona',
  n: POINT_COUNT,
  xrange: transformedBounds.xrange.map((value) => Number(value.toFixed(DECIMALS))),
  yrange: transformedBounds.yrange.map((value) => Number(value.toFixed(DECIMALS))),
  zrange: transformedBounds.zrange.map((value) => Number(value.toFixed(DECIMALS))),
  pos: positions,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
console.log(
  `Wrote ${POINT_COUNT.toLocaleString()} persona surface points from ${meshes.length} mesh(es) to ${OUTPUT_PATH}`,
);
