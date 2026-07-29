import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ZendbxReact',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@zendbx/sdk'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@zendbx/sdk': 'ZendbxSDK',
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
