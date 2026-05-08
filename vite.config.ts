import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Three build modes share one source tree:
//   default        → dist/agent-pet.js              (ES, React external; for React apps)
//   widget         → dist/agent-pet-widget.iife.js  (IIFE, vanilla DOM, no framework runtime)
//   widget-esm     → dist/agent-pet-widget.es.js    (ES, vanilla DOM, no framework runtime)
//
// The widget builds DON'T use React or Preact — the renderer is pure DOM.
// Only the React subpath (default mode) brings in a framework runtime, kept
// as a peer dep for React apps.
export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget';
  const isWidgetEsm = mode === 'widget-esm';
  const isWidgetBuild = isWidget || isWidgetEsm;

  return {
    plugins: [
      // The React plugin is only needed for the default (React component) build.
      // Widget builds enter through src/widget/{index,widget-es}.ts which import
      // no JSX, so the plugin would be inert — we omit it for cleanliness.
      ...(!isWidgetBuild ? [react()] : []),
      // Generate .d.ts only on the main build — the widget builds reuse them.
      ...(!isWidgetBuild ? [dts({ include: ['src'], entryRoot: 'src' })] : []),
    ],
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
        external: isWidgetBuild ? [] : ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          globals: isWidgetBuild ? {} : { react: 'React', 'react-dom': 'ReactDOM' },
          assetFileNames: (asset) =>
            asset.name?.endsWith('.css') ? 'pet.css' : 'assets/[name]-[hash][extname]',
        },
      },
      outDir: 'dist',
      emptyOutDir: !isWidgetBuild,
      copyPublicDir: false,
    },
  };
});
