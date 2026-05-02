import { describe, expect, it } from 'vitest';
import { RingBuffer } from './RingBuffer';

describe('RingBuffer', () => {
  it('rejects non-positive capacities', () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
    expect(() => new RingBuffer(-3)).toThrow(RangeError);
    expect(() => new RingBuffer(1.5)).toThrow(RangeError);
  });

  it('starts empty', () => {
    const rb = new RingBuffer(4);
    expect(rb.length).toBe(0);
    expect(rb.last()).toBeUndefined();
    expect(rb.getValues()).toEqual(new Float64Array(0));
    expect(rb.getTimes()).toEqual(new Float64Array(0));
  });

  it('returns oldest→newest order while filling', () => {
    const rb = new RingBuffer(5);
    rb.push(1, 100);
    rb.push(2, 200);
    rb.push(3, 300);
    expect(rb.length).toBe(3);
    expect(Array.from(rb.getValues())).toEqual([1, 2, 3]);
    expect(Array.from(rb.getTimes())).toEqual([100, 200, 300]);
    expect(rb.last()).toEqual({ value: 3, timestamp: 300 });
  });

  it('overwrites oldest entries once full', () => {
    const rb = new RingBuffer(3);
    for (let i = 1; i <= 5; i++) rb.push(i, i * 10);
    expect(rb.length).toBe(3);
    // After 5 pushes into a cap-3 buffer the surviving samples are 3,4,5.
    expect(Array.from(rb.getValues())).toEqual([3, 4, 5]);
    expect(Array.from(rb.getTimes())).toEqual([30, 40, 50]);
    expect(rb.last()).toEqual({ value: 5, timestamp: 50 });
  });

  it('handles wraparound that exactly aligns head with index 0', () => {
    const rb = new RingBuffer(3);
    for (let i = 1; i <= 6; i++) rb.push(i, i);
    expect(Array.from(rb.getValues())).toEqual([4, 5, 6]);
  });

  it('returns ordered copies (mutating output never mutates internal state)', () => {
    const rb = new RingBuffer(3);
    rb.push(7, 1);
    rb.push(8, 2);
    const snapshot = rb.getValues();
    snapshot[0] = 999;
    expect(Array.from(rb.getValues())).toEqual([7, 8]);
  });

  it('clears state', () => {
    const rb = new RingBuffer(3);
    rb.push(1, 1);
    rb.push(2, 2);
    rb.clear();
    expect(rb.length).toBe(0);
    expect(rb.last()).toBeUndefined();
    rb.push(9, 9);
    expect(Array.from(rb.getValues())).toEqual([9]);
  });

  it('exposes the configured capacity', () => {
    expect(new RingBuffer(64).capacity).toBe(64);
  });
});
