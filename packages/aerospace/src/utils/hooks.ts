import { useEffect, useRef } from 'react';
import type { AltaraDataSource, TelemetryValue } from '@altara/core';

/**
 * Subscribe to an AltaraDataSource and route each sample to a per-channel
 * setter held in `stateRef`. Channels with no matching key are dropped.
 * Samples without a channel tag fall back to `defaultChannel`.
 */
export function useChannelSubscription<T extends Record<string, number>>(
  dataSource: AltaraDataSource | undefined,
  stateRef: React.MutableRefObject<T>,
  defaultChannel: keyof T,
): void {
  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => {
      const key = (v.channel ?? (defaultChannel as string)) as keyof T;
      if (key in stateRef.current) {
        (stateRef.current as Record<keyof T, number>)[key] = v.value;
      }
    };
    for (const v of dataSource.getHistory()) apply(v);
    const off = dataSource.subscribe(apply);
    return () => {
      off();
    };
  }, [dataSource, stateRef, defaultChannel]);
}

/**
 * Run `tick` at ~30 Hz when `enabled` is true. Cleaned up on unmount.
 * Use this for mockMode animation in components that don't already drive
 * a rAF loop.
 */
export function useTick(enabled: boolean, tick: () => void, intervalMs = 33): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => tickRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}

/** Force a re-render every `intervalMs` so live values update visually. */
export function useRerender(intervalMs = 100): void {
  const ref = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      ref.current = (ref.current + 1) % 1_000_000;
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
