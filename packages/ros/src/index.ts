// @altara/ros — ROS2 rosbridge adapter package.
// Extracted from @altara/core in Phase 4 (blueprint §12).

export { createRosbridgeAdapter } from './rosbridge';
export type { RosbridgeAdapterOptions, TimeSource } from './rosbridge';

export {
  createBatteryStateAdapter,
  createFloat32Adapter,
  createFloat64Adapter,
  createNavSatFixAdapter,
  createRangeAdapter,
  createTemperatureAdapter,
} from './typed';
export type {
  BatteryStateMessage,
  FloatMessage,
  NavSatFixMessage,
  RangeMessage,
  TemperatureMessage,
} from './typed';
