import type { AltaraDataSource, TelemetryValue } from '../adapters/types';

/**
 * Pure generators — given a wall-clock time in ms, return a sample value.
 * These are the building blocks for `mockMode` on every component
 * (blueprint §5.5).
 */
export type MockGenerator = (timeMs: number) => number;

/** Smooth sine wave at `hz` cycles/sec, centered on zero, peak `amplitude`. */
export function sineWave(hz = 1, amplitude = 50): MockGenerator {
  const omega = 2 * Math.PI * hz;
  return (t) => Math.sin(omega * (t / 1000)) * amplitude;
}

/**
 * Bounded random walk. Each call adds a small random delta and clamps
 * to [-bound, bound]. `drift` controls step magnitude as a fraction of
 * the bound. Stateful — returned generator owns its own value.
 */
export function randomWalk(drift = 0.1, bound = 100, seed = 0.5): MockGenerator {
  let value = seed * bound;
  return () => {
    value += (Math.random() * 2 - 1) * drift * bound;
    if (value > bound) value = bound;
    if (value < -bound) value = -bound;
    return value;
  };
}

/**
 * Discrete step changes: returns a constant value that flips between
 * `low` and `high` every `intervalMs`. Useful for state-machine signals.
 */
export function stepFunction(intervalMs = 1000, low = 0, high = 1): MockGenerator {
  return (t) => (Math.floor(t / intervalMs) % 2 === 0 ? low : high);
}

/** Pass-through wrapper for arbitrary user generators. */
export function custom(fn: MockGenerator): MockGenerator {
  return fn;
}

export interface MockDataSourceOptions {
  /** Generator function — defaults to a 1 Hz sine wave with amplitude 50. */
  generator?: MockGenerator;
  /** Sample rate in Hz. Default: 30. */
  hz?: number;
  /** Pre-seed the history buffer with this many samples. Default: 0. */
  seedCount?: number;
  /** Optional channel tag attached to each emitted value. Use to drive multi-channel components from one source. */
  channel?: string;
}

/**
 * Wraps a generator as a full AltaraDataSource — what `mockMode` plumbs
 * into components. Uses setInterval; safe to destroy multiple times.
 */
export function createMockDataSource(options: MockDataSourceOptions = {}): AltaraDataSource {
  const {
    generator = sineWave(),
    hz = 30,
    seedCount = 0,
    channel,
  } = options;

  const subscribers = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  const periodMs = 1000 / hz;
  let destroyed = false;

  const startTime = Date.now() - seedCount * periodMs;
  for (let i = 0; i < seedCount; i++) {
    const t = startTime + i * periodMs;
    history.push({ value: generator(t), timestamp: t, ...(channel ? { channel } : {}) });
  }

  const interval = setInterval(() => {
    if (destroyed) return;
    const t = Date.now();
    const sample: TelemetryValue = {
      value: generator(t),
      timestamp: t,
      ...(channel ? { channel } : {}),
    };
    history.push(sample);
    // Bound history to ~10k samples so a long-running mock doesn't leak.
    if (history.length > 10_000) history.splice(0, history.length - 10_000);
    for (const cb of subscribers) cb(sample);
  }, periodMs);

  return {
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    getHistory: () => history.slice(),
    get status() {
      return destroyed ? 'disconnected' : 'connected';
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(interval);
      subscribers.clear();
    },
  };
}
