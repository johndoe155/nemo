/* ============================================================================
   nemo-particles — the ported hero particle field, driven for real.

   There is no browser in this sandbox (Playwright's download CDN is
   unreachable, so the sign-off suite cannot run here), and Node has no WebGL
   context. So this test does the next best thing: it runs the ACTUAL engine
   module (src/three/nemo-particles/nemo-particles.js — the same file the app
   imports) against a recording WebGL stub and a virtual clock, feeding it the
   REAL pose JSONs out of public/nemo-particles/.

   That exercises everything the port is responsible for: the fetch and schema
   validation, the y-orientation flip, the interleaved static VBO packing, the
   spatial-hash edge generation, the CPU spring physics, the four-pass render
   sequence, the pointer / click / arrow-key paths, the reduced-motion branch,
   the host-driven resize and the teardown. Only the GL driver itself is faked.
============================================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  createNemoParticleField,
  POSE_FILE_NAMES,
} from '../../src/three/nemo-particles/nemo-particles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const POSE_DIR = join(HERE, '..', '..', 'public', 'nemo-particles');
const N = 20000;
const STRIDE = 22;

/** Let every pending microtask (the pose fetch chain) settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/* -------------------------------------------------------------------------- */
/* recording WebGL1 stub                                                      */
/* -------------------------------------------------------------------------- */

type Call = { name: string; args: unknown[] };

function makeGL() {
  const calls: Call[] = [];
  const deleted: string[] = [];
  let objectSeq = 0;
  const make = (kind: string) => ({ __gl: kind, id: ++objectSeq });
  let attrSeq = 0;
  let lost = false;

  /* Only the calls that have to hand something back. Everything else the
     engine does to the context is recorded by the Proxy below and no-ops. */
  const impl: Record<string, unknown> = {
    createShader: () => make('shader'),
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => make('program'),
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    getUniformLocation: (_p: unknown, name: string) => ({ __uniform: name }),
    getAttribLocation: () => attrSeq++ % 8,
    createBuffer: () => make('buffer'),
    createTexture: () => make('texture'),
    createFramebuffer: () => make('framebuffer'),
    isContextLost: () => lost,
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context'
        ? {
            loseContext: () => {
              lost = true;
              calls.push({ name: 'loseContext', args: [] });
            },
          }
        : null,
  };

  const record = (name: string, fn: ((...a: unknown[]) => unknown) | undefined) =>
    (...args: unknown[]) => {
      if (name.startsWith('delete')) deleted.push(name);
      calls.push({ name, args });
      return fn ? fn(...args) : undefined;
    };

  const gl = new Proxy(impl, {
    get(target, prop: string) {
      if (prop in target) {
        const value = target[prop];
        return typeof value === 'function'
          ? record(prop, value as (...a: unknown[]) => unknown)
          : value;
      }
      /* Any WebGL enum we did not spell out: a stable unique number is all the
         engine needs from it. */
      if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) {
        let hash = 0;
        for (let i = 0; i < prop.length; i++) hash = (hash * 31 + prop.charCodeAt(i)) | 0;
        return Math.abs(hash) || 1;
      }
      /* Every other GL call is recorded and does nothing. */
      return record(String(prop), undefined);
    },
  });

  return { gl, calls, deleted, isLost: () => lost };
}

/* -------------------------------------------------------------------------- */
/* virtual window / clock / element stubs                                     */
/* -------------------------------------------------------------------------- */

