import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BlackHoleSimulation } from '../three/blackhole/blackhole.js';
import { CameraAnimation } from '../three/blackhole/camera-animation.js';
import { flatSimulationConfig as config } from '../three/blackhole/blackhole.config.js';
import BlackHoleStill from './BlackHoleStill';

/* ============================================================================
   BlackHoleStage — the React mounting layer for the WebGPU black hole.

   WHY THIS FILE EXISTS
   The simulation lives in src/three/blackhole/ and is byte-for-byte identical
   to the upstream zip (see PROVENANCE.md there). Upstream ships `main.js`, a
   standalone Vite entry point: it sizes off window.innerWidth/innerHeight,
   appends its canvas to document.body, listens for window resize, and never
   tears anything down. None of that survives contact with a React tree, so
   this component re-writes ONLY that orchestration. The renderer / scene /
   camera / controls / post-processing / simulation wiring below is the same
   sequence main.js performs, in the same order, with the same values — adapted
   for scoped mounting, scoped sizing, full teardown, off-screen pausing,
   reduced motion and touch. Nothing in src/three/blackhole/ is modified.

   ---------------------------------------------------------------------------
   FAILURE HANDLING — READ THIS BEFORE TOUCHING THE FALLBACK BRANCHES
   ---------------------------------------------------------------------------
   THE RULE THIS FILE IS BUILT AROUND: three decides, the glue does not.

   `WebGPURenderer` installs its own fallback in its constructor:

       parameters.getFallback = () => {
         warn( 'WebGPURenderer: WebGPU is not available, running under WebGL2 backend.' );
         return new WebGLBackend( parameters );
       };

   and `Renderer.init()` catches a failing backend, swaps that fallback in and
   initialises it, rejecting ONLY if the fallback fails as well. So a resolved
   `init()` does not mean WebGPU — it means "some backend is live". Upstream
   main.js relies on exactly that: it contains no capability check at all, just

       renderer.init().then( … animate … ).catch( … "WebGPU Not Supported" … )

   An earlier version of this component probed `navigator.gpu` first and treated
   its absence — or a null adapter — as fatal. That gate is what put a static
   frame on screen in browsers where three would have rendered the scene live on
   WebGL2, i.e. the same browsers that run the upstream demo fine. DO NOT
   REINTRODUCE IT. The probe below is DIAGNOSTIC ONLY: it acquires the adapter
   we hand to the renderer (see the r185 note) and explains in the logs which
   backend we landed on and why.

   What may claim *unsupported* now, and only this: `renderer.init()` rejected
   AND the browser cannot produce a WebGL2 context either. three has then tried
   both GPU APIs and there is nothing left to render with. Logged at info level
   with the real rejection reason, because on such a browser that outcome is
   expected rather than defective.

   EVERYTHING else — an init() that rejects while WebGL2 exists, a TSL graph
   that fails to build, a per-frame render exception — is a real error with a
   real message, and it is reported as one: console.error with the message, the
   stack and an environment dump, an honest on-screen label naming the stage
   that failed, and a Retry control. Labelling those "unsupported" is how a
   version-skew bug ends up disguised as a missing browser feature.

   Which backend came up is recorded on the stage element as
   `data-backend="webgpu"|"webgl2"` and in the console. Nothing visible changes:
   a live stage stays bare, on WebGL2 exactly as on WebGPU.

   THE r185 ADAPTER REGRESSION (why the glue requests the device itself)
   three r181 — the version the donor demo runs — asked for an adapter like
   this:

       featureLevel: parameters.compatibilityMode ? 'compatibility' : undefined

   three r185, which this project ships, hardcodes it:

       featureLevel: 'compatibility'          // unconditional
       xrCompatible: renderer.xr.enabled

   Per the WebGPU spec a compatibility-level request resolves to null wherever
   the user agent cannot provide a compatibility-mode adapter, and three then
   throws "THREE.WebGPUBackend: Unable to create WebGPU adapter." — after which
   it silently drops to WebGL2, so a device that could have had real WebGPU
   renders the fallback instead. r185
   also documents `parameters.device` ("if there is an existing GPU device on
   app level, it can be passed to the renderer"), so the glue acquires the
   adapter and device itself with a plain core-level request — precisely what
   r181 asked for — and hands the device over, which makes three skip its own
   request entirely. Consequence to remember: three only destroys a device it
   created itself (`if (parameters.device === undefined) device.destroy()`), so
   release() below must destroy ours. This applies only when an adapter exists;
   with no adapter there is nothing to hand over and three's own path (WebGPU
   attempt, then WebGL2 fallback) runs untouched.

   SSR / build safety: every window, document, navigator, renderer and DOM
   write happens inside the effect. Module scope holds imports, types and pure
   helpers only, so importing this file outside a browser cannot throw.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Minimal structural WebGPU types. TypeScript's lib.dom.d.ts still ships none,
   and a local declaration beats a `declare global` augmentation: nothing here
   can collide when lib.dom eventually catches up.
   -------------------------------------------------------------------------- */
