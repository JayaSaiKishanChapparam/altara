# @altara/demo

## 0.0.10

### Patch Changes

- Updated dependencies [99a30f8]
- Updated dependencies [99a30f8]
  - @altara/aerospace@0.1.6
  - @altara/core@0.3.1
  - @altara/av@0.1.4
  - @altara/industrial@0.1.4
  - @altara/ros@0.1.3

## 0.0.9

### Patch Changes

- 436b06c: Point the Worker Pipeline tab at one shared worker, and fix two dead CSS tokens.

  With several viewports now supported per source, both charts and the stats panel
  read one `createWorkerDataSource` instead of needing a worker each. The panel's
  counters come from its own third viewport, which is labelled as such.

  The inbound-rate counter divided by an assumed 1000 ms tick. A backgrounded tab
  throttles timers, so it reported rates several times higher than the feed was
  delivering; it now divides by the interval that actually elapsed and says "tab
  inactive" when animation frames are not running at all rather than showing a
  stale figure.

  `CoreView` and `styles.css` referenced `--vt-data-danger`, `--vt-data-warn`, and
  `--vt-data-active`. Those tokens do not exist — the palette is `--vt-color-*` —
  so the gauge arc rendered grey and the selected-tab underline fell back to the
  text colour.

  Adds `scripts/measure-worker-path.mjs` (`pnpm --filter @altara/demo measure`),
  which drives both decimation paths and prints the spread across repeated
  samples.

- 436b06c: Add a Worker Pipeline tab driven by a real socket, and stop the status strip
  reporting a fake message rate.

  The new tab is the first consumer of `createWorkerDataSource` and the
  `decimator` capability. A synthetic quadrotor feed (scripts/telemetry-server.mjs,
  mounted on the Vite dev and preview servers) streams ~5,000 samples/s across
  seven channels; the charts render it with decimation running in the worker. A
  toggle swaps the same live data onto the local decimation path so the two can be
  compared, and the panel above reports measured values — inbound rate, samples
  behind the plot, bucket columns, frame epoch and sequence, frame pacing — read
  from the source rather than hardcoded.

  The signal is a small flight model rather than sine waves, specifically so it
  produces the short transients min/max decimation exists to preserve.

  `ConnectionBar` on the other tabs previously showed `ws://demo.altara.dev:9090`
  at `284 msg/s` with 14 ms latency, none of which was real. Those tabs run on
  in-browser generators, so the strip now reads `mock://in-browser-generators`
  with no latency or rate. The Worker Pipeline tab renders its own strip with the
  actual URL, connection state, and measured sample rate; with no server reachable
  it shows Disconnected and explains how to start one instead of showing data.

- Updated dependencies [436b06c]
- Updated dependencies [436b06c]
- Updated dependencies [436b06c]
- Updated dependencies [b734a27]
- Updated dependencies [436b06c]
  - @altara/core@0.3.0
  - @altara/industrial@0.1.4
  - @altara/ros@0.1.3
  - @altara/aerospace@0.1.5
  - @altara/av@0.1.4

## 0.0.8

### Patch Changes

- Updated dependencies [253323e]
  - @altara/core@0.2.3
  - @altara/aerospace@0.1.4
  - @altara/av@0.1.3
  - @altara/industrial@0.1.3
  - @altara/ros@0.1.2

## 0.0.7

### Patch Changes

- Updated dependencies [e9297bc]
- Updated dependencies [2a168e2]
- Updated dependencies [90243d5]
- Updated dependencies [4e586ac]
- Updated dependencies [0f9ac2c]
  - @altara/industrial@0.1.3
  - @altara/core@0.2.2
  - @altara/aerospace@0.1.4
  - @altara/ros@0.1.2
  - @altara/av@0.1.3

## 0.0.6

### Patch Changes

- Updated dependencies [a320b40]
- Updated dependencies [a320b40]
  - @altara/core@0.2.1
  - @altara/aerospace@0.1.3
  - @altara/av@0.1.2
  - @altara/industrial@0.1.2
  - @altara/ros@0.1.1

## 0.0.5

### Patch Changes

- Updated dependencies [6aede91]
- Updated dependencies [af08119]
  - @altara/ros@0.1.1
  - @altara/aerospace@0.1.2
  - @altara/av@0.1.2
  - @altara/industrial@0.1.2
  - @altara/core@0.2.0

## 0.0.4

### Patch Changes

- Updated dependencies [56d91fb]
  - @altara/ros@0.1.0
  - @altara/core@0.1.0
  - @altara/aerospace@0.1.1
  - @altara/av@0.1.1
  - @altara/industrial@0.1.1

## 0.0.1

### Patch Changes

- Updated dependencies [f0e783e]
  - @altara/core@0.0.2
