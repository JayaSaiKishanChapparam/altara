import type { AltaraDataSource } from '@altara/core';
import { createRosbridgeAdapter, type RosbridgeAdapterOptions } from './rosbridge';

/**
 * Typed convenience factories for common ROS message types. Each one is
 * a thin wrapper around `createRosbridgeAdapter` that pre-configures the
 * `messageType` and `valueExtractor` so the consumer only has to point
 * at a topic.
 */

type BaseOpts = Omit<RosbridgeAdapterOptions, 'messageType' | 'valueExtractor'>;

/** Subset of `sensor_msgs/BatteryState` consumed by the adapter. */
export interface BatteryStateMessage {
  /**
   * Battery state of charge in the ROS-native range `0..1`. The adapter scales
   * to `0..100`. PX4/ArduPilot publish `-1` (or `NaN`) here when the firmware
   * has no fuel-gauge estimate — the common case on bare LiPo packs.
   */
  percentage?: number;
  /** Pack terminal voltage in volts. Used for the SoC fallback below. */
  voltage?: number;
}

export interface BatteryStateAdapterOptions extends BaseOpts {
  /**
   * Per-pack voltage range used to derive a state-of-charge estimate when the
   * flight controller reports an invalid `percentage` (`-1` or `NaN`). `min`
   * is the empty-pack voltage, `max` the full-pack voltage — e.g. a 4S LiPo is
   * roughly `{ min: 14.0, max: 16.8 }` (3.5–4.2 V/cell). Without this, an
   * invalid `percentage` is dropped and the gauge stays blank, which is the
   * default on most real drones. The voltage→charge map is a clamped linear
   * approximation (the true curve is nonlinear) — enough to keep the gauge
   * alive and roughly right.
   */
  voltageRange?: { min: number; max: number };
}

/** ROS `sensor_msgs/BatteryState.percentage` is valid only in `[0, 1]`. */
function isValidPercentage(p: number | undefined): p is number {
  return typeof p === 'number' && !Number.isNaN(p) && p >= 0 && p <= 1;
}

export function createBatteryStateAdapter(opts: BatteryStateAdapterOptions): AltaraDataSource {
  const { voltageRange, ...rest } = opts;
  return createRosbridgeAdapter({
    ...rest,
    messageType: 'sensor_msgs/BatteryState',
    valueExtractor: (m) => {
      const msg = m as BatteryStateMessage;
      if (isValidPercentage(msg.percentage)) return msg.percentage * 100;
      // No usable SoC from the firmware — estimate from voltage if the caller
      // gave us a pack range. Returning NaN otherwise preserves the original
      // drop-the-sample behavior.
      if (voltageRange && typeof msg.voltage === 'number' && !Number.isNaN(msg.voltage)) {
        const span = voltageRange.max - voltageRange.min || 1;
        const t = (msg.voltage - voltageRange.min) / span;
        return Math.max(0, Math.min(1, t)) * 100;
      }
      return NaN;
    },
  });
}

/** Shape of `std_msgs/Float32` and `std_msgs/Float64`. */
export interface FloatMessage {
  /** The numeric payload. */
  data: number;
}

export function createFloat32Adapter(opts: BaseOpts): AltaraDataSource {
  return createRosbridgeAdapter({
    ...opts,
    messageType: 'std_msgs/Float32',
    valueExtractor: (m) => (m as FloatMessage).data,
  });
}

export function createFloat64Adapter(opts: BaseOpts): AltaraDataSource {
  return createRosbridgeAdapter({
    ...opts,
    messageType: 'std_msgs/Float64',
    valueExtractor: (m) => (m as FloatMessage).data,
  });
}

/** Subset of `sensor_msgs/Range` consumed by the adapter. */
export interface RangeMessage {
  /** Measured distance in meters. */
  range: number;
}

export function createRangeAdapter(opts: BaseOpts): AltaraDataSource {
  return createRosbridgeAdapter({
    ...opts,
    messageType: 'sensor_msgs/Range',
    valueExtractor: (m) => (m as RangeMessage).range,
  });
}

/** Subset of `sensor_msgs/Temperature` consumed by the adapter. */
export interface TemperatureMessage {
  /** Temperature in degrees Celsius. */
  temperature: number;
}

