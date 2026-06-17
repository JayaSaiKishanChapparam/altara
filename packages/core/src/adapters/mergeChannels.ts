import type { AltaraDataSource, ConnectionStatus, TelemetryValue } from './types';

/**
 * Combine several single-value data sources into one channel-tagged source.
 *
 * Each key in `sources` becomes the `channel` on every sample its source
 * emits, so a multi-input component (e.g. `PrimaryFlightDisplay`, which routes
 * `roll`/`pitch`/`heading`/… by channel) can consume a single `dataSource`
 * instead of the caller hand-rolling a fan-in shim:
 *
 * ```ts
 * const pfd = mergeChannels({
 *   roll:     rollAdapter,
 *   pitch:    pitchAdapter,
 *   heading:  headingAdapter,
 *   airspeed: airspeedAdapter,
 *   altitude: altitudeAdapter,
 * });
 * // <PrimaryFlightDisplay dataSource={pfd} />
 * ```
 *
 * `getHistory()` replays every child's buffered history, tagged and merged in
 * timestamp order. `status` is the worst-of across children. `destroy()` tears
 * down every child source as well as this wrapper.
 *
 * An incoming sample's own `channel` (if any) is overwritten by its key here —
 * the key is authoritative.
 */
export function mergeChannels(sources: Record<string, AltaraDataSource>): AltaraDataSource {
  const entries = Object.entries(sources);
  const subscribers = new Set<(v: TelemetryValue) => void>();
  const unsubs: Array<() => void> = [];

  for (const [channel, src] of entries) {
    unsubs.push(
      src.subscribe((v) => {
        const tagged: TelemetryValue = { ...v, channel };
        for (const cb of subscribers) cb(tagged);
      }),
    );
  }

  return {
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    getHistory() {
      const all: TelemetryValue[] = [];
      for (const [channel, src] of entries) {
        for (const v of src.getHistory()) all.push({ ...v, channel });
      }
      return all.sort((a, b) => a.timestamp - b.timestamp);
    },
    get status(): ConnectionStatus {
      const states = entries.map(([, s]) => s.status);
      if (states.some((s) => s === 'error')) return 'error';
      if (states.some((s) => s === 'connecting')) return 'connecting';
      if (states.length > 0 && states.every((s) => s === 'connected')) return 'connected';
      return 'disconnected';
    },
    destroy() {
      for (const off of unsubs) off();
      subscribers.clear();
      for (const [, src] of entries) src.destroy();
    },
  };
}
