# @altara/core

**React components for real-time telemetry dashboards.** Canvas-rendered time-series charts, gauges, attitude indicators, GPS maps, signal panels, and event logs for robotics, aerospace, autonomous-vehicle, and industrial-IoT applications — where generic charting libraries fall short.

[![npm version](https://img.shields.io/npm/v/@altara/core?color=1D9E75&label=npm)](https://www.npmjs.com/package/@altara/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/core?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/core)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/core)
[![license](https://img.shields.io/npm/l/@altara/core?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

![Altara — real-time telemetry at 60fps](https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/hero.gif)

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

A working dashboard with zero configuration — `mockMode` plumbs realistic synthetic data into every component until you swap in a real `dataSource`.

## What's in the package

- **Components** — `TimeSeries`, `Gauge`, `Attitude`, `SignalPanel`, `LiveMap`, `EventLog`, `ConnectionBar`, `MultiAxisPlot`, `DashboardLayout`
- **Hooks** — `useWebSocket`, `useTelemetry`, `useRingBuffer`
- **Adapters** — `createMqttAdapter`, `createWorkerDataSource`, `createMockDataSource`
- **Mock generators** — `sineWave`, `randomWalk`, `stepFunction`, `custom`
- **Design tokens** — single CSS file (`@altara/core/styles.css`), dark + light themes via CSS custom properties

## Showcase

<table>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/time-series.gif" width="380" alt="TimeSeries — 60fps canvas chart"/><br/>
<sub><b>TimeSeries</b> — 60fps canvas chart</sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/attitude.gif" width="240" alt="Attitude indicator"/><br/>
<sub><b>Attitude</b> — artificial horizon</sub>
</td>
</tr>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/gauge.gif" width="240" alt="Analog gauge"/><br/>
<sub><b>Gauge</b> — threshold-zone arcs</sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/signal-panel.gif" width="380" alt="Signal panel"/><br/>
<sub><b>SignalPanel</b> — live signals + status dots</sub>
</td>
</tr>
</table>

## Why Altara

Most React charting libraries render via SVG or React DOM — at 100 Hz+ sensor data rates that causes visible jank. Altara writes directly to Canvas via `requestAnimationFrame` and keeps the hot path completely out of React. A `RingBuffer` (Float64Array) holds samples; the rAF loop reads from the buffer and paints. React state only tracks UI concerns like connection status.

It also ships the domain-specific components engineers actually need — attitude indicators, live GPS maps, threshold-aware gauges — and a typed rosbridge adapter (in [`@altara/ros`](https://www.npmjs.com/package/@altara/ros)) so a one-line import gets you live ROS2 data on screen.

## Bundle size

Under 30 KB gzipped. Optional peer deps (`leaflet`, `react-leaflet`, `react-grid-layout`, `mqtt`, `three`) are dynamically imported and only paid for if you use the components that need them.

## Documentation

- **[📚 Storybook](https://jayasaikishanchapparam.github.io/altara/storybook/)** — every component, every prop, with live demos. Plus Guides (Getting started, Connecting ROS2 / MQTT, Mock data, Theming, Performance), Cookbook dashboards, and Comparisons vs. Grafana / Foxglove.
- **[🛰️ Live demo dashboard](https://jayasaikishanchapparam.github.io/altara/demo/)** — multi-tab showcase combining `core`, `aerospace`, `av`, and `industrial`, all driven by mock data.

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
| [`@altara/aerospace`](https://www.npmjs.com/package/@altara/aerospace) | Flight instruments — PFD, HSI, altimeter, airspeed, VSI, engine cluster, TCAS, TAWS, FMA, fuel gauge, radio altimeter. |
| [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) | ROS2 / rosbridge adapter + typed factories for common `sensor_msgs/*` message types. |
| [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) | MQTT-over-WebSocket adapter (re-exports `createMqttAdapter` from this package). |

## Links

- [Storybook (live)](https://jayasaikishanchapparam.github.io/altara/storybook/) · [Demo dashboard (live)](https://jayasaikishanchapparam.github.io/altara/demo/)
- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [Issue tracker](https://github.com/JayaSaiKishanChapparam/altara/issues)
- [Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