interface GPUFeatureSetLike {
  has(name: string): boolean;
  [Symbol.iterator](): IterableIterator<string>;
}
interface GPUDeviceLike {
  readonly features?: GPUFeatureSetLike;
  readonly lost?: Promise<unknown>;
  destroy(): void;
}
interface GPUAdapterLike {
  readonly features?: GPUFeatureSetLike;
  readonly isFallbackAdapter?: boolean;
  readonly info?: unknown;
  requestDevice(descriptor?: { requiredFeatures?: string[] }): Promise<GPUDeviceLike>;
}
type NavigatorWithGPU = Navigator & {
  gpu?: { requestAdapter(options?: Record<string, unknown>): Promise<GPUAdapterLike | null> };
};

/** Discriminated so no branch can be mistaken for another. */
type Probe =
  | { ok: true; adapter: GPUAdapterLike }
  | { ok: false; reason: 'no-navigator-gpu' }
  | { ok: false; reason: 'adapter-null' }
  | { ok: false; reason: 'probe-threw'; error: unknown };

type StageStatus = 'booting' | 'live' | 'unsupported' | 'error';
/** Which of three's backends actually came up. Reported, never rendered. */
type BackendKind = 'webgpu' | 'webgl2';
type Note = { label: string; hint?: string };

/* main.js caps at Math.min(devicePixelRatio, 2). Kept identical: the sim should
   read the same here as upstream. First knob to turn down if low-end mobile
   GPUs struggle — the raymarcher is 64 steps per pixel. */
const DPR_CAP = 2;

/* Start the loop a little before the stage actually enters the viewport so the
   first visible frame is already warm instead of popping in from black. */
const VIEW_MARGIN = '18% 0px';

/* three r183 renamed PostProcessing → RenderPipeline; the old name is still
   exported but is documented as deprecated ("will be removed in a future
   version") and logs a warning on construction. Upstream main.js predates the
   rename, and post-processing is orchestration rather than shader code — none
   of the four vendored files touch it — so the glue uses the current name and
   keeps the old one only as a fallback for a three pinned below r183. */
const Pipeline: typeof THREE.RenderPipeline =
  THREE.RenderPipeline ?? (THREE.PostProcessing as unknown as typeof THREE.RenderPipeline);

/* Is this page running inside a frame? WebGPU is gated by Permissions Policy
   (default allowlist `self`), so a cross-origin embed gets NO navigator.gpu at
   all even in a browser that supports it perfectly. Accessing window.top from
   a cross-origin frame can throw, which is itself the answer. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Everything worth knowing when a failure is reported. */
function environment(extra?: Record<string, unknown>): Record<string, unknown> {
  const nav = navigator as NavigatorWithGPU;
  const info: Record<string, unknown> = {
    threeRevision: THREE.REVISION,
    navigatorGpu: typeof nav.gpu === 'undefined' ? 'undefined' : 'present',
    secureContext: window.isSecureContext,
    embeddedInFrame: isEmbedded(),
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
    ...extra,
  };
  try {
    const allowed = (document as Document & { featurePolicy?: { allowedFeatures(): string[] } })
      .featurePolicy?.allowedFeatures();
    if (Array.isArray(allowed)) info.permissionsPolicyAllowsWebgpu = allowed.includes('webgpu');
  } catch {
    /* older browsers have no featurePolicy API — absence is not evidence */
  }
  return info;
}

