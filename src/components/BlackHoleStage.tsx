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
   "WebGPU unavailable" is a claim about the browser, and it is only allowed to
   be made when the browser actually says so. Exactly two conditions may render
   the static frame as *unsupported*:

     · `navigator.gpu` is absent          → reason 'no-navigator-gpu'
     · `requestAdapter()` resolves null   → reason 'adapter-null'

   EVERYTHING else — a rejected requestAdapter(), a thrown renderer.init(), a
   TSL graph that fails to build, a per-frame render exception — is a real error
   with a real message, and it is reported as one: console.error with the
   message, the stack and an environment dump, an honest on-screen label that
   names the stage that failed, and a Retry control. Those paths are NOT
   "unsupported", and labelling them that way is how a version-skew bug ends up
   disguised as a missing browser feature.

   THE r185 ADAPTER REGRESSION (why the glue requests the device itself)
   three r181 — the version the donor demo runs — asked for an adapter like
   this:

       featureLevel: parameters.compatibilityMode ? 'compatibility' : undefined

   three r185, which this project ships, hardcodes it:

       featureLevel: 'compatibility'          // unconditional
       xrCompatible: renderer.xr.enabled

   Per the WebGPU spec a compatibility-level request resolves to null wherever
   the user agent cannot provide a compatibility-mode adapter, and three then
   throws "THREE.WebGPUBackend: Unable to create WebGPU adapter." So the same
   browser and GPU that run the donor demo live can fail here, and the failure
   lands in the renderer-init path rather than in capability detection. r185
   also documents `parameters.device` ("if there is an existing GPU device on
   app level, it can be passed to the renderer"), so the glue acquires the
   adapter and device itself with a plain core-level request — precisely what
   r181 asked for — and hands the device over, which makes three skip its own
   request entirely. Consequence to remember: three only destroys a device it
   created itself (`if (parameters.device === undefined) device.destroy()`), so
   release() below must destroy ours.

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
function reportError(stage: string, error: unknown, extra?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    `[singularity] the black hole failed during ${stage}. This is NOT a "WebGPU unsupported" case — the real error follows.\n` +
      `  message: ${message}\n` +
      `  stack: ${stack ?? '(none)'}\n` +
      `  environment: ${JSON.stringify(environment(extra), null, 2)}`,
    error,
  );
}

/* --------------------------------------------------------------------------
   Capability probe. Note what is deliberately NOT here: no featureLevel, no
   powerPreference — a plain core-level request, matching three r181 and the
   donor demo. `navigator.gpu` existing is necessary but not sufficient (a
   browser can expose it and still hand back no adapter), so the adapter is
   requested too — and kept, because it is used to build the device below
   instead of being thrown away and re-requested by three.
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
      // textures and the canvas context. Guarded on initDone because pre-init
      // it is a no-op that would leave the device alive once init completes.
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
      /* ---- 1 · capability probe: the ONLY place "unsupported" may be claimed ---- */
      const probe = await probeWebGPU();
      if (released) return; // unmounted while the adapter request was in flight

      if (!probe.ok) {
        if (probe.reason === 'probe-threw') {
          // navigator.gpu exists and the request itself threw. That is a real
          // error with a real message — not a missing browser feature.
          reportError('navigator.gpu.requestAdapter()', probe.error);
          fail('error', 'ADAPTER REQUEST THREW — SEE CONSOLE');
          return;
        }

        const embedded = isEmbedded();
        console.info(
          `[singularity] WebGPU is genuinely unavailable (reason: ${probe.reason}) — rendering the static frame.`,
          environment(),
        );
        if (probe.reason === 'no-navigator-gpu' && embedded) {
          // The single most misdiagnosed case: WebGPU is gated by Permissions
          // Policy, so a cross-origin embed has no navigator.gpu at all even
          // though the browser supports it. Say so instead of blaming the
          // browser.
          fail(
            'unsupported',
            'WEBGPU IS BLOCKED IN THIS EMBEDDED FRAME',
            'Open this page in its own tab — the browser supports WebGPU, the frame is not allowed to use it.',
          );
        } else if (probe.reason === 'no-navigator-gpu') {
          fail('unsupported', 'NO WEBGPU IN THIS BROWSER');
        } else {
          fail('unsupported', 'NO WEBGPU ADAPTER AVAILABLE');
        }
        return;
      }

      /* ---- 2 · our own adapter → device (see the r185 note at the top) ---- */
      let stage = 'GPUDevice acquisition';
      let stageLabel = 'DEVICE SETUP';
      try {
        device = await acquireDevice(probe.adapter);
        if (released) {
          // Unmounted mid-request; release() destroys the device we just made.
          release();
          return;
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
        // The real error, the stage that produced it, and the environment —
        // never a silent "unavailable".
        reportError(stage, error, {
          usedAppLevelDevice: device !== null,
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
    setStatus('booting');
    setAttempt((a) => a + 1);
  };

  return (
    <div className="bh-stage" data-status={status}>
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
