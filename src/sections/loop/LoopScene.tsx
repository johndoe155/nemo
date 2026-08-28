/* ============================================================================
   LoopScene — the WebGL architecture of "One loop. Nothing wasted."

   Replaces the flat 2D orbit with a real spatial system:
     · a volumetric, slowly-rotating refractive core ("THE NEMOVERSE")
     · four structural nodes floating at different Z depths, each drifting on
       its own localised sine wave
     · glowing 3D splines (CatmullRom loop + four spokes) with light particles
       continuously travelling along them — the loop is literally in motion
     · a lerped camera that pushes toward a hovered node while the core is
       thrown out of focus (multi-jittered defocus in the core shader)
     · the cursor is a point light: it unprojects into the scene, illuminates
       the void through an additive light-plane, and snaps magnetically to a
       node once inside its radius

   DOM stays in charge of text: every frame the scene projects the core and
   the four nodes to screen space and hands the coordinates to the parent
   (onFrame), which writes them straight onto refs — zero React re-renders.
   ========================================================================== */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { webglSupported } from '../pulls/webgl';
import {
  AURA_FRAG,
  AURA_VERT,
  CORE_FRAG,
  CORE_VERT,
  DUST_FRAG,
  DUST_VERT,
  LIGHTPLANE_FRAG,
  LIGHTPLANE_VERT,
  NODE_FRAG,
  NODE_VERT,
  SPLINE_FRAG,
  SPLINE_VERT,
  TRAIL_FRAG,
  TRAIL_VERT,
} from './shaders';

export interface LoopItem {
  n: string;
  name: string;
  tag: string;
  body: string;
  target: string;
}

export interface FramePoint {
  /** px, relative to the stage element */
  x: number;
  y: number;
  /** perspective scale, 1 = at the focal plane */
  scale: number;
  /** suggested CSS blur in px (depth of field + defocus) */
  blur: number;
}

export interface FrameData {
  core: FramePoint;
  nodes: FramePoint[];
  /** stage size in CSS px — lets the DOM layer clamp cards to the frame */
  size: { w: number; h: number };
  /** index of the focused node, -1 when none */
  hover: number;
  cursor: { x: number; y: number; snap: number; inside: boolean; label: string };
}

interface Props {
  items: LoopItem[];
  /** the tall scroll track the section is pinned inside */
  trackRef: React.RefObject<HTMLElement | null>;
  /** index of the node the DOM layer currently considers hovered (-1) */
  hoverRef: React.MutableRefObject<number>;
  onFrame?: (f: FrameData) => void;
  /** pointer/tap driven focus changes (the scene owns hover hysteresis) */
  onHoverChange?: (index: number) => void;
  /** DOM overlay rendered inside the stage so 3D→screen space always matches */
  children?: React.ReactNode;
  className?: string;
}

/* --------------------------------- layout -------------------------------- */

const FOV = 42;
/* focused lens — a narrower fov magnifies the node in place instead of
   flinging it across the frame the way a full push-in would */
const FOV_FOCUS = 27;
const TAN_HALF = Math.tan(((FOV * Math.PI) / 180) / 2);

interface Layout {
  xs: number[];
  ys: number[];
  zs: number[];
  fitW: number;
  fitH: number;
  coreR: number;
}

/* Desktop: a wide cinematic ellipse filling the frame.
   Portrait: a tighter ring, taller than wide, core shrunk to breathe. */
