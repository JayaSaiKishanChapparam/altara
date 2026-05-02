# Changelog

All notable changes are documented here. After v1.0.0, per-package CHANGELOGs are also maintained in each package directory by [Changesets](https://github.com/changesets/changesets) — the entries below are a curated narrative of the release.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Initial public release

### Added — components

- `SignalPanel` — React grid of named telemetry values with status dots, threshold-driven coloring, staleness detection, and a per-update flash animation.
- `ConnectionBar` — controlled status strip showing connection state, URL, latency, and message-rate.
- `Gauge` — SVG arc 135°→45° with animated needle (transition auto-disabled above ~10 Hz), threshold-zone arcs, sm/md/lg sizes.
- `TimeSeries` — Canvas + `requestAnimationFrame` chart with sliding window, multi-channel, threshold lines, DPR scaling, design tokens read every frame.
- `Attitude` — Canvas artificial horizon with sky/ground halves, pitch ladder, fixed aircraft symbol, roll-scale arc.
- `LiveMap` — Leaflet + react-leaflet (optional peer deps, dynamically imported); GPS track, heading marker, geofences, auto-follow.
- `EventLog` — scrollable severity log with filter toolbar, max-entries cap, auto-scroll-when-pinned.
- `MultiAxisPlot` — dual-Y-axis time-series chart for signals on different scales.
- `DashboardLayout` — `react-grid-layout` integration (optional peer dep) for draggable / resizable panels.

### Added — data layer

- `RingBuffer` — fixed-capacity Float64Array circular buffer.
- `useWebSocket` — auto-reconnect with exponential backoff (capped 30 s), bounded message queue, status transitions, manual `reconnect` / `close`, `enabled` pause toggle.
- `useRingBuffer`, `useTelemetry` — React hooks for buffer + data-source binding.
- `createMqttAdapter` — MQTT-over-WebSocket adapter (optional `mqtt` peer dep, dynamically imported).
- `createWorkerDataSource` — Web Worker pipeline for ≥500 Hz feeds. Inline-blob worker so it ships without a separate build entry.
- Mock generators: `sineWave`, `randomWalk`, `stepFunction`, `custom`, plus `createMockDataSource`.

### Added — `@altara/ros`

- `createRosbridgeAdapter` and types — moved out of `@altara/core` (see migration guide).
- Typed convenience factories for common ROS message types: `createBatteryStateAdapter`, `createFloat32Adapter`, `createFloat64Adapter`, `createRangeAdapter`, `createTemperatureAdapter`, `createNavSatFixAdapter`.

### Added — design system

- Single `tokens.css` exposed via `@altara/core/styles.css`. CSS custom properties for both `dark` and `light` themes, semantic data colors (`active` / `warn` / `danger` / `stale` / `info`), spacing / radii / typography tokens.
- `prefers-reduced-motion` support: the SignalPanel flash animation and Gauge needle transition disable when the OS-level setting is on.

### Added — tooling

- pnpm + Turborepo monorepo, GitHub Actions CI (`lint` / `test` / `build` / `size-limit` gate), Changesets release pipeline.
- Storybook documentation site with three stories per component (`Default`, `WithDataSource`, `AllProps`).
- Bundle-size gate: 30 kB gzipped for `@altara/core/dist/index.mjs`.

### Breaking changes

- `createRosbridgeAdapter` (and `RosbridgeAdapterOptions`, `TimeSource`) are no longer exported from `@altara/core`. Import from `@altara/ros`. See [MIGRATION.md](./MIGRATION.md).

[1.0.0]: https://github.com/altara/altara/releases/tag/v1.0.0
