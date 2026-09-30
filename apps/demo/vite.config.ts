import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { attachTelemetryServer, TELEMETRY_PATH } from './scripts/telemetry-server.mjs';

// `BASE` is set in CI when building for GitHub Pages
// (e.g. BASE=/altara/demo/). Defaults to '/' for local dev.
const base = process.env.BASE ?? '/';

/**
 * Serves the synthetic high-rate feed the Worker Pipeline tab consumes, on the
 * same port as the app so the page can derive the URL from `location.host`.
 * Mounted on preview as well as dev, so the *built* demo can be exercised too.
 * A statically hosted build (GitHub Pages) has no server — that tab detects the
 * failed connection and says so rather than faking data.
 */
const telemetry = {
  name: 'altara-demo-telemetry',
  configureServer(server) {
    if (server.httpServer) attachTelemetryServer(server.httpServer, TELEMETRY_PATH);
  },
  configurePreviewServer(server) {
    if (server.httpServer) attachTelemetryServer(server.httpServer, TELEMETRY_PATH);
  },
};

export default defineConfig({
  base,
  plugins: [react(), telemetry],
});
