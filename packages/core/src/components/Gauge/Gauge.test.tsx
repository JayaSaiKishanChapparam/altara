import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gauge } from './Gauge';
import type { AltaraDataSource, TelemetryValue } from '../../adapters/types';

function controllableSource(): AltaraDataSource & { emit(value: number): void } {
  const subs = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  return {
    emit(value) {
      const v = { value, timestamp: Date.now() };
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const needleAngle = (container: HTMLElement): number => {
  // The needle is the <g> wrapping the line+hub. We look it up by its
  // children rather than a class so the assertion is robust to internal
  // refactors. The SVG `transform` attribute is `rotate(angle cx cy)`.
  const groups = Array.from(container.querySelectorAll('g'));
  const needle = groups.find((g) => g.querySelector('line'));
  expect(needle).toBeTruthy();
  const attr = needle!.getAttribute('transform') ?? '';
  const m = attr.match(/rotate\(([-\d.]+)/);
  expect(m).not.toBeNull();
  return parseFloat(m![1]!);
};

describe('Gauge', () => {
  it('renders an SVG with role=img and an accessible label', () => {
    const { container, getByRole } = render(<Gauge min={0} max={100} label="Battery" unit="%" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/Battery/);
  });

  it('rotates the needle proportionally to value within [min,max]', () => {
    const ds = controllableSource();
    const { container } = render(<Gauge min={0} max={100} dataSource={ds} />);
    act(() => ds.emit(0));
    expect(needleAngle(container)).toBeCloseTo(-135, 5);
    act(() => ds.emit(100));
    expect(needleAngle(container)).toBeCloseTo(135, 5);
    act(() => ds.emit(50));
    expect(needleAngle(container)).toBeCloseTo(0, 5);
  });

  it('clamps values that fall outside [min,max]', () => {
    const ds = controllableSource();
    const { container } = render(<Gauge min={0} max={100} dataSource={ds} />);
    act(() => ds.emit(-50));
    expect(needleAngle(container)).toBeCloseTo(-135, 5);
    act(() => ds.emit(500));
    expect(needleAngle(container)).toBeCloseTo(135, 5);
  });

  it('respects size prop (sm/md/lg)', () => {
    for (const [size, px] of [
      ['sm', 120],
      ['md', 180],
      ['lg', 240],
    ] as const) {
      const { container, unmount } = render(<Gauge min={0} max={1} size={size} />);
      const root = container.querySelector('.vt-gauge') as HTMLElement;
      expect(root.style.width).toBe(`${px}px`);
      expect(root.style.height).toBe(`${px}px`);
      unmount();
    }
  });

  it('renders one threshold-zone arc per supplied threshold', () => {
    const { container } = render(
      <Gauge
        min={0}
        max={100}
        thresholds={[
          { value: 0, color: '#f00' },
          { value: 50, color: '#0f0' },
        ]}
      />,
    );
    // Base arc + two threshold segments = 3 arc paths.
    expect(container.querySelectorAll('path').length).toBe(3);
  });

  it('mockMode animates the needle without a dataSource', () => {
    const { container } = render(<Gauge min={0} max={100} mockMode />);
    const a0 = needleAngle(container);
    act(() => vi.advanceTimersByTime(2000));
    const a1 = needleAngle(container);
    expect(a1).not.toBe(a0);
  });

  it('shows em-dash placeholder until first sample arrives', () => {
    const { container } = render(<Gauge min={0} max={100} />);
    expect(container.textContent ?? '').toContain('—');
  });
});
