import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Hub is served behind the sandbox preview proxy; bind to 0.0.0.0
// so the live preview can reach it. Base './' keeps asset paths relative
// if the build is ever dropped into a sub-path (e.g. IPFS or a CDN folder).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      // `@` — the shadcn convention (see components.json aliases). Mirrors
      // the paths mapping in tsconfig.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
        manualChunks(id) {
          const moduleId = id.replaceAll('\\\\', '/');

          // Explicitly keep React out of the r3f chunk. If the shared runtime
          // lands there, Rollup makes the app entry import (and therefore
          // preload) the desktop-only Persona stack on every viewport.
          if (
            moduleId.includes('/node_modules/react/') ||
            moduleId.includes('/node_modules/react-dom/') ||
            moduleId.includes('/node_modules/scheduler/') ||
            moduleId.includes('vite/preload-helper')
          ) {
            return 'framework';
          }
          if (
            moduleId.includes('/node_modules/@react-three/fiber/') ||
            moduleId.includes('/node_modules/@react-three/drei/')
          ) {
            return 'r3f';
          }
          if (
            moduleId.endsWith('/node_modules/three/build/three.webgpu.js') ||
            moduleId.endsWith('/node_modules/three/build/three.tsl.js')
          ) {
            return 'webgpu';
          }
          if (
            moduleId.endsWith('/node_modules/three/build/three.module.js') ||
            moduleId.endsWith('/node_modules/three/build/three.core.js')
          ) {
            return 'webgl';
          }
          if (moduleId.includes('/node_modules/gsap/')) return 'animation';
        },
      },
    },
  },
});
