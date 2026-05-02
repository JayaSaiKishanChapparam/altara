import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockDataSource,
  custom,
  randomWalk,
  sineWave,
  stepFunction,
} from './mockData';

describe('mock generators', () => {
  it('sineWave produces values within [-amplitude, amplitude]', () => {
    const gen = sineWave(2, 10);
    for (let t = 0; t < 5000; t += 50) {
      const v = gen(t);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
    }
    // Sine through full cycle returns close to zero at t=0.
    expect(Math.abs(gen(0))).toBeLessThan(1e-9);
  });

  it('randomWalk stays inside the configured bound', () => {
    const gen = randomWalk(0.5, 5, 0.5);
    for (let i = 0; i < 1000; i++) {
      const v = gen(i);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('stepFunction toggles low/high on the configured interval', () => {
    const gen = stepFunction(1000, 0, 1);
    expect(gen(0)).toBe(0);
    expect(gen(999)).toBe(0);
    expect(gen(1000)).toBe(1);
    expect(gen(1999)).toBe(1);
    expect(gen(2000)).toBe(0);
  });

  it('custom passes the user fn through unchanged', () => {
    const fn = (t: number) => t * 2;
    expect(custom(fn)).toBe(fn);
  });
});

describe('createMockDataSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports connected status until destroyed', () => {
    const ds = createMockDataSource();
    expect(ds.status).toBe('connected');
    ds.destroy();
    expect(ds.status).toBe('disconnected');
  });

  it('emits samples to subscribers on its interval', () => {
    const ds = createMockDataSource({ hz: 100, generator: () => 42 });
    const sub = vi.fn();
    ds.subscribe(sub);
    vi.advanceTimersByTime(100); // 10ms period * 10 ticks = 100ms → 10 samples
    expect(sub).toHaveBeenCalled();
    expect(sub.mock.calls[0][0].value).toBe(42);
    ds.destroy();
  });

  it('seeds history when seedCount > 0', () => {
    const ds = createMockDataSource({ generator: () => 7, seedCount: 5, hz: 10 });
    const history = ds.getHistory();
    expect(history.length).toBe(5);
    expect(history.every((h) => h.value === 7)).toBe(true);
    ds.destroy();
  });

  it('attaches channel tag when configured', () => {
    const ds = createMockDataSource({ generator: () => 1, channel: 'imu' });
    const sub = vi.fn();
    ds.subscribe(sub);
    vi.advanceTimersByTime(50);
    expect(sub.mock.calls[0][0].channel).toBe('imu');
    ds.destroy();
  });

  it('unsubscribe stops delivery to that subscriber only', () => {
    const ds = createMockDataSource({ hz: 100 });
    const a = vi.fn();
    const b = vi.fn();
    const offA = ds.subscribe(a);
    ds.subscribe(b);
    vi.advanceTimersByTime(20);
    offA();
    a.mockClear();
    b.mockClear();
    vi.advanceTimersByTime(50);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    ds.destroy();
  });

  it('destroy is idempotent', () => {
    const ds = createMockDataSource();
    ds.destroy();
    expect(() => ds.destroy()).not.toThrow();
  });
});