export function createTemperatureAdapter(opts: BaseOpts): AltaraDataSource {
  return createRosbridgeAdapter({
    ...opts,
    messageType: 'sensor_msgs/Temperature',
    valueExtractor: (m) => (m as TemperatureMessage).temperature,
  });
}

/**
 * Subset of `sensor_msgs/NavSatFix` consumed by the adapter. Build three
 * adapters (one per axis) if you need all three channels piped into one
 * component.
 */
export interface NavSatFixMessage {
  /** Latitude in degrees. */
  latitude: number;
  /** Longitude in degrees. */
  longitude: number;
  /** Altitude above the WGS84 ellipsoid, in meters. */
  altitude: number;
}

export function createNavSatFixAdapter(
  opts: BaseOpts & { axis: 'latitude' | 'longitude' | 'altitude' },
): AltaraDataSource {
  const { axis, ...rest } = opts;
  return createRosbridgeAdapter({
    ...rest,
    messageType: 'sensor_msgs/NavSatFix',
    valueExtractor: (m) => (m as NavSatFixMessage)[axis],
  });
}

/** A unit quaternion in ROS `geometry_msgs/Quaternion` order. */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Roll/pitch/yaw in degrees, matching the channel names the PFD consumes. */
export interface EulerAngles {
  roll: number;
  pitch: number;
  yaw: number;
}

/**
 * Convert a ROS orientation quaternion to intrinsic Tait–Bryan angles in
 * **degrees** — roll (about X), pitch (about Y), yaw (about Z). Pitch is
 * clamped at the ±90° gimbal poles so a marginally non-unit quaternion can't
 * push `asin` out of domain. This is the exact conversion every robotics user
 * has to write by hand when feeding `sensor_msgs/Imu.orientation` into an
 * attitude display.
 */
export function quaternionToEuler(q: Quaternion): EulerAngles {
  const { x, y, z, w } = q;
  const DEG = 180 / Math.PI;

  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return { roll: roll * DEG, pitch: pitch * DEG, yaw: yaw * DEG };
}

/** Subset of `sensor_msgs/Imu` consumed by the adapter — only `orientation`. */
export interface ImuMessage {
  orientation?: Quaternion;
}

/**
 * Adapter for a `sensor_msgs/Imu` topic. Returns an **object of named
 * single-channel sources** — `{ roll, pitch, yaw }` in degrees — all backed by
 * **one** shared rosbridge connection. Pass them into `mergeChannels` to drive
 * a multi-input component such as `PrimaryFlightDisplay`:
 *
 * ```ts
 * const imu = createImuAdapter({ url, topic: '/mavros/imu/data' });
 * const source = mergeChannels({ roll: imu.roll, pitch: imu.pitch });
 * ```
 *
 * Pass `channels` to emit only some axes, e.g. `channels: ['roll', 'pitch']`.
 *
 * Note: IMU `yaw` is heading in the IMU's own frame, **not** magnetic/compass
 * heading — for a PFD heading tape drive `heading` from `mavros_msgs/VFR_HUD`
 * and use this adapter only for `roll`/`pitch`.
 */
export function createImuAdapter(
  opts: BaseOpts,
): { roll: AltaraDataSource; pitch: AltaraDataSource; yaw: AltaraDataSource };
export function createImuAdapter<K extends keyof EulerAngles>(
  opts: BaseOpts & { channels: readonly K[] },
): { [P in K]: AltaraDataSource };
export function createImuAdapter(
  opts: BaseOpts & { channels?: readonly (keyof EulerAngles)[] },
): Record<string, AltaraDataSource> {
  const { channels = ['roll', 'pitch', 'yaw'] as const, ...rest } = opts;
  const extractors: Record<string, (msg: unknown) => number> = {};
  for (const name of channels) {
    extractors[name] = (m: unknown) => {
      const o = (m as ImuMessage).orientation;
      return o ? quaternionToEuler(o)[name] : NaN;
    };
  }
  return createRosbridgeAdapter({ ...rest, messageType: 'sensor_msgs/Imu', channels: extractors });
}
