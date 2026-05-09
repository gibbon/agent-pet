import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

// Build modes share one source tree:
//   default        → dist/agent-pet.js              (ES, React external; for React apps)
//   widget         → dist/agent-pet-widget.iife.js  (IIFE, vanilla DOM)
//   widget-esm     → dist/agent-pet-widget.es.js    (ES, vanilla DOM)
//   rich           → dist/agent-pet-rich.iife.js    (IIFE, lazy-loaded addon)
//
// Widget + rich builds DON'T use React or Preact — the renderer is pure DOM.
// The rich addon is *separate* so consumers only pay its weight when their
// manifest opts in via `runtime: "rich"`.
export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget';
  const isWidgetEsm = mode === 'widget-esm';
  const isRich = mode === 'rich';
  const isPureDomBuild = isWidget || isWidgetEsm || isRich;

  const entry = isWidget
    ? 'src/widget/index.ts'
    : isWidgetEsm
    ? 'src/widget/widget-es.ts'
    : isRich
    ? 'src/rich/index.ts'
    : 'src/index.ts';

  const fileName = isWidget
    ? 'agent-pet-widget'
    : isWidgetEsm
    ? 'agent-pet-widget.es'
    : isRich
    ? 'agent-pet-rich'
    : 'agent-pet';

  const iife = isWidget || isRich;

  return {
    plugins: [
      ...(!isPureDomBuild ? [react()] : []),
      // Generate .d.ts only on the main build — the widget/rich builds reuse them.
      ...(!isPureDomBuild ? [dts({ include: ['src'], entryRoot: 'src' })] : []),
    ],
    build: {
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, entry),
        name: isRich ? 'AgentPetRich' : 'AgentPet',
        fileName,
        formats: iife ? ['iife'] : ['es'],
      },
      rollupOptions: {
        external: isPureDomBuild ? [] : ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          globals: isPureDomBuild ? {} : { react: 'React', 'react-dom': 'ReactDOM' },
          assetFileNames: (asset) =>
            asset.name?.endsWith('.css') ? 'pet.css' : 'assets/[name]-[hash][extname]',
        },
      },
      outDir: 'dist',
      emptyOutDir: !isPureDomBuild,
      copyPublicDir: false,
    },
  };
});
