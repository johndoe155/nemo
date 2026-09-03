/**
 * Three.js driver for the Shadertoy multipass shader. Renders a full-screen
 * quad five times per frame: Buffer A (raymarch) -> B (mipmap bloom) ->
 * C (H blur) -> D (V blur) -> Image (composite + tonemap).
 *
 * Uniform contract (shared objects, one write updates all passes):
 *   uTime -> iTime · uResolution -> iResolution · uMouse -> iMouse
 *   uCamera = (yaw, pitch, radius) orbit state (drag deltas integrated here)
 *   uEntrance = one-time entrance ramp · uFeedbackReset = skip one temporal
 *   blend after a render-target realloc (feedback is black then).
 *
 * Mobile policy (lib/device.ts, lib/renderScale.ts): drawing buffer is
 * `dpr * renderScale` — renderScale capped on touch devices, always 1.0 on
 * desktop; MOBILE_QUALITY lowers raymarch iterations. Desktop is never capped.
 */

import * as THREE from 'three'
import { CHANNEL_TEXTURES, SHADERTOY_PASSES } from './shaderSource'
import { MOBILE_RENDER_SCALE_CAP, MOBILE_RENDER_SCALE_FLOOR } from './renderScale'

// Initial yaw/pitch reproduce the shader's original default look angle.
const ORBIT_YAW_START = 1.371762981912308 // ~78.6 deg
const ORBIT_PITCH_START = -0.0450188031530495 // ~-2.58 deg
/** Pitch clamp: just short of the poles (pi/2.2), preventing gimbal lock. */
const ORBIT_PITCH_LIMIT = Math.PI / 2.2
/** Radians of yaw per full-width drag — screen-size independent. */
const ORBIT_YAW_SWEEP = 3.0
/** Radians of pitch per full-height drag. */
const ORBIT_PITCH_SWEEP = 2.0
/** Keyboard orbit speed (rad/s). */
const ORBIT_KEY_RATE = 1.0
/** Keyboard velocity approach rate (1/s) for smooth ramp-up/down. */
const ORBIT_KEY_SMOOTHING = 14.0
/** Orbit radius (distance from the origin) in world units. */
const ORBIT_RADIUS = 10.0

/**
 * Entrance phase (seconds): the composite eases 0 -> 1 once on load, then is
 * locked at 1 forever. Same monotonic clock as iTime, so it never loops.
 */
const ENTRANCE_DURATION = 1.2

// DPR capping is decided by the caller (lib/device.ts), not here.

