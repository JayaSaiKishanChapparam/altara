# @altara/core

**React components for real-time telemetry dashboards.** Built for robotics, aerospace, and industrial IoT — where generic charting libraries fall short.

This is the core package: components, hooks, design tokens, the MQTT and mock adapters, and the off-thread Web Worker pipeline. For ROS2 install [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) alongside.

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

## Why Altara

Most React charting libraries render via SVG or React DOM — at 100 Hz+ sensor data rates that causes visible jank. Altara writes directly to Canvas via `requestAnimationFrame` and keeps the hot path completely out of React. A `RingBuffer` (Float64Array) holds samples; the rAF loop reads from the buffer and paints. React state only tracks UI concerns like connection status.

It also ships the domain-specific components engineers actually need — attitude indicators, live GPS maps, threshold-aware gauges — and a typed rosbridge adapter (in `@altara/ros`) so a one-line import gets you live ROS2 data on screen.

## Bundle size

Under 30 KB gzipped. Optional peer deps (`leaflet`, `react-leaflet`, `react-grid-layout`, `mqtt`, `three`) are dynamically imported and only paid for if you use the components that need them.

## Documentation

Interactive component demos, written guides, and the cookbook live in Storybook. Run it locally:

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm --filter @altara/storybook storybook
# → http://localhost:6006
```

You'll find the landing page, six guides (Getting started, Connecting ROS2, Connecting MQTT, Mock data, Theming, Performance), three full cookbook dashboards, comparisons vs Grafana / Foxglove, and an interactive playground for every component.

## Links

- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) — ROS2 rosbridge adapter

## License

MIT
