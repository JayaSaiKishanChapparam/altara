/** Types for `flightModel.js`, which is plain JS so Node and Vite can share it. */

/** One generated sample, in the shape the worker's extractor expects. */
export interface FlightSample {
  channel: string;
  value: number;
  timestamp: number;
}

/** Channel name → wall-clock rate in Hz. */
export declare const CHANNEL_HZ: Record<string, number>;

/** How often a batch is emitted, in Hz. */
export declare const TICK_HZ: number;

/** Advance the model by `dt` seconds; returns the current value of every channel. */
export type FlightStep = (dt: number) => Record<string, number>;

/** Build a fresh model instance with its own state. */
export declare function createFlightModel(): FlightStep;

/** Fractional per-channel sample debt, carried between batches. */
export type OwedMap = Map<string, number>;

export declare function createOwedMap(): OwedMap;

/** Every channel the model produces, as `[name, hz]` pairs. */
export declare function allChannels(): Array<[string, number]>;

/** Advance the model and collect every sample due over `elapsedMs`. */
export declare function collectBatch(
  step: FlightStep,
  owed: OwedMap,
  channels: Array<[string, number]>,
  now: number,
  elapsedMs: number,
): FlightSample[];
