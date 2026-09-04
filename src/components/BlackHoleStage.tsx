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
   for:

     · scoped mounting    — the canvas goes into this component's own container,
                            never document.body
     · scoped sizing      — ResizeObserver on the container's bounding box,
                            never window.innerWidth/innerHeight
     · full teardown      — React StrictMode double-invokes effects, so the
                            async renderer.init() race is handled explicitly
                            (see release() below); no second WebGPU device leaks
     · off-screen pause   — IntersectionObserver stops the rAF loop, so the
                            raymarcher is not burning GPU while the reader is
                            somewhere else on a very long page
     · reduced motion     — no cinematic orbit, no damping, one static frame
     · touch              — no drag-to-orbit, and OrbitControls' `touch-action:
                            none` is undone so the thumb scrolls the page

   Rewriting the orchestration is not rewriting the shader: nothing in
   src/three/blackhole/ is modified to achieve any of this.

   SSR / build safety: every `window`, `document`, `navigator`, renderer and DOM
   write happens inside the effect. Module scope holds only imports and two
   constants, so importing this file outside a browser cannot throw.
   ========================================================================== */

/* TypeScript 5.9's lib.dom.d.ts still ships no WebGPU types, so the probe
   declares the single member it reads. A local intersection cast rather than a
   `declare global` augmentation: nothing to collide with when lib.dom catches
   up, and no ambient state for the rest of the app to trip over. */
type NavigatorWithGPU = Navigator & {
  gpu?: {
    requestAdapter(): Promise<unknown | null>;
  };
};

/** 'booting' — still is up as a poster · 'live' — canvas is rendering ·
    'still' — no WebGPU (or init failed), the static frame is the section. */
type StageStatus = 'booting' | 'live' | 'still';

/* main.js caps at Math.min(devicePixelRatio, 2). Kept identical: the sim should
   read the same here as it does upstream. This is the first knob to turn down
   if low-end mobile GPUs struggle — the raymarcher is 64 steps per pixel. */
const DPR_CAP = 2;

/* Start the loop a little before the stage actually enters the viewport so the
   first visible frame is already warm (pipelines compiled, disk in motion)
   instead of popping in from black. */
const VIEW_MARGIN = '18% 0px';

/* three r183 renamed PostProcessing → RenderPipeline; the old name is still
   exported but is documented as deprecated ("will be removed in a future
   version") and logs a warning on construction. Upstream main.js predates the
   rename, and post-processing is orchestration rather than shader code — none
   of the four vendored files touch it — so the glue uses the current name and
   keeps the old one only as a fallback for a three pinned below r183. */
const Pipeline: typeof THREE.RenderPipeline =
  THREE.RenderPipeline ?? (THREE.PostProcessing as unknown as typeof THREE.RenderPipeline);

/* Feature detection, per the integration brief: this app has no built-in WebGL
   fallback and its own README states it needs Chrome/Edge 113+ with WebGPU.
   `navigator.gpu` existing is necessary but not sufficient — a browser can
   expose the interface and still hand back no adapter (blocklisted driver,
   disabled flag, exhausted GPU process) — so the adapter is requested too. */
async function webgpuAvailable(): Promise<boolean> {
  const nav = navigator as NavigatorWithGPU;
  if (!nav.gpu || typeof nav.gpu.requestAdapter !== 'function') return false;
  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter !== null && adapter !== undefined;
  } catch {
    return false;
  }
}

export default function BlackHoleStage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<StageStatus>('booting');

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

    /* ---- draw / loop (same order of operations as main.js animate()) ---- */
    const draw = () => {
      if (!renderer || !scene || !camera) return;
      // main.js renders through the bloom chain when it exists, else straight
      // to the renderer. Same branch, same order.
      if (pipeline) pipeline.render();
      else renderer.render(scene, camera);
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      // main.js clamps dt to 0.033 so a stalled tab cannot lurch the simulation
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      camAnim?.update(dt);
      controls?.update();
      if (sim && camera) sim.update(dt, camera);
      draw();
    };

    const start = () => {
      if (running || released || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    /* ---- teardown ----------------------------------------------------------------
       Idempotent, and deliberately safe to call BEFORE renderer.init()
       resolves. three's Renderer.dispose() only frees the backend once its
       internal `_initialized` flag is set, so a teardown that lands mid-init
       cannot release the GPU device — which is precisely the React StrictMode
       case (mount → cleanup → mount) and the hot-reload case. boot() therefore
       calls release() a *second* time once init resolves, and that pass is the
       one that actually destroys the device. This is why renderer/canvas are
       not nulled out here. */
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

      // renderer.dispose() → backend.dispose() → destroys the WebGPU device and
      // its canvas context. Guarded on initDone: pre-init it would be a no-op
      // that leaves the device alive once init later completes.
      if (initDone && renderer) {
        try {
          renderer.dispose();
        } catch {
          /* device already gone (tab backgrounded, driver reset) */
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
      if (!(await webgpuAvailable())) {
        setStatus('still');
        return;
      }
      if (released) return; // unmounted while the adapter request was in flight

      const box = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(box.width));
      const h = Math.max(1, Math.round(box.height));

      /* ---- scene + camera (main.js) ---- */
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
      camera.position.set(0, -5, 20);
      camera.lookAt(0, 0, 0);

      /* ---- renderer (main.js, scoped) ---- */
      renderer = new THREE.WebGPURenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
      renderer.setSize(w, h, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      canvas = renderer.domElement;
      canvas.className = 'bh-stage__canvas';
      host.appendChild(canvas); // scoped to the section container, not body

      /* ---- controls (main.js values, minus the two page-fighting ones) ---- */
      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = !reduced; // reduced motion: no inertia/damping
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = -0.5;
      controls.minDistance = 5;
      controls.maxDistance = 50;
      // Wheel-zoom would trap page scroll inside a mid-page section, so zoom is
      // off everywhere; the cinematic camera owns the framing.
      controls.enableZoom = false;
      controls.target.set(0, 0, 0);

      if (coarse) {
        // PRODUCT DECISION (touch): drag-to-orbit is disabled outright on touch
        // devices. A thumb landing on the canvas mid-page must scroll the page,
        // never the camera — this is a mobile-first layout, so it is the
        // primary case, not an edge case. The camera is cinematic-or-static
        // only. Fine pointers keep drag-to-orbit.
        controls.enabled = false;
        controls.enableRotate = false;
        controls.enablePan = false;
      }

      // OrbitControls.connect() stamps `touch-action: none` on the element,
      // which kills native scrolling even when `enabled` is false. Undo it:
      // vertical pans belong to the page.
      canvas.style.touchAction = 'pan-y';

      /* ---- cinematic camera ---- */
      camAnim = new CameraAnimation(camera, controls);
      // main.js gates this on config.cinematicMode, which ships `false` in the
      // vendored config — and that file is read-only here. PRODUCT DECISION:
      // the section gets the cinematic flythrough whenever motion is allowed,
      // so the glue starts it itself. prefers-reduced-motion always vetoes it.
      if (!reduced) camAnim.start();

      /* ---- simulation ---- */
      sim = new BlackHoleSimulation(scene);
      sim.createBlackHole();
      sim.onResize(w, h);

      /* ---- the async gate: WebGPU device creation ---- */
      try {
        await renderer.init();
      } catch (err) {
        console.warn(
          '[singularity] WebGPU renderer failed to initialise — showing the static frame.',
          err,
        );
        release();
        setStatus('still');
        return;
      }
      initDone = true;

      if (released) {
        // Unmounted (StrictMode, fast remount, HMR) while init was in flight.
        // The earlier release() ran before the backend existed, so this second
        // pass is the one that frees the now-real device — skipping it is
        // exactly how a duplicate WebGPU context leaks on hot reload.
        release();
        return;
      }

      /* ---- post-processing (main.js setupBloom(), same config keys) ---- */
      pipeline = new Pipeline(renderer);
      const scenePass = pass(scene, camera);
      const scenePassColor = scenePass.getTextureNode();
      const bloomNode = bloom(scenePassColor);
      bloomNode.threshold.value = config.bloomThreshold;
      bloomNode.strength.value = config.bloomStrength;
      bloomNode.radius.value = config.bloomRadius;
      pipeline.outputNode = scenePassColor.add(bloomNode);

      /* ---- observers ---- */
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
  }, []);

  return (
    <div className="bh-stage" data-status={status}>
      {/* Poster / fallback. Underneath the canvas; cross-faded out by CSS once
          the stage is live, and left in place forever if WebGPU never arrives. */}
      <BlackHoleStill />

      {/* The renderer's canvas is appended in here by the effect above. */}
      <div className="bh-stage__host" ref={hostRef} />

      {status === 'still' && (
        <p className="bh-stage__note">Static frame · WebGPU unavailable</p>
      )}
    </div>
  );
}
