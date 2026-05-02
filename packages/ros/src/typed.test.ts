import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBatteryStateAdapter,
  createFloat32Adapter,
  createFloat64Adapter,
  createNavSatFixAdapter,
  createRangeAdapter,
  createTemperatureAdapter,
} from './typed';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  binaryType: BinaryType = 'blob';
  readyState = MockWebSocket.CONNECTING;
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
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

const lastSocket = () => MockWebSocket.instances[MockWebSocket.instances.length - 1]!;

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('typed ROS adapter factories', () => {
  it('createBatteryStateAdapter scales percentage 0..1 → 0..100', () => {
    const ds = createBatteryStateAdapter({
      url: 'ws://test',
      topic: '/battery',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    expect(JSON.parse(lastSocket().sent[0]!).type).toBe('sensor_msgs/BatteryState');
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/battery', { percentage: 0.42 });
    expect(sub.mock.calls[0][0].value).toBeCloseTo(42);
    ds.destroy();
  });

  it('createFloat32Adapter pulls .data from std_msgs/Float32', () => {
    const ds = createFloat32Adapter({
      url: 'ws://test',
      topic: '/x',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    expect(JSON.parse(lastSocket().sent[0]!).type).toBe('std_msgs/Float32');
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/x', { data: 3.14 });
    expect(sub.mock.calls[0][0].value).toBeCloseTo(3.14);
    ds.destroy();
  });

  it('createFloat64Adapter advertises std_msgs/Float64', () => {
    createFloat64Adapter({
      url: 'ws://test',
      topic: '/y',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    expect(JSON.parse(lastSocket().sent[0]!).type).toBe('std_msgs/Float64');
  });

  it('createRangeAdapter and createTemperatureAdapter pull the right field', () => {
    const range = createRangeAdapter({
      url: 'ws://test',
      topic: '/sonar',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const subR = vi.fn();
    range.subscribe(subR);
    lastSocket().publish('/sonar', { range: 1.7 });
    expect(subR.mock.calls[0][0].value).toBeCloseTo(1.7);
    range.destroy();

    const temp = createTemperatureAdapter({
      url: 'ws://test',
      topic: '/temp',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const subT = vi.fn();
    temp.subscribe(subT);
    lastSocket().publish('/temp', { temperature: 22.4 });
    expect(subT.mock.calls[0][0].value).toBeCloseTo(22.4);
    temp.destroy();
  });

  it('createNavSatFixAdapter extracts the requested axis', () => {
    const ds = createNavSatFixAdapter({
      url: 'ws://test',
      topic: '/gps',
      axis: 'altitude',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    lastSocket().publish('/gps', { latitude: 37.77, longitude: -122.42, altitude: 14.5 });
    expect(sub.mock.calls[0][0].value).toBeCloseTo(14.5);
    ds.destroy();
  });
});
