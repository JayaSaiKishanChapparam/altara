/**
 * Page rendered by `run.mjs` in real Chromium. Every case mounts a real chart
 * against static data, so the runner can read back what the canvas actually
 * painted.
 *
 * Built from `src/` (not `dist/`) so a change to the draw code is tested
 * without a rebuild.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TimeSeries } from '../src/components/TimeSeries/TimeSeries';
import { MultiAxisPlot } from '../src/components/MultiAxisPlot/MultiAxisPlot';
import { createWorkerDataSource, type WorkerLike } from '../src/adapters/worker';
import { installWorkerBody, type SocketLike } from '../src/adapters/workerBody';
import type { AltaraDataSource, TelemetryValue } from '../src/adapters/types';
import { CASES, LINE_COLOR, WINDOW_MS, type PixelCase } from './cases';

/**
 * Samples spread evenly over most of the window. The margins keep the oldest
 * sample on screen for a few seconds while the runner waits for the draw.
 */
function samplesFor(c: PixelCase, now: number): TelemetryValue[] {
  const start = now - WINDOW_MS + 4_000;
  const end = now - 500;
  const spikeAt = c.n >> 1;
  return Array.from({ length: c.n }, (_, i) => {
    const timestamp = start + (i / (c.n - 1)) * (end - start);
    const value =
      c.kind === 'flat' ? 0.5 : c.kind === 'spike' ? (i === spikeAt ? 1 : 0) : Math.sin(timestamp / 3_000);
    return { value, timestamp, channel: 'a' };
  });
}

/** Plain source: charts buffer it locally and decimate in the draw pass. */
function localSource(samples: TelemetryValue[]): AltaraDataSource {
  return { subscribe: () => () => undefined, getHistory: () => samples, status: 'connected', destroy() {} };
}

/**
 * The real worker body, run on this page instead of in a Worker. Messages in
 * both directions go through `structuredClone`, the same copy a real
 * `postMessage` makes, so frames reach the chart in the shape a real worker
 * would deliver.
 */
function inPageWorker(samples: TelemetryValue[]): WorkerLike {
  const listeners: Array<(ev: MessageEvent) => void> = [];
  const scope = {
    onmessage: null as ((ev: { data: unknown }) => void) | null,
    postMessage(msg: unknown) {
      const data = structuredClone(msg);
      setTimeout(() => listeners.forEach((l) => l({ data } as MessageEvent)), 0);
    },
  };
  installWorkerBody(scope, {
    createSocket: () => {
      const socket: SocketLike = {
        send() {},
        close() {},
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };
      setTimeout(() => {
        socket.onopen?.();
        for (const s of samples) socket.onmessage?.({ data: s });
      }, 0);
      return socket;
    },
  });
  return {
    postMessage(msg: unknown) {
      const data = structuredClone(msg);
      setTimeout(() => scope.onmessage?.({ data }), 0);
    },
    terminate() {},
    addEventListener(_event, cb) {
      listeners.push(cb);
    },
  };
}

const now = Date.now();
for (const c of CASES) {
  const host = document.createElement('div');
  host.id = c.id;
  host.style.width = '840px';
  document.body.appendChild(host);

  const samples = samplesFor(c, now);
  const dataSource =
    c.path === 'local'
      ? localSource(samples)
      : createWorkerDataSource({
          url: 'ws://pixel-test',
          extractorSource: '(m) => m',
          workerImpl: () => inPageWorker(samples),
        });
  const channel = { key: 'a', label: c.id, color: LINE_COLOR };
  const props = { dataSource, windowMs: WINDOW_MS, height: 160 };
  createRoot(host).render(
    c.chart === 'TimeSeries'
      ? createElement(TimeSeries, { ...props, channels: [channel] })
      : createElement(MultiAxisPlot, { ...props, channels: [{ ...channel, axis: 'left' as const }] }),
  );
}
Object.assign(window, { __cases: CASES, __mounted: true });
