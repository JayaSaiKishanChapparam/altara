# @altara/core

**React components for real-time telemetry dashboards.** Canvas-rendered time-series charts, gauges, attitude indicators, GPS maps, signal panels, and event logs for robotics, aerospace, autonomous-vehicle, and industrial-IoT applications — where generic charting libraries fall short.

![Altara Gauge — live battery-drain telemetry](https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/gauge-battery-drain.gif)

[![npm version](https://img.shields.io/npm/v/@altara/core?color=1D9E75&label=npm)](https://www.npmjs.com/package/@altara/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/core?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/core)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/core)
[![license](https://img.shields.io/npm/l/@altara/core?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

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

**See it live:** [Website](https://www.usealtara.dev/) · [Live demo](https://jayasaikishanchapparam.github.io/altara/demo/) · [Storybook](https://jayasaikishanchapparam.github.io/altara/storybook/)

## What's in the package

- **Components** — `TimeSeries`, `Gauge`, `Attitude`, `SignalPanel`, `LiveMap`, `EventLog`, `ConnectionBar`, `MultiAxisPlot`, `DashboardLayout`
- **Hooks** — `useWebSocket`, `useTelemetry`, `useRingBuffer`
- **Adapters** — `createMqttAdapter`, `createWorkerDataSource` (worker-side buffering + decimation), `createMockDataSource`, `mergeChannels`
- **Mock generators** — `sineWave`, `randomWalk`, `stepFunction`, `custom`
- **Design tokens** — single CSS file (`@altara/core/styles.css`), dark + light themes via CSS custom properties

### Driving multi-input components — `mergeChannels`

`mergeChannels(sources)` unions several single-value data sources into one channel-tagged source: each key becomes the `channel` on that source's samples, so a multi-input component (like `PrimaryFlightDisplay` from `@altara/aerospace`, which routes by `roll` / `pitch` / `heading` / `airspeed` / `altitude`) can consume a single `dataSource`. `getHistory()` merges children in timestamp order, `status` is worst-of, and `destroy()` tears down every child.

```ts
import { mergeChannels } from '@altara/core';

const source = mergeChannels({
  roll: rollAdapter,   // samples tagged channel: 'roll'
  pitch: pitchAdapter, // samples tagged channel: 'pitch'
});
// <PrimaryFlightDisplay dataSource={source} />
```

A merged source exposes no `decimator` — see the worker section below for why.

### Off-main-thread decimation — `createWorkerDataSource`

At high sample rates the expensive part of a chart is not painting, it is
everything before the paint: copying the ring buffer, scanning it for the y
extent, and reducing it to one min/max pair per pixel column. Done in
`requestAnimationFrame`, that work is O(samples buffered) every frame and it
lands directly on the render path.

`createWorkerDataSource` moves all of it into a Web Worker. The worker owns the
WebSocket, a `RingBuffer` per channel, and the min/max reduction, and pushes back
only the geometry the renderer needs:

```ts
import { createWorkerDataSource, TimeSeries } from '@altara/core';

const source = createWorkerDataSource({
  url: 'wss://telemetry.example/stream',
  // Evaluated inside the worker, so it is passed as source text. Return a
  // number, an object, or an array of either.
  extractorSource: '(m) => m.samples',
  bufferSize: 12_000, // per channel, inside the worker
  flushHz: 60,
});

<TimeSeries dataSource={source} channels={[{ key: 'gyro_x', label: 'Gyro X' }]} />;
```

Charts feature-detect the capability. Nothing else has to change: pass a
worker-backed source and `TimeSeries` / `MultiAxisPlot` take the fast path; pass
a mock, replay, rosbridge, or MQTT source and they buffer and decimate locally
exactly as before.

**How the protocol works.** The visible window is anchored to wall-clock
(`tMin = now - windowMs`), so it advances on its own every frame. Telling the
worker the range 60 times a second would be pure overhead, so the renderer sends
a *viewport* only when something real changes — plot width, window length, or the
channel list — and the worker derives the rest and pushes frames at `flushHz`.

- **Frames carry data-space values, not pixels.** Each channel comes back as
  per-column min/max plus its own extent. Projection to pixels stays in the
  renderer, because it depends on sibling channels and threshold lines, which the
  worker cannot know. That projection is O(columns), not O(samples).
- **Every frame is a complete snapshot**, never a delta. That is what makes
  dropping one safe.
- **Each frame carries an epoch.** Geometry decimated for a superseded viewport
  is discarded rather than drawn against the wrong width.
- **One unacknowledged frame at a time.** If the main thread stalls, the worker
  skips flushes instead of queueing them, so the renderer gets the newest
  complete snapshot rather than a backlog of stale ones.

**Several charts can share one source.** `decimator.acquire()` hands each
consumer its own viewport, epoch, and send credit:

```ts
const view = source.decimator?.acquire();
view?.setViewport({ channels: ['gyro_x'], windowMs: 10_000, plotW: 800 });
view?.getFrame(); // latest frame for this consumer, or null
view?.release();  // when the consumer goes away
```

The components do this internally, so two charts on one source just work — they
share the socket, the ingest pass, and the ring buffers, and differ only in the
decimation pass. You do not need `acquire()` unless you are building your own
renderer.

**Two things worth knowing:**

- **`bufferSize` on the chart is ignored for decimating sources.** Capacity
  belongs to the worker; set it in `createWorkerDataSource`.
- **`mergeChannels` deliberately exposes no `decimator`.** Off-main-thread
  decimation needs one worker owning every channel in the plot, and a merge spans
  independent sources by definition. Charts fed a merged source decimate locally,
  which is correct, just not accelerated. For the fast path, configure one
  `createWorkerDataSource` with a channel-tagging extractor instead of merging
  several sources.

Raw delivery is unchanged: `subscribe()` and `getHistory()` still see every
sample, so `Gauge`, `SignalPanel`, and `Attitude` behave exactly as they always
did on the same source.

#### Advanced: `WORKER_SOURCE` and `workerImpl`

> **Low-level escape hatch, not the main path.** If you are calling
> `createWorkerDataSource` normally you can ignore this entire section.

By default the worker is spawned from a Blob URL built out of `WORKER_SOURCE` —
the worker body, exported as source text. `workerImpl` lets you supply the
`Worker` yourself, which together make the pipeline inspectable and reusable
instead of a sealed box:

```ts
import { WORKER_SOURCE, createWorkerDataSource } from '@altara/core';

// A worker that runs the real library body against a WebSocket you control.
// Assigning globalThis.WebSocket before evaluating WORKER_SOURCE is the seam:
// the body resolves its socket constructor from the worker's global scope.
const source = createWorkerDataSource({
  url: 'simulated://local',
  workerImpl: () => new Worker(myWorkerUrl, { type: 'module' }),
});
```

Two reasons this is exported:

- **Testing.** A sealed Blob worker cannot be driven deterministically. With
  `workerImpl` you can inject a double, and with `WORKER_SOURCE` you can run the
  genuine body under a controlled clock and socket.
- **Hosts without Blob URLs.** Strict CSP, some Electron configurations, and
  bundlers that want a real worker chunk all need to construct the worker
  themselves.

`WORKER_SOURCE` is the bundled output of an internal module. Its *contents* are
an implementation detail and will change; what is stable is that it is a
self-contained script which, when evaluated in a worker scope, installs the
message handler `createWorkerDataSource` talks to.

### `LiveMap` setup: stylesheet and height

`LiveMap` has two requirements that are easy to miss.

**1. Import Leaflet's stylesheet once in your app.** Without it, every tile loads but nothing positions the tiles, so they stack in normal document flow. The result is scattered tile blocks, and the map's container grows to thousands of pixels tall. `leaflet` is an optional peer dependency, so nothing imports the stylesheet for you.

```ts
import 'leaflet/dist/leaflet.css';
```

**2. Give the map's parent a definite height.** `.vt-live-map` is `width: 100%; height: 100%`, so it fills its parent. That only works if the parent has a definite height, such as `height: 420px`, a grid or flex track of fixed size, or a chain of percentage heights back to a fixed ancestor. A parent that only has a `min-height`, or that is sized by its content, is not definite. The percentage then doesn't resolve, and the map takes whatever height the surrounding layout happens to give it, which changes with the viewport. If the stylesheet is also missing, the map grows to thousands of pixels tall.

```tsx
// ✗ the height depends on whatever else is in the layout
<div style={{ minHeight: 320 }}>
  <LiveMap mockMode />
</div>

// ✓ a definite height for the map to fill
<div style={{ height: 420 }}>
  <LiveMap mockMode />
</div>
```

### Mock profiles

`Gauge` takes an optional `mockProfile?: 'sine' | 'ramp'` (default `'sine'`) that's only relevant when `mockMode` is on: `'sine'` sweeps the needle back and forth, while `'ramp'` drains monotonically from max → min then resets — a believable draining-battery demo.

`LiveMap`'s `mockMode` now rotates the marker's nose along its orbit (great-circle bearing along the simulated path); when you pass a controlled `position`, your `heading` prop still wins.

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

Most React charting libraries re-render a React subtree per update, so paint cost scales with how often the data changes. Altara writes directly to Canvas via `requestAnimationFrame` and keeps the hot path completely out of React. A `RingBuffer` (Float64Array) holds samples; the rAF loop reads from the buffer and paints. React state only tracks UI concerns like connection status.

Above roughly one sample per pixel column the charts switch to min/max
decimation, keeping the extremes of each column rather than averaging them, so
short transients survive. With `createWorkerDataSource` that reduction happens in
a worker and the renderer never touches a raw sample at all.

It also ships the domain-specific components engineers actually need — attitude indicators, live GPS maps, threshold-aware gauges — and a typed rosbridge adapter (in [`@altara/ros`](https://www.npmjs.com/package/@altara/ros)) so a one-line import gets you live ROS2 data on screen.

## Bundle size

14.4 KB gzipped (`@altara/core@0.2.3`, measured 2026-09-30 with `size-limit`), enforced in CI by a 30 KB gate. Optional peer deps (`leaflet`, `react-leaflet`, `react-grid-layout`, `mqtt`, `three`) are dynamically imported and only paid for if you use the components that need them.

## Documentation

- **[📚 Storybook](https://jayasaikishanchapparam.github.io/altara/storybook/)** — every component, every prop, with live demos. Plus Guides (Getting started, Connecting ROS2 / MQTT, Mock data, Theming, Performance), Cookbook dashboards, and Comparisons vs. Grafana / Foxglove.
- **[🛰️ Live demo dashboard](https://jayasaikishanchapparam.github.io/altara/demo/)** — multi-tab showcase combining `core`, `aerospace`, `av`, and `industrial`. Most tabs run on in-browser generators; the Worker Pipeline tab needs a local telemetry server and is inert on the hosted build.

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

## Stability

**Pre-1.0.** Every package is below `1.0.0`, and until one reaches it the public
API is not considered stable:

- **Patch** (`0.2.1` -> `0.2.2`) — bug fixes, docs, packaging. Safe.
- **Minor** (`0.2.x` -> `0.3.0`) — new features, and **may include breaking
  changes**. This is the pre-1.0 semver allowance, not an accident. Pin the
  minor (`~0.2.0`) if you need that not to happen.
- Breaking changes are always described in the package's
  [CHANGELOG](CHANGELOG.md); anything spanning packages also lands in
  [MIGRATION.md](https://github.com/JayaSaiKishanChapparam/altara/blob/main/MIGRATION.md).

In practice the component APIs have been stable since `0.1.0` and every break so
far has been in the adapter layer. That is a track record, not a guarantee.

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
