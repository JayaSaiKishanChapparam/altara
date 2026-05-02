import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeSeries } from './TimeSeries';
import type { AltaraDataSource, TelemetryValue } from '../../adapters/types';

class FakeResizeObserver {
  cb: (entries: unknown[]) => void;
  constructor(cb: (entries: unknown[]) => void) {
    this.cb = cb;
  }
  observe() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
  unobserve() {
    /* no-op */
  }
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
    scale: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  // @ts-expect-error — install global test double.
  globalThis.ResizeObserver = FakeResizeObserver;
  // happy-dom doesn't implement canvas.getContext — return a no-op stub.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function getContext() {
    return makeFakeCtx();
  };
});

afterEach(() => {
  // @ts-expect-error — cleanup the test double.
  delete globalThis.ResizeObserver;
});

function controllableSource(): AltaraDataSource & { emit(value: number, channel?: string): void } {
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

describe('TimeSeries', () => {
  it('renders a canvas with role=img and an aria-label', () => {
    const { container, getByRole } = render(<TimeSeries mockMode />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/Time series/);
  });

  it('mockMode mounts and runs without errors with no other props', () => {
    expect(() => render(<TimeSeries mockMode />)).not.toThrow();
  });

  it('builds the aria-label from channel labels', () => {
    const { getByRole } = render(
      <TimeSeries
        mockMode
        channels={[
          { key: 'a', label: 'Pitch' },
          { key: 'b', label: 'Roll' },
        ]}
      />,
    );
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/Pitch/);
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/Roll/);
  });

  it('subscribes to dataSource and unsubscribes on unmount', () => {
    const ds = controllableSource();
    const unsub = vi.fn();
    const realSub = ds.subscribe.bind(ds);
    ds.subscribe = (cb) => {
      const off = realSub(cb);
      return () => {
        unsub();
        off();
      };
    };
    const { unmount } = render(<TimeSeries dataSource={ds} />);
    ds.emit(1);
    ds.emit(2);
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('honors a custom height', () => {
    const { container } = render(<TimeSeries mockMode height={420} />);
    const root = container.querySelector('.vt-timeseries') as HTMLElement;
    expect(root.style.height).toBe('420px');
  });

  it('accepts thresholds prop without throwing', () => {
    expect(() =>
      render(
        <TimeSeries
          mockMode
          thresholds={[
            { value: 10, color: 'var(--vt-color-warn)' },
            { value: 20, color: 'var(--vt-color-danger)' },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});
