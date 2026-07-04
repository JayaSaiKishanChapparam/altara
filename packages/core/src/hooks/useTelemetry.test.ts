import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AltaraDataSource, TelemetryValue } from '../adapters/types';
import { useTelemetry } from './useTelemetry';

function source(history: TelemetryValue[] = []): AltaraDataSource {
  const subscribers = new Set<(value: TelemetryValue) => void>();
  return {
    status: 'connected',
    getHistory: () => history,
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
}

describe('useTelemetry', () => {
  it('clears stale values when the data source is removed', () => {
    const dataSource = source([{ value: 42, timestamp: 1 }]);
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useTelemetry(active ? dataSource : undefined),
      { initialProps: { active: true } },
    );

    expect(result.current.latest?.value).toBe(42);
    expect(result.current.sampleCount).toBe(1);
    expect(result.current.buffer.length).toBe(1);

    rerender({ active: false });

    expect(result.current.status).toBe('disconnected');
    expect(result.current.latest).toBeNull();
    expect(result.current.sampleCount).toBe(0);
    expect(result.current.buffer.length).toBe(0);
  });

  it('unsubscribes from the previous source when switching', () => {
    const unsubscribe = vi.fn();
    const dataSource: AltaraDataSource = {
      status: 'connected',
      getHistory: () => [],
      subscribe: () => unsubscribe,
    };

    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useTelemetry(active ? dataSource : undefined),
      { initialProps: { active: true } },
    );

    act(() => rerender({ active: false }));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
