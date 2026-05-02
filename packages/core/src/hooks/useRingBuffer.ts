import { useEffect, useMemo, useRef } from 'react';
import { RingBuffer } from '../utils/RingBuffer';

/**
 * Stable RingBuffer instance whose capacity is fixed for the component
 * lifetime. Components push directly into the underlying buffer and read
 * from it in their rAF loop — React state stays out of the hot path
 * (blueprint §13, "React re-render jank").
 */
export function useRingBuffer(capacity: number): RingBuffer {
  const initialCapacity = useRef(capacity);
  const buffer = useMemo(() => new RingBuffer(initialCapacity.current), []);

  // Capacity is fixed; warn (in dev) if the caller tries to change it.
  useEffect(() => {
    if (capacity !== initialCapacity.current && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `useRingBuffer: capacity changed from ${initialCapacity.current} to ${capacity}; ` +
          'capacity is fixed for the component lifetime. Remount the component to resize.',
      );
    }
  }, [capacity]);

  return buffer;
}
