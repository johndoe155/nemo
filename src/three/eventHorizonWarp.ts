import { flatSimulationConfig } from './blackhole/blackhole.config.js';
import {
  EFFECTIVE_HORIZON_RADIUS_PX,
  TIDAL_CAP,
  TIDAL_FALLOFF,
  horizonRadiusAtProgress,
  shaderInfallAt,
  swirlAt,
  tidalGainAt,
} from '../lib/spaghettification';
import type { SignoffHorizonGeometry } from '../lib/signoffHorizonGeometry';

export { EFFECTIVE_HORIZON_RADIUS_PX, horizonRadiusAtProgress };

/** Fixed performance budget, not a second simulation parameter. */
export const HORIZON_STEPS = 32;

/** The vendored capture threshold, in Schwarzschild radii: a ray closer than
 * `rs * CAPTURE_THRESHOLD` never comes back. Kept here (and only here) so the
 * GLSL and the CPU reference in the test suite read the same number. */
export const CAPTURE_THRESHOLD = 1.01;

const VERTEX = `#version 300 es
out vec2 vUV;
void main() {
  // A full-cover triangle: the same fragment quad without a vertex buffer.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = vec2(p.x, 1.0 - p.y); // DOM / snapshot coordinates have y pointing down
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* ----------------------------------------------------------------------------
   The frozen frame's warp.

   Two stages, in the order light would meet them:

   1 · THE TIDAL REMAP. A fragment at radius r from the singularity does not
       sample the snapshot at r: it samples the source it fell in from,
       `r · (1 + infall + tidal)`, rotated by the frame dragging. `infall` is
       the global contraction — `1/contraction − 1`, where `contraction` is the
       fraction of its rest distance a fragment keeps: 1 at rest and exactly 0
       at the horizon, so everything falls the same fraction of its own distance
       and the last frame samples from infinity. The GPU is handed that term
       floored (`shaderInfallAt`), so no driver multiplies 0 by inf at the
       anchor fragment. `tidal` is the gradient of the pull: local, diverging at
       the horizon. Because the tidal term falls off with radius, its derivative
       is NEGATIVE, which is the whole effect: the radial axis magnifies while
       the tangential one squeezes, i.e. the image strands. This is the same
       field `lib/spaghettification.ts` evaluates per element for the live DOM
       flyers, which is why the paint handoff between the two is invisible.

   2 · THE LENSING. The remapped source is then traced through the vendored
       inverse-square deflection ODE, ported unchanged from Daniel Greenheck's
       MIT-licensed `blackhole-shader.js` with `vec2` ray state. Rays that cross
       the capture radius are void; rays that escape finish the remaining
       straight flight to the flat sampling plane.

   Coordinates are CSS pixels of the overlay box (y down), which covers the
   sheet plus `veil` px of headroom above it; the snapshot itself occupies the
   `uSheetOffset`/`uSheetSize` sub-rectangle of that box.
---------------------------------------------------------------------------- */
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSnapshot;
uniform vec2 uCanvasSize;
uniform vec2 uSheetOffset;
uniform vec2 uSheetSize;
uniform vec2 uAnchor;
uniform float uHorizonPx;
uniform float uCapturePx;
uniform float uInfall;
uniform float uTidal;
uniform float uTidalFalloff;
uniform float uTidalCap;
uniform float uSwirl;
uniform float uBlackHoleMass;
uniform float uGravitationalLensing;
uniform float uStepSize;
in vec2 vUV;
out vec4 outColor;

const int STEPS = ${HORIZON_STEPS};
const float TAU = 6.283185307179586;
const float ESCAPE_UNITS = 100.0; // the vendored simulation's escape distance

void main() {
  vec2 pos = vUV * uCanvasSize;
  vec2 toPos = pos - uAnchor;
  float radius = length(toPos);
  bool live = uHorizonPx > 0.0;

  // Identity is exact when the field is closed, including alpha and colour: no
  // gamma, no tone mapping, no resample.
  if (!live) {
    vec2 restUV = (pos - uSheetOffset) / uSheetSize;
    outColor = (restUV.x < 0.0 || restUV.y < 0.0 || restUV.x > 1.0 || restUV.y > 1.0)
      ? vec4(0.0)
      : texture(uSnapshot, restUV);
    return;
  }

  // Already inside the effective horizon: void. Full consumption is geometric,
  // never an end-of-scroll opacity fade over an otherwise unwarped image.
  if (radius < uCapturePx) {
    outColor = vec4(0.0);
    return;
  }

  // ---- 1 · the tidal remap -------------------------------------------------
  float safeRadius = max(radius, 1e-4);
  vec2 radial = toPos / safeRadius;
  float tidal = min(uTidalCap, uTidal * pow(uHorizonPx / safeRadius, uTidalFalloff));
  float drag = tidal * uSwirl * TAU;
  float cosine = cos(drag);
  float sine = sin(drag);
  vec2 stretched = toPos * (1.0 + uInfall + tidal);
  vec2 source = uAnchor + vec2(
    stretched.x * cosine - stretched.y * sine,
    stretched.x * sine + stretched.y * cosine
  );

  // ---- 2 · the lensing -----------------------------------------------------
  float rs = uBlackHoleMass * 2.0;
  float pixelsPerUnit = uHorizonPx / rs;
  vec2 rayDir = vec2(0.0, -1.0);
  vec2 rayPos = (source - uAnchor) / pixelsPerUnit;
  // Explicit 2D orthographic launch, NOT the moving 3D cinematic camera:
  // parallel rays approach from below the flat DOM plane. Without deflection,
  // STEPS normalize-and-steps land back on exactly the source texel.
  rayPos -= rayDir * uStepSize * float(STEPS);
  float remaining = float(STEPS);
  bool captured = false;

  for (int i = 0; i < STEPS; i++) {
    float simRadius = length(rayPos);

    // Port of blackhole-shader.js's capture / escape checks, in the SAME
    // simulation units. The pixel conversion above preserves both thresholds.
    if (simRadius * pixelsPerUnit < uCapturePx) {
      captured = true;
      break;
    }
    if (simRadius > ESCAPE_UNITS) break;

    // Daniel Greenheck's blackhole-shader.js (MIT), lines 364–372: the SAME
    // per-step inverse-square deflection ODE, with vec2 instead of vec3. No
    // vortex angle, radial pinch or barrel map is added here — the tidal term
    // above is this effect's own field, and it is applied BEFORE the trace.
    vec2 toCenter = -rayPos / simRadius;
    float bendStrength = rs / (simRadius * simRadius) * uStepSize * uGravitationalLensing;
    rayDir += toCenter * bendStrength;
    rayDir = normalize(rayDir);
    rayPos += rayDir * uStepSize;
    remaining -= 1.0;
  }

  // Include a hit on the final step. Captured rays NEVER sample the texture.
  if (captured || length(rayPos) * pixelsPerUnit < uCapturePx) {
    outColor = vec4(0.0);
    return;
  }

  // Once escaped, finish the unbent flight to the sampling plane. A ray that
  // starts beyond the escape distance therefore stays identity, rather than
  // jumping by the unused step budget as the field first grows.
  rayPos += rayDir * uStepSize * remaining;
  vec2 landedUV = (uAnchor + rayPos * pixelsPerUnit - uSheetOffset) / uSheetSize;
  if (any(lessThan(landedUV, vec2(0.0))) || any(greaterThan(landedUV, vec2(1.0)))) {
    outColor = vec4(0.0); // don't smear the texture's edge with clamp-to-edge
    return;
  }
  outColor = texture(uSnapshot, landedUV);
}`;