function layoutFor(aspect: number): Layout {
  if (aspect < 0.98) {
    return {
      xs: [-2.35, 2.35, 2.35, -2.35],
      ys: [3.0, 2.55, -2.55, -3.0],
      zs: [1.1, -1.3, 1.4, -1.0],
      fitW: 4.1,
      fitH: 5.0,
      coreR: 1.15,
    };
  }
  return {
    xs: [-6.15, 6.15, 6.05, -6.05],
    ys: [2.6, 2.35, -2.55, -2.3],
    zs: [1.5, -1.7, 1.2, -1.4],
    fitW: 7.6,
    fitH: 4.6,
    coreR: 1.7,
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ------------------------- ribbon (live spline tube) ---------------------- */
/* A tube whose centreline is re-sampled from a live curve every frame, so the
   glowing filament keeps connecting nodes that are themselves drifting.     */

class Ribbon {
  readonly mesh: THREE.Mesh;
  private readonly curve: THREE.Curve<THREE.Vector3>;
  private readonly geo: THREE.BufferGeometry;
  private readonly pos: Float32Array;
  private readonly nrm: Float32Array;
  private readonly pts: THREE.Vector3[] = [];
  private readonly samples: number;
  private readonly radial: number;
  private readonly radius: number;
  private readonly tan = new THREE.Vector3();
  private readonly nor = new THREE.Vector3();
  private readonly bin = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly alt = new THREE.Vector3(1, 0, 0);

  constructor(
    curve: THREE.Curve<THREE.Vector3>,
    material: THREE.ShaderMaterial,
    samples: number,
    radial: number,
    radius: number,
  ) {
    this.curve = curve;
    this.samples = samples;
    this.radial = radial;
    this.radius = radius;

    const vertCount = (samples + 1) * (radial + 1);
    this.pos = new Float32Array(vertCount * 3);
    this.nrm = new Float32Array(vertCount * 3);

    const uv = new Float32Array(vertCount * 2);
    const index: number[] = [];
    for (let i = 0; i <= samples; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        uv[k * 2] = i / samples;
        uv[k * 2 + 1] = j / radial;
        if (i < samples && j < radial) {
          const a = k;
          const b = k + radial + 1;
          const c = b + 1;
          const d = k + 1;
          index.push(a, b, d, b, c, d);
        }
      }
    }
    for (let i = 0; i <= samples; i++) this.pts.push(new THREE.Vector3());

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(index);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.update();
  }

  update() {
    const { samples, radial, radius, pts } = this;
    for (let i = 0; i <= samples; i++) this.curve.getPoint(i / samples, pts[i]);

    let k = 0;
    for (let i = 0; i <= samples; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(samples, i + 1)];
      this.tan.subVectors(next, prev);
      if (this.tan.lengthSq() < 1e-8) this.tan.set(0, 0, 1);
      this.tan.normalize();
      const ref = Math.abs(this.tan.y) > 0.92 ? this.alt : this.up;
      this.nor.crossVectors(this.tan, ref).normalize();
      this.bin.crossVectors(this.tan, this.nor).normalize();

      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        const nx = this.nor.x * cx + this.bin.x * sy;
        const ny = this.nor.y * cx + this.bin.y * sy;
        const nz = this.nor.z * cx + this.bin.z * sy;
        this.pos[k * 3] = pts[i].x + nx * radius;
        this.pos[k * 3 + 1] = pts[i].y + ny * radius;
        this.pos[k * 3 + 2] = pts[i].z + nz * radius;
        this.nrm[k * 3] = nx;
        this.nrm[k * 3 + 1] = ny;
        this.nrm[k * 3 + 2] = nz;
        k++;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
  }
}

/* --------------------------------- scene --------------------------------- */

export default function LoopScene({
  items,
  trackRef,
  hoverRef,
  onFrame,
  onHoverChange,
  children,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLSpanElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (!webglSupported()) {
      host.dataset.webgl = 'off';
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.dataset.webgl = 'on';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      host.dataset.webgl = 'off';
      return;
    }
    renderer.setClearAlpha(0);
    /* glow-heavy full-bleed surface: cap harder on big viewports */
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, host.clientWidth > 1200 ? 1.4 : 1.75),
    );

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 140);
    camera.position.set(0, 0, 16);

    const cyan = new THREE.Color('#3fe8ff');
    const magenta = new THREE.Color('#ff3d9a');
    const ice = new THREE.Color('#7fd4ff');

    /* ------------------------------ groups ------------------------------ */
    /* `world` sits slightly below the frame centre so the orbit occupies the
       clear band between the pinned headline and the narrative copy */
    const world = new THREE.Group();
    world.position.y = -0.55;
    scene.add(world);

    const orbitGroup = new THREE.Group();
    world.add(orbitGroup);

    /* ------------------------------- core ------------------------------- */
    let coreR = 1.5;
    const coreGeo = new THREE.SphereGeometry(1, 72, 48);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uBlur: { value: 0 },
        uHover: { value: 0 },
        uCursor: { value: new THREE.Vector3(0, 0, 40) },
        uCursorI: { value: 0 },
        uCyan: { value: cyan },
        uMagenta: { value: magenta },
      },
      transparent: true,
      depthWrite: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.renderOrder = 3;
    world.add(core);

    /* aura shells — the pulsing emissive bloom around the body */
    const auraGeo = new THREE.PlaneGeometry(1, 1);
    const makeAura = (scale: number, power: number, tint: THREE.Color) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: AURA_VERT,
        fragmentShader: AURA_FRAG,
        uniforms: {
          /* cloned: the aura lerps its own colour toward magenta on focus and
             must never write through to the shared palette instance */
          uColor: { value: tint.clone() },
          uIntensity: { value: 0.3 },
          uPower: { value: power },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(auraGeo, mat);
      mesh.scale.setScalar(scale);
      mesh.renderOrder = 4;
      mesh.userData.scaleBase = scale;
      world.add(mesh);
      return mesh;
    };
    const auraOuter = makeAura(9.5, 2.6, cyan);
    const auraInner = makeAura(5.2, 3.4, ice);

    /* ------------------------------- nodes ------------------------------ */
    const nodeGeo = new THREE.OctahedronGeometry(0.5, 0);
    nodeGeo.computeVertexNormals();
    const ringGeo = new THREE.RingGeometry(0.78, 0.82, 64);

    interface NodeUnit {
      group: THREE.Group;
      crystal: THREE.Mesh;
      glow: THREE.Mesh;
      ring: THREE.Mesh;
      mat: THREE.ShaderMaterial;
      glowMat: THREE.ShaderMaterial;
      ringMat: THREE.MeshBasicMaterial;
      base: THREE.Vector3;
      phase: number;
      hover: number;
    }
    const nodes: NodeUnit[] = [];
    const glowGeo = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < items.length; i++) {
      const group = new THREE.Group();
      orbitGroup.add(group);

      const mat = new THREE.ShaderMaterial({
        vertexShader: NODE_VERT,
        fragmentShader: NODE_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uDim: { value: 1 },
          uCursorI: { value: 0 },
          uCursor: { value: new THREE.Vector3(0, 0, 40) },
          uCyan: { value: cyan },
          uMagenta: { value: magenta },
        },
      });
      const crystal = new THREE.Mesh(nodeGeo, mat);
      crystal.scale.set(1, 1.28, 1);
      group.add(crystal);

      const glowMat = new THREE.ShaderMaterial({
        vertexShader: AURA_VERT,
        fragmentShader: AURA_FRAG,
        uniforms: {
          uColor: { value: cyan.clone() },
          uIntensity: { value: 0.55 },
          uPower: { value: 3.2 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.scale.setScalar(2.6);
      glow.renderOrder = 5;
      group.add(glow);

      const ringMat = new THREE.MeshBasicMaterial({
        color: magenta.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.renderOrder = 6;
      group.add(ring);

      nodes.push({
        group,
        crystal,
        glow,
        ring,
        mat,
        glowMat,
        ringMat,
        base: new THREE.Vector3(),
        phase: i * 1.9 + 0.4,
        hover: 0,
      });
    }

    /* ------------------------------ splines ----------------------------- */
    const splineMat = new THREE.ShaderMaterial({
      vertexShader: SPLINE_VERT,
      fragmentShader: SPLINE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uActive: { value: 0 },
        uDim: { value: 1 },
        uCyan: { value: cyan },
        uMagenta: { value: magenta },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* the closed loop: node → node → node → node → back to the first */
    const loopPoints = nodes.map(() => new THREE.Vector3());
    const loopCurve = new THREE.CatmullRomCurve3(loopPoints, true, 'catmullrom', 0.5);
    const loopRibbon = new Ribbon(loopCurve, splineMat, 108, 5, 0.028);
    loopRibbon.mesh.renderOrder = 3;
    orbitGroup.add(loopRibbon.mesh);

    /* spokes: core → each node, bowed outward so they read as orbits */
    interface Spoke {
      curve: THREE.QuadraticBezierCurve3;
      ribbon: Ribbon;
    }
    const spokes: Spoke[] = nodes.map(() => {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      );
      const mat = splineMat.clone();
      const ribbon = new Ribbon(curve, mat, 46, 5, 0.02);
      ribbon.mesh.renderOrder = 3;
      orbitGroup.add(ribbon.mesh);
      return { curve, ribbon };
    });

    /* ------------------------------ trails ------------------------------ */
    interface Trail {
      curve: THREE.Curve<THREE.Vector3>;
      count: number;
      start: number;
      speed: number;
      nodeIndex: number; // -1 = the loop itself
    }
    const trailDefs: Trail[] = [
      { curve: loopCurve, count: 118, start: 0, speed: 0.055, nodeIndex: -1 },
      ...nodes.map((_, i) => ({
        curve: spokes[i].curve as THREE.Curve<THREE.Vector3>,
        count: 26,
        start: i * 0.31,
        speed: 0.11 + i * 0.012,
        nodeIndex: i,
      })),
    ];
    const trailTotal = trailDefs.reduce((a, t) => a + t.count, 0);
    const trailPos = new Float32Array(trailTotal * 3);
    const trailSeed = new Float32Array(trailTotal);
    const trailActive = new Float32Array(trailTotal);
    const trailOffset = new Float32Array(trailTotal);
    const trailCurve = new Int32Array(trailTotal);
    let p = 0;
    trailDefs.forEach((t, ti) => {
      for (let i = 0; i < t.count; i++) {
        trailSeed[p] = Math.random();
        trailOffset[p] = (i / t.count + t.start) % 1;
        trailActive[p] = t.nodeIndex === -1 ? 0.35 : 0.15;
        trailCurve[p] = ti;
        p++;
      }
    });
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('aSeed', new THREE.BufferAttribute(trailSeed, 1));
    trailGeo.setAttribute('aActive', new THREE.BufferAttribute(trailActive, 1));
    trailGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: {
        uPx: { value: 800 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uCyan: { value: cyan },
        uMagenta: { value: magenta },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trails = new THREE.Points(trailGeo, trailMat);
    trails.frustumCulled = false;
    trails.renderOrder = 3;
    orbitGroup.add(trails);

    /* ------------------------------- dust ------------------------------- */
    const dustCount = 460;
    const dustPos = new Float32Array(dustCount * 3);
    const dustSeed = new Float32Array(dustCount);
    const dustSize = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 26;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      dustPos[i * 3 + 2] = -9 + Math.random() * 13;
      dustSeed[i] = Math.random();
      dustSize[i] = 0.018 + Math.random() * 0.05;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1));
    const dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: 800 },
        uCursor: { value: new THREE.Vector3(0, 0, 40) },
        uCursorI: { value: 0 },
        uOpacity: { value: 0.9 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 1;
    scene.add(dust);

    /* --------------------- cursor light (the void glow) ------------------ */
    const lightMat = new THREE.ShaderMaterial({
      vertexShader: LIGHTPLANE_VERT,
      fragmentShader: LIGHTPLANE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPoint: { value: new THREE.Vector2(0.5, 0.5) },
        uIntensity: { value: 0 },
        uAspect: { value: 1 },
        uColor: { value: new THREE.Color('#8fd8ff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lightPlane = new THREE.Mesh(auraGeo, lightMat);
    lightPlane.position.z = -7;
    lightPlane.renderOrder = 0;
    scene.add(lightPlane);

    /* ------------------------------- sizing ------------------------------ */
    const stageSize = { w: host.clientWidth || 1, h: host.clientHeight || 1 };
    let width = host.clientWidth || 1;
    let height = host.clientHeight || 1;
    let layout = layoutFor(width / Math.max(1, height));
    let camZ = 16;

    const applyLayout = () => {
      layout = layoutFor(width / Math.max(1, height));
      coreR = layout.coreR;
      core.scale.setScalar(coreR);
      nodes.forEach((n, i) => {
        n.base.set(layout.xs[i % 4], layout.ys[i % 4], layout.zs[i % 4]);
        n.group.position.copy(n.base);
        const s = layout.coreR < 1.3 ? 0.82 : 1;
        n.crystal.scale.set(s, s * 1.28, s);
        n.glow.scale.setScalar(2.6 * s);
      });
      const aspect = width / Math.max(1, height);
      /* the closest node sits this far in front of the focal plane, which
         magnifies it — the camera has to give that much extra room or the
         near nodes blow past the frame edge */
      const nearZ = layout.zs.reduce((a, z) => Math.max(a, z), 0) + 0.45;
      const zW = layout.fitW / (TAN_HALF * aspect) + nearZ;
      const zH = layout.fitH / TAN_HALF + nearZ;
      camZ = Math.max(zW, zH, 9);
      const lh = 2 * TAN_HALF * (camZ + 7) * 1.35;
      lightPlane.scale.set(lh * (width / Math.max(1, height)), lh, 1);
      lightMat.uniforms.uAspect.value = width / Math.max(1, height);
    };

    const resize = () => {
      width = host.clientWidth || 1;
      height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      stageSize.w = width;
      stageSize.h = height;
      const px = renderer.getPixelRatio();
      trailMat.uniforms.uPx.value = ((height * px) / 2) / TAN_HALF;
      dustMat.uniforms.uPx.value = ((height * px) / 2) / TAN_HALF;
      applyLayout();
    };
    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(host);

    /* ------------------------------ pointer ------------------------------ */
    const pointer = { x: -9999, y: -9999, inside: false };
    const cursorSmooth = { x: -9999, y: -9999 };
    const ndc = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    const focusPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const cursorWorld = new THREE.Vector3(0, 0, 20);
    const cursorLight = new THREE.Vector3(0, 0, 20);
    let snap = 0;
    let cursorI = 0;

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.inside = true;
      ndc.set((pointer.x / r.width) * 2 - 1, -(pointer.y / r.height) * 2 + 1);
      lightMat.uniforms.uPoint.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    };
    const onDown = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.inside = true;
    };
    const onLeave = () => {
      pointer.inside = false;
      snap = 0;
      if (hoverRef.current !== -1) {
        if (onHoverChange) onHoverChange(-1);
        else hoverRef.current = -1;
      }
    };
    if (!reduce) {
      /* pointermove drives both the focus physics and the light; the magnetic
         cursor DOM is hidden by CSS on coarse pointers */
      host.addEventListener('pointermove', onMove, { passive: true });
      /* touch: the down position seeds the focus search */
      host.addEventListener('pointerdown', onDown, { passive: true });
      host.addEventListener('pointerleave', onLeave);
      host.addEventListener('pointercancel', onLeave);
    }

    /* ------------------------------- frame ------------------------------- */
    const frame: FrameData = {
      core: { x: 0, y: 0, scale: 1, blur: 0 },
      size: stageSize,
      nodes: nodes.map(() => ({ x: 0, y: 0, scale: 1, blur: 0 })),
      hover: -1,
      cursor: { x: -9999, y: -9999, snap: 0, inside: false, label: '' },
    };
    const worldTmp = new THREE.Vector3();
    const projTmp = new THREE.Vector3();
    const camTarget = new THREE.Vector3(0, 0, 0);
    const camDesired = new THREE.Vector3(0, 0, camZ);
    const lookAt = new THREE.Vector3(0, 0, 0);
    const nodeScreen: { x: number; y: number; z: number; r: number }[] = nodes.map(() => ({
      x: 0,
      y: 0,
      z: 0,
      r: 60,
    }));

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let lastScroll = window.scrollY;
    let energy = 0;
    let progress = 0;
    let hoverRamp = 0;
    let lastHover = -1;
    let visible = true;

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting;
              if (visible && !reduce && !raf) {
                last = performance.now();
                raf = requestAnimationFrame(tick);
              }
            },
            { rootMargin: '120px' },
          )
        : null;
    io?.observe(host);

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!visible) return;

      time += dt;

      /* ---- scroll energy drives the core's pulse ---- */
      const y = window.scrollY;
      const vel = Math.abs(y - lastScroll);
      lastScroll = y;
      energy = clamp(energy * 0.9 + Math.min(1, vel * 0.035), 0, 1);

      /* ---- pinned progress (for the slow dolly-in) ---- */
      const track = trackRef.current;
      if (track) {
        const rect = track.getBoundingClientRect();
        const span = Math.max(1, rect.height - window.innerHeight * 0.9);
        progress = clamp(-rect.top / span, 0, 1);
      }

      /* ---- node drift: independent localised sine waves ---- */
      nodes.forEach((n, i) => {
        const ph = n.phase;
        n.group.position.set(
          n.base.x + Math.sin(time * 0.29 + ph) * 0.26,
          n.base.y + Math.sin(time * 0.23 + ph * 1.7) * 0.34,
          n.base.z + Math.sin(time * 0.17 + ph * 2.3) * 0.35,
        );
        n.crystal.rotation.set(time * 0.16 + ph, time * 0.21 + ph * 0.5, Math.sin(time * 0.2 + ph) * 0.2);
        n.group.getWorldPosition(worldTmp);
        nodeScreen[i].z = worldTmp.z;
      });

      /* ---- focus: proximity-to-node with hysteresis --------------------
         The camera pushes in when a node takes focus, which moves that node
         across the screen. Without hysteresis the pointer would drop out of
         the hit radius mid-transition and the whole thing would oscillate:
         the focus radius grows once a node is held, so the stay put. */
      if (!reduce && pointer.inside) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < nodeScreen.length; i++) {
          const d = Math.hypot(pointer.x - nodeScreen[i].x, pointer.y - nodeScreen[i].y);
          const reach = hoverRef.current === i ? 210 : 140;
          if (d < reach && d < bestD) {
            bestD = d;
            best = i;
          }
        }
        /* the parent owns hoverRef — it writes it synchronously inside the
           callback, and this frame reads the updated value straight after */
        if (best !== hoverRef.current) onHoverChange?.(best);
      }

      /* ---- hover state ---- */
      const hoverIdx = hoverRef.current;
      frame.hover = hoverIdx;
      nodes.forEach((n, i) => {
        const want = i === hoverIdx ? 1 : 0;
        n.hover += (want - n.hover) * (1 - Math.exp(-dt * 7));
        n.mat.uniforms.uHover.value = n.hover;
        const others = hoverIdx >= 0 && i !== hoverIdx ? 1 : 0;
        const dimWant = 1 - others * 0.62;
        const cur = n.mat.uniforms.uDim.value as number;
        n.mat.uniforms.uDim.value = cur + (dimWant - cur) * (1 - Math.exp(-dt * 6));
        const gs = nodes[i].crystal.scale.y / 1.28;
        n.glowMat.uniforms.uIntensity.value = 0.35 + n.hover * 0.9 + energy * 0.25;
        n.glowMat.uniforms.uColor.value.lerpColors(cyan, magenta, n.hover);
        n.glow.scale.setScalar(2.6 * gs * (1 + n.hover * 0.55 + energy * 0.12));
        n.ringMat.opacity = n.hover * 0.85;
        n.ring.scale.setScalar(0.85 + n.hover * 0.5);
        n.ring.quaternion.copy(camera.quaternion);
        n.glow.quaternion.copy(camera.quaternion);
      });
      hoverRamp += ((hoverIdx >= 0 ? 1 : 0) - hoverRamp) * (1 - Math.exp(-dt * 4.5));

      if (hoverIdx !== lastHover) {
        lastHover = hoverIdx;
        for (let i = 0; i < trailTotal; i++) {
          const def = trailDefs[trailCurve[i]];
          trailActive[i] = def.nodeIndex === -1 ? (hoverIdx >= 0 ? 0.85 : 0.35) : def.nodeIndex === hoverIdx ? 1 : 0.12;
        }
        trailGeo.attributes.aActive.needsUpdate = true;
      }

      /* ---- splines follow the drifting nodes ---- */
      nodes.forEach((n, i) => loopPoints[i].copy(n.group.position));
      loopRibbon.update();
      spokes.forEach((s, i) => {
        const target = nodes[i].group.position;
        s.curve.v0.set(0, 0, 0);
        s.curve.v2.copy(target);
        s.curve.v1
          .copy(target)
          .multiplyScalar(0.5)
          .add(
            worldTmp
              .set(-target.y, target.x, target.z * 0.6)
              .normalize()
              .multiplyScalar(0.85 + Math.sin(time * 0.4 + i) * 0.15),
          );
        s.ribbon.update();
        const mat = s.ribbon.mesh.material as THREE.ShaderMaterial;
        const want = i === hoverIdx ? 1 : 0;
        mat.uniforms.uActive.value += (want - (mat.uniforms.uActive.value as number)) * (1 - Math.exp(-dt * 6));
        const dimWant = hoverIdx >= 0 && i !== hoverIdx ? 0.45 : 1;
        mat.uniforms.uDim.value += (dimWant - (mat.uniforms.uDim.value as number)) * (1 - Math.exp(-dt * 6));
      });
      const loopMat = loopRibbon.mesh.material as THREE.ShaderMaterial;
      loopMat.uniforms.uActive.value +=
        ((hoverIdx >= 0 ? 0.6 : 0.18) - (loopMat.uniforms.uActive.value as number)) * (1 - Math.exp(-dt * 5));
      loopMat.uniforms.uDim.value +=
        ((hoverIdx >= 0 ? 0.5 : 1) - (loopMat.uniforms.uDim.value as number)) * (1 - Math.exp(-dt * 5));

      /* ---- trails: light travelling the splines ---- */
      for (let i = 0; i < trailTotal; i++) {
        const def = trailDefs[trailCurve[i]];
        const t = (trailOffset[i] + time * def.speed) % 1;
        def.curve.getPoint(t, projTmp);
        trailPos[i * 3] = projTmp.x;
        trailPos[i * 3 + 1] = projTmp.y;
        trailPos[i * 3 + 2] = projTmp.z;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailMat.uniforms.uTime.value = time;

      /* ---- cursor → point light + magnetic snap ---- */
      if (!reduce) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < nodeScreen.length; i++) {
          const d = Math.hypot(pointer.x - nodeScreen[i].x, pointer.y - nodeScreen[i].y);
          if (d < nodeScreen[i].r && d < bestD) {
            bestD = d;
            best = i;
          }
        }
        const targetSnap = best >= 0 ? 1 - clamp(bestD / nodeScreen[best].r, 0, 1) : 0;
        snap += (targetSnap - snap) * (1 - Math.exp(-dt * 9));

        let cx = pointer.x;
        let cy = pointer.y;
        if (best >= 0) {
          const k = snap * 0.92;
          cx += (nodeScreen[best].x - pointer.x) * k;
          cy += (nodeScreen[best].y - pointer.y) * k;
        }
        if (cursorSmooth.x < -5000) {
          cursorSmooth.x = cx;
          cursorSmooth.y = cy;
        }
        cursorSmooth.x += (cx - cursorSmooth.x) * (1 - Math.exp(-dt * 22));
        cursorSmooth.y += (cy - cursorSmooth.y) * (1 - Math.exp(-dt * 22));

        const inside = pointer.inside;
        cursorI += ((inside ? 1 : 0) - cursorI) * (1 - Math.exp(-dt * 6));

        ndc.set(
          (Math.max(0, Math.min(width, cx)) / width) * 2 - 1,
          -((Math.max(0, Math.min(height, cy)) / height) * 2 - 1),
        );
        focusPlane.constant = -(hoverIdx >= 0 ? nodeScreen[hoverIdx].z : 0);
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(focusPlane, cursorWorld)) {
          cursorLight.lerp(cursorWorld, 1 - Math.exp(-dt * 14));
        }
        lightMat.uniforms.uIntensity.value =
          cursorI * (0.32 + 0.5 * snap) * (1 - hoverRamp * 0.45);
        lightMat.uniforms.uTime.value = time;
      } else {
        cursorI = 0;
        lightMat.uniforms.uIntensity.value = 0;
      }

      /* ---- camera: lerped zoom on focus ----
         A physical push-in drags the focused node across the frame and out
         from under the cursor. Instead the lens zooms: the fov narrows (the
         node expands) while the aim follows ~40% of the way toward it, which
         cancels the magnification — so the node grows where it stands and the
         pointer never loses it. A short dolly keeps the move feeling physical. */
      const parallaxX = pointer.inside ? (pointer.x / width - 0.5) : 0;
      const parallaxY = pointer.inside ? (pointer.y / height - 0.5) : 0;
      const baseX = parallaxX * 0.7;
      const baseY = -parallaxY * 0.5;
      const baseZ = camZ - progress * 0.7;
      camDesired.set(baseX, baseY, baseZ);
      camTarget.set(0, world.position.y * 0.55, 0);

      if (hoverIdx >= 0) {
        nodes[hoverIdx].group.getWorldPosition(worldTmp);
        const dolly = 0.08;
        camDesired.set(
          baseX + (worldTmp.x - baseX) * dolly,
          baseY + (worldTmp.y - baseY) * dolly,
          baseZ + (worldTmp.z - baseZ) * dolly,
        );
        const aim = 0.4;
        camTarget.set(worldTmp.x * aim, worldTmp.y * aim, worldTmp.z * aim);
      }

      const camK = 1 - Math.exp(-dt * 3.1);
      camera.position.lerp(camDesired, camK);
      lookAt.lerp(camTarget, 1 - Math.exp(-dt * 3.6));
      const tilt = Math.sin(time * 0.13) * 0.05;
      camera.lookAt(lookAt.x + tilt, lookAt.y, lookAt.z);

      const fovWant = FOV + (FOV_FOCUS - FOV) * hoverRamp;
      if (Math.abs(camera.fov - fovWant) > 0.002) {
        camera.fov = fovWant;
        camera.updateProjectionMatrix();
        /* point sprites are sized in world units — keep them in step */
        const px = renderer.getPixelRatio();
        const tanNow = Math.tan((((camera.fov * Math.PI) / 180) / 2));
        trailMat.uniforms.uPx.value = ((height * px) / 2) / tanNow;
        dustMat.uniforms.uPx.value = ((height * px) / 2) / tanNow;
      }

      orbitGroup.rotation.y = parallaxX * 0.07 + progress * 0.085;
      orbitGroup.rotation.x = parallaxY * 0.05;

      /* ---- core ---- */
      core.rotation.y += dt * 0.075;
      core.rotation.x = Math.sin(time * 0.11) * 0.12;
      const pulse = clamp(0.28 + 0.3 * Math.sin(time * 0.85) + energy * 0.75, 0, 1.25);
      coreMat.uniforms.uTime.value = time;
      coreMat.uniforms.uPulse.value = pulse;
      coreMat.uniforms.uBlur.value = hoverRamp * 1.0;
      coreMat.uniforms.uHover.value = hoverRamp;
      (coreMat.uniforms.uCursor.value as THREE.Vector3).copy(cursorLight);
      coreMat.uniforms.uCursorI.value = cursorI;

      const auraPulse = 0.22 + pulse * 0.3 + energy * 0.35;
      [auraOuter, auraInner].forEach((a, i) => {
        const base = a.userData.scaleBase as number;
        a.scale.setScalar(coreR * base * (1 + pulse * 0.06 + energy * 0.05 + (i === 1 ? hoverRamp * 0.1 : 0)));
        a.quaternion.copy(camera.quaternion);
        const m = a.material as THREE.ShaderMaterial;
        m.uniforms.uIntensity.value = (i === 0 ? auraPulse * 0.55 : auraPulse) * (1 - hoverRamp * 0.35);
        (m.uniforms.uColor.value as THREE.Color).lerpColors(cyan, magenta, hoverRamp * 0.75);
      });

      /* ---- dust + shared light uniforms ---- */
      dust.rotation.y += dt * 0.012;
      dustMat.uniforms.uTime.value = time;
      (dustMat.uniforms.uCursor.value as THREE.Vector3).copy(cursorLight);
      dustMat.uniforms.uCursorI.value = cursorI;
      lightPlane.quaternion.copy(camera.quaternion);

      nodes.forEach((n) => {
        (n.mat.uniforms.uCursor.value as THREE.Vector3).copy(cursorLight);
        n.mat.uniforms.uCursorI.value = cursorI;
        n.mat.uniforms.uTime.value = time;
      });

      /* ---- project to screen space for the DOM layer ---- */
      const baseDist = camera.position.length();
      nodes.forEach((n, i) => {
        n.group.getWorldPosition(projTmp);
        const z = projTmp.z;
        projTmp.project(camera);
        const sx = (projTmp.x * 0.5 + 0.5) * width;
        const sy = (-projTmp.y * 0.5 + 0.5) * height;
        nodeScreen[i].x = sx;
        nodeScreen[i].y = sy;
        const dist = Math.max(0.5, camera.position.distanceTo(n.group.getWorldPosition(worldTmp)));
        const scale = baseDist / dist;
        nodeScreen[i].r = Math.max(84, 104 * scale * (width < 700 ? 0.8 : 1));
        const f = frame.nodes[i];
        f.x = sx;
        f.y = sy;
        f.scale = scale;
        f.blur = clamp((Math.abs(z - (hoverIdx >= 0 ? nodeScreen[hoverIdx].z : 0)) - 1.1) * 0.5, 0, 3.4);
      });

      core.getWorldPosition(projTmp);
      projTmp.project(camera);
      frame.core.x = (projTmp.x * 0.5 + 0.5) * width;
      frame.core.y = (-projTmp.y * 0.5 + 0.5) * height;
      frame.core.scale = (baseDist / Math.max(0.5, camera.position.length())) * (1 + pulse * 0.04);
      frame.core.blur = hoverRamp * 11;

      frame.cursor.x = cursorSmooth.x;
      frame.cursor.y = cursorSmooth.y;
      frame.cursor.snap = snap;
      frame.cursor.inside = pointer.inside && cursorI > 0.01;
      frame.cursor.label = hoverIdx >= 0 ? `${items[hoverIdx].n} · ${items[hoverIdx].name}` : '';
      onFrame?.(frame);

      /* ---- custom cursor DOM ---- */
      const el = cursorRef.current;
      if (el) {
        el.style.transform = `translate3d(${cursorSmooth.x}px, ${cursorSmooth.y}px, 0)`;
        el.style.opacity = frame.cursor.inside ? '1' : '0';
        el.dataset.snap = snap > 0.25 ? 'true' : 'false';
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(-50%, -50%) scale(${1 + snap * 1.5})`;
      }
      if (labelRef.current) {
        const txt = snap > 0.4 && hoverIdx >= 0 ? frame.cursor.label : '';
        if (labelRef.current.textContent !== txt) labelRef.current.textContent = txt;
      }

      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf || reduce) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    if (reduce) {
      /* single static frame: composition without motion */
      time = 1.2;
      nodes.forEach((n, i) => n.group.position.set(layout.xs[i % 4], layout.ys[i % 4], layout.zs[i % 4]));
      nodes.forEach((n, i) => loopPoints[i].copy(n.group.position));
      loopRibbon.update();
      spokes.forEach((s, i) => {
        const target = nodes[i].group.position;
        s.curve.v0.set(0, 0, 0);
        s.curve.v2.copy(target);
        s.curve.v1.copy(target).multiplyScalar(0.5);
        s.ribbon.update();
      });
      for (let i = 0; i < trailTotal; i++) {
        const def = trailDefs[trailCurve[i]];
        def.curve.getPoint(trailOffset[i], projTmp);
        trailPos[i * 3] = projTmp.x;
        trailPos[i * 3 + 1] = projTmp.y;
        trailPos[i * 3 + 2] = projTmp.z;
      }
      trailGeo.attributes.position.needsUpdate = true;
      coreMat.uniforms.uPulse.value = 0.3;
      camera.position.set(0, 0, camZ);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      // project once so the DOM labels land correctly
      const baseDist = camera.position.length();
      nodes.forEach((n, i) => {
        n.group.getWorldPosition(projTmp);
        projTmp.project(camera);
        frame.nodes[i].x = (projTmp.x * 0.5 + 0.5) * width;
        frame.nodes[i].y = (-projTmp.y * 0.5 + 0.5) * height;
        frame.nodes[i].scale = baseDist / Math.max(0.5, camera.position.distanceTo(n.group.getWorldPosition(worldTmp)));
        frame.nodes[i].blur = 0;
        nodeScreen[i].x = frame.nodes[i].x;
        nodeScreen[i].y = frame.nodes[i].y;
        nodeScreen[i].r = 60;
      });
      frame.core.x = width / 2;
      frame.core.y = height / 2;
      frame.core.scale = 1;
      frame.core.blur = 0;
      onFrame?.(frame);
    } else {
      start();
    }

    const onVisibility = () => (document.hidden ? stop() : visible && start());
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointercancel', onLeave);
      // dispose
      coreGeo.dispose();
      coreMat.dispose();
      auraGeo.dispose();
      (auraOuter.material as THREE.Material).dispose();
      (auraInner.material as THREE.Material).dispose();
      nodeGeo.dispose();
      ringGeo.dispose();
      nodes.forEach((n) => {
        n.mat.dispose();
        n.glowMat.dispose();
        n.ringMat.dispose();
      });
      glowGeo.dispose();
      loopRibbon.dispose();
      splineMat.dispose();
      spokes.forEach((s) => {
        s.ribbon.dispose();
        (s.ribbon.mesh.material as THREE.Material).dispose();
      });
      trailGeo.dispose();
      trailMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      lightMat.dispose();
      renderer.dispose();
    };
  }, [items, trackRef, hoverRef, onFrame, onHoverChange]);

  return (
    <div className={`loop__stage${className ? ` ${className}` : ''}`} ref={hostRef}>
      <canvas className="loop__canvas" ref={canvasRef} aria-hidden="true" />
      <div className="loop__cursor" ref={cursorRef} aria-hidden="true">
        <span className="loop__cursor-ring" ref={ringRef} />
        <span className="loop__cursor-dot" />
        <span className="loop__cursor-label" ref={labelRef} />
      </div>
      {children}
    </div>
  );
}