function makeEnv({ reduced = false } = {}) {
  let now = 1_000;
  let frameSeq = 0;
  let frame: ((t: number) => void) | null = null;
  let frameId = 0;

  const mqListeners: Array<(e: { matches: boolean }) => void> = [];
  const windowListeners = new Map<string, Array<(e: never) => void>>();

  const win = {
    devicePixelRatio: 1,
    performance: { now: () => now },
    matchMedia: () => ({
      matches: reduced,
      addEventListener: (_t: string, fn: (e: { matches: boolean }) => void) => mqListeners.push(fn),
      removeEventListener: (_t: string, fn: (e: { matches: boolean }) => void) => {
        const i = mqListeners.indexOf(fn);
        if (i >= 0) mqListeners.splice(i, 1);
      },
    }),
    requestAnimationFrame: (cb: (t: number) => void) => {
      frame = cb;
      return (frameId = ++frameSeq);
    },
    cancelAnimationFrame: (id: number) => {
      if (id === frameId) frame = null;
    },
    addEventListener: (type: string, fn: (e: never) => void) => {
      const list = windowListeners.get(type) ?? [];
      list.push(fn);
      windowListeners.set(type, list);
    },
    removeEventListener: (type: string, fn: (e: never) => void) => {
      const list = windowListeners.get(type);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
  };

  const dispatchWindow = (type: string, event: Record<string, unknown>) => {
    for (const fn of [...(windowListeners.get(type) ?? [])]) fn(event as never);
  };
  const listenerCount = (type: string) => (windowListeners.get(type) ?? []).length;

  /** Advance the clock and run one queued frame. */
  const tick = (dtMs = 16) => {
    now += dtMs;
    const cb = frame;
    frame = null;
    cb?.(now);
  };

  const rect = { left: 0, top: 0, width: 1280, height: 900, right: 1280, bottom: 900 };
  const canvas = {
    width: 1,
    height: 1,
    style: {} as Record<string, string>,
    ownerDocument: { defaultView: win },
    getBoundingClientRect: () => rect,
  };

  const hostListeners = new Map<string, Array<(e: never) => void>>();
  const host = {
    addEventListener: (type: string, fn: (e: never) => void) => {
      const list = hostListeners.get(type) ?? [];
      list.push(fn);
      hostListeners.set(type, list);
    },
    removeEventListener: (type: string, fn: (e: never) => void) => {
      const list = hostListeners.get(type);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
  };
  const dispatchHost = (type: string, event: Record<string, unknown>) => {
    for (const fn of [...(hostListeners.get(type) ?? [])]) fn(event as never);
  };
  const hostListenerCount = (type: string) => (hostListeners.get(type) ?? []).length;

  return {
    win,
    canvas,
    host,
    rect,
    tick,
    advance: (ms: number) => {
      const steps = Math.max(1, Math.round(ms / 16));
      for (let i = 0; i < steps; i++) tick(ms / steps);
    },
    dispatchWindow,
    dispatchHost,
    listenerCount,
    hostListenerCount,
    fireReducedChange: (matches: boolean) => {
      for (const fn of [...mqListeners]) fn({ matches });
    },
    mqListenerCount: () => mqListeners.length,
  };
}

/* -------------------------------------------------------------------------- */
/* the real pose JSONs, served off disk the way the dev server serves public/ */
/* -------------------------------------------------------------------------- */

function diskFetch() {
  const requested: string[] = [];
  const impl = ((url: string) => {
    requested.push(url);
    const name = url.split('/').pop() as string;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => JSON.parse(readFileSync(join(POSE_DIR, name), 'utf8')),
    });
  }) as unknown as typeof fetch;
  return { impl, requested };
}

type Harness = Awaited<ReturnType<typeof boot>>;

/** Boot a field and run it until the pose data is in. */
async function boot(opts: { reduced?: boolean; fetchImpl?: typeof fetch } = {}) {
  const env = makeEnv({ reduced: opts.reduced });
  const { gl, calls, deleted, isLost } = makeGL();
  (env.canvas as unknown as { getContext: () => unknown }).getContext = () => gl;

  const statuses: string[] = [];
  const state = { ready: 0, errors: [] as Error[], unsupported: 0 };

  const disk = diskFetch();
  const field = createNemoParticleField(env.canvas as never, {
    baseUrl: '/nemo-particles',
    host: env.host as never,
    fetchImpl: opts.fetchImpl ?? disk.impl,
    onStatus: (t: string) => statuses.push(t),
    onReady: () => {
      state.ready++;
    },
    onError: (e: Error) => {
      state.errors.push(e);
    },
    onUnsupported: () => {
      state.unsupported++;
    },
  });

  field.resize(1280, 900);
  await flush();

  return { env, field, gl, calls, deleted, isLost, statuses, requested: disk.requested, state };
}

const uploads = (f: Harness) =>
  f.calls.filter((c) => c.name === 'bufferData' || c.name === 'bufferSubData');
const lastDyn = (f: Harness) =>
  [...uploads(f)].reverse().find((c) => c.name === 'bufferSubData')?.args[2] as Float32Array;
const poseCount = (f: Harness) => {
  const s = f.field.getState();
  return `${s.fromPose}->${s.toPose}`;
};

/* -------------------------------------------------------------------------- */

