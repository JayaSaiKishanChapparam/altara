import type {
  AltaraDataSource,
  ConnectionStatus,
  TelemetryValue,
  WorkerPipelineOptions,
} from './types';

/**
 * Web Worker pipeline. Designed for ≥500 Hz feeds where running the
 * WebSocket on the main thread blocks the UI (blueprint §13, "WebSocket
 * flooding main thread"). The worker owns the socket, batches incoming
 * samples, and posts them to the main thread at a fixed cadence
 * (default 60 fps) — independent of the inbound rate.
 */

/**
 * Minimal subset of the `Worker` API used by `createWorkerDataSource`.
 * Lets tests or custom-transport environments inject a non-Worker double.
 */
export interface WorkerLike {
  /** Send a message to the worker. */
  postMessage(msg: unknown): void;
  /** Stop the worker permanently. */
  terminate(): void;
  /** Register a `message` event listener. */
  addEventListener(event: 'message', cb: (ev: MessageEvent) => void): void;
}

export interface CreateWorkerDataSourceOptions extends WorkerPipelineOptions {
  /**
   * Provide a custom Worker for tests or for environments where Blob
   * URLs aren't available. Defaults to spawning a Blob-URL Worker that
   * runs `WORKER_SOURCE`.
   */
  workerImpl?: () => WorkerLike;
}

interface BatchMessage {
  type: 'batch';
  samples: TelemetryValue[];
}
interface StatusMessage {
  type: 'status';
  value: ConnectionStatus;
}
type WorkerOutbound = BatchMessage | StatusMessage;

/**
 * The worker body, kept as a self-contained string so the library doesn't
 * need a second build entry — we Blob-URL it at runtime. Extractor is
 * provided as a source string because functions cannot be cloned across
 * the worker boundary.
 */
export const WORKER_SOURCE = `
(function () {
  var socket = null;
  var batch = [];
  var timer = null;
  var extractor = function (m) {
    return m && typeof m.data === 'number' ? m.data : undefined;
  };
  self.onmessage = function (e) {
    var data = e.data || {};
    if (data.type === 'start') {
      var cfg = data.config || {};
      if (cfg.extractorSource) {
        try {
          extractor = new Function('msg', 'return (' + cfg.extractorSource + ')(msg);');
        } catch (err) { /* keep default */ }
      }
      var flushMs = 1000 / Math.max(cfg.flushHz || 60, 1);
      try {
        socket = new WebSocket(cfg.url);
        socket.onopen = function () {
          if (cfg.subscribeMessage) {
            try { socket.send(JSON.stringify(cfg.subscribeMessage)); } catch (err) {}
          }
          self.postMessage({ type: 'status', value: 'connected' });
        };
        socket.onclose = function () {
          self.postMessage({ type: 'status', value: 'disconnected' });
        };
        socket.onerror = function () {
          self.postMessage({ type: 'status', value: 'error' });
        };
        socket.onmessage = function (ev) {
          try {
            var msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            var v = extractor(msg);
            if (typeof v === 'number' && !isNaN(v)) {
              batch.push({ value: v, timestamp: Date.now() });
            }
          } catch (err) { /* drop */ }
        };
      } catch (err) {
        self.postMessage({ type: 'status', value: 'error' });
      }
      timer = setInterval(function () {
        if (batch.length === 0) return;
        var samples = batch;
        batch = [];
        self.postMessage({ type: 'batch', samples: samples });
      }, flushMs);
    } else if (data.type === 'stop') {
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (socket) { try { socket.close(); } catch (err) {} socket = null; }
      batch = [];
    }
  };
})();
`;

function defaultWorkerFactory(): WorkerLike {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    throw new Error(
      'createWorkerDataSource requires a browser environment with Worker + Blob support',
    );
  }
  const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

/**
 * Spawn a worker-backed AltaraDataSource. The worker connects to `url`,
 * extracts a numeric sample per message, and posts batches at `flushHz`.
 */
export function createWorkerDataSource(
  options: CreateWorkerDataSourceOptions,
): AltaraDataSource {
  const { bufferSize = 10_000 } = options;
  const subs = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  let status: ConnectionStatus = 'connecting';
  let destroyed = false;

  const worker = options.workerImpl ? options.workerImpl() : defaultWorkerFactory();

  worker.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as WorkerOutbound | undefined;
    if (!msg) return;
    if (msg.type === 'batch') {
      for (const s of msg.samples) {
        history.push(s);
        if (history.length > bufferSize) history.splice(0, history.length - bufferSize);
        for (const cb of subs) cb(s);
      }
    } else if (msg.type === 'status') {
      status = msg.value;
    }
  });

  worker.postMessage({
    type: 'start',
    config: {
      url: options.url,
      subscribeMessage: options.subscribeMessage,
      flushHz: options.flushHz ?? 60,
      extractorSource: options.extractorSource,
    },
  });

  return {
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getHistory: () => history.slice(),
    get status() {
      return status;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        worker.postMessage({ type: 'stop' });
      } catch {
        // worker may have already terminated
      }
      worker.terminate();
      subs.clear();
      status = 'disconnected';
    },
  };
}
