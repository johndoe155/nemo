import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Hub is served behind the sandbox preview proxy; bind to 0.0.0.0
// so the live preview can reach it. Base './' keeps asset paths relative
// if the build is ever dropped into a sub-path (e.g. IPFS or a CDN folder).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // The site is served behind the sandbox's preview proxy; accept any host.
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // three + gsap are multi-hundred-kB libs used below the fold
        // (ambient WebGL, magnetic pull) — split them so the hero shell
        // (react + framer) paints while the heavy chunks stream in parallel.
        //
        // The singularity's WebGPU/TSL stack is a SECOND three build: the
        // classic `three` above has no three/webgpu, and `three/tsl` is a thin
        // re-export layer over it (34 kB). Both are split out the same way, so
        // the two builds download as parallel chunks instead of landing in the
        // entry. Tradeoff, stated plainly: the page ships two three builds
        // (~365 kB + ~668 kB min) because the vendored simulation must keep
        // importing three/webgpu + three/tsl verbatim and the existing pulls
        // canvases keep using WebGLRenderer. Unifying them would mean editing
        // one side or the other, which the integration brief forbids.
        manualChunks: {
          webgl: ['three'],
          webgpu: ['three/webgpu', 'three/tsl'],
          animation: ['gsap'],
        },
      },
    },
  },
});
