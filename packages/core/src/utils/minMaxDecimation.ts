export interface MinMaxBucketScratch {
  minY: Float64Array;
  maxY: Float64Array;
  /** Y of the earliest sample in the column (M4). */
  firstY: Float64Array;
  /** Y of the latest sample in the column (M4). */
  lastY: Float64Array;
  /** Timestamps behind `firstY`/`lastY`, so they're picked by time, not arrival order. */
  firstT: Float64Array;
  lastT: Float64Array;
  seen: Uint8Array;
  /** Populated column indices. Always ascending on return — see {@link sortTouched}. */
  touched: Uint32Array;
}

/** Allocate pixel-space scratch for up to `size` columns. Do it once, not per frame. */
export function allocBucketScratch(size: number): MinMaxBucketScratch {
  return {
    minY: new Float64Array(size),
    maxY: new Float64Array(size),
    firstY: new Float64Array(size),
    lastY: new Float64Array(size),
    firstT: new Float64Array(size),
    lastT: new Float64Array(size),
    seen: new Uint8Array(size),
    touched: new Uint32Array(size),
  };
}

/**
 * Columns are recorded in first-touch order, which is ascending only while
 * timestamps are. A merged or replayed feed can arrive out of order, and the
 * draw path joins consecutive columns into one line, so an out-of-order list
 * would zigzag. Sort only when the pass saw a column go backwards.
 */
function sortTouched(touched: Uint32Array, count: number, ordered: boolean): void {
  if (!ordered) touched.subarray(0, count).sort();
}

export function countVisibleSamples(times: Float64Array, len: number, tMin: number): number {
  let count = 0;
  for (let i = 0; i < len; i++) {
    if (times[i]! >= tMin) count++;
  }
  return count;
}

/**
 * Bucket visible samples into plot pixel columns, preserving telemetry spikes by
 * storing the min/max y extent per column instead of averaging values away.
 *
 * Also records each column's first and last sample (M4). Min/max alone tells
 * the renderer how tall each column is but not how it connects to the next one,
 * and drawing columns as separate segments left flat signals and lone spikes
 * blank (#39). With first/last the columns join into one continuous line.
 */
export function buildMinMaxBuckets(
  values: Float64Array,
  times: Float64Array,
  len: number,
  tMin: number,
  windowMs: number,
  plotW: number,
  padLeft: number,
  yFor: (value: number) => number,
  scratch: MinMaxBucketScratch,
): number {
  const bucketCount = Math.max(1, Math.ceil(plotW));
  scratch.seen.fill(0, 0, bucketCount);

  let touchedCount = 0;
  let ordered = true;
  for (let i = 0; i < len; i++) {
    const t = times[i]!;
    if (t < tMin) continue;

    const rawBucket = Math.floor(((t - tMin) / windowMs) * plotW);
    const bucket = Math.min(Math.max(rawBucket, 0), bucketCount - 1);
    const y = yFor(values[i]!);

    if (scratch.seen[bucket] === 0) {
      scratch.seen[bucket] = 1;
      if (touchedCount > 0 && bucket < scratch.touched[touchedCount - 1]!) ordered = false;
      scratch.touched[touchedCount++] = bucket;
      scratch.minY[bucket] = y;
      scratch.maxY[bucket] = y;
      scratch.firstY[bucket] = y;
      scratch.lastY[bucket] = y;
      scratch.firstT[bucket] = t;
      scratch.lastT[bucket] = t;
    } else {
      if (y < scratch.minY[bucket]!) scratch.minY[bucket] = y;
      if (y > scratch.maxY[bucket]!) scratch.maxY[bucket] = y;
      if (t < scratch.firstT[bucket]!) {
        scratch.firstT[bucket] = t;
        scratch.firstY[bucket] = y;
      }
      if (t >= scratch.lastT[bucket]!) {
        scratch.lastT[bucket] = t;
        scratch.lastY[bucket] = y;
      }
    }
  }

  sortTouched(scratch.touched, touchedCount, ordered);
  return touchedCount;
}

/** Scratch for {@link buildDataBuckets}. Same shape as {@link MinMaxBucketScratch}
 *  but the min/max arrays hold data-space values rather than pixel coordinates. */
export interface DataBucketScratch {
  minV: Float64Array;
  maxV: Float64Array;
  firstV: Float64Array;
  lastV: Float64Array;
  firstT: Float64Array;
  lastT: Float64Array;
  seen: Uint8Array;
  touched: Uint32Array;
}

