# Migration guide

## 0.x → 1.0

### `createRosbridgeAdapter` moved to `@altara/ros`

The rosbridge adapter is no longer exported from `@altara/core`. Install `@altara/ros` and update the import.

**Before** (0.x):

```ts
import { createRosbridgeAdapter, AltaraProvider, TimeSeries } from '@altara/core';
```

**After** (1.x):

```ts
import { AltaraProvider, TimeSeries } from '@altara/core';
import { createRosbridgeAdapter } from '@altara/ros';
```

```bash
pnpm add @altara/ros
# or
npm install @altara/ros
```

The function signature, message-envelope handling, throttle, and `timeSource` modes are unchanged. `RosbridgeAdapterOptions` and `TimeSource` types likewise moved.

### New typed convenience factories in `@altara/ros`

If you were configuring `valueExtractor` by hand for common ROS message types, you can drop down to the pre-typed factories:

```ts
// Before
createRosbridgeAdapter({
  url: 'ws://localhost:9090',
  topic: '/drone/battery',
  messageType: 'sensor_msgs/BatteryState',
  valueExtractor: (m) => (m as { percentage: number }).percentage * 100,
});

// After
import { createBatteryStateAdapter } from '@altara/ros';
createBatteryStateAdapter({ url: 'ws://localhost:9090', topic: '/drone/battery' });
```

Available factories: `createBatteryStateAdapter`, `createFloat32Adapter`, `createFloat64Adapter`, `createRangeAdapter`, `createTemperatureAdapter`, `createNavSatFixAdapter`. The original `createRosbridgeAdapter` remains for everything else.

### Web Worker pipeline

A new `createWorkerDataSource` is available in `@altara/core` for ≥500 Hz feeds. No migration required for existing code, but consider switching if you've been seeing UI jank under heavy telemetry rates.

```ts
import { createWorkerDataSource } from '@altara/core';

const ds = createWorkerDataSource({
  url: 'ws://localhost:9090',
  subscribeMessage: { op: 'subscribe', topic: '/imu', type: 'sensor_msgs/Imu' },
  flushHz: 60,
  extractorSource: 'function (msg) { return msg.angular_velocity.z; }',
});
```

The extractor is supplied as a source string because functions cannot be cloned across the worker boundary.

### `MultiAxisPlot` and `DashboardLayout`

Two new components ship in 1.0 (`MultiAxisPlot`, `DashboardLayout`). They're additive — no changes required for existing dashboards.

`DashboardLayout` requires `react-grid-layout` as an optional peer dependency. Install it only if you use the component:

```bash
pnpm add react-grid-layout
```

### Reduced-motion support

The single stylesheet (`@altara/core/styles.css`) now respects `prefers-reduced-motion`. `SignalPanel` row flashes and the `Gauge` needle CSS transition are disabled when the OS-level setting is on. JavaScript-driven animation (the `TimeSeries` rAF render loop, etc.) continues — those drive the actual data display.

No code changes required to opt in.
