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
| `createBatteryStateAdapter` | `sensor_msgs/BatteryState` | `percentage * 100` (voltage fallback — see below) |
| `createRangeAdapter` | `sensor_msgs/Range` | `range` (m) |
| `createTemperatureAdapter` | `sensor_msgs/Temperature` | `temperature` (°C) |
| `createNavSatFixAdapter({ axis })` | `sensor_msgs/NavSatFix` | `latitude` / `longitude` / `altitude` |
| `createImuAdapter` | `sensor_msgs/Imu` | `{ roll, pitch, yaw }` in degrees (see below) |
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

### Battery state of charge with a voltage fallback

PX4 and ArduPilot publish `BatteryState.percentage` as `-1` (or `NaN`) when the
firmware has no fuel-gauge estimate — the common case on a bare LiPo pack. By
default that sample is dropped and the gauge stays blank. Pass a `voltageRange`
to derive an estimate from `voltage` instead:

```ts
const battery = createBatteryStateAdapter({
  url: 'ws://localhost:9090',
  topic: '/mavros/battery',
  voltageRange: { min: 14.0, max: 16.8 }, // 4S LiPo (3.5–4.2 V/cell)
});
```

> ⚠️ The voltage→charge map is a **clamped linear approximation**. A LiPo's
> discharge curve is non-linear, so treat this as **presence-of-charge**
> (is there juice left?), **not** an accurate range-remaining percentage. A
> valid `percentage` from the firmware always takes precedence.

## Multi-channel sources & the PFD

A flight display needs several signals at once (roll, pitch, heading, airspeed,
altitude). Two helpers make that one coherent `dataSource`:

- **`channels`** — pass a `{ name: extractor }` map to `createRosbridgeAdapter`
  (or use `createImuAdapter`) to pull several numbers from **one** message over
  **one** socket. Returns `{ [name]: AltaraDataSource }`.
- **`mergeChannels`** — union several single-value sources into one
  channel-tagged source that a multi-input component routes by channel.

`createImuAdapter` converts `sensor_msgs/Imu.orientation` (a quaternion) into
`{ roll, pitch, yaw }` degree channels for you (the standalone
`quaternionToEuler(q)` is exported too, clamped at the ±90° poles). Note IMU
`yaw` is heading in the IMU frame, **not** compass heading — drive the PFD's
`heading` from `VFR_HUD`.

A full Primary Flight Display wires on **two sockets** — one IMU, one VFR_HUD:

```tsx
import { PrimaryFlightDisplay } from '@altara/aerospace';
import { createImuAdapter, createRosbridgeAdapter, mergeChannels } from '@altara/ros';

const imu = createImuAdapter({ url, topic: '/mavros/imu/data' }); // { roll, pitch, yaw }
const hud = createRosbridgeAdapter({
  url,
  topic: '/mavros/vfr_hud',
  messageType: 'mavros_msgs/VFR_HUD',
  channels: {
    heading: (m) => m.heading,
    airspeed: (m) => m.airspeed * 1.94384, // m/s -> kt
    altitude: (m) => m.altitude * 3.28084, // m -> ft
  },
});

const source = mergeChannels({
  roll: imu.roll,
  pitch: imu.pitch,
  heading: hud.heading,
  airspeed: hud.airspeed,
  altitude: hud.altitude,
});

// <PrimaryFlightDisplay dataSource={source} showFlightDirector />
```

`mergeChannels` is re-exported from `@altara/ros` (it lives in `@altara/core`),
so a single import line covers the whole wiring.

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