/** Report a REAL failure: message, stack, and the environment, unmissably. */
function reportError(
  stage: string,
  error: unknown,
  extra?: Record<string, unknown>,
  fatal = true,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  // Both severities go to console.error on purpose: a swallowed warning is how
  // this bug stayed invisible in the first place. Only the framing differs.
  const framing = fatal
    ? 'This is NOT a "WebGPU unsupported" case — the real error follows.'
    : 'This did NOT stop the section from rendering, but it should not have happened — the real error follows.';
  console.error(
    `[singularity] the black hole failed during ${stage}. ${framing}\n` +
      `  message: ${message}\n` +
      `  stack: ${stack ?? '(none)'}\n` +
      `  environment: ${JSON.stringify(environment(extra), null, 2)}`,
    error,
  );
}

/* --------------------------------------------------------------------------
   Diagnostic probe — NOT a gate. Nothing here may decide whether the section
   renders; see the doctrine at the top of the file. Note what is deliberately
   absent from the request: no featureLevel, no powerPreference — a plain
   core-level request, matching three r181 and the donor demo. `navigator.gpu`
   existing is necessary but not sufficient (a browser can expose it and still
   hand back no adapter), so the adapter is requested too — and kept, because it
   builds the device below instead of being thrown away and re-requested by
   three. A failure here is a fact to log, not a reason to stop.
   -------------------------------------------------------------------------- */
async function probeWebGPU(): Promise<Probe> {
  const nav = navigator as NavigatorWithGPU;
  if (nav.gpu === undefined || nav.gpu === null || typeof nav.gpu.requestAdapter !== 'function') {
    return { ok: false, reason: 'no-navigator-gpu' };
  }
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (adapter === null || adapter === undefined) return { ok: false, reason: 'adapter-null' };
    return { ok: true, adapter };
  } catch (error) {
    return { ok: false, reason: 'probe-threw', error };
  }
}

/* Is there a WebGL2 context to be had? Consulted for exactly one decision:
   when renderer.init() rejects, three has already tried WebGPU and its WebGL2
   backend, so this separates "the browser has no GPU API at all" (genuine
   non-support → static frame) from "WebGL2 exists but three refused it" (a real
   error → console.error + Retry). The probe context is released immediately:
   browsers cap the number of live contexts, and leaking one would eat into the
   renderer's own budget. */
function hasWebGL2(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null;
    lose?.loseContext();
    return true;
  } catch {
    return false; // a getContext that throws has answered the question
  }
}

/* Free a context three will never free. `Renderer.dispose()` is gated on
   `if ( this._initialized === true )`, so a renderer whose init() REJECTED is
   not disposable at all — and by then three has already tried its WebGL2
   fallback, whose init can create a real context before throwing. Browsers cap
   live contexts, and Retry makes this path repeatable, so lose it explicitly:
   getContext() hands back the canvas's EXISTING context rather than making a
   second one, which is what makes this safe to call on any canvas. */
function loseAnyContext(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  try {
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      | (WebGLRenderingContext & { getExtension(name: string): unknown })
      | null;
    const lose = gl?.getExtension('WEBGL_lose_context') as { loseContext(): void } | null;
    lose?.loseContext();
  } catch {
    /* no context, or a browser without WEBGL_lose_context: nothing to free */
  }
}

/* --------------------------------------------------------------------------
   Build the device ourselves so three never issues its r185
   compatibility-mode adapter request. Mirrors three's own device descriptor:
   every feature the adapter supports becomes required (that is what three
   computes from its GPUFeatureName list), and the feature that decides three's
   `compatibilityMode` flag — and therefore whether MSAA survives — is
   'core-features-and-limits'. Two-step retry: all features, then defaults,
   then give up and let three make its own request (which also has a WebGL2
   fallback path). Every step is logged; none of them is silent.
   -------------------------------------------------------------------------- */
