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
        // gsap is the only multi-hundred-kB library left in the graph: it
        // drives the scroll/motion layer below the fold. Split it so the hero
        // shell (react + framer) paints while it streams in parallel.
        //
        // `three` used to need three more rules here (webgl / webgpu / r3f).
        // Phase 6 of IDENTITY-SPEC §13 ported the particle field to a raw
        // WebGL context (src/sections/pulls/particleGL.ts) and deleted the last
        // four consumers, so the library and its chunk rules left the project.
        manualChunks(id) {
          const moduleId = id.replaceAll('\\\\', '/');

          // Framework first: React must never land in a lazily-imported
          // chunk, or Rollup hoists that island into the entry's preload set.
          if (
            moduleId.includes('/node_modules/react/') ||
            moduleId.includes('/node_modules/react-dom/') ||
            moduleId.includes('/node_modules/scheduler/') ||
            moduleId.includes('vite/preload-helper')
          ) {
            return 'framework';
          }
          if (moduleId.includes('/node_modules/gsap/')) return 'animation';
        },
      },
    },
  },
});
