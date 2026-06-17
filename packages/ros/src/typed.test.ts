import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRosbridgeAdapter } from './rosbridge';
import {
  createBatteryStateAdapter,
  createFloat32Adapter,
  createFloat64Adapter,
  createImuAdapter,
  createNavSatFixAdapter,
  createRangeAdapter,
  createTemperatureAdapter,
  quaternionToEuler,
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

  it('createBatteryStateAdapter drops invalid percentage with no voltageRange', () => {
    const ds = createBatteryStateAdapter({
      url: 'ws://test',
      topic: '/battery',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    // PX4/ArduPilot publish -1 when there's no SoC estimate.
    lastSocket().publish('/battery', { percentage: -1, voltage: 15.4 });
    expect(sub).not.toHaveBeenCalled();
    ds.destroy();
  });

  it('createBatteryStateAdapter falls back to a voltage-derived estimate', () => {
    const ds = createBatteryStateAdapter({
      url: 'ws://test',
      topic: '/battery',
      voltageRange: { min: 14.0, max: 16.8 }, // 4S LiPo
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const sub = vi.fn();
    ds.subscribe(sub);
    // Invalid percentage, but 15.4 V is exactly halfway 14.0..16.8 → 50%.
    lastSocket().publish('/battery', { percentage: -1, voltage: 15.4 });
    expect(sub.mock.calls[0][0].value).toBeCloseTo(50);
    // A valid percentage still wins over the voltage fallback.
    lastSocket().publish('/battery', { percentage: 0.9, voltage: 14.0 });
    expect(sub.mock.calls[1][0].value).toBeCloseTo(90);
    // Below the empty-pack voltage clamps to 0, not negative.
    lastSocket().publish('/battery', { percentage: NaN, voltage: 10.0 });
    expect(sub.mock.calls[2][0].value).toBeCloseTo(0);
    ds.destroy();
  });

  it('quaternionToEuler converts identity and known rotations (degrees)', () => {
    expect(quaternionToEuler({ x: 0, y: 0, z: 0, w: 1 })).toEqual({
      roll: 0,
      pitch: 0,
      yaw: 0,
    });
    // 90° roll about X: q = (sin45, 0, 0, cos45).
    const r = quaternionToEuler({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 });
    expect(r.roll).toBeCloseTo(90);
    expect(r.pitch).toBeCloseTo(0);
    expect(r.yaw).toBeCloseTo(0);
  });

  it('createImuAdapter returns { roll, pitch, yaw } sources off one socket', () => {
    const imu = createImuAdapter({
      url: 'ws://test',
      topic: '/imu',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    expect(JSON.parse(lastSocket().sent[0]!).type).toBe('sensor_msgs/Imu');
    // Exactly one connection backs all three channels.
    expect(MockWebSocket.instances).toHaveLength(1);

    const rollSub = vi.fn();
    const pitchSub = vi.fn();
    const yawSub = vi.fn();
    imu.roll.subscribe(rollSub);
    imu.pitch.subscribe(pitchSub);
    imu.yaw.subscribe(yawSub);

    // 90° roll about X.
    lastSocket().publish('/imu', {
      orientation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
    });
    expect(rollSub.mock.calls[0][0].value).toBeCloseTo(90);
    expect(pitchSub.mock.calls[0][0].value).toBeCloseTo(0);
    expect(yawSub.mock.calls[0][0].value).toBeCloseTo(0);
    // Per-channel sources emit untagged single values (mergeChannels tags them).
    expect(rollSub.mock.calls[0][0].channel).toBeUndefined();

    imu.roll.destroy();
    imu.pitch.destroy();
    imu.yaw.destroy();
  });

  it('createImuAdapter honors a channel subset', () => {
    const imu = createImuAdapter({
      url: 'ws://test',
      topic: '/imu',
      channels: ['roll', 'pitch'],
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    expect(Object.keys(imu).sort()).toEqual(['pitch', 'roll']);
    // @ts-expect-error — yaw was not requested, so it isn't on the returned type.
    expect(imu.yaw).toBeUndefined();
  });

  it('shared socket is torn down only after the last channel is destroyed', () => {
    const imu = createImuAdapter({
      url: 'ws://test',
      topic: '/imu',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    lastSocket().open();
    const socket = lastSocket();
    imu.roll.destroy();
    imu.pitch.destroy();
    // Two of three released — socket still open, no unsubscribe yet.
    expect(socket.readyState).toBe(MockWebSocket.OPEN);
    imu.yaw.destroy();
    // Last channel released — unsubscribe sent and socket closed.
    expect(socket.sent.some((s) => JSON.parse(s).op === 'unsubscribe')).toBe(true);
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('createRosbridgeAdapter channels map returns one source per name', () => {
    const hud = createRosbridgeAdapter({
      url: 'ws://test',
      topic: '/vfr_hud',
      messageType: 'mavros_msgs/VFR_HUD',
      socketImpl: MockWebSocket as unknown as typeof WebSocket,
      channels: {
        heading: (m) => (m as { heading: number }).heading,
        airspeed: (m) => (m as { airspeed: number }).airspeed * 1.94384,
        altitude: (m) => (m as { altitude: number }).altitude * 3.28084,
      },
    });
    lastSocket().open();
    expect(MockWebSocket.instances).toHaveLength(1);
    const spd = vi.fn();
    hud.airspeed.subscribe(spd);
    lastSocket().publish('/vfr_hud', { heading: 90, airspeed: 10, altitude: 100 });
    expect(spd.mock.calls[0][0].value).toBeCloseTo(19.4384); // 10 m/s → kt
    hud.heading.destroy();
    hud.airspeed.destroy();
    hud.altitude.destroy();
  });

  it('createRosbridgeAdapter throws without valueExtractor or channels', () => {
    expect(() =>
      createRosbridgeAdapter({
        url: 'ws://test',
        topic: '/x',
        messageType: 'std_msgs/Float64',
        socketImpl: MockWebSocket as unknown as typeof WebSocket,
      } as never),
    ).toThrow(/valueExtractor.*channels/);
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
