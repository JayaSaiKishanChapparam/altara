/**
 * Fixed-capacity circular buffer backed by Float64Array.
 *
 * Plain JS arrays grow unbounded and gc-thrash at telemetry rates; this
 * structure overwrites the oldest sample once full. See blueprint §5.1
 * and §13 ("Memory leak from arrays").
 */
export class RingBuffer {
  private buf: Float64Array;
  private times: Float64Array;
  private head = 0;
  private count = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.buf = new Float64Array(capacity);
    this.times = new Float64Array(capacity);
  }

  push(value: number, timestamp: number): void {
    this.buf[this.head] = value;
    this.times[this.head] = timestamp;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Ordered slice of values, oldest → newest. Allocates a new Float64Array. */
  getValues(): Float64Array {
    return this.orderedCopy(this.buf);
  }

  /** Ordered slice of timestamps, oldest → newest. Allocates a new Float64Array. */
  getTimes(): Float64Array {
    return this.orderedCopy(this.times);
  }

  /** Most recent sample, or undefined if empty. */
  last(): { value: number; timestamp: number } | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return { value: this.buf[idx]!, timestamp: this.times[idx]! };
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  private orderedCopy(source: Float64Array): Float64Array {
    const out = new Float64Array(this.count);
    if (this.count === 0) return out;
    if (this.count < this.capacity) {
      // Buffer not yet full: oldest is at index 0, newest is at head-1.
      out.set(source.subarray(0, this.count));
      return out;
    }
    // Full: oldest sits at head, wrapping forward to head-1.
    const tail = source.subarray(this.head, this.capacity);
    const wrap = source.subarray(0, this.head);
    out.set(tail, 0);
    out.set(wrap, tail.length);
    return out;
  }
}
