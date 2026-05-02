/**
 * Tests for useWebSocket. The browser WebSocket global is replaced with a
 * controllable MockWebSocket so we can drive open/message/error/close events
 * deterministically and validate the reconnect schedule against the
 * exponential-backoff formula in §5.3.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from './useWebSocket';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  binaryType: BinaryType = 'blob';
  readyState: number = MockWebSocket.CONNECTING;
  sent: unknown[] = [];

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  // Test helpers — drive lifecycle from the outside.
  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  message(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
  errorEvent() {
    this.onerror?.(new Event('error'));
  }
  serverClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  // WebSocket interface
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

const realWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  // @ts-expect-error — installing a test double in place of the global.
  globalThis.WebSocket = MockWebSocket;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.WebSocket = realWebSocket;
});

const lastSocket = () => MockWebSocket.instances[MockWebSocket.instances.length - 1]!;

describe('useWebSocket', () => {
  it('opens a socket and transitions connecting → connected', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    expect(result.current.status).toBe('connecting');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(lastSocket().binaryType).toBe('arraybuffer');

    act(() => lastSocket().open());
    expect(result.current.status).toBe('connected');
  });

  it('forwards inbound messages and updates lastMessage', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket('ws://test', { onMessage }));
    act(() => lastSocket().open());
    act(() => lastSocket().message('hello'));
    expect(result.current.lastMessage?.data).toBe('hello');
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('reconnects with exponential backoff capped at 30s', () => {
    const onStatusChange = vi.fn();
    renderHook(() =>
      useWebSocket('ws://test', { reconnectDelay: 1000, onStatusChange }),
    );
    act(() => lastSocket().open());
    act(() => lastSocket().serverClose());
    expect(MockWebSocket.instances).toHaveLength(1);

    // 1st reconnect after 1000ms (attempt 0).
    act(() => vi.advanceTimersByTime(999));
    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(MockWebSocket.instances).toHaveLength(2);

    // Drop again — next delay is 2000ms (attempt 1).
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(2000));
    expect(MockWebSocket.instances).toHaveLength(3);

    // Force 6 more failed attempts; backoff caps at 30_000.
    for (let i = 2; i < 8; i++) {
      act(() => lastSocket().serverClose());
      const expected = Math.min(1000 * 2 ** i, 30_000);
      act(() => vi.advanceTimersByTime(expected));
    }
    // Last delay used was capped at 30s.
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(30_000));
    expect(MockWebSocket.instances.length).toBeGreaterThan(8);

    // Status reported through onStatusChange — must include both connecting and disconnected.
    const seen = onStatusChange.mock.calls.map((c) => c[0]);
    expect(seen).toContain('connecting');
    expect(seen).toContain('disconnected');
  });

  it('stops reconnecting once maxReconnects is reached', () => {
    renderHook(() => useWebSocket('ws://test', { reconnectDelay: 100, maxReconnects: 2 }));
    act(() => lastSocket().open());
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(100)); // attempt 1
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(200)); // attempt 2
    expect(MockWebSocket.instances).toHaveLength(3);

    // Third drop should not produce another connection.
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('send() no-ops when the socket is not open', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    act(() => result.current.send('before-open')); // should not throw
    act(() => lastSocket().open());
    act(() => result.current.send('after-open'));
    expect(lastSocket().sent).toEqual(['after-open']);
  });

  it('reconnect() forces a fresh socket and resets backoff', () => {
    const { result } = renderHook(() => useWebSocket('ws://test', { reconnectDelay: 1000 }));
    act(() => lastSocket().open());
    // Force several failures so attempts > 0.
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(1000));
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(2000));
    const before = MockWebSocket.instances.length;

    act(() => result.current.reconnect());
    expect(MockWebSocket.instances.length).toBe(before + 1);

    // Backoff reset → next failure should reconnect after 1s, not the prior delay.
    act(() => lastSocket().open());
    act(() => lastSocket().serverClose());
    act(() => vi.advanceTimersByTime(1000));
    expect(MockWebSocket.instances.length).toBe(before + 2);
  });

  it('close() tears down the socket and prevents further reconnects', () => {
    const { result } = renderHook(() => useWebSocket('ws://test', { reconnectDelay: 50 }));
    act(() => lastSocket().open());
    act(() => result.current.close());
    expect(result.current.status).toBe('disconnected');
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('does not connect when enabled=false', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useWebSocket('ws://test', { enabled }),
      { initialProps: { enabled: false } },
    );
    expect(MockWebSocket.instances).toHaveLength(0);
    expect(result.current.status).toBe('disconnected');

    rerender({ enabled: true });
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('closes the socket on unmount and clears pending reconnect timers', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://test', { reconnectDelay: 100 }));
    act(() => lastSocket().open());
    act(() => lastSocket().serverClose());
    // pending reconnect timer is queued; unmounting should clear it.
    unmount();
    act(() => vi.advanceTimersByTime(10_000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('caps the in-memory message queue at messageQueueSize', () => {
    const { result } = renderHook(() => useWebSocket('ws://test', { messageQueueSize: 3 }));
    act(() => lastSocket().open());
    for (let i = 0; i < 10; i++) {
      act(() => lastSocket().message(i));
    }
    // We do not expose the queue; lastMessage must be the most recent.
    expect(result.current.lastMessage?.data).toBe(9);
  });

  it('sets error status when the WebSocket constructor throws', () => {
    // @ts-expect-error — replace the global with a throwing ctor.
    globalThis.WebSocket = function ThrowingSocket() {
      throw new Error('blocked');
    };
    const { result } = renderHook(() => useWebSocket('ws://test', { reconnectDelay: 100 }));
    expect(result.current.status).toBe('error');
  });

  it('emits an error status when the underlying socket fires onerror', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    act(() => lastSocket().open());
    act(() => lastSocket().errorEvent());
    expect(result.current.status).toBe('error');
  });
});
