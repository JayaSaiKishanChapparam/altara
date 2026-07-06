import { describe, expect, it } from 'vitest';
import { buildMinMaxBuckets, countVisibleSamples } from './minMaxDecimation';

function scratch(size: number) {
  return {
    minY: new Float64Array(size),
    maxY: new Float64Array(size),
    seen: new Uint8Array(size),
    touched: new Uint32Array(size),
  };
}

describe('min/max decimation', () => {
  it('counts only visible samples', () => {
    const times = new Float64Array([10, 20, 30, 40]);
    expect(countVisibleSamples(times, 4, 25)).toBe(2);
  });

  it('preserves min and max spikes per pixel column', () => {
    const values = new Float64Array([0, 10, -5, 3, 7]);
    const times = new Float64Array([0, 10, 20, 50, 90]);
    const s = scratch(10);

    const count = buildMinMaxBuckets(values, times, 5, 0, 100, 2, 0, (v) => v, s);

    expect(count).toBe(2);
    expect(s.touched[0]).toBe(0);
    expect(s.minY[0]).toBe(-5);
    expect(s.maxY[0]).toBe(10);
    expect(s.touched[1]).toBe(1);
    expect(s.minY[1]).toBe(3);
    expect(s.maxY[1]).toBe(7);
  });

  it('ignores samples before the visible window', () => {
    const values = new Float64Array([100, 1, 2]);
    const times = new Float64Array([0, 60, 90]);
    const s = scratch(10);

    const count = buildMinMaxBuckets(values, times, 3, 50, 50, 5, 0, (v) => v, s);

    expect(count).toBe(2);
    expect(Array.from(s.touched.slice(0, count))).not.toContain(0);
  });
});
