import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget';

  return {
    plugins: [
      react(),
      ...(isWidget ? [cssInjectedByJs({ styleId: 'agent-pet-styles' })] : []),
    ],
    resolve: {
      alias: isWidget
        ? {
            react: 'preact/compat',
            'react-dom': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime',
          }
        : {},
    },
    build: {
      lib: {
        entry: resolve(__dirname, isWidget ? 'src/widget/index.ts' : 'src/index.ts'),
        name: 'AgentPet',
        fileName: isWidget ? 'agent-pet-widget' : 'agent-pet',
        formats: isWidget ? ['iife'] : ['es'],
      },
      rollupOptions: {
        external: isWidget ? [] : ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          globals: isWidget
            ? {}
            : { react: 'React', 'react-dom': 'ReactDOM' },
        },
      },
      outDir: 'dist',
      emptyOutDir: !isWidget,
      copyPublicDir: false,
    },
  };
});