test('the field fetches the four pose files from public/ and reports ready', async () => {
  const f = await boot();
  assert.equal(f.requested.length, 4, 'one request per pose file');
  for (const name of POSE_FILE_NAMES) {
    assert.ok(
      f.requested.includes(`/nemo-particles/${name}`),
      `expected a fetch for /nemo-particles/${name}, got ${f.requested.join(', ')}`,
    );
  }
  assert.equal(f.field.isReady(), true);
  assert.equal(f.state.ready, 1, 'onReady fires exactly once');
  assert.deepEqual(f.statuses, ['FIELD READY — ENTERING']);
  assert.equal(f.field.getState().n, N, 'all 20 000 particles uploaded');
  f.field.destroy();
});

test('the interleaved static VBO keeps the 22-float layout, the y-flip and the colour scale', async () => {
  const f = await boot();
  const staticUpload = uploads(f).find(
    (c) => c.args[1] instanceof Float32Array && (c.args[1] as Float32Array).length === N * STRIDE,
  );
  assert.ok(staticUpload, 'the static particle VBO was uploaded');
  const data = staticUpload!.args[1] as Float32Array;

  const pose0 = JSON.parse(readFileSync(join(POSE_DIR, 'pose0.json'), 'utf8'));
  const pose3 = JSON.parse(readFileSync(join(POSE_DIR, 'pose3.json'), 'utf8'));
  const yMid = (pose0.yrange[0] + pose0.yrange[1]) / 2;

  for (const i of [0, 1, 997, 12345, N - 1]) {
    const o = i * STRIDE;
    assert.ok(
      Math.abs(data[o + 0] - pose0.pos[i * 2]) < 1e-6,
      'pose0.x passes through untouched (to Float32 precision)',
    );
    assert.ok(
      Math.abs(data[o + 1] - (2 * yMid - pose0.pos[i * 2 + 1])) < 1e-6,
      'pose0.y is mirrored about the pose y-range centre',
    );
    assert.ok(Math.abs(data[o + 6] - pose3.pos[i * 2]) < 1e-6, 'pose3.x lands at offset 6');
    assert.ok(Math.abs(data[o + 8] - pose0.rgb[i * 3] / 255) < 1e-6, 'colour is scaled to 0..1');
    assert.ok(data[o + 20] >= 0 && data[o + 20] <= 1, 'seed is 0..1');
    assert.ok(data[o + 21] >= 0 && data[o + 21] <= 1, 'size is 0..1');
  }

  assert.ok(
    uploads(f).some(
      (c) => c.args[1] instanceof Float32Array && (c.args[1] as Float32Array).length === N * 3,
    ),
    'the dynamic physics VBO was allocated at N*3',
  );

  const edgeUploads = f.calls.filter((c) => c.name === 'bufferData' && c.args[1] instanceof Uint16Array);
  assert.equal(edgeUploads.length, 4, 'one edge index buffer per pose');
  for (const e of edgeUploads) {
    const idx = e.args[1] as Uint16Array;
    assert.ok(idx.length > 0 && idx.length % 2 === 0, 'edges come in pairs');
    for (let i = 0; i < idx.length; i++) assert.ok(idx[i] < N, `edge index ${idx[i]} is in range`);
  }
  f.field.destroy();
});

test('a frame runs the original four passes in order and re-uploads the physics offsets', async () => {
  const f = await boot();
  /* Halfway through the 2.4 s morph, so the crossfade draws BOTH edge sets —
     at t=0 the original skips the incoming one (te > 0.001), which is exactly
     the behaviour being asserted here. */
  f.env.advance(1200);
  f.calls.length = 0;
  f.env.tick(16);

  const draws = f.calls.filter((c) => c.name === 'drawArrays' || c.name === 'drawElements');
  /* stars → morph edges (from + to) → particles → bright pass + 4 blur taps +
     composite = 4 scene draws and 6 fullscreen quads. */
  assert.equal(draws.length, 10, `expected 10 draws, got ${draws.length}`);
  assert.deepEqual(
    draws.map((d) => d.name),
    ['drawArrays', 'drawElements', 'drawElements', 'drawArrays', ...Array(6).fill('drawArrays')],
    'points/lines first, then the fullscreen quads',
  );
  assert.deepEqual(
    f.calls.filter((c) => c.name === 'viewport').map((c) => `${c.args[2]}x${c.args[3]}`),
    ['1280x900', '640x450', '640x450', '640x450', '640x450', '640x450', '1280x900'],
    'full-res scene → half-res bright/blur ×4 → full-res composite',
  );

  const dyn = lastDyn(f);
  assert.equal(dyn.length, N * 3);
  for (let i = 0; i < 300; i++) assert.ok(Number.isFinite(dyn[i]), `physics output ${i} is finite`);
  f.field.destroy();
});

