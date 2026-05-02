import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Attitude } from './Attitude';
import type { AltaraDataSource, TelemetryValue } from '../../adapters/types';

function makeFakeCtx() {
  const noop = () => undefined;
  return {
    fillRect: noop,
    clearRect: noop,
    fillText: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    save: noop,
    restore: noop,
    setTransform: noop,
    translate: noop,
    rotate: noop,
    clip: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.useFakeTimers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function getContext() {
    return makeFakeCtx();
  };
});
afterEach(() => vi.useRealTimers());

function controllableSource(): AltaraDataSource & {
  emit(value: number, channel?: string): void;
} {
  const subs = new Set<(v: TelemetryValue) => void>();
  return {
    emit(value, channel) {
      const v: TelemetryValue = { value, timestamp: Date.now(), ...(channel ? { channel } : {}) };
      for (const s of subs) s(v);
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getHistory: () => [],
    status: 'connected' as const,
    destroy() {
      subs.clear();
    },
  };
}

describe('Attitude', () => {
  it('renders a canvas inside a role=img wrapper with attitude in the label', () => {
    const { container, getByRole } = render(<Attitude roll={5} pitch={-3} />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/roll 5\.0°/);
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/pitch -3\.0°/);
  });

  it('honors the size prop', () => {
    const { container } = render(<Attitude roll={0} pitch={0} size={300} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('300px');
    expect(wrapper.style.height).toBe('300px');
  });

  it('updates the live label when a dataSource emits', () => {
    const ds = controllableSource();
    const { getByRole } = render(<Attitude dataSource={ds} />);
    act(() => ds.emit(45, 'roll'));
    act(() => ds.emit(-10, 'pitch'));
    // The label refreshes via a periodic tick — fast-forward past it.
    act(() => vi.advanceTimersByTime(600));
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/roll 45\.0°/);
    expect(label).toMatch(/pitch -10\.0°/);
  });

  it('mockMode mounts and runs without errors when no dataSource is given', () => {
    expect(() => render(<Attitude mockMode />)).not.toThrow();
  });
});
