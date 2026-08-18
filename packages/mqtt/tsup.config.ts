import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Every entry point here is browser-only (React hooks, canvas, WebSocket).
  // Emit the directive so Next.js App Router consumers can import directly
  // from a server component file without hand-wrapping each import.
  banner: { js: '"use client";' },
  treeshake: true,
  external: ['react', 'react-dom', '@altara/core', 'mqtt'],
});
