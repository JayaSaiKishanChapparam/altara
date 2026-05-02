import { useEffect, useState } from 'react';
import type { AltaraDataSource, ConnectionStatus, TelemetryValue } from '../adapters/types';
import { RingBuffer } from '../utils/RingBuffer';
import { useRingBuffer } from './useRingBuffer';

export interface UseTelemetryResult {
  /** Most recent value, or `null` until the first sample arrives. */
  latest: TelemetryValue | null;
  /** Live connection state mirrored from the underlying `AltaraDataSource`. */
  status: ConnectionStatus;
  /** Stable `RingBuffer` instance. Read from this directly inside rAF loops to bypass React. */
  buffer: RingBuffer;
  /** Current number of samples in `buffer`. Triggers re-render on every new sample. */
  sampleCount: number;
}

/**
 * Convenience hook: subscribes to an AltaraDataSource, mirrors values into
 * a RingBuffer, and exposes the latest sample plus connection status as
 * React state. Components that need 60fps drawing should read from
 * `buffer` inside their rAF loop instead of `latest` (which triggers a
 * re-render per sample).
 */
export function useTelemetry(
  dataSource: AltaraDataSource | undefined,
  bufferSize = 10_000,
): UseTelemetryResult {
  const buffer = useRingBuffer(bufferSize);
  const [latest, setLatest] = useState<TelemetryValue | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(
    dataSource?.status ?? 'disconnected',
  );
  const [sampleCount, setSampleCount] = useState(0);

  useEffect(() => {
    if (!dataSource) {
      setStatus('disconnected');
      return;
    }

    // Replay history into the buffer so first paint has data.
    buffer.clear();
    for (const v of dataSource.getHistory()) {
      buffer.push(v.value, v.timestamp);
    }
    setSampleCount(buffer.length);
    const last = buffer.last();
    if (last) setLatest({ value: last.value, timestamp: last.timestamp });
    setStatus(dataSource.status);

    const unsubscribe = dataSource.subscribe((v) => {
      buffer.push(v.value, v.timestamp);
      setLatest(v);
      setSampleCount(buffer.length);
      setStatus(dataSource.status);
    });

    return () => {
      unsubscribe();
    };
  }, [dataSource, buffer]);

  return { latest, status, buffer, sampleCount };
}
