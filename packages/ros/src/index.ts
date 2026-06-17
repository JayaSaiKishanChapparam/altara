// @altara/ros — ROS2 rosbridge adapter package.
// Extracted from @altara/core in Phase 4 (blueprint §12).

export { createRosbridgeAdapter } from './rosbridge';
export type {
  ChannelExtractors,
  RosbridgeAdapterOptions,
  RosbridgeChannelAdapterOptions,
  RosbridgeConnectionOptions,
  TimeSource,
} from './rosbridge';

export {
  createBatteryStateAdapter,
  createFloat32Adapter,
  createFloat64Adapter,
  createImuAdapter,
  createNavSatFixAdapter,
  createRangeAdapter,
  createTemperatureAdapter,
  quaternionToEuler,
} from './typed';
export type {
  BatteryStateAdapterOptions,
  BatteryStateMessage,
  EulerAngles,
  FloatMessage,
  ImuMessage,
  NavSatFixMessage,
  Quaternion,
  RangeMessage,
  TemperatureMessage,
} from './typed';

// Re-exported from @altara/core so ROS consumers can build a multi-channel
// source (e.g. for PrimaryFlightDisplay) without a second import.
export { mergeChannels } from '@altara/core';
