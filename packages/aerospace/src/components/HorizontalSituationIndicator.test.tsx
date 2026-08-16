import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { AltaraDataSource, TelemetryValue } from '@altara/core';
import { HorizontalSituationIndicator } from './HorizontalSituationIndicator';

// Stub canvas API for happy-dom — Altara components paint to it.
function makeFakeCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    fillRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeRect: noop,
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
    measureText: () => ({ width: 0 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
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
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

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

describe('HorizontalSituationIndicator channel routing', () => {
  it('ignores channels it does not own instead of folding them into heading', () => {
    const ds = controllableSource();
    const { getByRole, rerender } = render(<HorizontalSituationIndicator dataSource={ds} />);
    ds.emit(107, 'heading');
    ds.emit(50, 'course');
    // A merged source also carries foreign channels. Before the fix these fell
    // through to heading, so a battery reading of 85.9% spun the compass to 86°.
    ds.emit(85.9, 'battery');
    ds.emit(4553, 'altitude');
    ds.emit(-18, 'roll');
    // The aria-label is computed at render time from a ref, so force a render.
    rerender(<HorizontalSituationIndicator dataSource={ds} />);
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/heading 107°/);
    expect(label).toMatch(/course 50°/);
  });

  it('drives heading from untagged samples so single-channel sources still work', () => {
    const ds = controllableSource();
    const { getByRole, rerender } = render(<HorizontalSituationIndicator dataSource={ds} />);
    ds.emit(212);
    rerender(<HorizontalSituationIndicator dataSource={ds} />);
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/heading 212°/);
  });

  it('routes every owned channel from a merged source', () => {
    const ds = controllableSource();
    const { getByRole, rerender } = render(<HorizontalSituationIndicator dataSource={ds} />);
    ds.emit(33, 'heading');
    ds.emit(60, 'headingBug');
    ds.emit(128, 'course');
    ds.emit(0.5, 'courseDev');
    rerender(<HorizontalSituationIndicator dataSource={ds} />);
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/heading 33°/);
    expect(label).toMatch(/course 128°/);
  });

  it('replays channel-routed history on mount', () => {
    const ds: AltaraDataSource = {
      subscribe: () => () => undefined,
      getHistory: () => [
        { value: 90, timestamp: 1, channel: 'heading' },
        { value: 45, timestamp: 2, channel: 'course' },
        { value: 85.9, timestamp: 3, channel: 'battery' },
      ],
      status: 'connected',
      destroy() {},
    };
    const { getByRole, rerender } = render(<HorizontalSituationIndicator dataSource={ds} />);
    rerender(<HorizontalSituationIndicator dataSource={ds} />);
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/heading 90°/);
    expect(label).toMatch(/course 45°/);
  });
});
