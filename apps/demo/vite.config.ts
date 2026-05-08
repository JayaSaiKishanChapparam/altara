import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `BASE` is set in CI when building for GitHub Pages
// (e.g. BASE=/altara/demo/). Defaults to '/' for local dev.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
});
