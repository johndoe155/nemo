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
  },
});
