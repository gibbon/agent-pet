import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'web'),
  build: {
    outDir: resolve(__dirname, 'web-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'web/index.html'),
        controls: resolve(__dirname, 'web/controls.html'),
      },
    },
  },
  test: {
    include: ['web/**/*.test.ts'],
  },
});
