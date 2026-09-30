/**
 * Runs the **real** Altara worker body against a **simulated** data source.
 *
 * Statically hosted (GitHub Pages) there is no telemetry server to open a socket
 * to, and `createWorkerDataSource` builds its worker from a Blob URL that opens
 * a real `WebSocket`. Rather than fake the whole tab, this module runs the
 * genuine library body — same ring buffers, same min/max decimation, same epoch
 * and credit protocol — and swaps only the socket underneath it.
 *
 * The seam is `WORKER_SOURCE`: the body resolves its socket constructor from the
 * worker's global scope, so assigning `globalThis.WebSocket` before evaluating
 * it is enough. Nothing about the pipeline is mocked; only the samples are
 * generated here instead of arriving over the network.
 */
import { WORKER_SOURCE } from '@altara/core';
import {
  TICK_HZ,
  allChannels,
  collectBatch,
  createFlightModel,
  createOwedMap,
} from './flightModel';

type Listener = (() => void) | null;
type MessageListener = ((ev: { data: unknown }) => void) | null;

/**
 * Enough of the `WebSocket` surface for the worker body to drive: it assigns the
 * four handlers after construction, calls `send` once with the subscribe
 * envelope, and calls `close` on stop.
 */
class SimulatedSocket {
  onopen: Listener = null;
  onclose: Listener = null;
  onerror: Listener = null;
  onmessage: MessageListener = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private last = Date.now();
  private readonly step = createFlightModel();
  private readonly owed = createOwedMap();
  private channels = allChannels();

  constructor(_url: string) {
    // The body assigns its handlers *after* the constructor returns, so opening
    // synchronously here would fire into nulls.
    setTimeout(() => {
      this.onopen?.();
      this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
    }, 0);
  }

  /** The body sends `subscribeMessage` on open; honour its channel filter. */
  send(data: string): void {
    try {
      const msg = JSON.parse(data) as { channels?: unknown };
      if (Array.isArray(msg.channels)) {
        const wanted = new Set(msg.channels as string[]);
        this.channels = allChannels().filter(([name]) => wanted.has(name));
      }
    } catch {
      /* ignore malformed subscribe */
    }
  }

  close(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.onclose?.();
  }

  private tick(): void {
    const now = Date.now();
    const elapsed = Math.min(now - this.last, 250); // clamp after a tab stall
    this.last = now;

    const samples = collectBatch(this.step, this.owed, this.channels, now, elapsed);
    if (samples.length === 0) return;
    // The body accepts a pre-parsed object as well as a JSON string, so skip a
    // serialise/parse round trip that would exist only to look like a network.
    this.onmessage?.({ data: { samples } });
  }
}

(globalThis as unknown as { WebSocket: typeof SimulatedSocket }).WebSocket =
  SimulatedSocket;

// Evaluate the library's worker body in this scope. It installs the `onmessage`
// handler that `createWorkerDataSource` on the main thread talks to.
new Function(WORKER_SOURCE)();
