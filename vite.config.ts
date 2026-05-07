import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget';

  return {
    plugins: [
      react(),
      ...(!isWidget ? [dts({ include: ['src'] })] : []),
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
      sourcemap: true,
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
          // Force the extracted CSS to be `pet.css` rather than entry-named.
          assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'pet.css' : 'assets/[name]-[hash][extname]'),
        },
      },
      outDir: 'dist',
      emptyOutDir: !isWidget,
      copyPublicDir: false,
    },
  };
});
