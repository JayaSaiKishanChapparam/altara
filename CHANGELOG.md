# Changelog

A curated narrative of what's published. Per-package CHANGELOGs (maintained by [Changesets](https://github.com/changesets/changesets)) live alongside each package and have the precise version-by-version history.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until any package reaches `1.0.0` the public API is still considered pre-stable; minor bumps may include additive breaks. The MIGRATION guide tracks any cross-package break.

## Where the versions live

There is no hand-maintained version table here — it went stale (it claimed
`@altara/core@0.0.2` while npm was serving `0.2.1`) and a table that lies is
worse than no table.

For what is published right now, read the source of truth:

| Package | npm | Changelog |
| --- | --- | --- |
| `@altara/core` | [npm](https://npmjs.com/package/@altara/core) | [CHANGELOG](packages/core/CHANGELOG.md) |
| `@altara/aerospace` | [npm](https://npmjs.com/package/@altara/aerospace) | [CHANGELOG](packages/aerospace/CHANGELOG.md) |
| `@altara/av` | [npm](https://npmjs.com/package/@altara/av) | [CHANGELOG](packages/av/CHANGELOG.md) |
| `@altara/industrial` | [npm](https://npmjs.com/package/@altara/industrial) | [CHANGELOG](packages/industrial/CHANGELOG.md) |
| `@altara/ros` | [npm](https://npmjs.com/package/@altara/ros) | [CHANGELOG](packages/ros/CHANGELOG.md) |
| `@altara/mqtt` | [npm](https://npmjs.com/package/@altara/mqtt) | [CHANGELOG](packages/mqtt/CHANGELOG.md) |

Those per-package changelogs are written by Changesets on every release and
ship inside the published tarballs, so `npm view <pkg> versions` and the
changelog can't drift apart.

Everything below is the historical narrative of the early releases, kept as
written.

## Initial publish — `@altara/core@0.0.1`, `@altara/ros@0.0.1`

### Added — components (`@altara/core`)

- `SignalPanel` — React grid of named telemetry values with status dots, threshold-driven coloring, staleness detection, and a per-update flash animation.
- `ConnectionBar` — controlled status strip showing connection state, URL, latency, and message-rate.
- `Gauge` — SVG arc 135°→45° with animated needle (transition auto-disabled above ~10 Hz), threshold-zone arcs, sm/md/lg sizes.
- `TimeSeries` — Canvas + `requestAnimationFrame` chart with sliding window, multi-channel, threshold lines, DPR scaling, design tokens read every frame.
- `Attitude` — Canvas artificial horizon with sky/ground halves, pitch ladder, fixed aircraft symbol, roll-scale arc.
- `LiveMap` — Leaflet + react-leaflet (optional peer deps, dynamically imported); GPS track, heading marker, geofences, auto-follow.
- `EventLog` — scrollable severity log with filter toolbar, max-entries cap, auto-scroll-when-pinned.
- `MultiAxisPlot` — dual-Y-axis time-series chart for signals on different scales.
- `DashboardLayout` — `react-grid-layout` integration (optional peer dep) for draggable / resizable panels.

### Added — data layer (`@altara/core`)

- `RingBuffer` — fixed-capacity Float64Array circular buffer.
- `useWebSocket` — auto-reconnect with exponential backoff (capped 30 s), bounded message queue, status transitions, manual `reconnect` / `close`, `enabled` pause toggle.
- `useRingBuffer`, `useTelemetry` — React hooks for buffer + data-source binding.
- `createMqttAdapter` — MQTT-over-WebSocket adapter (optional `mqtt` peer dep, dynamically imported).
- `createWorkerDataSource` — Web Worker pipeline for ≥500 Hz feeds. Inline-blob worker so it ships without a separate build entry.
- Mock generators: `sineWave`, `randomWalk`, `stepFunction`, `custom`, plus `createMockDataSource`.

### Added — `@altara/ros`

- `createRosbridgeAdapter` and types — extracted from `@altara/core` so the rosbridge dependency footprint is opt-in. See [MIGRATION.md](./MIGRATION.md).
- Typed convenience factories for common ROS message types: `createBatteryStateAdapter`, `createFloat32Adapter`, `createFloat64Adapter`, `createRangeAdapter`, `createTemperatureAdapter`, `createNavSatFixAdapter`.

### Added — design system

- Single `tokens.css` exposed via `@altara/core/styles.css`. CSS custom properties for both `dark` and `light` themes, semantic data colors (`active` / `warn` / `danger` / `stale` / `info`), spacing / radii / typography tokens.
- `prefers-reduced-motion` support: the SignalPanel flash animation and Gauge needle transition disable when the OS-level setting is on.

### Added — tooling

- pnpm + Turborepo monorepo, GitHub Actions CI (`lint` / `test` / `build` / `size-limit` gate), Changesets release pipeline.
- Storybook documentation site with three stories per component (`Default`, `WithDataSource`, `AllProps`).
- Bundle-size gate: 30 kB gzipped for `@altara/core/dist/index.mjs`.

### Breaking changes

- `createRosbridgeAdapter` (and `RosbridgeAdapterOptions`, `TimeSource`) are no longer exported from `@altara/core`. Import from `@altara/ros`.

## `@altara/core@0.0.2`, `@altara/ros@0.0.2`

- Per-package `README.md`, bundled `LICENSE`, and the npm-rendered metadata fields (`repository`, `homepage`, `bugs`, `keywords`, `author`). The packages had no README on npm, no source link, and no description — install worked but discovery was broken.

## `@altara/aerospace@0.1.0`

- Flight-instrument React components for drone ground stations, eVTOL, UAV simulators, and aerospace research. Eleven components: `PrimaryFlightDisplay` (flagship composite PFD), `HorizontalSituationIndicator`, `Altimeter`, `VerticalSpeedIndicator`, `AirspeedIndicator`, `EngineInstrumentCluster`, `RadioAltimeter`, `TerrainAwareness`, `TCASDisplay`, `AutopilotModeAnnunciator`, and `FuelGauge`. All canvas/SVG, all support `mockMode`, all consume any `AltaraDataSource`.

## `@altara/mqtt@0.1.0`

- Public publish. The package was previously `private`; `package.json` now matches `@altara/core` / `@altara/ros` (homepage, repository, bugs, author, keywords, sideEffects, README + LICENSE in the tarball). Entry point re-exports `createMqttAdapter`, `MqttAdapterOptions`, and `MqttClientLike` from `@altara/core` — a thin specialised package that signals "this app talks to an MQTT broker".

## `@altara/av@0.1.0`

- Autonomous-vehicle React components for ADS / robotaxi / robotics dashboards. Eleven components: `LiDARPointCloud` (Three.js, flagship), `OccupancyGrid`, `ObjectDetectionOverlay`, `PathPlannerOverlay`, `VelocityVectorDisplay`, `PerceptionStateMachine`, `SensorHealthMatrix`, `CameraFeed`, `ControlTrace`, `RadarSweep`, and `SLAMMap`. Three.js is an optional peer dep — `LiDARPointCloud` lazy-imports it at runtime and renders a friendly "install three" placeholder when absent.

## `@altara/industrial@0.1.0`

- SCADA / HMI React components for manufacturing, energy, and process-control applications. Nine components: `WaterfallSpectrogram` (FFT + Canvas heat-map waterfall, flagship — built for vibration / acoustic / RF analysis), `OEEDashboard` (availability × performance × quality with Pareto), `AlarmAnnunciatorPanel` (industrial control-room alarm grid with blink + acknowledge), `TrendRecorder` (multi-pen up-to-8-channel chart recorder), `PIDTuningPanel`, `PIDNode` (single ISA 5.1 instrument symbol), `ProcessFlowDiagram` (composable tanks / pumps / heat-exchangers / valves), `MotorDashboard`, and `PredictiveMaintenanceGauge`. Inline radix-2 FFT keeps the spectrogram dependency-free; for very large FFT sizes, push the work to a Web Worker via `createWorkerDataSource` from `@altara/core`.
