import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Three build modes share one source tree:
//   default        → dist/agent-pet.js          (ES, React external; for React apps)
//   widget         → dist/agent-pet-widget.iife.js  (IIFE, Preact bundled; for <script> tags)
//   widget-esm     → dist/agent-pet-widget.es.js    (ES, Preact bundled; for Svelte/Vue/etc apps)
//
// The widget builds alias react→preact/compat so non-React consumers get a
// ~14 KB self-contained renderer with no React peer dep.
export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget';
  const isWidgetEsm = mode === 'widget-esm';
  const usesPreact = isWidget || isWidgetEsm;

  return {
    plugins: [
      react(),
      // Generate .d.ts only on the main build — the widget builds reuse them.
      ...(!usesPreact ? [dts({ include: ['src'] })] : []),
    ],
    resolve: {
      alias: usesPreact
        ? {
            react: 'preact/compat',
            'react-dom': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime',
          }
        : {},
    },
    build: {
      sourcemap: true,
      lib: {
        entry: resolve(
          __dirname,
          isWidget
            ? 'src/widget/index.ts'
            : isWidgetEsm
            ? 'src/widget/widget-es.ts'
            : 'src/index.ts',
        ),
        name: 'AgentPet',
        fileName: isWidget
          ? 'agent-pet-widget'
          : isWidgetEsm
          ? 'agent-pet-widget.es'
          : 'agent-pet',
        formats: isWidget ? ['iife'] : ['es'],
      },
      rollupOptions: {
        external: usesPreact ? [] : ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          globals: usesPreact ? {} : { react: 'React', 'react-dom': 'ReactDOM' },
          // Force the extracted CSS to be `pet.css` rather than entry-named.
          assetFileNames: (asset) =>
            asset.name?.endsWith('.css') ? 'pet.css' : 'assets/[name]-[hash][extname]',
        },
      },
      outDir: 'dist',
      // Only the main build clears dist; subsequent widget builds add to it.
      emptyOutDir: !usesPreact,
      copyPublicDir: false,
    },
  };
});
