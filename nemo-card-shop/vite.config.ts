import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The shop is served behind the sandbox preview proxy; bind to 0.0.0.0 so the
// live preview can reach it. Base './' keeps asset paths relative if the build
// is dropped into a sub-path — and mirrors the Hub's own vite.config.ts so the
// two share build behaviour on a future merge.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5174,
    // Served behind the sandbox's preview proxy; accept any host.
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // framer-motion + react land in the entry; nothing else is heavy.
        manualChunks: undefined,
      },
    },
  },
});
