import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'leaflet',
    'react-leaflet',
    'react-grid-layout',
    'three',
    '@react-three/fiber',
    'mqtt',
  ],
});
