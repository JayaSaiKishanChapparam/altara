import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiAxisPlot } from './MultiAxisPlot';
import type { AltaraDataSource, TelemetryValue } from '../../adapters/types';

class FakeResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function makeFakeCtx() {
  const noop = () => undefined;
  return {
    fillRect: noop,
    clearRect: noop,
    fillText: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    setLineDash: noop,
    save: noop,
    restore: noop,
    setTransform: noop,
    translate: noop,
    rotate: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  // @ts-expect-error — install global stub for happy-dom.
  globalThis.ResizeObserver = FakeResizeObserver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function getContext() {
    return makeFakeCtx();
  };
});
afterEach(() => {
  // @ts-expect-error — cleanup.
  delete globalThis.ResizeObserver;
});

function ctrl(): AltaraDataSource & { emit(value: number, channel?: string): void } {
  const subs = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  return {
    emit(value, channel) {
      const v: TelemetryValue = { value, timestamp: Date.now(), ...(channel ? { channel } : {}) };
      history.push(v);
      for (const s of subs) s(v);
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getHistory: () => history.slice(),
    status: 'connected' as const,
    destroy() {
      subs.clear();
    },
  };
}

describe('MultiAxisPlot', () => {
  it('renders a canvas with role=img and an aria-label listing channels', () => {
    const { getByRole } = render(
      <MultiAxisPlot
        mockMode
        channels={[
          { key: 'a', label: 'Battery', axis: 'left' },
          { key: 'b', label: 'Current', axis: 'right' },
        ]}
      />,
    );
    const canvas = getByRole('img');
    expect(canvas.getAttribute('aria-label')).toMatch(/Battery/);
    expect(canvas.getAttribute('aria-label')).toMatch(/Current/);
  });

  it('subscribes to dataSource and unsubscribes on unmount', () => {
    const ds = ctrl();
    const unsub = vi.fn();
    const realSub = ds.subscribe.bind(ds);
    ds.subscribe = (cb) => {
      const off = realSub(cb);
      return () => {
        unsub();
        off();
      };
    };
    const { unmount } = render(
      <MultiAxisPlot
        dataSource={ds}
        channels={[
          { key: 'a', label: 'A', axis: 'left' },
          { key: 'b', label: 'B', axis: 'right' },
        ]}
      />,
    );
    ds.emit(1, 'a');
    ds.emit(2, 'b');
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('honors custom height', () => {
    const { container } = render(
      <MultiAxisPlot
        mockMode
        height={420}
        channels={[{ key: 'a', label: 'A', axis: 'left' }]}
      />,
    );
    const root = container.querySelector('.vt-timeseries') as HTMLElement;
    expect(root.style.height).toBe('420px');
  });

  it('accepts thresholds with optional axis tag', () => {
    expect(() =>
      render(
        <MultiAxisPlot
          mockMode
          channels={[{ key: 'a', label: 'A', axis: 'left' }]}
          thresholds={[
            { value: 10, color: 'red' },
            { value: 5, color: 'orange', axis: 'right' },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});
