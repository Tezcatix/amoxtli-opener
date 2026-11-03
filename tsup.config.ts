import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
  },
  {
    entry: { 'amoxtli-opener': 'src/index.ts' },
    format: ['iife'],
    globalName: 'AmoxtliOpener',
    minify: true,
    sourcemap: true,
    target: 'es2020',
  },
  {
    // Recursos de ejemplo de Amoxtli, para la demo (no forman parte del paquete publicado).
    entry: { 'amoxtli-preset': 'examples/amoxtli/index.ts' },
    format: ['iife'],
    globalName: 'AmoxtliPreset',
    outDir: 'dist-examples',
    target: 'es2020',
  },
]);