export interface EventHorizonWarp {
  canvas: HTMLCanvasElement;
  draw(progress: number, geometry: SignoffHorizonGeometry): void;
  dispose(): void;
}

/** The overlay box, in CSS px: the sheet plus the veil of headroom above it
 * the falling glyphs are allowed to strand across. */
export function overlayBox(geometry: SignoffHorizonGeometry): { width: number; height: number; veil: number } {
  return { width: geometry.width, height: geometry.height + geometry.veil, veil: geometry.veil };
}

/** Plain WebGL2 only. No three/WebGPURenderer, backend probes, animation loop,
 * document listeners or global resources. A fresh canvas per activation also
 * avoids reusing a deliberately lost context on StrictMode's second mount. */
export function createEventHorizonWarp(
  snapshot: HTMLCanvasElement,
  onContextLost: () => void,
): EventHorizonWarp {
  const canvas = document.createElement('canvas');
  canvas.className = 'signoff-horizon__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-html2canvas-ignore', 'true');
  canvas.width = snapshot.width;
  canvas.height = snapshot.height;
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) throw new Error('No WebGL2 context for the sign-off overlay');

  let disposed = false;
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  const shaders: WebGLShader[] = [];
  const lost = (event: Event) => {
    event.preventDefault();
    if (!disposed) onContextLost();
  };
  canvas.addEventListener('webglcontextlost', lost);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    gl.deleteTexture(texture);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
    canvas.width = canvas.height = 0;
  };

  try {
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Cannot allocate horizon shader');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Horizon shader compilation failed');
      }
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error('Cannot allocate horizon program');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Horizon shader linking failed');
    }
    gl.useProgram(program);
    vao = gl.createVertexArray();
    texture = gl.createTexture();
    if (!vao || !texture) throw new Error('Cannot allocate horizon texture/quad');
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Horizon snapshot upload failed');

    const uniform = (name: string) => {
      const location = gl.getUniformLocation(program!, name);
      if (location === null) throw new Error(`Missing horizon uniform ${name}`);
      return location;
    };
    gl.uniform1i(uniform('uSnapshot'), 0);
    // The vendored config is the ONLY source of these three. Never copy the
    // current literals into GLSL defaults, JS fallbacks, tests or CSS.
    gl.uniform1f(uniform('uBlackHoleMass'), flatSimulationConfig.blackHoleMass);
    gl.uniform1f(uniform('uGravitationalLensing'), flatSimulationConfig.gravitationalLensing);
    gl.uniform1f(uniform('uStepSize'), flatSimulationConfig.stepSize);
    // The consumption field's own constants come from lib/spaghettification.ts,
    // which is the single place the art direction is written down.
    gl.uniform1f(uniform('uTidalFalloff'), TIDAL_FALLOFF);
    gl.uniform1f(uniform('uTidalCap'), TIDAL_CAP);
    const canvasSize = uniform('uCanvasSize');
    const sheetOffset = uniform('uSheetOffset');
    const sheetSize = uniform('uSheetSize');
    const anchor = uniform('uAnchor');
    const horizon = uniform('uHorizonPx');
    const capture = uniform('uCapturePx');
    const infall = uniform('uInfall');
    const tidalGain = uniform('uTidal');
    const swirl = uniform('uSwirl');
    let sized: SignoffHorizonGeometry | null = null;

    const size = (geometry: SignoffHorizonGeometry) => {
      // CSS box: the sheet plus the veil above it. Backing store: the snapshot's
      // own resolution for the sheet, extended by the same scale for the veil,
      // so one overlay pixel is always one snapshot pixel.
      const { width, height, veil } = overlayBox(geometry);
      const scale = snapshot.width / Math.max(1, geometry.width);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.top = `${-veil}px`;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(canvasSize, width, height);
      gl.uniform2f(sheetOffset, 0, veil);
      gl.uniform2f(sheetSize, geometry.width, geometry.height);
      sized = { ...geometry };
    };

    size({
      width: snapshot.width,
      height: snapshot.height,
      anchorX: snapshot.width / 2,
      anchorY: 0,
      seam: 0,
      veil: 0,
    });

    return {
      canvas,
      draw(progress, geometry) {
        if (disposed) return;
        if (
          !sized ||
          sized.width !== geometry.width ||
          sized.height !== geometry.height ||
          sized.veil !== geometry.veil
        ) {
          size(geometry);
        }
        const radius = horizonRadiusAtProgress(progress, geometry);
        gl.uniform2f(anchor, geometry.anchorX, geometry.anchorY + geometry.veil);
        gl.uniform1f(horizon, radius);
        gl.uniform1f(capture, radius * CAPTURE_THRESHOLD);
        // `infallAt` diverges at exactly p = 1, which is honest on the CPU (no
        // consumer divides by it) and unacceptable in a shader that multiplies
        // it by a fragment offset that can be zero at the anchor. The floor is
        // MAX_GL_INFALL — 1e-6 of a contraction, two ten-thousandths of a pixel
        // on a 200px headline — and at p = 1 the capture radius has already
        // swallowed every texel of the overlay, so the floored branch is never
        // the one that paints.
        gl.uniform1f(infall, shaderInfallAt(progress));
        // The gain the shader multiplies by (R/r)^falloff; tidalAt() is the same
        // expression, evaluated on the CPU for the live flyers.
        gl.uniform1f(tidalGain, tidalGainAt(progress));
        gl.uniform1f(swirl, swirlAt(progress));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose,
    };
  } catch (error) {
    dispose(); // includes partially compiled programs and failed texture upload
    throw error;
  }
}
