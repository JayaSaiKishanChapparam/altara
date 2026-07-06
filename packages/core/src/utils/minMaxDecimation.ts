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
