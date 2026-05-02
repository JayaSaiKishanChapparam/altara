# @altara/ros

**ROS2 rosbridge adapter for Altara.** Subscribe to a ROS2 topic from React in one line and pipe live samples into any [`@altara/core`](https://www.npmjs.com/package/@altara/core) component.

## Install

```bash
npm install @altara/core @altara/ros
```

You'll also need [`rosbridge_suite`](https://github.com/RobotWebTools/rosbridge_suite) running on your robot (or in a Docker container during development):

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
# → ws://localhost:9090
```

## Quick start

```tsx
import { AltaraProvider, TimeSeries } from '@altara/core';
import { createRosbridgeAdapter } from '@altara/ros';

const source = createRosbridgeAdapter({
  url: 'ws://localhost:9090',
  topic: '/imu/data',
  messageType: 'sensor_msgs/Imu',
  valueExtractor: (msg) => msg.angular_velocity.z,
});

export function App() {
  return (
    <AltaraProvider theme="dark">
      <TimeSeries dataSource={source} height={240} />
    </AltaraProvider>
  );
}
```

## What you get

`createRosbridgeAdapter` handles:

- rosbridge v2 envelope (`{ op: 'subscribe', topic, type }`) on connect
- Auto-reconnect with exponential backoff (1 s → 30 s)
- ROS `header.stamp.{sec, nanosec}` → unix milliseconds normalization
- Optional `throttleMs` to drop samples that arrive faster than you want to render
- Three timestamp modes (`'wallclock'` / `'message'` / `'relative'`)
- Cleanup on `destroy()` including the `unsubscribe` envelope

## Typed convenience factories

For common ROS message types, skip the `messageType` + `valueExtractor` boilerplate:

| Factory | Message type | Extracted value |
|---|---|---|
| `createBatteryStateAdapter` | `sensor_msgs/BatteryState` | `percentage * 100` |
| `createRangeAdapter` | `sensor_msgs/Range` | `range` (m) |
| `createTemperatureAdapter` | `sensor_msgs/Temperature` | `temperature` (°C) |
| `createNavSatFixAdapter({ axis })` | `sensor_msgs/NavSatFix` | `latitude` / `longitude` / `altitude` |
| `createFloat32Adapter` | `std_msgs/Float32` | `data` |
| `createFloat64Adapter` | `std_msgs/Float64` | `data` |

```ts
import { createBatteryStateAdapter } from '@altara/ros';

const battery = createBatteryStateAdapter({
  url: 'ws://localhost:9090',
  topic: '/battery',
});
// hand to any component that takes `dataSource={…}`
```

## Documentation

The full **Connecting ROS2** guide — Docker setup, multi-topic dashboards, timestamp source modes, throttling, troubleshooting table — lives in the project Storybook. Run it locally:

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm --filter @altara/storybook storybook
```

Then open **Guides → Connecting ROS2**.

## Links

- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [`@altara/core`](https://www.npmjs.com/package/@altara/core) — components, hooks, design tokens
- [rosbridge_suite](https://github.com/RobotWebTools/rosbridge_suite) — the WebSocket server you're connecting to

## License

MIT
