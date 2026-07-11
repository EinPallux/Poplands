import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages subpaths and itch.io zips.
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900, // three.js core lands near the default 500 kB warning
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
