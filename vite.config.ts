import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The Hub is served behind the sandbox preview proxy; bind to 0.0.0.0
// so the live preview can reach it. Base './' keeps asset paths relative
// if the build is ever dropped into a sub-path (e.g. IPFS or a CDN folder).
export default defineConfig({
  plugins: [react()],
  base: './',
  // '@/*' → src/* — path alias used by the Gargantua donor files, which are
  // imported byte-for-byte from Gargantua.zip and resolve their modules
  // through '@' (their own vite.config had the same alias). Purely additive:
  // no pre-existing import in the Hub used '@'.
  resolve: {
    alias: {
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
        manualChunks: {
          webgl: ['three'],
          animation: ['gsap'],
        },
      },
    },
  },
});
