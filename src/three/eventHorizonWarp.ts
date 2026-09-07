import { flatSimulationConfig } from './blackhole/blackhole.config.js';
import type { SignoffHorizonGeometry } from '../lib/signoffHorizonGeometry';

/** The ONE new art-direction knob: a screen-space horizon radius in CSS px.
 * Scroll expands this seed to the measured farthest corner, so progress=1
 * consumes every texel at every footer size. It never changes M, lensing or ds.
 */
export const EFFECTIVE_HORIZON_RADIUS_PX = 28;
// Fixed performance budget, not a second simulation parameter.
export const HORIZON_STEPS = 32;

const VERTEX = `#version 300 es
out vec2 vUV;
void main() {
  // A full-cover triangle: the same fragment quad without a vertex buffer.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = vec2(p.x, 1.0 - p.y); // DOM / snapshot coordinates have y pointing down
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSnapshot;
uniform vec2 uSize;
uniform vec2 uAnchor;
uniform float uHorizonPx;
uniform float uBlackHoleMass;
uniform float uGravitationalLensing;
uniform float uStepSize;
in vec2 vUV;
out vec4 outColor;

const int STEPS = ${HORIZON_STEPS};

void main() {
  // Identity is exact, including alpha and colour: no gamma/tone mapping.
  if (uHorizonPx <= 0.0) {
    outColor = texture(uSnapshot, vUV);
    return;
  }

  float rs = uBlackHoleMass * 2.0;
  float pixelsPerUnit = uHorizonPx / rs;
  vec2 pixelPos = (vUV * uSize - uAnchor) / pixelsPerUnit;

  // A fragment already inside the effective horizon is void. This also makes
  // full consumption geometric, not an unrelated end-of-scroll opacity fade.
  if (length(pixelPos) < rs * 1.01) {
    outColor = vec4(0.0);
    return;
  }

  // Explicit 2D orthographic launch, NOT the moving 3D cinematic camera.
  // Parallel rays approach from below, as the reader scrolls the DOM up to
  // the seam. Without deflection, STEPS normalize-and-steps land at exactly
  // the original snapshot texel. This launch geometry is the 2D analogue,
  // not an attempt to infer the vendored scene's camera or screen projection.
  vec2 rayDir = vec2(0.0, -1.0);
  vec2 rayPos = pixelPos - rayDir * uStepSize * float(STEPS);
  float remaining = float(STEPS);
  bool captured = false;

  for (int i = 0; i < STEPS; i++) {
    float r = length(rayPos);

    // Port of blackhole-shader.js's capture / escape checks, in the SAME
    // simulation units. Pixel conversion above preserves both thresholds.
    if (r < rs * 1.01) {
      captured = true;
      break;
    }
    if (r > 100.0) break;

    // Daniel Greenheck's blackhole-shader.js (MIT), lines 364–372:
    // SAME per-step inverse-square deflection ODE, with vec2 instead of vec3.
    // No vortex angle, radial pinch, barrel map, or progress multiplier here.
    vec2 toCenter = -rayPos / r;
    float bendStrength = rs / (r * r) * uStepSize * uGravitationalLensing;
    rayDir += toCenter * bendStrength;
    rayDir = normalize(rayDir);
    rayPos += rayDir * uStepSize;
    remaining -= 1.0;
  }

  // Include a hit on the final step. Captured rays NEVER sample the texture.
  if (captured || length(rayPos) < rs * 1.01) {
    outColor = vec4(0.0);
    return;
  }

  // Once escaped, finish the unbent flight to the sampling plane. In
  // particular a ray that starts beyond the escape distance stays identity,
  // rather than jumping by the unused step budget as the field first grows.
  rayPos += rayDir * uStepSize * remaining;
  vec2 landedUV = (uAnchor + rayPos * pixelsPerUnit) / uSize;
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

export function horizonRadiusAtProgress(progress: number, geometry: SignoffHorizonGeometry): number {
  const p = Math.max(0, Math.min(1, progress));
  const { width, height, anchorX, anchorY } = geometry;
  const coverRadius = Math.hypot(
    Math.max(anchorX, width - anchorX),
    Math.max(anchorY, height - anchorY),
  );
  // Hold the field small while the crawl enters at the lower seam;
  // accelerate closure only once the headline has scrolled into view.
  const growth = p * p * p * p;
  return p * (EFFECTIVE_HORIZON_RADIUS_PX +
    (Math.max(EFFECTIVE_HORIZON_RADIUS_PX, coverRadius) - EFFECTIVE_HORIZON_RADIUS_PX) * growth);
}

/** Plain WebGL2 only. No three/WebGPURenderer, backend probes, animation loop,
 * document listeners or global resources. A fresh canvas per activation also
 * avoids reusing a deliberately lost context on StrictMode's second mount.
 */
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
    // The vendored config is the ONLY source of these values. Never copy the
    // current literals into GLSL defaults, JS fallbacks, tests or CSS.
    gl.uniform1f(uniform('uBlackHoleMass'), flatSimulationConfig.blackHoleMass);
    gl.uniform1f(uniform('uGravitationalLensing'), flatSimulationConfig.gravitationalLensing);
    gl.uniform1f(uniform('uStepSize'), flatSimulationConfig.stepSize);
    const size = uniform('uSize');
    const anchor = uniform('uAnchor');
    const horizon = uniform('uHorizonPx');
    gl.viewport(0, 0, canvas.width, canvas.height);

    return {
      canvas,
      draw(progress, geometry) {
        if (disposed) return;
        const { width, height, anchorX, anchorY } = geometry;
        const radius = horizonRadiusAtProgress(progress, geometry);
        gl.uniform2f(size, width, height);
        gl.uniform2f(anchor, anchorX, anchorY);
        gl.uniform1f(horizon, radius);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose,
    };
  } catch (error) {
    dispose(); // includes partially compiled programs and failed texture upload
    throw error;
  }
}
