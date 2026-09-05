/* ---------------------------------------------------------------------------
   webgl — capability probe shared by every WebGL surface of the pulls canvas
   (particle field, liquid CTA, liquid gauges). Cached after first test so the
   probe costs one context creation at most; surfaces degrade silently to
   their CSS counterparts when WebGL is unavailable.
--------------------------------------------------------------------------- */

let cached: boolean | null = null;

export function webglSupported(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    cached = Boolean(gl);
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    cached = false;
  }
  return cached;
}