test('the morph/hold cycle advances on its own: 2.4 s morph + 5.2 s hold', async () => {
  const f = await boot();
  assert.equal(poseCount(f), '0->1', 'starts on pose0 → pose1');
  f.env.advance(2400 + 5200 - 100);
  assert.equal(poseCount(f), '0->1', 'still holding pose1 just before the deadline');
  f.env.advance(200);
  assert.equal(poseCount(f), '1->2', 'advances once the hold expires');
  f.env.advance(2400 + 5200 + 200);
  assert.equal(poseCount(f), '2->3', 'and on to pose3');
  f.field.destroy();
});

test('the pointer pushes particles, a click shocks then advances, arrows step poses', async () => {
  const f = await boot();

  /* Cursor response: park the pointer on the figure (origin is 68% × 94%-ish). */
  f.env.dispatchWindow('pointermove', { clientX: 870, clientY: 500 });
  f.env.advance(120);
  const dyn = lastDyn(f);
  let displaced = 0;
  for (let i = 0; i < N; i++) {
    if (Math.abs(dyn[i * 3]) > 0.5 || Math.abs(dyn[i * 3 + 1]) > 0.5) displaced++;
  }
  assert.ok(displaced > 50, `cursor repulsion displaced ${displaced} particles`);

  /* Click: shockwave now, the morph advance ~600 ms later. */
  const before = f.field.getState().toPose;
  f.env.dispatchHost('pointerdown', { clientX: 870, clientY: 500 });
  assert.equal(f.field.getState().toPose, before, 'the click does not advance immediately');
  f.env.advance(300);
  assert.equal(f.field.getState().toPose, before, 'still waiting out the 600 ms void');
  f.env.advance(500);
  assert.equal(f.field.getState().toPose, (before + 1) % 4, 'then the delayed advance lands');

  /* Arrow keys. */
  let prevented = 0;
  const key = (k: string, tagName: string) =>
    f.env.dispatchWindow('keydown', {
      key: k,
      preventDefault: () => {
        prevented++;
      },
      target: { tagName },
    });
  key('ArrowRight', 'BODY');
  assert.equal(f.field.getState().toPose, (before + 2) % 4, 'ArrowRight steps forward');
  key('ArrowLeft', 'BODY');
  assert.equal(f.field.getState().toPose, (before + 1) % 4, 'ArrowLeft steps back');
  assert.equal(prevented, 2, 'both handled keys were consumed');

  key('ArrowRight', 'INPUT');
  assert.equal(prevented, 2, 'a text input keeps its arrow keys');
  assert.equal(f.field.getState().toPose, (before + 1) % 4, 'and the pose does not move');
  f.field.destroy();
});

test('reduced motion freezes the cycle, flags the shader, and follows a live change', async () => {
  const f = await boot({ reduced: true });
  assert.equal(f.field.getState().reduced, true, 'the media query was read at construction');
  f.env.tick(16);
  const bootFlags = f.calls
    .filter((c) => c.name === 'uniform1f' && (c.args[0] as { __uniform?: string }).__uniform === 'uReduced')
    .map((c) => c.args[1]);
  assert.ok(bootFlags.length > 0 && bootFlags.every((v) => v === 1), 'uReduced is 1 from the first frame');

  f.calls.length = 0;
  f.env.advance(2400 + 5200 + 500);
  assert.equal(poseCount(f), '0->1', 'no automatic morph under reduced motion');
  f.env.tick(16);
  const flags = f.calls
    .filter((c) => c.name === 'uniform1f' && (c.args[0] as { __uniform?: string }).__uniform === 'uReduced')
    .map((c) => c.args[1]);
  assert.ok(flags.length > 0 && flags.every((v) => v === 1), 'still flagged after minutes of frames');

  /* Turning motion back on mid-session restarts the cycle — the original's
     matchMedia change handler, still wired. */
  f.env.fireReducedChange(false);
  assert.equal(f.field.getState().reduced, false);
  f.env.advance(2400 + 5200 + 200);
  assert.equal(poseCount(f), '1->2', 'the cycle resumes when the preference changes');
  f.field.destroy();
});

