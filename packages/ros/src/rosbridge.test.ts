import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRosbridgeAdapter } from './rosbridge';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  binaryType: BinaryType = 'blob';
  readyState: number = MockWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  publish(topic: string, msg: unknown) {
    this.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify({ op: 'publish', topic, msg }) }),
    );
  }
  raw(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
  serverClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
  errorEvent() {
    this.onerror?.(new Event('error'));
  }
}

const lastSocket = () => MockWebSocket.instances[MockWebSocket.instances.length - 1]!;

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createRosbridgeAdapter', () => {
  it('connects, sends a subscribe envelope, and reports connected status', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test:9090',
      topic: '/drone/battery',
      messageType: 'sensor_msgs/BatteryState',
      valueExtractor: (m) => (m as { percentage: number }).percentage,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    expect(ds.status).toBe('connecting');
    lastSocket().open();
    expect(ds.status).toBe('connected');
    expect(JSON.parse(lastSocket().sent[0]!)).toEqual({
      op: 'subscribe',
      topic: '/drone/battery',
      type: 'sensor_msgs/BatteryState',
    });
    ds.destroy();
  });

  it('passes published messages through valueExtractor and notifies subscribers', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/x', { data: 12.5 });
    lastSocket().publish('/x', { data: 13.0 });
    expect(sub).toHaveBeenCalledTimes(2);
    expect(sub.mock.calls[0][0].value).toBe(12.5);
    expect(sub.mock.calls[1][0].value).toBe(13.0);
    expect(ds.getHistory().length).toBe(2);
    ds.destroy();
  });

  it('ignores messages for other topics', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/wanted',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/other', { data: 99 });
    expect(sub).not.toHaveBeenCalled();
    ds.destroy();
  });

  it('uses ROS header.stamp when timeSource=message', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/imu',
      messageType: 'sensor_msgs/Imu',
      valueExtractor: () => 1,
      timeSource: 'message',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/imu', { header: { stamp: { sec: 10, nanosec: 500_000_000 } } });
    expect(sub.mock.calls[0][0].timestamp).toBe(10_500);
    ds.destroy();
  });

  it('falls back to wallclock when timeSource=message but message lacks a stamp', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      timeSource: 'message',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/x', { data: 1 });
    expect(sub.mock.calls[0][0].timestamp).toBe(1_700_000_000_000);
    ds.destroy();
  });

  it('returns relative timestamps when timeSource=relative', () => {
    vi.setSystemTime(new Date(1_000_000));
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      timeSource: 'relative',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/x', { data: 1 });
    vi.setSystemTime(new Date(1_002_500));
    lastSocket().publish('/x', { data: 2 });
    expect(sub.mock.calls[0][0].timestamp).toBe(0);
    expect(sub.mock.calls[1][0].timestamp).toBe(2_500);
    ds.destroy();
  });

  it('drops samples that breach throttleMs', () => {
    vi.setSystemTime(new Date(0));
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      throttleMs: 100,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/x', { data: 1 });
    vi.setSystemTime(new Date(50));
    lastSocket().publish('/x', { data: 2 }); // dropped
    vi.setSystemTime(new Date(150));
    lastSocket().publish('/x', { data: 3 });
    expect(sub.mock.calls.map((c) => c[0].value)).toEqual([1, 3]);
    ds.destroy();
  });

  it('survives valueExtractor throwing — sample is just skipped', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: () => {
        throw new Error('bad');
      },
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    expect(() => lastSocket().publish('/x', { data: 1 })).not.toThrow();
    expect(sub).not.toHaveBeenCalled();
    ds.destroy();
  });

  it('ignores non-JSON frames', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().raw('not-json');
    expect(sub).not.toHaveBeenCalled();
    ds.destroy();
  });

  it('keeps history bounded by bufferSize', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: (m) => (m as { data: number }).data,
      bufferSize: 3,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    for (let i = 0; i < 6; i++) lastSocket().publish('/x', { data: i });
    const hist = ds.getHistory();
    expect(hist.map((h) => h.value)).toEqual([3, 4, 5]);
    ds.destroy();
  });

  it('reconnects with backoff on socket close', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: () => 1,
      reconnectDelay: 1000,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    lastSocket().serverClose();
    expect(ds.status).toBe('disconnected');
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);
    ds.destroy();
  });

  it('destroy is idempotent and stops further reconnect attempts', () => {
    const ds = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/x',
      messageType: 'std_msgs/Float32',
      valueExtractor: () => 1,
      reconnectDelay: 100,
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    lastSocket().serverClose();
    ds.destroy();
    expect(() => ds.destroy()).not.toThrow();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(ds.status).toBe('disconnected');
  });

  it('throws when no WebSocket implementation is available', () => {
    const original = globalThis.WebSocket;
    // @ts-expect-error — strip global to force the no-impl path.
    delete globalThis.WebSocket;
    expect(() =>
      createRosbridgeAdapter({
        url: 'ws://test',
        topic: '/x',
        messageType: 'std_msgs/Float32',
        valueExtractor: () => 1,
      }),
    ).toThrow(/no WebSocket implementation/);
    globalThis.WebSocket = original;
  });
});
