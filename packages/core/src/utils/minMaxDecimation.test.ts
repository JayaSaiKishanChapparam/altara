import { describe, expect, it } from 'vitest';
import {
  buildDataBuckets,
  buildMinMaxBuckets,
  countVisibleSamples,
  scanVisible,
} from './minMaxDecimation';

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

describe('scanVisible', () => {
  it('counts only samples inside the window and reports their extent', () => {
    const values = new Float64Array([5, -2, 9, 4]);
    const times = new Float64Array([100, 200, 300, 400]);
    expect(scanVisible(values, times, 4, 200)).toEqual({ count: 3, min: -2, max: 9 });
  });

  it('returns an empty, non-finite extent when nothing is visible', () => {
    const values = new Float64Array([1, 2]);
    const times = new Float64Array([10, 20]);
    const r = scanVisible(values, times, 2, 1_000);
    expect(r.count).toBe(0);
    expect(Number.isFinite(r.min)).toBe(false);
    expect(Number.isFinite(r.max)).toBe(false);
  });
});

describe('buildDataBuckets', () => {
  const scratchFor = (n: number) => ({
    minV: new Float64Array(n),
    maxV: new Float64Array(n),
    seen: new Uint8Array(n),
    touched: new Uint32Array(n),
  });

  it('keeps data-space min/max per pixel column', () => {
    // Four samples across a 2-column plot: two per column.
    const values = new Float64Array([1, 7, 3, 9]);
    const times = new Float64Array([0, 10, 50, 60]);
    const scratch = scratchFor(16);
    const touched = buildDataBuckets(values, times, 4, 0, 100, 2, scratch);

    expect(touched).toBe(2);
    const cols = Array.from(scratch.touched.slice(0, touched)).sort();
    expect(cols).toEqual([0, 1]);
    expect(scratch.minV[0]).toBe(1);
    expect(scratch.maxV[0]).toBe(7);
    expect(scratch.minV[1]).toBe(3);
    expect(scratch.maxV[1]).toBe(9);
  });

  it('preserves an isolated spike instead of averaging it away', () => {
    const n = 1000;
    const values = new Float64Array(n).fill(0);
    const times = new Float64Array(n);
    for (let i = 0; i < n; i++) times[i] = i;
    values[500] = 42;

    const scratch = scratchFor(2048);
    const touched = buildDataBuckets(values, times, n, 0, n, 10, scratch);
    let seenMax = -Infinity;
    for (let i = 0; i < touched; i++) {
      const b = scratch.touched[i]!;
      if (scratch.maxV[b]! > seenMax) seenMax = scratch.maxV[b]!;
    }
    expect(seenMax).toBe(42);
  });

  it('ignores samples older than the window and clamps to the last column', () => {
    const values = new Float64Array([100, 1, 2]);
    const times = new Float64Array([0, 500, 1000]);
    const scratch = scratchFor(16);
    const touched = buildDataBuckets(values, times, 3, 400, 600, 4, scratch);

    for (let i = 0; i < touched; i++) {
      const b = scratch.touched[i]!;
      expect(b).toBeLessThan(4);
      expect(scratch.maxV[b]).not.toBe(100);
    }
  });

  it('agrees with the pixel-space variant once the caller projects the values', () => {
    const n = 300;
    const values = new Float64Array(n);
    const times = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      values[i] = Math.sin(i / 7) * 10;
      times[i] = i;
    }
    const yFor = (v: number) => 100 - v * 2;

    const dataScratch = scratchFor(512);
    const dataTouched = buildDataBuckets(values, times, n, 0, n, 20, dataScratch);

    const pixelScratch = {
      minY: new Float64Array(512),
      maxY: new Float64Array(512),
      seen: new Uint8Array(512),
      touched: new Uint32Array(512),
    };
    const pixelTouched = buildMinMaxBuckets(values, times, n, 0, n, 20, 0, yFor, pixelScratch);

    expect(dataTouched).toBe(pixelTouched);
    for (let i = 0; i < dataTouched; i++) {
      const b = dataScratch.touched[i]!;
      // yFor inverts, so the data-space min projects to the pixel-space max.
      expect(yFor(dataScratch.minV[b]!)).toBeCloseTo(pixelScratch.maxY[b]!, 10);
      expect(yFor(dataScratch.maxV[b]!)).toBeCloseTo(pixelScratch.minY[b]!, 10);
    }
  });
});