test('sizing comes from the host box, not the window, and keeps the 150 ms debounce + DPR clamp', async () => {
  const f = await boot();
  const s = f.field.getState();
  assert.deepEqual([s.width, s.height, s.dpr], [1280, 900, 1], 'the measured hero box at DPR 1');

  f.field.scheduleResize(640, 480);
  assert.equal(f.field.getState().width, 1280, 'the debounced resize has not landed yet');
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(
    [f.field.getState().width, f.field.getState().height],
    [640, 480],
    'it lands after the original 150 ms debounce',
  );

  f.env.win.devicePixelRatio = 3;
  f.field.resize(1000, 800);
  assert.deepEqual(
    [f.field.getState().width, f.field.getState().height, f.field.getState().dpr],
    [1500, 1200, 1.5],
    'devicePixelRatio 3 is clamped to 1.5',
  );
  f.field.destroy();
});

test('the field pauses off screen and resumes on screen', async () => {
  const f = await boot();
  assert.equal(f.field.getState().running, true, 'running once the data is in');
  f.field.setVisible(false);
  assert.equal(f.field.getState().running, false, 'stopped while off screen');
  f.calls.length = 0;
  f.env.tick(16);
  assert.equal(
    f.calls.filter((c) => c.name === 'drawArrays').length,
    0,
    'nothing is drawn while paused',
  );
  f.field.setVisible(true);
  assert.equal(f.field.getState().running, true, 'running again');
  f.env.tick(16);
  assert.ok(
    f.calls.filter((c) => c.name === 'drawArrays').length > 0,
    'and drawing resumes',
  );
  f.field.destroy();
});

test('the GPU morphs the SAME pose pair the physics targets — the formation-loss bug', async () => {
  /* THE BUG THIS PINS. jumpTo() picks `display = cycleTimer/TRANSITION >= 0.5 ?
     toPose : fromPose`, so an advance that lands in the FIRST HALF of a morph
     (a click does exactly that: it schedules the advance 600 ms out) produces a
     two-step pair like 0->2. The vertex shader used to derive BOTH endpoints
     from uFromIndex, i.e. it could only ever draw pose[i] -> pose[(i+1)%4]. The
     CPU springs then pulled every particle toward poses[2] while the GPU drew
     the way to poses[1] — a divergence of up to 452 px on a 648 px figure — and
     the pose-2 edge set was drawn at pose-1 positions, so ~16 000 links that
     should average 15.7 px averaged 185 px. The field lost formation and only
     recovered when the NEXT transition happened to set an adjacent pair.
     Fix: a uToIndex uniform, so the shader honours the pair the physics has. */
  const f = await boot();
  f.env.advance(200);
  f.env.dispatchHost('pointerdown', { clientX: 870, clientY: 500 });
  f.env.advance(900); // the delayed advance lands inside the early-morph window

  const s = f.field.getState();
  assert.notEqual(
    s.toPose,
    (s.fromPose + 1) % 4,
    'the scenario must really produce a two-step pair, or this test proves nothing',
  );

  f.calls.length = 0;
  f.env.tick(16);
  const sent = new Map<string, number>();
  for (const c of f.calls) {
    if (c.name === 'uniform1i') {
      sent.set((c.args[0] as { __uniform?: string }).__uniform as string, c.args[1] as number);
    }
  }
  assert.equal(sent.get('uFromIndex'), s.fromPose, 'the shader is told where the morph starts');
  assert.equal(
    sent.get('uToIndex'),
    s.toPose,
    'and where it ends — which must be the pose the CPU springs are targeting',
  );

  /* The same pair must hold after the morph, into the hold, and across the
     pause/resume that a scrolling page produces. */
  f.env.advance(3000);
  f.field.setVisible(false);
  f.field.setVisible(true);
  f.env.advance(1000);
  f.calls.length = 0;
  f.env.tick(16);
  const after = new Map<string, number>();
  for (const c of f.calls) {
    if (c.name === 'uniform1i') {
      after.set((c.args[0] as { __uniform?: string }).__uniform as string, c.args[1] as number);
    }
  }
  const s2 = f.field.getState();
  assert.equal(after.get('uFromIndex'), s2.fromPose);
  assert.equal(after.get('uToIndex'), s2.toPose, 'still the same pair after a pause/resume');
  f.field.destroy();
});

test('a two-step jump still ends with the field at rest on the pose it asked for', async () => {
  const f = await boot();
  f.env.advance(200);
  f.env.dispatchHost('pointerdown', { clientX: 870, clientY: 500 });
  f.env.advance(900);
  assert.notEqual(f.field.getState().toPose, (f.field.getState().fromPose + 1) % 4);
  f.env.advance(4000); // through the 2.4 s morph and into the hold
  const dyn = lastDyn(f);
  let max = 0;
  for (let i = 0; i < N; i++) max = Math.max(max, Math.hypot(dyn[i * 3], dyn[i * 3 + 1]));
  assert.ok(max < 5, `the field settled (worst particle is ${max.toFixed(1)} px off its rest)`);
  f.field.destroy();
});

