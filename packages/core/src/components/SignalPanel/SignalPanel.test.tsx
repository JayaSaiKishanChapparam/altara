import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalPanel } from './SignalPanel';
import type { AltaraDataSource, TelemetryValue } from '../../adapters/types';

function controllableSource(): AltaraDataSource & {
  emit(value: number, timestamp?: number): void;
  history: TelemetryValue[];
} {
  const subs = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  return {
    history,
    emit(value, timestamp = Date.now()) {
      const v: TelemetryValue = { value, timestamp };
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

describe('SignalPanel', () => {
  it('renders a row per signal with label and a status dot', () => {
    render(
      <SignalPanel
        signals={[
          { key: 'a', label: 'Battery', unit: '%' },
          { key: 'b', label: 'Voltage', unit: 'V' },
        ]}
      />,
    );
    expect(screen.getByText('Battery')).toBeTruthy();
    expect(screen.getByText('Voltage')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('reflects warn / danger thresholds (above direction)', () => {
    const ds = controllableSource();
    const { container } = render(
      <SignalPanel
        signals={[{ key: 't', label: 'Temp', warnAt: 60, dangerAt: 80, dataSource: ds }]}
      />,
    );
    const dot = () => container.querySelector('.vt-status-dot') as HTMLElement;

    act(() => ds.emit(20));
    expect(dot().getAttribute('data-status')).toBe('active');

    act(() => ds.emit(65));
    expect(dot().getAttribute('data-status')).toBe('warn');

    act(() => ds.emit(95));
    expect(dot().getAttribute('data-status')).toBe('danger');
  });

  it('handles thresholdDirection=below (battery-style)', () => {
    const ds = controllableSource();
    const { container } = render(
      <SignalPanel
        signals={[
          {
            key: 'b',
            label: 'Battery',
            warnAt: 30,
            dangerAt: 15,
            thresholdDirection: 'below',
            dataSource: ds,
          },
        ]}
      />,
    );
    const dot = () => container.querySelector('.vt-status-dot') as HTMLElement;
    act(() => ds.emit(80));
    expect(dot().getAttribute('data-status')).toBe('active');
    act(() => ds.emit(20));
    expect(dot().getAttribute('data-status')).toBe('warn');
    act(() => ds.emit(5));
    expect(dot().getAttribute('data-status')).toBe('danger');
  });

  it('marks rows stale once the latest sample exceeds staleAfterMs', () => {
    vi.setSystemTime(new Date(0));
    const ds = controllableSource();
    const { container } = render(
      <SignalPanel signals={[{ key: 's', label: 'Sig', dataSource: ds }]} staleAfterMs={1000} />,
    );
    act(() => ds.emit(42));
    expect(container.querySelector('.vt-status-dot')!.getAttribute('data-status')).toBe(
      'active',
    );
    vi.setSystemTime(new Date(2000));
    act(() => vi.advanceTimersByTime(600)); // periodic refresh (staleAfterMs/2)
    expect(container.querySelector('.vt-status-dot')!.getAttribute('data-status')).toBe('stale');
  });

  it('flashes the row on each new sample', () => {
    const ds = controllableSource();
    const { container } = render(
      <SignalPanel signals={[{ key: 'f', label: 'F', dataSource: ds }]} />,
    );
    act(() => ds.emit(1));
    const row = container.querySelector('.vt-signal-row') as HTMLElement;
    expect(row.getAttribute('data-flash')).toBe('true');
  });

  it('lays out signals across the configured columns', () => {
    const { container } = render(
      <SignalPanel
        signals={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
        columns={3}
      />,
    );
    const root = container.querySelector('.vt-signal-panel') as HTMLElement;
    expect(root.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('formats the displayed value with sensible precision', () => {
    const ds = controllableSource();
    const { rerender } = render(
      <SignalPanel signals={[{ key: 'n', label: 'N', dataSource: ds }]} />,
    );
    act(() => ds.emit(0.123));
    expect(screen.getByText('0.12')).toBeTruthy();
    act(() => ds.emit(12.34));
    expect(screen.getByText('12.3')).toBeTruthy();
    act(() => ds.emit(1234.5));
    expect(screen.getByText('1235')).toBeTruthy();
    // No data → em dash placeholder.
    rerender(<SignalPanel signals={[{ key: 'n2', label: 'N2' }]} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
