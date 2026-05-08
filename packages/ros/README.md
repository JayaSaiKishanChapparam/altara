# @altara/ros

**ROS2 rosbridge adapter for Altara.** Subscribe to a ROS2 topic from React in one line and pipe live samples (IMU, GPS, battery, range, temperature, ...) into any [`@altara/core`](https://www.npmjs.com/package/@altara/core) component. Built for robotics dashboards, drone ground stations, and rover monitoring UIs.

[![npm version](https://img.shields.io/npm/v/@altara/ros?color=EF9F27&label=npm)](https://www.npmjs.com/package/@altara/ros)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/ros?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/ros)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/ros)
[![license](https://img.shields.io/npm/l/@altara/ros?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

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
| --- | --- | --- |
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

- **[📚 Connecting ROS2 guide (live Storybook)](https://jayasaikishanchapparam.github.io/altara/storybook/?path=/docs/guides-connecting-ros2--api-reference)** — Docker setup, multi-topic dashboards, timestamp source modes, throttling, troubleshooting.
- **[🛰️ Live demo dashboard](https://jayasaikishanchapparam.github.io/altara/demo/)** — see the components a rosbridge feed would drive.

Or run Storybook locally:

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm --filter @altara/storybook storybook
```

Then open **Guides → Connecting ROS2**.

## Sibling packages

| Package | What it does |
| --- | --- |
| [`@altara/core`](https://www.npmjs.com/package/@altara/core) | Components, hooks, MQTT/mock adapters, design tokens. The starting point. |
| [`@altara/aerospace`](https://www.npmjs.com/package/@altara/aerospace) | Flight instruments — PFD, HSI, altimeter, airspeed, VSI, engine cluster, TCAS, TAWS, FMA, fuel gauge, radio altimeter. |
| [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) | MQTT-over-WebSocket adapter for IoT brokers. |

## Links

- [Storybook (live)](https://jayasaikishanchapparam.github.io/altara/storybook/) · [Demo dashboard (live)](https://jayasaikishanchapparam.github.io/altara/demo/)
- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [Issue tracker](https://github.com/JayaSaiKishanChapparam/altara/issues)
- [Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)
- [rosbridge_suite](https://github.com/RobotWebTools/rosbridge_suite) — the WebSocket server you're connecting to

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
