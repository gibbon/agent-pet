import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'web'),
  build: {
    outDir: resolve(__dirname, 'web-dist'),
    emptyOutDir: true,
  },
  test: {
    include: ['web/**/*.test.ts'],
  },
});
