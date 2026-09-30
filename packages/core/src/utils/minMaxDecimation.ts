export interface MinMaxBucketScratch {
  minY: Float64Array;
  maxY: Float64Array;
  seen: Uint8Array;
  touched: Uint32Array;
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
  for (let i = 0; i < len; i++) {
    const t = times[i]!;
    if (t < tMin) continue;

    const rawBucket = Math.floor(((t - tMin) / windowMs) * plotW);
    const bucket = Math.min(Math.max(rawBucket, 0), bucketCount - 1);
    const y = yFor(values[i]!);

    if (scratch.seen[bucket] === 0) {
      scratch.seen[bucket] = 1;
      scratch.touched[touchedCount++] = bucket;
      scratch.minY[bucket] = y;
      scratch.maxY[bucket] = y;
    } else {
      if (y < scratch.minY[bucket]!) scratch.minY[bucket] = y;
      if (y > scratch.maxY[bucket]!) scratch.maxY[bucket] = y;
    }
  }

  return touchedCount;
}

/** Scratch for {@link buildDataBuckets}. Same shape as {@link MinMaxBucketScratch}
 *  but the min/max arrays hold data-space values rather than pixel coordinates. */
export interface DataBucketScratch {
  minV: Float64Array;
  maxV: Float64Array;
  seen: Uint8Array;
  touched: Uint32Array;
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
  for (let i = 0; i < len; i++) {
    const t = times[i]!;
    if (t < tMin) continue;

    const rawBucket = Math.floor(((t - tMin) / windowMs) * plotW);
    const bucket = Math.min(Math.max(rawBucket, 0), bucketCount - 1);
    const v = values[i]!;

    if (scratch.seen[bucket] === 0) {
      scratch.seen[bucket] = 1;
      scratch.touched[touchedCount++] = bucket;
      scratch.minV[bucket] = v;
      scratch.maxV[bucket] = v;
    } else {
      if (v < scratch.minV[bucket]!) scratch.minV[bucket] = v;
      if (v > scratch.maxV[bucket]!) scratch.maxV[bucket] = v;
    }
  }

  return touchedCount;
}