test('a failed pose fetch surfaces as an error, not a silent black canvas', async () => {
  const failing = (() =>
    Promise.resolve({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
  const f = await boot({ fetchImpl: failing });
  assert.equal(f.field.isReady(), false);
  assert.equal(f.state.ready, 0);
  assert.equal(f.state.errors.length, 1, 'onError received an Error');
  assert.match(f.state.errors[0].message, /HTTP 404/);
  f.field.destroy();
});

test('no WebGL context means the fallback path, with nothing wired up', async () => {
  const env = makeEnv();
  (env.canvas as unknown as { getContext: () => null }).getContext = () => null;
  let unsupported = 0;
  const field = createNemoParticleField(env.canvas as never, {
    host: env.host as never,
    onUnsupported: () => {
      unsupported++;
    },
  });
  assert.equal(unsupported, 1, 'onUnsupported fired');
  assert.equal(field.isReady(), false);
  assert.equal(env.listenerCount('pointermove'), 0, 'no window listeners left behind');
  assert.equal(env.hostListenerCount('pointerdown'), 0, 'no host listeners left behind');
  assert.equal(env.mqListenerCount(), 0, 'the reduced-motion listener was released');
  field.destroy();
});

test('destroy tears everything down, and later events cannot touch a dead context', async () => {
  const f = await boot();
  assert.ok(f.env.listenerCount('pointermove') > 0, 'pointermove was bound');
  assert.ok(f.env.hostListenerCount('pointerdown') > 0, 'pointerdown was bound');

  f.field.destroy();

  assert.equal(f.field.isDestroyed(), true);
  assert.equal(f.env.listenerCount('pointermove'), 0, 'pointermove removed');
  assert.equal(f.env.listenerCount('keydown'), 0, 'keydown removed');
  assert.equal(f.env.hostListenerCount('pointerdown'), 0, 'pointerdown removed');
  assert.equal(f.env.hostListenerCount('pointerleave'), 0, 'pointerleave removed');
  assert.equal(f.env.hostListenerCount('pointercancel'), 0, 'pointercancel removed');
  assert.equal(f.env.mqListenerCount(), 0, 'reduced-motion listener removed');
  assert.equal(f.field.getState().running, false, 'the rAF loop is stopped');
  for (const kind of ['deleteBuffer', 'deleteProgram', 'deleteShader', 'deleteTexture', 'deleteFramebuffer']) {
    assert.ok(f.deleted.includes(kind), `${kind} was called`);
  }
  assert.equal(f.isLost(), true, 'the WebGL context was released');

  f.calls.length = 0;
  f.env.tick(16);
  f.env.dispatchWindow('pointermove', { clientX: 10, clientY: 10 });
  f.env.dispatchHost('pointerdown', { clientX: 10, clientY: 10 });
  f.env.dispatchWindow('keydown', { key: 'ArrowRight', preventDefault: () => {}, target: { tagName: 'BODY' } });
  assert.deepEqual(
    f.calls.filter((c) => ['drawArrays', 'drawElements', 'bufferSubData'].includes(c.name)),
    [],
    'no GL work after destroy',
  );
});

test('a mount that never resolves its poses stays safe to tear down', async () => {
  const env = makeEnv();
  const { gl } = makeGL();
  (env.canvas as unknown as { getContext: () => unknown }).getContext = () => gl;
  const resolvers: Array<(v: unknown) => void> = [];
  const hanging = (() => new Promise((r) => resolvers.push(r))) as unknown as typeof fetch;

  const field = createNemoParticleField(env.canvas as never, {
    host: env.host as never,
    fetchImpl: hanging,
    onReady: () => assert.fail('nothing may become ready after teardown'),
    onError: () => assert.fail('a cancelled mount must not report an error'),
  });
  field.resize(1280, 900);
  field.destroy();

  /* Resolve after teardown: the engine must ignore it, not throw. */
  for (const r of resolvers) {
    r({
      ok: true,
      status: 200,
      json: async () => ({ n: 1, pos: [0, 0], rgb: [0, 0, 0], yrange: [0, 1] }),
    });
  }
  await flush();
  assert.equal(field.isReady(), false, 'nothing was built on the dead context');
  assert.equal(field.getState().running, false);
});