/** Allocate data-space scratch for up to `size` columns. Do it once, not per flush. */
export function allocDataBucketScratch(size: number): DataBucketScratch {
  return {
    minV: new Float64Array(size),
    maxV: new Float64Array(size),
    firstV: new Float64Array(size),
    lastV: new Float64Array(size),
    firstT: new Float64Array(size),
    lastT: new Float64Array(size),
    seen: new Uint8Array(size),
    touched: new Uint32Array(size),
  };
}

/** Visible-sample count plus the data-space extent, gathered in one pass. */
export interface VisibleExtent {
  count: number;
  min: number;
  max: number;
}

/**
 * Single pass over the buffer collecting both the visible-sample count and the
 * data-space y-extent. The render path needs both every frame and they were
 * previously two separate O(n) scans (`countVisibleSamples` plus the extent
 * loop inside each chart); fusing them halves the traversal.
 *
 * Returns `min`/`max` as ±Infinity when nothing is visible — callers apply their
 * own empty-window fallback, which differs between TimeSeries and MultiAxisPlot.
 */
export function scanVisible(
  values: Float64Array,
  times: Float64Array,
  len: number,
  tMin: number,
): VisibleExtent {
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < len; i++) {
    if (times[i]! < tMin) continue;
    count++;
    const v = values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { count, min, max };
}

/**
 * Data-space twin of {@link buildMinMaxBuckets}: buckets visible samples into
 * plot pixel columns keeping the min/max **value** per column instead of the
 * min/max pixel coordinate.
 *
 * Staying in data space is what lets decimation run off the main thread. The
 * pixel-space variant needs a `yFor` projection, and `yFor` depends on the
 * y-extent of every channel sharing the axis plus any threshold lines — none of
 * which the worker knows. Emitting values instead defers projection to the
 * renderer, which is O(buckets) rather than O(samples).
 */
export function buildDataBuckets(
  values: Float64Array,
  times: Float64Array,
  len: number,
  tMin: number,
  windowMs: number,
  plotW: number,
  scratch: DataBucketScratch,
): number {
  const bucketCount = Math.max(1, Math.ceil(plotW));
  scratch.seen.fill(0, 0, bucketCount);

  let touchedCount = 0;
  let ordered = true;
  for (let i = 0; i < len; i++) {
    const t = times[i]!;
    if (t < tMin) continue;

    const rawBucket = Math.floor(((t - tMin) / windowMs) * plotW);
    const bucket = Math.min(Math.max(rawBucket, 0), bucketCount - 1);
    const v = values[i]!;

    if (scratch.seen[bucket] === 0) {
      scratch.seen[bucket] = 1;
      if (touchedCount > 0 && bucket < scratch.touched[touchedCount - 1]!) ordered = false;
      scratch.touched[touchedCount++] = bucket;
      scratch.minV[bucket] = v;
      scratch.maxV[bucket] = v;
      scratch.firstV[bucket] = v;
      scratch.lastV[bucket] = v;
      scratch.firstT[bucket] = t;
      scratch.lastT[bucket] = t;
    } else {
      if (v < scratch.minV[bucket]!) scratch.minV[bucket] = v;
      if (v > scratch.maxV[bucket]!) scratch.maxV[bucket] = v;
      if (t < scratch.firstT[bucket]!) {
        scratch.firstT[bucket] = t;
        scratch.firstV[bucket] = v;
      }
      if (t >= scratch.lastT[bucket]!) {
        scratch.lastT[bucket] = t;
        scratch.lastV[bucket] = v;
      }
    }
  }

  sortTouched(scratch.touched, touchedCount, ordered);
  return touchedCount;
}

/**
 * Append one M4 column to the current path: join from the previous column's
 * last point to this column's first, sweep the full min..max extent, and end
 * on the last point, where the next column joins. Because consecutive columns
 * are joined, a column holding a single sample (min = max) still draws a
 * segment: the join into it. Before, each column was a separate min→max stroke,
 * which is zero length when min = max and paints nothing (#39).
 *
 * Arguments are already-projected pixel coordinates. `start` begins the path.
 */
export function traceM4Column(
  ctx: Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo'>,
  start: boolean,
  x: number,
  firstY: number,
  minY: number,
  maxY: number,
  lastY: number,
): void {
  if (start) ctx.moveTo(x, firstY);
  else ctx.lineTo(x, firstY);
  ctx.lineTo(x, minY);
  ctx.lineTo(x, maxY);
  ctx.lineTo(x, lastY);
}
