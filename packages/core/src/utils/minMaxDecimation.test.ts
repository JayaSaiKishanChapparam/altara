import { describe, expect, it } from 'vitest';
import {
  allocBucketScratch,
  allocDataBucketScratch,
  buildDataBuckets,
  buildMinMaxBuckets,
  countVisibleSamples,
  scanVisible,
  traceM4Column,
} from './minMaxDecimation';

const scratch = allocBucketScratch;

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
  const scratchFor = allocDataBucketScratch;

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

    const pixelScratch = allocBucketScratch(512);
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

describe('M4 first/last per column (#39)', () => {
  it('records the first and last sample of each column alongside min/max', () => {
    // Column 0: 5, 1, 9, 4 — first 5, last 4, min 1, max 9.
    const values = new Float64Array([5, 1, 9, 4, 7]);
    const times = new Float64Array([0, 10, 20, 30, 60]);
    const s = allocDataBucketScratch(8);
    const touched = buildDataBuckets(values, times, 5, 0, 100, 2, s);

    expect(touched).toBe(2);
    expect([s.firstV[0], s.minV[0], s.maxV[0], s.lastV[0]]).toEqual([5, 1, 9, 4]);
    // A single-sample column: all four collapse to the one value.
    expect([s.firstV[1], s.minV[1], s.maxV[1], s.lastV[1]]).toEqual([7, 7, 7, 7]);
  });

  it('picks first/last by timestamp, not arrival order', () => {
    // Arrives 2nd-1st-3rd in time: first must be the t=5 sample, last t=30.
    const values = new Float64Array([20, 10, 30]);
    const times = new Float64Array([20, 5, 30]);
    const s = allocDataBucketScratch(4);
    buildDataBuckets(values, times, 3, 0, 100, 1, s);

    expect(s.firstV[0]).toBe(10);
    expect(s.lastV[0]).toBe(30);
  });

  it('returns columns in ascending order even when samples arrive out of order', () => {
    // A merged feed: a late sample lands in an earlier column than the one before it.
    const values = new Float64Array([1, 2, 3, 4]);
    const times = new Float64Array([80, 10, 50, 30]);
    const data = allocDataBucketScratch(16);
    const pixel = allocBucketScratch(16);
    const n = buildDataBuckets(values, times, 4, 0, 100, 10, data);
    const m = buildMinMaxBuckets(values, times, 4, 0, 100, 10, 0, (v) => v, pixel);

    expect(Array.from(data.touched.subarray(0, n))).toEqual([1, 3, 5, 8]);
    expect(Array.from(pixel.touched.subarray(0, m))).toEqual([1, 3, 5, 8]);
  });

  it('agrees between the data-space and pixel-space kernels', () => {
    const n = 500;
    const values = new Float64Array(n);
    const times = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      values[i] = Math.sin(i / 9) * 10 + (i === 250 ? 40 : 0);
      times[i] = i;
    }
    const yFor = (v: number) => 100 - v * 2;
    const data = allocDataBucketScratch(64);
    const pixel = allocBucketScratch(64);
    const count = buildDataBuckets(values, times, n, 0, n, 37, data);
    buildMinMaxBuckets(values, times, n, 0, n, 37, 0, yFor, pixel);

    for (let i = 0; i < count; i++) {
      const b = data.touched[i]!;
      expect(yFor(data.firstV[b]!)).toBeCloseTo(pixel.firstY[b]!, 10);
      expect(yFor(data.lastV[b]!)).toBeCloseTo(pixel.lastY[b]!, 10);
    }
  });
});

describe('traceM4Column', () => {
  /** Records path commands and measures the stroked length they describe. */
  function recorder() {
    const ops: Array<[string, number, number]> = [];
    return {
      ops,
      moveTo: (x: number, y: number) => void ops.push(['M', x, y]),
      lineTo: (x: number, y: number) => void ops.push(['L', x, y]),
      length() {
        let len = 0;
        for (let i = 1; i < ops.length; i++) {
          if (ops[i]![0] === 'M') continue;
          len += Math.hypot(ops[i]![1] - ops[i - 1]![1], ops[i]![2] - ops[i - 1]![2]);
        }
        return len;
      },
    };
  }

  it('joins flat single-sample columns into a line with real length', () => {
    // The #39 case: every column has min = max. Drawn as separate segments,
    // each one was zero length and nothing painted.
    const ctx = recorder();
    for (let x = 0; x < 100; x++) traceM4Column(ctx, x === 0, x + 0.5, 50, 50, 50, 50);
    expect(ctx.ops.filter((o) => o[0] === 'M')).toHaveLength(1);
    expect(ctx.length()).toBeCloseTo(99, 6);
  });

  it('keeps a lone spike connected to the line on both sides', () => {
    const ctx = recorder();
    const cols = [
      [50, 50, 50, 50],
      [5, 5, 5, 5], // one-sample spike column
      [50, 50, 50, 50],
    ];
    cols.forEach(([f, lo, hi, l], i) => traceM4Column(ctx, i === 0, i + 0.5, f!, lo!, hi!, l!));
    // Up 45 px into the spike column and back down 45 px, plus 1 px across each time.
    expect(ctx.length()).toBeCloseTo(2 * Math.hypot(1, 45), 6);
    expect(Math.min(...ctx.ops.map((o) => o[2]))).toBe(5);
  });

  it('sweeps the full min..max extent of a column', () => {
    const ctx = recorder();
    traceM4Column(ctx, true, 0.5, 40, 10, 90, 60);
    expect(ctx.ops).toEqual([
      ['M', 0.5, 40],
      ['L', 0.5, 10],
      ['L', 0.5, 90],
      ['L', 0.5, 60],
    ]);
  });
});
