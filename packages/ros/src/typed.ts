import type { AltaraDataSource } from '@altara/core';
import { createRosbridgeAdapter, type RosbridgeAdapterOptions } from './rosbridge';

/**
 * Typed convenience factories for common ROS message types. Each one is
 * a thin wrapper around `createRosbridgeAdapter` that pre-configures the
 * `messageType` and `valueExtractor` so the consumer only has to point
 * at a topic.
 */

type BaseOpts = Omit<RosbridgeAdapterOptions, 'messageType' | 'valueExtractor'>;

/** Subset of `sensor_msgs/BatteryState` consumed by the adapter — only `percentage` is needed. */
export interface BatteryStateMessage {
  /** Battery state of charge in the ROS-native range `0..1`. The adapter scales to `0..100`. */
  percentage?: number;
}

export function createBatteryStateAdapter(opts: BaseOpts): AltaraDataSource {
  return createRosbridgeAdapter({
    ...opts,
    messageType: 'sensor_msgs/BatteryState',
    valueExtractor: (m) => {
      const pct = (m as BatteryStateMessage).percentage;
      return typeof pct === 'number' ? pct * 100 : NaN;
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
