/**
 * Synthetic high-rate telemetry over WebSocket, for the Worker Pipeline tab.
 *
 * `createWorkerDataSource` spawns a Blob-URL worker that opens a real
 * `WebSocket`, so exercising that path needs a real server — there is no seam
 * for injecting samples into the library's worker from the page. This is that
 * server. It is mounted onto Vite's dev and preview servers (see vite.config.ts)
 * so `pnpm dev` and `pnpm preview` just work; it can also be run standalone:
 *
 *     node scripts/telemetry-server.mjs --port 8787
 *
 * No shebang on purpose: vite.config.ts imports this module, and esbuild only
 * strips shebangs from entry points — one inside an imported file is a syntax
 * error. Run it with `node scripts/telemetry-server.mjs`.
 *
 * The signal itself lives in `../src/telemetry/flightModel.js`, shared with the
 * in-worker simulation the hosted build falls back to. It is a small quadrotor
 * model rather than sine waves: body rates come from a damped second-order
 * response to a manoeuvre command with Ornstein-Uhlenbeck turbulence layered on,
 * plus discrete gust impulses. That matters for the demo — min/max decimation
 * exists to preserve exactly the short transients a sine wave never produces.
 */
import { WebSocketServer } from 'ws';
import {
  CHANNEL_HZ,
  TICK_HZ,
  allChannels,
  collectBatch,
  createFlightModel,
  createOwedMap,
} from '../src/telemetry/flightModel.js';

export const TELEMETRY_PATH = '/altara-telemetry';

/**
 * Drive one connected client. Emits `{ samples: [{ channel, value, timestamp }] }`
 * batches — one message carrying every sample due since the previous tick, so a
 * 5 kHz aggregate feed costs 50 messages/second rather than 5000.
 */
function driveClient(socket) {
  const step = createFlightModel();
  let channels = allChannels();

  // `createWorkerDataSource({ subscribeMessage })` sends this on connect. Each
  // client takes only the channels it renders, so several sources on one page
  // do not each pay for the whole feed.
  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!Array.isArray(msg?.channels)) return;
      const wanted = new Set(msg.channels);
      channels = allChannels().filter(([name]) => wanted.has(name));
    } catch {
      /* ignore malformed subscribe */
    }
  });

  const owed = createOwedMap();
  const tickMs = 1000 / TICK_HZ;
  let last = Date.now();

  const timer = setInterval(() => {
    if (socket.readyState !== socket.OPEN) return;

    const now = Date.now();
    const elapsed = Math.min(now - last, 250); // clamp after a tab stall
    last = now;

    const samples = collectBatch(step, owed, channels, now, elapsed);
    if (samples.length > 0) socket.send(JSON.stringify({ samples }));
  }, tickMs);

  socket.on('close', () => clearInterval(timer));
  socket.on('error', () => clearInterval(timer));
}

/**
 * Attach the feed to an existing HTTP server on {@link TELEMETRY_PATH}.
 * Uses `noServer` and ignores upgrades for other paths so Vite's own HMR
 * WebSocket on the same port keeps working.
 */
export function attachTelemetryServer(httpServer, path = TELEMETRY_PATH) {
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', driveClient);

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return;
    }
    // Not ours — leave it for Vite's HMR listener.
    if (pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  return wss;
}

// Standalone mode, for serving the built demo from something other than Vite.
if (process.argv[1] && process.argv[1].endsWith('telemetry-server.mjs')) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg !== -1 ? Number(process.argv[portArg + 1]) : 8787;
  const wss = new WebSocketServer({ port, path: TELEMETRY_PATH });
  wss.on('connection', driveClient);
  const total = Object.values(CHANNEL_HZ).reduce((a, b) => a + b, 0);
  console.log(
    `telemetry: ws://localhost:${port}${TELEMETRY_PATH} — ` +
      `${Object.keys(CHANNEL_HZ).length} channels, ${total} samples/s, ${TICK_HZ} msg/s`,
  );
}
