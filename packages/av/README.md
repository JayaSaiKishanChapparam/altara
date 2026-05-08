# @altara/av

**Autonomous-vehicle React components for Altara.** Embeddable LiDAR point-cloud renderer (Three.js), occupancy grid, object-detection overlay, path planner, camera feed, control trace, radar sweep, perception state machine, sensor health matrix, and SLAM map — for robotaxis, ADS prototypes, autonomous-shuttle dashboards, mobile-robotics monitoring, and self-driving research UIs.

[![npm version](https://img.shields.io/npm/v/@altara/av?color=D946EF&label=npm)](https://www.npmjs.com/package/@altara/av)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/av?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/av)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/av)
[![license](https://img.shields.io/npm/l/@altara/av?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

![LiDAR point cloud](https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/av-lidar.gif)

## Install

```bash
npm install @altara/core @altara/av
# Three.js is required only if you use LiDARPointCloud — it's an optional peer dep:
npm install three
```

Import the design-token stylesheet from `@altara/core` once at your app root:

```ts
import '@altara/core/styles.css';
```

## Quick start

```tsx
import { AltaraProvider } from '@altara/core';
import { LiDARPointCloud, OccupancyGrid, ControlTrace } from '@altara/av';

export function AvDashboard() {
  return (
    <AltaraProvider theme="dark">
      <LiDARPointCloud mockMode width={800} height={500} />
      <OccupancyGrid mockMode width={400} height={400} />
      <ControlTrace mockMode windowMs={15_000} />
    </AltaraProvider>
  );
}
```

## Components

| Component | Description |
| --- | --- |
| `LiDARPointCloud` | Three.js BufferGeometry + Points renderer. Color modes: intensity, height, return, flat. Camera presets: top, iso, follow. |
| `OccupancyGrid` | 2D overhead occupancy-grid renderer with vehicle pose, goal marker, and planned-path overlay. |
| `ObjectDetectionOverlay` | Bounding-box overlay with class labels + confidence scores for YOLO/SSD-style detections. |
| `PathPlannerOverlay` | Top-down planned vs actual trajectory with deviation corridor and live cross-track-error readout. |
| `VelocityVectorDisplay` | SVG vehicle diagram with linear-velocity arrow + angular-velocity arc. |
| `PerceptionStateMachine` | SVG node graph of the perception pipeline with per-module status + latency. |
| `SensorHealthMatrix` | Grid of sensor-health tiles — name, topic, expected rate, age, status. |
| `CameraFeed` | Canvas image renderer with overlay slot (crosshair, grid, bounding box). |
| `ControlTrace` | Three vertically stacked time-series for throttle, brake, steering. |
| `RadarSweep` | PPI radar sweep with rotating wedge and decaying target dots. |
| `SLAMMap` | Occupancy grid + pose-graph overlay with loop-closure highlighting. |

## Showcase

<table>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/av-occgrid.gif" width="320" alt="Occupancy grid"/><br/>
<sub><b>OccupancyGrid</b></sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/av-slam.gif" width="320" alt="SLAM map"/><br/>
<sub><b>SLAMMap</b></sub>
</td>
</tr>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/av-radar.gif" width="280" alt="Radar sweep"/><br/>
<sub><b>RadarSweep</b></sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/av-perception.gif" width="360" alt="Perception state machine"/><br/>
<sub><b>PerceptionStateMachine</b></sub>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/av-controltrace.gif" width="640" alt="Control trace"/><br/>
<sub><b>ControlTrace</b> — throttle / brake / steering</sub>
</td>
</tr>
</table>

## Three.js — optional

`LiDARPointCloud` is the only component that needs `three`. It's loaded via dynamic `import('three')` so:

- The other ten components work without `three` installed.
- If `three` is missing when `LiDARPointCloud` mounts, the component renders a placeholder telling the user to `npm install three` — your app keeps running.

The package's tsup build externalises `three`, so you control which version your app pins.

## Data sources

Every component accepts an `AltaraDataSource` from `@altara/core`. Pair with [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) to wire `sensor_msgs/PointCloud2` into `LiDARPointCloud`, `nav_msgs/OccupancyGrid` into `OccupancyGrid`, and `vision_msgs/Detection2DArray` into `ObjectDetectionOverlay`. Or use [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) for broker-published telemetry.

## Documentation

- **[📚 Storybook](https://jayasaikishanchapparam.github.io/altara/storybook/)** — open the **AV/** section for Default + variant stories per component, props in Controls, dark/light theme toggle.
- **[🛰️ Live demo](https://jayasaikishanchapparam.github.io/altara/demo/)** — Autonomous Vehicle tab (LiDAR, occupancy grid, radar, control trace, perception).

Or run them locally:

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm --filter @altara/storybook storybook   # http://localhost:6006
pnpm --filter @altara/demo dev              # http://localhost:5173
```

## Sibling packages

| Package | What it does |
| --- | --- |
| [`@altara/core`](https://www.npmjs.com/package/@altara/core) | Components, hooks, MQTT/mock adapters, design tokens. The starting point. |
| [`@altara/aerospace`](https://www.npmjs.com/package/@altara/aerospace) | Flight instruments — PFD, HSI, altimeter, airspeed, VSI, engine cluster, TCAS, TAWS, FMA, fuel gauge, radio altimeter. |
| [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) | ROS2 / rosbridge adapter + typed factories for common `sensor_msgs/*` message types. |
| [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) | MQTT-over-WebSocket adapter for IoT brokers. |

## Links

- [Storybook (live)](https://jayasaikishanchapparam.github.io/altara/storybook/) · [Demo dashboard (live)](https://jayasaikishanchapparam.github.io/altara/demo/)
- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [Issue tracker](https://github.com/JayaSaiKishanChapparam/altara/issues)
- [Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)
- [Three.js](https://threejs.org/) — the rendering engine behind `LiDARPointCloud`

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
