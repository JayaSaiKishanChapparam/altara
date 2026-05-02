![Altara — real-time telemetry at 60fps](./hero.gif)

# Altara

**React components for real-time telemetry dashboards.** Built for robotics, aerospace, and industrial IoT.

[![npm version](https://img.shields.io/npm/v/@altara/core?color=1D9E75&label=npm)](https://npmjs.com/package/@altara/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/core?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/core)
[![license](https://img.shields.io/npm/l/@altara/core?color=888780)](LICENSE)
[![CI](https://github.com/JayaSaiKishanChapparam/altara/actions/workflows/ci.yml/badge.svg)](https://github.com/JayaSaiKishanChapparam/altara/actions)

## Install

```bash
npm install @altara/core
```

## Quick start

```tsx
import '@altara/core/styles.css';
import { AltaraProvider, TimeSeries, Gauge } from '@altara/core';

export function Dashboard() {
  return (
    <AltaraProvider theme="dark">
      <TimeSeries mockMode height={240} />
      <Gauge mockMode min={0} max={100} label="Battery" unit="%" />
    </AltaraProvider>
  );
}
```

That's a working dashboard with zero configuration — `mockMode` plumbs realistic synthetic data into every component until you swap in a real `dataSource`.

## What's included

| Component | What it does |
|---|---|
| `TimeSeries` | Canvas-rendered time-series chart for high-frequency sensor data — `requestAnimationFrame` + `RingBuffer` for smooth 60+ fps. |
| `Gauge` | SVG analog gauge with a 270° sweep, animated needle, and threshold-zone arcs. |
| `Attitude` | Canvas artificial horizon — sky/ground halves, pitch ladder, fixed aircraft symbol. |
| `SignalPanel` | Compact grid of named telemetry values with status dots, threshold coloring, and staleness detection. |
| `LiveMap` | GPS track on Leaflet (optional peer dep) with heading marker and geofence overlays. |
| `EventLog` | Scrollable severity-tagged log with filter, auto-scroll-when-pinned, and `maxEntries` cap. |
| `ConnectionBar` | Persistent status strip — connection state, URL, latency, message rate. |

Plus `MultiAxisPlot` (dual-Y-axis chart), `DashboardLayout` (`react-grid-layout` integration), `createWorkerDataSource` (off-thread WebSocket pipeline for ≥500 Hz feeds), `createMqttAdapter` for MQTT brokers, and the sibling `@altara/ros` package with typed factories for common `sensor_msgs/*` message types.

## Why Altara

| | Altara | Grafana | Foxglove | Recharts |
|---|---|---|---|---|
| Embeds in React app | ✅ Native | ❌ iframe only | ❌ Separate app | ✅ Native |
| 60fps canvas rendering | ✅ | ❌ SVG | ✅ | ❌ SVG |
| Attitude indicator | ✅ | ❌ | ✅ | ❌ |
| ROS2 adapter | ✅ | ⚠️ Plugin | ✅ Native | ❌ |
| Bundle size | <30KB gz | Standalone app | Standalone app | ~80KB gz |
| License | MIT | AGPL | Proprietary | MIT |

## Links

- **[Storybook](https://storybook.altara.dev)** — interactive component demos and full API reference
- **[npm](https://npmjs.com/package/@altara/core)** — `@altara/core` and `@altara/ros`
- **[GitHub Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)** — questions, ideas, what-are-you-building threads
- **[Connecting ROS2 guide](https://storybook.altara.dev/?path=/docs/guides-connecting-ros2--api-reference)** — typed adapters, troubleshooting

## License

MIT. See [LICENSE](LICENSE).
