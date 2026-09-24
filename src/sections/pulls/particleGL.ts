import { FIELD_FRAG, FIELD_VERT, FIELD_MATRIX_PRELUDE } from './shaders';

/* ============================================================================
   particleGL — a ~150-line WebGL renderer for the reef field.

   IDENTITY-SPEC §13 (phase 6 structural cut): the field used three.js purely
   as a renderer — one BufferGeometry of POINTS, one ShaderMaterial, one
   PerspectiveCamera and a Scene. That cost the project the whole `three`
   dependency (189.6 kB gz island) for what GLSL already does natively.

   This module is the same pipeline in the platform's own API: two buffers,
   a projection matrix computed on the CPU (the old camera never rotated, so
   the model-view matrix is a single translation), points drawn with additive
   blending — the exact contract the shader was written against.

   The shader source is unchanged apart from two ports, both documented in
   shaders.ts: three's built-in `projectionMatrix` / `modelViewMatrix` uniforms
   are declared explicitly (prelude), and the point size is clamped to the
   driver's ALIASED_POINT_SIZE_RANGE, which three does for you and raw GL
   does not.
============================================================================ */

export interface FieldGL {
  /** Upload a new frame of particle positions. */
  setPositions: (pos: Float32Array) => void;
  draw: (time: number, pointScale: number) => void;
  /** Re-shape the viewport and rebuild the projection matrix. */
  resize: (width: number, height: number, cameraZ: number) => void;
  dispose: () => void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'shader compile failed';
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

/** Column-major perspective projection, matching the retired camera exactly. */
function perspective(fovDeg: number, aspect: number, near: number, far: number): number[] {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

export function createFieldGL(
  canvas: HTMLCanvasElement,
  count: number,
  seeds: Float32Array,
  sizes: Float32Array,
  initialPositions: Float32Array,
  dpr: number,
): FieldGL {
  const gl = (canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  }) ?? canvas.getContext('webgl', { alpha: true, antialias: false })) as WebGLRenderingContext | null;
  if (!gl) throw new Error('webgl unavailable');

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, FIELD_MATRIX_PRELUDE + FIELD_VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FIELD_FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
  }
  gl.useProgram(prog);

  /* ---- geometry: position (dynamic), aSeed + aSize (static) ---- */
  const positions = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  gl.bufferData(gl.ARRAY_BUFFER, initialPositions, gl.DYNAMIC_DRAW);
  const positionLoc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

  const seedBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  const seedLoc = gl.getAttribLocation(prog, 'aSeed');
  gl.enableVertexAttribArray(seedLoc);
  gl.vertexAttribPointer(seedLoc, 1, gl.FLOAT, false, 0, 0);

  const sizeBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
  const sizeLoc = gl.getAttribLocation(prog, 'aSize');
  gl.enableVertexAttribArray(sizeLoc);
  gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

  /* ---- uniforms ---- */
  const u = {
    projectionMatrix: gl.getUniformLocation(prog, 'projectionMatrix'),
    modelViewMatrix: gl.getUniformLocation(prog, 'modelViewMatrix'),
    uTime: gl.getUniformLocation(prog, 'uTime'),
    uPx: gl.getUniformLocation(prog, 'uPx'),
    uPointScale: gl.getUniformLocation(prog, 'uPointScale'),
    uSizeMax: gl.getUniformLocation(prog, 'uSizeMax'),
  };

  /* The driver's own ceiling — three.js clamps point size internally; a raw
     context must ask, or tall particles silently vanish on mobile GPUs. */
  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
  const sizeMax = range ? Math.min(range[1], 160) : 64;
  gl.uniform1f(u.uSizeMax, sizeMax);

  /* ---- state: the old ShaderMaterial's contract ---- */
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // THREE.AdditiveBlending
  gl.clearColor(0, 0, 0, 0);

  let projection = perspective(52, 1, 1, 6000);
  let modelView = new Float32Array(16);
  gl.uniform1f(u.uPx, dpr);

  return {
    setPositions(pos) {
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    },
    draw(time, pointScale) {
      gl.uniformMatrix4fv(u.projectionMatrix, false, projection);
      gl.uniformMatrix4fv(u.modelViewMatrix, false, modelView);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uPointScale, pointScale);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.POINTS, 0, count);
    },
    resize(width, height, cameraZ) {
      const dpr2 = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(width * dpr2));
      const h = Math.max(1, Math.floor(height * dpr2));
      canvas.width = w;
      canvas.height = h;
      const aspect = width / Math.max(1, height);
      projection = perspective(52, aspect, 1, 6000);
      // camera at (0, 0, cameraZ) looking down -Z ⇒ a pure translation
      modelView = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, -cameraZ, 1,
      ]);
    },
    dispose() {
      gl.deleteBuffer(positions);
      gl.deleteBuffer(seedBuf);
      gl.deleteBuffer(sizeBuf);
      gl.deleteProgram(prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };
}