async function acquireDevice(adapter: GPUAdapterLike): Promise<GPUDeviceLike | null> {
  const supported: string[] = [];
  try {
    if (adapter.features) for (const feature of adapter.features) supported.push(String(feature));
  } catch (error) {
    console.warn('[singularity] could not enumerate adapter features.', error);
  }

  try {
    const device = await adapter.requestDevice(
      supported.length > 0 ? { requiredFeatures: supported } : undefined,
    );
    console.info(
      `[singularity] app-level GPUDevice acquired (three r185's own request would have asked for featureLevel:'compatibility').`,
      environment({ adapterFeatures: supported, adapterInfo: adapter.info ?? null }),
    );
    return device;
  } catch (error) {
    console.warn(
      `[singularity] requestDevice with the adapter's ${supported.length} supported feature(s) failed; retrying with defaults.`,
      error,
    );
  }

  try {
    return await adapter.requestDevice();
  } catch (error) {
    console.warn(
      '[singularity] requestDevice failed twice; falling through to three’s own adapter request.',
      error,
    );
    return null;
  }
}

export default function BlackHoleStage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<StageStatus>('booting');
  const [note, setNote] = useState<Note | null>(null);
  /* Machine-readable only: which of three's backends came up. Deliberately not
     rendered as text — a live stage stays bare whether it is WebGPU or the
     WebGL2 fallback. */
  const [backend, setBackend] = useState<BackendKind | null>(null);
  /* Retry re-runs the whole effect from scratch: teardown is already complete
     by then, so this is a clean cold start rather than a resumed one. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    /* ---- device policy, read once ------------------------------------------------
       Same house pattern as Hero/Footer/Ambience: matchMedia is read at mount,
       not subscribed to, so there is no first-pass flicker and no re-init when
       an OS setting changes mid-session. */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse =
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

    /* ---- lifecycle state ---- */
    let released = false; // cleanup ran — React may still be mid-boot
    let initDone = false; // renderer.init() resolved, so the GPU device is real
    let raf = 0;
    let running = false;
    let last = 0;

    let device: GPUDeviceLike | null = null; // ours, so ours to destroy
    let renderer: THREE.WebGPURenderer | null = null;
    let pipeline: THREE.RenderPipeline | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: OrbitControls | null = null;
    let camAnim: CameraAnimation | null = null;
    let sim: BlackHoleSimulation | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let resizeObs: ResizeObserver | null = null;
    let viewObs: IntersectionObserver | null = null;

    const fail = (next: 'unsupported' | 'error', label: string, hint?: string) => {
      setNote({ label, hint });
      setStatus(next);
    };

    /* ---- draw / loop (same order of operations as main.js animate()) ---- */
    const draw = () => {
      if (!renderer || !scene || !camera) return;
      // main.js renders through the bloom chain when it exists, else straight
      // to the renderer. Same branch, same order.
      if (pipeline) pipeline.render();
      else renderer.render(scene, camera);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      // main.js clamps dt to 0.033 so a stalled tab cannot lurch the simulation
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      try {
        camAnim?.update(dt);
        controls?.update();
        if (sim && camera) sim.update(dt, camera);
        draw();
      } catch (error) {
        // A per-frame failure must not spam the console 60×/second. Stop the
        // loop, report the real error once, and show the still.
        stop();
        reportError('the render loop (first frame)', error);
        fail('error', 'RENDER LOOP FAILED — SEE CONSOLE');
      }
    };

    const start = () => {
      if (running || released || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    /* ---- teardown ----------------------------------------------------------------
       Idempotent, and deliberately safe to call BEFORE renderer.init()
       resolves. three's Renderer.dispose() only frees the backend once its
       internal `_initialized` flag is set, so a teardown that lands mid-init
       cannot release the GPU device — which is precisely the React StrictMode
       case (mount → cleanup → mount) and the hot-reload case. boot() therefore
       calls release() a *second* time once init resolves, and that pass is the
       one that actually destroys the device. This is why renderer/canvas/device
       are not nulled out here. */
    const release = () => {
      released = true;
      stop();

      resizeObs?.disconnect();
      resizeObs = null;
      viewObs?.disconnect();
      viewObs = null;

      // OrbitControls.dispose() → disconnect(): removes its pointer/wheel/
      // keydown listeners AND restores the element's touch-action.
      if (controls) {
        try {
          controls.dispose();
        } catch {
          /* element already detached — nothing left to unbind */
        }
        controls = null;
      }
      camAnim = null;

      // The simulation has no dispose() of its own upstream (it was never meant
      // to be torn down), so release exactly what createBlackHole() made.
      if (sim) {
        try {
          const mesh = sim.blackHoleMesh;
          if (mesh) {
            scene?.remove(mesh);
            mesh.geometry?.dispose();
            mesh.material?.dispose();
          }
        } catch {
          /* mesh never finished building */
        }
        sim = null;
      }

      if (pipeline) {
        try {
          pipeline.dispose();
        } catch {
          /* chain never built */
        }
        pipeline = null;
      }

      // renderer.dispose() → backend.dispose(): frees pipelines, bindings,
      // textures and the canvas context. Guarded on initDone because three's
      // dispose() is itself gated on `_initialized === true`: pre-init it is a
      // literal no-op that would leave the device alive once init completes.
      // The rejected-init case is handled separately by loseAnyContext().
      if (initDone && renderer) {
        try {
          renderer.dispose();
        } catch {
          /* device already gone (tab backgrounded, driver reset) */
        }
      }

      // Ours, so ours to destroy: three explicitly skips destroy() for an
      // app-provided device. Not guarded on initDone — the device exists as
      // soon as acquireDevice() resolves, even if init never got there.
      if (device) {
        try {
          device.destroy();
        } catch {
          /* already lost or destroyed */
        }
      }

      // The canvas belongs to this container, so it leaves with the component —
      // never a stray <canvas> left on document.body.
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);

      scene = null;
      camera = null;
    };

    /* ---- sizing: the section's own box, not the window ---- */
    const measure = () => {
      if (!renderer || !camera || !sim) return;
      const box = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(box.width));
      const h = Math.max(1, Math.round(box.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // updateStyle=false: CSS owns the element's layout box (100%/100% of the
      // stage), three only owns the backing-store resolution.
      renderer.setSize(w, h, false);
      // The raymarcher derives its own aspect from this uniform, so it must be
      // told the container size too — main.js passes window dimensions here.
      sim.onResize(w, h);
      if (reduced) draw(); // static path: one frame per size change
    };

    const boot = async () => {
      /* ---- 1 · capability probe — diagnostic only, never a gate ----
         three's WebGPURenderer installs getFallback → WebGLBackend, so
         renderer.init() RESOLVES on WebGL2 when WebGPU is missing and rejects
         only if WebGL2 fails too. Gating here is what used to put a static
         frame on screen in browsers where three would have rendered live — the
         same browsers that run the upstream demo fine. All the probe decides is
         whether we have an adapter to hand over, and what the logs say. */
      const probe = await probeWebGPU();
      if (released) return; // unmounted while the adapter request was in flight
      const probeReason = probe.ok ? 'adapter-acquired' : probe.reason;

      if (!probe.ok) {
        if (probe.reason === 'probe-threw') {
          // navigator.gpu exists and the request itself threw. A real error with
          // a real message, logged as one — but NOT fatal: three still has its
          // WebGL2 backend, and refusing to try it would be the original bug.
          reportError('navigator.gpu.requestAdapter()', probe.error, undefined, false);
        } else {
          console.info(
            `[singularity] WebGPU is unavailable here (reason: ${probe.reason}) — letting three fall back to its WebGL2 backend, as the upstream demo does.`,
            environment({ probeReason }),
          );
        }
      }

      /* ---- 2 · our own adapter → device (see the r185 note at the top) ---- */
      let stage = 'GPUDevice acquisition';
      let stageLabel = 'DEVICE SETUP';
      let backendUsed: BackendKind = 'webgpu';
      try {
        if (probe.ok) {
          device = await acquireDevice(probe.adapter);
          if (released) {
            // Unmounted mid-request; release() destroys the device we just made.
            release();
            return;
          }
        }

        /* ---- 3 · scene, camera, renderer, controls, simulation, init ---- */
        const box = host.getBoundingClientRect();
        const w = Math.max(1, Math.round(box.width));
        const h = Math.max(1, Math.round(box.height));
        if (box.width === 0 || box.height === 0) {
          // Hypothesis worth naming explicitly: a container that has not been
          // laid out yet gives a degenerate size. Clamped to 1×1 above so
          // nothing throws, and the ResizeObserver corrects it — but if the
          // section ever fails this way, this line is the evidence.
          console.warn(
            '[singularity] the stage container had zero size at init — layout had not settled. Rendering at 1×1 until the ResizeObserver fires.',
            environment({ containerBox: { width: box.width, height: box.height } }),
          );
        }

        stage = 'scene and camera construction';
        stageLabel = 'SCENE SETUP';
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
        camera.position.set(0, -5, 20);
        camera.lookAt(0, 0, 0);

        stage = 'WebGPURenderer construction';
        stageLabel = 'RENDERER SETUP';
        renderer = new THREE.WebGPURenderer(
          device ? { antialias: true, device } : { antialias: true },
        );
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
        renderer.setSize(w, h, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        canvas = renderer.domElement;
        canvas.className = 'bh-stage__canvas';
        host.appendChild(canvas); // scoped to the section container, not body

        /* controls: main.js values, minus the two that would fight the page */
        stage = 'OrbitControls setup';
        stageLabel = 'CONTROLS SETUP';
        controls = new OrbitControls(camera, canvas);
        controls.enableDamping = !reduced; // reduced motion: no inertia
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = -0.5;
        controls.minDistance = 5;
        controls.maxDistance = 50;
        // Wheel-zoom would trap page scroll inside a mid-page section, so zoom
        // is off everywhere; the cinematic camera owns the framing.
        controls.enableZoom = false;
        controls.target.set(0, 0, 0);

        if (coarse) {
          // PRODUCT DECISION (touch): drag-to-orbit is disabled outright on
          // touch devices. A thumb landing on the canvas mid-page must scroll
          // the page, never the camera — this is a mobile-first layout, so it
          // is the primary case, not an edge case.
          controls.enabled = false;
          controls.enableRotate = false;
          controls.enablePan = false;
        }

        // OrbitControls.connect() stamps `touch-action: none` on the element,
        // which kills native scrolling even when `enabled` is false. Undo it:
        // vertical pans belong to the page.
        canvas.style.touchAction = 'pan-y';

        /* cinematic camera */
        stage = 'cinematic camera';
        stageLabel = 'CAMERA SETUP';
        camAnim = new CameraAnimation(camera, controls);
        // main.js gates this on config.cinematicMode, which ships `false` in
        // the vendored config — and that file is read-only here. PRODUCT
        // DECISION: the section gets the cinematic flythrough whenever motion
        // is allowed, so the glue starts it itself. prefers-reduced-motion
        // always vetoes it.
        if (!reduced) camAnim.start();

        /* simulation — this is where the TSL raymarch graph is built, so a
           three-version skew throws HERE rather than at import time */
        stage = 'the simulation and its TSL raymarch graph';
        stageLabel = 'SHADER GRAPH';
        sim = new BlackHoleSimulation(scene);
        sim.createBlackHole();
        sim.onResize(w, h);

        /* the async gate: device creation + pipeline compilation */
        stage = 'renderer.init() (WebGPU device and pipeline compile)';
        stageLabel = 'RENDERER INIT';
        await renderer.init();
        initDone = true;

        /* A resolved init() does not mean WebGPU — three may have swapped in
           its WebGL2 backend. Ask the renderer which one is actually running
           rather than assuming; `isWebGPUBackend` is stamped on WebGPUBackend
           itself, and the accessor is cast because it is not on the public
           Backend type. */
        stage = 'backend detection after renderer.init()';
        const liveBackend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } })
          .backend;
        backendUsed = liveBackend?.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
        if (backendUsed === 'webgl2') {
          console.info(
            `[singularity] live on three’s WebGL2 backend (WebGPU reason: ${probeReason}). Same path the upstream demo takes; the section is rendering, not falling back to the still.`,
            environment({ probeReason }),
          );
        }

        if (released) {
          // Unmounted (StrictMode, fast remount, HMR) while init was in flight.
          // The earlier release() ran before the backend existed, so this
          // second pass is the one that frees the now-real device — skipping it
          // is exactly how a duplicate WebGPU context leaks on hot reload.
          release();
          return;
        }

        /* post-processing, wired as main.js wires it (see the RenderPipeline
           note: PostProcessing was renamed in r183 and warns) */
        stage = 'the bloom post-processing graph';
        stageLabel = 'BLOOM SETUP';
        pipeline = new Pipeline(renderer);
        const scenePass = pass(scene, camera);
        const scenePassColor = scenePass.getTextureNode();
        const bloomNode = bloom(scenePassColor);
        bloomNode.threshold.value = config.bloomThreshold;
        bloomNode.strength.value = config.bloomStrength;
        bloomNode.radius.value = config.bloomRadius;
        pipeline.outputNode = scenePassColor.add(bloomNode);
      } catch (error) {
        /* The one and only "unsupported" case left: init() rejected, which
           means three already tried WebGPU AND its WebGL2 backend — and if this
           browser cannot produce a WebGL2 context either, there is genuinely no
           GPU API to render with. Logged at info level with the real rejection
           reason, because on such a browser that outcome is expected rather
           than a defect in our code. */
        const initRejected = stage.startsWith('renderer.init()');
        // three cannot dispose a renderer that never initialised, so whatever
        // its failed backends allocated is ours to release. See loseAnyContext.
        if (initRejected) loseAnyContext(canvas);

        if (initRejected && !hasWebGL2()) {
          console.info(
            '[singularity] neither WebGPU nor WebGL2 is usable in this browser — rendering the static frame.',
            environment({
              probeReason,
              initError: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            }),
          );
          release();
          fail(
            'unsupported',
            'NO WEBGPU OR WEBGL2 IN THIS BROWSER',
            isEmbedded()
              ? 'This page is inside a frame, where WebGPU is gated by Permissions Policy. Open it in its own tab to get the real thing.'
              : undefined,
          );
          return;
        }

        // Anything else is a real failure — WebGL2 exists but three refused it,
        // or the graph/loop broke. The real error, the stage that produced it,
        // and the environment; never a silent "unavailable".
        reportError(stage, error, {
          usedAppLevelDevice: device !== null,
          probeReason,
          containerBox: host.getBoundingClientRect().toJSON(),
        });
        release();
        fail('error', `${stageLabel} FAILED — SEE CONSOLE`);
        return;
      }

      /* ---- 4 · observers ---- */
      resizeObs = new ResizeObserver(measure);
      resizeObs.observe(host);

      viewObs = new IntersectionObserver(
        (entries) => {
          // Pause off-screen: the raymarcher is the most expensive thing on the
          // page and it should cost nothing while the reader is elsewhere.
          if (entries[0]?.isIntersecting) start();
          else stop();
        },
        { rootMargin: VIEW_MARGIN },
      );
      viewObs.observe(host);

      setNote(null);
      setBackend(backendUsed);
      setStatus('live');

      if (reduced) {
        // Reduced motion: no loop at all. One frame, re-drawn by measure() on
        // resize — the same contract Ambience.tsx gives its static path.
        draw();
      } else {
        start();
      }
    };

    void boot();

    return release;
  }, [attempt]);

  const retry = () => {
    setNote(null);
    setBackend(null);
    setStatus('booting');
    setAttempt((a) => a + 1);
  };

  return (
    <div className="bh-stage" data-status={status} data-backend={backend ?? undefined}>
      {/* Poster / fallback. Underneath the canvas; cross-faded out by CSS once
          the stage is live, and left in place if the live path never arrives. */}
      <BlackHoleStill />

      {/* The renderer's canvas is appended in here by the effect above. */}
      <div className="bh-stage__host" ref={hostRef} />

      {note && (
        <div className="bh-stage__note" data-kind={status}>
          <p>{note.label}</p>
          {note.hint && <span className="bh-stage__hint">{note.hint}</span>}
          {status === 'error' && (
            <button type="button" className="bh-stage__retry" onClick={retry}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