// Passthrough vertex shader: a full-screen quad in clip space. (RawShaderMaterial
// injects only the `#version 300 es` line.)
const VERTEX_SHADER = /* glsl */ `
  precision highp float;
  in vec3 position;

  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/**
 * Shadertoy compatibility wrapper. The raw pass source declares
 * `void mainImage(out vec4 fragColor, in vec2 fragCoord)`; we define the
 * standard Shadertoy uniforms/inputs on top and call mainImage from main().
 * `fragCoord` is gl_FragCoord.xy (drawing-buffer pixels, bottom-left origin).
 */
function wrapFragmentShader(body: string): string {
  return /* glsl */ `
    precision highp float;
    precision highp int;
    precision highp sampler2D;

    uniform float uTime;
    uniform vec3  uResolution;
    uniform vec4  uMouse;
    uniform vec3  uCamera;
    uniform float uEntrance;
    uniform float uFeedbackReset;

    uniform sampler2D iChannel0;
    uniform sampler2D iChannel1;
    uniform sampler2D iChannel2;
    uniform sampler2D iChannel3;

    #define iTime       uTime
    #define iResolution uResolution
    #define iMouse      uMouse

    out vec4 _fragColor;

    ${body}

    void main() {
      vec4 fragColor = vec4(0.0);
      vec2 fragCoord = gl_FragCoord.xy;
      mainImage(fragColor, fragCoord);
      _fragColor = fragColor;
    }
  `
}

export interface PointerState {
  /** Pointer position in drawing-buffer pixels, origin bottom-left. */
  x: number
  y: number
  /** Last click position in drawing-buffer pixels, origin bottom-left. */
  clickX: number
  clickY: number
  /** A mouse button (or touch) is currently pressed. */
  down: boolean
}

export interface GargantuaRendererOptions {
  /**
   * Enable mobile optimizations: capped render scale (see
   * lib/renderScale.ts) and a reduced raymarch iteration count. Desktop
   * callers pass false/omit this and are never capped.
   */
  mobile?: boolean
}

export interface RendererInitError {
  kind: 'webgl' | 'shader' | 'texture'
  message: string
  detail?: string
}

/** WebGL2 render targets: HalfFloat to carry the shader's HDR range. */
function createRenderTarget(width: number, height: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  })
  target.texture.generateMipmaps = false
  target.texture.colorSpace = THREE.NoColorSpace
  return target
}

export class GargantuaRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quad: THREE.Mesh
  private geometry: THREE.PlaneGeometry

  private materials: THREE.ShaderMaterial[] = []
  /** ping-pong buffers for Buffer A so feedback samples the previous frame. */
  private bufferA: THREE.WebGLRenderTarget[]
  private bufferB: THREE.WebGLRenderTarget
  private bufferC: THREE.WebGLRenderTarget
  private bufferD: THREE.WebGLRenderTarget
  private textures: THREE.Texture[] = []

  /** Shared uniform objects — mutate these and every pass sees the change. */
  public readonly uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector3(1, 1, 1) },
    uMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCamera: {
      value: new THREE.Vector3(ORBIT_YAW_START, ORBIT_PITCH_START, ORBIT_RADIUS),
    },
    // 0 during the throwaway verify frame; ramps on the first animated frame.
    uEntrance: { value: 0 },
    // 1.0 for one frame after a render-target realloc (feedback is black).
    uFeedbackReset: { value: 0 },
  }

  // Orbit state: yaw/pitch only change from drag/keyboard deltas (no drift);
  // yaw wraps continuously past screen edges.
  private camYaw = ORBIT_YAW_START
  private camPitch = ORBIT_PITCH_START
  private camRadius = ORBIT_RADIUS
  private lastPointer: { x: number; y: number } | null = null
  private wasPointerDown = false
  private keyVel = { x: 0, y: 0 }

  // Set on render-target realloc; next frame skips temporal blending so the
  // black feedback texture never dims the image.
  private needsFeedbackReset = false

  /** Mobile tier flag: caps render scale and reduces raymarch iterations. */
  private readonly mobile: boolean
  /** Render-scale ceiling/floor: mobile uses the shared caps, desktop is 1.0. */
  private readonly scaleCap: number
  private readonly scaleFloor: number
  /** Current render scale (mutable via setRenderScale for adaptive scaling). */
  private renderScale: number

  private cssWidth = 1
  private cssHeight = 1
  private width = 1
  private height = 1
  private dpr = 1

  constructor(canvas: HTMLCanvasElement, options: GargantuaRendererOptions = {}) {
    this.mobile = options.mobile ?? false
    this.scaleCap = this.mobile ? MOBILE_RENDER_SCALE_CAP : 1
    this.scaleFloor = this.mobile ? MOBILE_RENDER_SCALE_FLOOR : 1
    this.renderScale = this.scaleCap

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    })
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.autoClear = true
    // The shader performs its own tone mapping / gamma.
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace

    // Full-screen triangle pair via a plane with the passthrough vertex shader
    // (position.xy lands directly in clip space).
    this.geometry = new THREE.PlaneGeometry(2, 2)

    this.bufferA = [createRenderTarget(1, 1), createRenderTarget(1, 1)]
    this.bufferB = createRenderTarget(1, 1)
    this.bufferC = createRenderTarget(1, 1)
    this.bufferD = createRenderTarget(1, 1)

    const channel0 = this.buildChannelTextures()
    const channelInputs = this.buildChannelSamplers(channel0)

    for (const pass of SHADERTOY_PASSES) {
      // Mobile: compile Buffer A with fewer raymarch steps (see bufferA.glsl).
      // Desktop always compiles the original ITERATIONS 200.
      const source =
        pass.name === 'A' && this.mobile ? `#define MOBILE_QUALITY 1\n${pass.source}` : pass.source
      const material = new THREE.RawShaderMaterial({
        name: `gargantua-pass-${pass.name}`,
        glslVersion: THREE.GLSL3,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: this.uniforms.uTime,
          uResolution: this.uniforms.uResolution,
          uMouse: this.uniforms.uMouse,
          uCamera: this.uniforms.uCamera,
          uEntrance: this.uniforms.uEntrance,
          uFeedbackReset: this.uniforms.uFeedbackReset,
          iChannel0: { value: channelInputs[pass.name][0] },
          iChannel1: { value: channelInputs[pass.name][1] },
          iChannel2: { value: channelInputs[pass.name][2] },
          iChannel3: { value: channelInputs[pass.name][3] },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: wrapFragmentShader(source),
      })
      this.materials.push(material)
    }

    // The quad's material is swapped per pass; start with the composite pass.
    this.quad = new THREE.Mesh(this.geometry, this.materials[this.materials.length - 1])
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }

  /** Loads the two bundled channel textures (noise LUT + disk photo). */
  private buildChannelTextures(): { noise: THREE.Texture; photo: THREE.Texture } {
    // Both URLs are statically imported assets, so a missing file fails the
    // production build rather than erroring at runtime.
    const loader = new THREE.TextureLoader()

    const noise = loader.load(CHANNEL_TEXTURES.noise)
    noise.wrapS = THREE.RepeatWrapping
    noise.wrapT = THREE.RepeatWrapping
    // iq's 256x256 noise LUT must be point-filtered.
    noise.minFilter = THREE.NearestFilter
    noise.magFilter = THREE.NearestFilter
    noise.generateMipmaps = false
    noise.flipY = true

    const photo = loader.load(CHANNEL_TEXTURES.diskPhoto)
    photo.wrapS = THREE.RepeatWrapping
    photo.wrapT = THREE.RepeatWrapping
    photo.minFilter = THREE.LinearFilter
    photo.magFilter = THREE.LinearFilter
    photo.generateMipmaps = false
    photo.flipY = true

    this.textures.push(noise, photo)
    return { noise, photo }
  }

  /** Resolves iChannel0..3 for each pass, following Shadertoy's wiring. */
  private buildChannelSamplers(channels: {
    noise: THREE.Texture
    photo: THREE.Texture
  }): Record<string, (THREE.Texture | null)[]> {
    const black: THREE.Texture = new THREE.DataTexture(
      new Uint8Array([0, 0, 0, 255]),
      1,
      1,
      THREE.RGBAFormat,
    )
    black.needsUpdate = true
    black.colorSpace = THREE.NoColorSpace
    this.textures.push(black)

    // Buffer A: iChannel0 = noise, iChannel1 = photo, iChannel2 = self feedback.
    // iChannel2 is rebound every frame to the *previous* Buffer A target.
    const passA = [channels.noise, channels.photo, this.bufferA[0].texture, black]
    // Buffer B down-samples A.
    const passB = [this.bufferA[0].texture, black, black, black]
    // Buffer C blurs B.
    const passC = [this.bufferB.texture, black, black, black]
    // Buffer D blurs C.
    const passD = [this.bufferC.texture, black, black, black]
    // Image recombines A + B + C + D.
    const passImage = [
      this.bufferA[0].texture,
      this.bufferB.texture,
      this.bufferC.texture,
      this.bufferD.texture,
    ]

    return { A: passA, B: passB, C: passC, D: passD, Image: passImage }
  }

  /** Re-allocates render targets for the given CSS size and DPR. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.dpr = Math.max(1, dpr)
    this.cssWidth = Math.max(1, cssWidth)
    this.cssHeight = Math.max(1, cssHeight)
    this.applySize()
  }

  /**
   * Sets the render scale for the drawing buffer. Clamped to [scaleFloor,
   * scaleCap] — 1.0..1.0 on desktop (no-op), capped on mobile. The canvas CSS
   * size is unchanged; the GPU upscales the smaller buffer.
   */
  setRenderScale(scale: number): void {
    const clamped = Math.max(this.scaleFloor, Math.min(this.scaleCap, scale))
    if (clamped === this.renderScale) return
    this.renderScale = clamped
    this.applySize()
  }

  /** Adds an absolute orbit delta (radians). Yaw wraps, pitch is clamped. */
  nudgeOrbit(dyaw: number, dpitch: number): void {
    this.camYaw += dyaw
    this.camPitch = Math.max(-ORBIT_PITCH_LIMIT, Math.min(ORBIT_PITCH_LIMIT, this.camPitch + dpitch))
  }

  /** Keyboard orbit: smoothed velocity from held arrow keys, integrated by dt. */
  keyboardOrbit(
    dt: number,
    keys: { up: boolean; down: boolean; left: boolean; right: boolean },
  ): void {
    const tx = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * ORBIT_KEY_RATE
    const ty = ((keys.up ? 1 : 0) - (keys.down ? 1 : 0)) * ORBIT_KEY_RATE
    const blend = Math.min(1, dt * ORBIT_KEY_SMOOTHING)
    this.keyVel.x += (tx - this.keyVel.x) * blend
    this.keyVel.y += (ty - this.keyVel.y) * blend
    if (this.keyVel.x !== 0 || this.keyVel.y !== 0) {
      this.nudgeOrbit(this.keyVel.x * dt, this.keyVel.y * dt)
    }
  }

  /** Recomputes the drawing-buffer size from CSS size, DPR and render scale. */
  private applySize(): void {
    const nextWidth = Math.max(1, Math.round(this.cssWidth * this.dpr * this.renderScale))
    const nextHeight = Math.max(1, Math.round(this.cssHeight * this.dpr * this.renderScale))

    // Same-size guard: avoid churn and reallocation (which clears the TAA
    // feedback; the next frame skips blending via needsFeedbackReset).
    if (nextWidth === this.width && nextHeight === this.height) return

    this.width = nextWidth
    this.height = nextHeight
    this.needsFeedbackReset = true

    this.renderer.setPixelRatio(1) // sizes are already expressed in pixels
    this.renderer.setSize(this.width, this.height, false)

    for (const target of this.bufferA) target.setSize(this.width, this.height)
    this.bufferB.setSize(this.width, this.height)
    this.bufferC.setSize(this.width, this.height)
    this.bufferD.setSize(this.width, this.height)

    this.uniforms.uResolution.value.set(this.width, this.height, 1)
  }

  /** Renders one frame. */
  render(time: number, mouse: PointerState): void {
    this.uniforms.uTime.value = time

    // Entrance ramp 0 -> 1 once, then locked (monotonic clock, never loops).
    const t = Math.min(1, time / ENTRANCE_DURATION)
    this.uniforms.uEntrance.value = t * t * (3 - 2 * t)

    // One-frame blend skip after a realloc (feedback is black).
    this.uniforms.uFeedbackReset.value = this.needsFeedbackReset ? 1.0 : 0.0
    this.needsFeedbackReset = false

    // iMouse: xy = drag position, zw = click point while held (z > 1 = dragging).
    this.uniforms.uMouse.value.set(
      mouse.x,
      mouse.y,
      mouse.down ? mouse.clickX : 0,
      mouse.down ? mouse.clickY : 0,
    )

    // Orbit: integrate drag deltas (absolute pointer coords can't wrap past
    // screen edges). Sensitivity is normalized to pointer space, so rotation
    // feels identical at any resolution/DPR and re-normalizes on resize.
    const yawSens = ORBIT_YAW_SWEEP / Math.max(1, this.cssWidth * this.dpr)
    const pitchSens = ORBIT_PITCH_SWEEP / Math.max(1, this.cssHeight * this.dpr)
    if (mouse.down && !this.wasPointerDown) {
      this.lastPointer = { x: mouse.x, y: mouse.y }
    } else if (mouse.down && this.lastPointer) {
      const dx = mouse.x - this.lastPointer.x
      const dy = mouse.y - this.lastPointer.y
      this.camYaw += dx * yawSens
      this.camPitch += dy * pitchSens
      this.camPitch = Math.max(-ORBIT_PITCH_LIMIT, Math.min(ORBIT_PITCH_LIMIT, this.camPitch))
      this.lastPointer = { x: mouse.x, y: mouse.y }
    } else if (!mouse.down) {
      this.lastPointer = null
    }
    this.wasPointerDown = mouse.down

    // Keep yaw in (-pi, pi] for numerical precision (trig wrap is exact).
    this.camYaw -= Math.round(this.camYaw / (2 * Math.PI)) * 2 * Math.PI

    this.uniforms.uCamera.value.set(this.camYaw, this.camPitch, this.camRadius)

    const [matA, matB, matC, matD, matImage] = this.materials
    const [readA, writeA] = this.bufferA

    // --- Buffer A: raymarch with temporal feedback from the previous frame --
    // Rebind every sampler that references Buffer A to the frame we are reading.
    ;(matA.uniforms.iChannel2 as { value: THREE.Texture }).value = readA.texture
    ;(matB.uniforms.iChannel0 as { value: THREE.Texture }).value = readA.texture
    ;(matImage.uniforms.iChannel0 as { value: THREE.Texture }).value = readA.texture

    this.quad.material = matA
    this.renderer.setRenderTarget(writeA)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // --- Buffer B: mipmap bloom tree (reads A) ------------------------------
    this.quad.material = matB
    this.renderer.setRenderTarget(this.bufferB)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // --- Buffer C: horizontal blur (reads B) --------------------------------
    this.quad.material = matC
    this.renderer.setRenderTarget(this.bufferC)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // --- Buffer D: vertical blur (reads C) ----------------------------------
    this.quad.material = matD
    this.renderer.setRenderTarget(this.bufferD)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // --- Image: composite + tonemap -> screen (reads A, B, C, D) ------------
    this.quad.material = matImage
    this.renderer.setRenderTarget(null)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // Swap ping-pong so next frame feeds back the freshly rendered A.
    this.bufferA.reverse()
  }

  /** Collects a program's compile/link error log, or null when healthy. */
  private programLogFor(material: THREE.Material): string | null {
    const gl = this.renderer.getContext()
    const properties = (
      this.renderer as unknown as {
        properties: { get: (obj: unknown) => { program?: { program?: WebGLProgram } } }
      }
    ).properties
    const entry = properties.get(material)?.program?.program
    if (!entry) return null
    if (gl.getProgramParameter(entry, gl.LINK_STATUS) === false) {
      return gl.getProgramInfoLog(entry)
    }
    return null
  }

  /** Renders one throwaway frame per pass to force compile, returns first error. */
  verifyPrograms(): string | null {
    const [matA, matB, matC, matD, matImage] = this.materials
    const passes: Array<{ material: THREE.Material; target: THREE.WebGLRenderTarget | null }> = [
      { material: matA, target: this.bufferA[1] },
      { material: matB, target: this.bufferB },
      { material: matC, target: this.bufferC },
      { material: matD, target: this.bufferD },
      { material: matImage, target: null },
    ]

    // Bind feedback channel for A to a valid (cleared) target before compiling.
    ;(matA.uniforms.iChannel2 as { value: THREE.Texture }).value = this.bufferA[0].texture
    ;(matB.uniforms.iChannel0 as { value: THREE.Texture }).value = this.bufferA[0].texture
    ;(matImage.uniforms.iChannel0 as { value: THREE.Texture }).value = this.bufferA[0].texture

    for (const pass of passes) {
      this.quad.material = pass.material
      this.renderer.setRenderTarget(pass.target)
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)
    }
    this.quad.material = matImage
    this.renderer.setRenderTarget(null)

    for (const pass of passes) {
      const log = this.programLogFor(pass.material)
      if (log) return log
    }

    // The verification frame populated bufferA[1]; start the ping-pong from
    // it so feedback never reads an uninitialized target on the real first
    // frame.
    this.bufferA.reverse()
    return null
  }

  dispose(): void {
    for (const target of this.bufferA) target.dispose()
    this.bufferB.dispose()
    this.bufferC.dispose()
    this.bufferD.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.geometry.dispose()
    this.renderer.dispose()
  }
}
