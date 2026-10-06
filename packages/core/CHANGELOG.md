# @altara/core

## 0.3.0

### Minor Changes

- 436b06c: Export `WORKER_SOURCE`, the worker body as source text.

  `createWorkerDataSource` spawns its worker from a Blob URL built out of this
  string. It was module-internal, which meant the pipeline could not be inspected,
  driven deterministically in a test, or reconstructed by a host that cannot use
  Blob URLs — a strict CSP or some Electron configurations, for instance. Paired
  with the existing `workerImpl` option it is now possible to run the genuine
  worker body against a socket you control.

  Documented in the README as a low-level escape hatch rather than the main path.
  The contents of the string are an implementation detail and will change; what is
  stable is that evaluating it in a worker scope installs the message handler
  `createWorkerDataSource` speaks to.

- 436b06c: Support several independent viewports per decimating source.

  `AltaraDataSource.decimator` previously carried one viewport, so two charts on
  the same worker-backed source overwrote each other's `setViewport` call. Last
  writer won, the other chart rendered an empty plot, and nothing errored — the
  most obvious way to use the feature failed silently.

  `Decimator` is now `acquire(): DecimatorSubscription`. Each consumer holds its
  own viewport, epoch, send credit, and latest frame, and calls `release()` when it
  goes away. `TimeSeries` and `MultiAxisPlot` acquire one per render loop. The
  worker keys viewports by id and serves each from the same per-channel ring
  buffers, so N charts on one source cost one extra decimation pass each and no
  extra memory or ingest — one socket, one set of buffers.

  Credit is per viewport: a stalled consumer no longer blocks frames to the
  others. `destroy()` invalidates outstanding handles so a chart still holding one
  cannot keep drawing from a dead source.

  This reshapes `Decimator`, which was added but never released, so no published
  API changes. `DecimatorSubscription` is exported alongside it.

  Covered by tests for two and three charts sharing one source — the case that had
  no coverage, which is why the single-viewport limitation shipped.

- 436b06c: Move min/max decimation off the main thread.

  `createWorkerDataSource` now owns the per-channel ring buffers and the min/max
  reduction, and pushes render-ready geometry to the renderer. `TimeSeries` and
  `MultiAxisPlot` feature-detect the new optional `AltaraDataSource.decimator`:
  when it is present they never touch a raw sample, so per-frame main-thread work
  drops from O(samples buffered) to O(pixel columns). Previously each frame copied
  every ring buffer, scanned it for the y-extent, and bucketed it again — three
  O(n) passes per channel at 60 Hz.

  The protocol is push-based rather than request/response, because the time window
  is wall-clock anchored and so advances every frame on its own. The renderer
  sends a viewport only when the plot width, window, or channel list actually
  changes; the worker derives the window itself and flushes frames at `flushHz`.
  Frames carry an epoch so geometry decimated for a superseded viewport is never
  drawn, and the worker keeps at most one unacknowledged frame in flight, skipping
  flushes rather than queueing them when the main thread stalls. Frames are whole
  snapshots, never deltas, so a dropped one is always safe.

  Additive and opt-in. `decimator` is optional, so every other adapter — mock,
  replay, rosbridge, MQTT — is unchanged and charts fall back to the existing local
  path. Raw `subscribe`/`getHistory` delivery is untouched, so `Gauge`,
  `SignalPanel`, and `Attitude` behave exactly as before. Note that `bufferSize` on
  the chart is ignored for decimating sources; capacity belongs to the worker.

  The worker body is now real linted and unit-tested source (`workerBody.ts`),
  compiled to the embedded `WORKER_SOURCE` string at build time, so `RingBuffer`
  and the decimation kernels have a single implementation instead of a copy
  maintained by hand inside a template literal.

### Patch Changes

- 436b06c: Document the worker pipeline and correct several stale README claims.

  `@altara/core` gains a section on `createWorkerDataSource`: per-channel ring
  buffers and min/max decimation in the worker, data-space frames carrying each
  channel's extent, the epoch plus single-credit push protocol, the `decimator`
  capability and how charts feature-detect it, several viewports per source via
  `acquire()`, and the two gotchas (`bufferSize` is ignored for decimating sources;
  `mergeChannels` exposes no decimator).

  `@altara/industrial` previously suggested offloading `WaterfallSpectrogram`'s FFT
  "via `createWorkerDataSource`". That API cannot do it — it moves socket ingest,
  buffering, and decimation into its worker, not arbitrary component work. The
  advice now says to compute the spectrum upstream instead.

  `@altara/ros` and `@altara/mqtt` state plainly that their sources expose no
  `decimator` and therefore use the main-thread render path.

  Core's stated bundle size was 12.2 KB against a measured 14.4 KB; corrected, with
  the version and date it was measured at.

## 0.2.3

### Patch Changes

- 253323e: **LiveMap:** fix auto-follow never disengaging on user interaction.

  The `dragstart` handler was passed to `<MapContainer>` via `eventHandlers`, which
  react-leaflet forwards to _layers_ only — so it was silently dropped and never
  fired. Auto-follow therefore recentred the map on every position update forever,
  and a user could not pan away from the tracked asset.

  The handler is now bound to the map instance itself via `useMapEvents`, and
  `zoomstart` disengages follow too, since a user zoom is equally an intent to
  take the view over. Programmatic recentring does not fire either event, so
  follow never disengages itself.

## 0.2.2

### Patch Changes

- e9297bc: Remove throughput claims from the package READMEs that no benchmark backs

  `@altara/core`'s README asserted SVG libraries jank "at 100 Hz+ sensor data
  rates"; `@altara/industrial`'s asserted `WaterfallSpectrogram` is "fine at
  `fftSize ≤ 2048` and `scrollRate ≤ 30 Hz`… to keep the main thread at 60 fps".

  The benchmark in `scripts/bench/` varies the number of rendered widgets. It
  does not vary ingest rate, and it does not exercise the FFT at all, so none of
  those numbers were measured. They are replaced with qualitative wording that
  promises nothing numeric.

  The bundle-size figure is now the measured 12.2 KB gzipped rather than the
  "under 30 KB" ceiling, with the CI gate named.

  Docs only — no code change.

- 2a168e2: Fix the exports map, and declare `type`, `engines.node` and `sideEffects`

  `publint` errored identically on all six packages: `exports["."].types` came
  last, and export conditions are order-sensitive, so TypeScript could not reach
  it. Resolution happened to work only because tsup emits declarations adjacent
  to the bundles.

  The exports map is now condition-specific, which is the correct dual-package
  shape and what `@arethetypeswrong/cli` requires:

  ```json
  "exports": {
    ".": {
      "import":  { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts",  "default": "./dist/index.js"  }
    }
  }
  ```

  Pointing both conditions at `index.d.ts` (CJS declarations) while the `import`
  condition serves ESM makes attw report "Masquerading as CJS" from ESM — so each
  condition now gets the declaration file that matches it.

  Also:
  - `"type": "commonjs"` on all six. **Not `"module"`** — `main`/`require` resolve
    to `dist/index.js`, which tsup emits as CommonJS. Declaring `"module"` makes
    Node parse it as ESM and `require()` of any package throws. Verified.
  - `"engines": { "node": ">=20" }`, matching the workspace root.
  - `"sideEffects": false` on `@altara/ros`, which was missing it and so opted
    itself out of bundler tree-shaking.

  All six now pass publint and attw clean. No API change.

- 90243d5: Ship CHANGELOG.md inside the published tarballs

  `files` listed only `dist`, `README.md` and `LICENSE`, so no changelog ever
  reached npm — verified against the real `@altara/core@0.2.1` tarball, which
  contains exactly those three entries plus `package.json`. Anyone evaluating the
  package on npm had no version history at all.

  `CHANGELOG.md` is now in `files` for all six packages.

  Packaging only — no code change.

- 4e586ac: Emit `"use client"` in every published bundle for Next.js App Router support

  Nothing shipped the directive before, so importing any Altara component from a
  Next.js App Router server-component file failed on first import — consumers had
  to hand-wrap each import in their own `'use client'` module.

  Both the ESM and CJS bundles of all six packages now carry the directive.

  Note for maintainers: setting tsup's `banner` option alone is not sufficient.
  Every package also sets `treeshake: true`, which makes tsup run a second
  Rollup pass that re-emits the bundle **without** the esbuild banner — the build
  succeeds and the directive silently disappears. `scripts/add-use-client.mjs`
  runs after `tsup` and stamps the directive onto line 1 (not as a new line, so
  the emitted sourcemaps keep their line numbers).

  No API or runtime behavior change.

- 0f9ac2c: Document the pre-1.0 stability policy in every package README

  The policy existed in one sentence on line 5 of the root `CHANGELOG.md` — a
  file that does not ship to npm. Anyone evaluating a `0.x` package on npm had no
  stated contract about what a minor bump could do to them.

  Each README now has a "Stability" section spelling out what patch and minor
  mean before 1.0, and how to pin if a minor break is unacceptable.

  Docs only.

## 0.2.1

### Patch Changes

- 943e142: perf(core): decimate canvas time-series rendering — thanks
  [@iacker](https://github.com/iacker)!
  ([#15](https://github.com/JayaSaiKishanChapparam/altara/pull/15))

  `TimeSeries` and `MultiAxisPlot` drew one line segment per buffered sample, so
  a full 10k-sample buffer painted 10k segments into a chart a few hundred
  pixels wide — most of them landing on a pixel column another segment already
  covered.

  Both charts now run min/max decimation (`utils/minMaxDecimation.ts`) before
  drawing: per pixel column, only the minimum and maximum are emitted, which
  preserves the visual envelope — spikes included — while cutting the segment
  count to roughly twice the pixel width.

  No API change. Charts with fewer samples than pixel columns are unaffected.

- a4b33ea: fix(core): `useTelemetry` now clears state when the source is removed
  — thanks [@iacker](https://github.com/iacker)!
  ([#16](https://github.com/JayaSaiKishanChapparam/altara/pull/16))

  Going from a `dataSource` to `undefined` left the last received value and the
  stale-detection timer in place, so a component that lost its source kept
  showing the final reading as though it were current. State is now reset.

- a320b40: fix(core): stop `Attitude` folding foreign channels into roll

  `Attitude` routed `'pitch'` and treated **every other** sample as roll, so any
  multi-channel source — a `mergeChannels` fan-in, or a rosbridge adapter
  publishing several channels — drove the artificial horizon from unrelated
  streams. A battery reading of 85.9% banked the horizon to 85.9°.

  Channels are now routed explicitly: `'roll'` and untagged samples drive roll,
  `'pitch'` drives pitch, and anything else is dropped — matching how
  `TimeSeries` and `PrimaryFlightDisplay` already handle channels they don't own.

  Single-channel sources are unaffected: samples with no `channel` tag still
  drive roll.

## 0.2.0

### Minor Changes

- af08119: RingBuffer: add zero-copy `readInto(out)` / `readTimesInto(out)` read path

  `getValues()` / `getTimes()` allocate a fresh `Float64Array` per call. The rAF
  render loops in `TimeSeries` and `MultiAxisPlot` called them once for the extent
  pass and again for the draw pass — ~4 array allocations per channel per frame at
  the default 10k buffer. `readInto(out)` / `readTimesInto(out)` fill a
  caller-owned buffer and return the sample count, allocating nothing. The two
  chart components now read each channel once per frame into a reused scratch
  buffer, dropping per-frame allocation in the draw loop to zero.

  `getValues()` / `getTimes()` are unchanged for non-hot-path callers.

## 0.1.0

### Minor Changes

- 56d91fb: ROS wiring ergonomics for multi-signal telemetry, plus a battery SoC fix.

  **@altara/ros**
  - `createRosbridgeAdapter` now accepts a `channels` map (`{ name: (msg) => number }`)
    and returns `{ [name]: AltaraDataSource }` — several named single-value sources
    pulled from one message over **one** socket. The single-`valueExtractor` form
    is unchanged and still returns a lone `AltaraDataSource`.
  - Add `createImuAdapter({ url, topic })` → `{ roll, pitch, yaw }` (degrees) over a
    single `sensor_msgs/Imu` connection, plus the standalone `quaternionToEuler(q)`
    (clamped at the ±90° poles).
  - `createBatteryStateAdapter` accepts an optional `voltageRange` and derives an
    **approximate** state-of-charge from `voltage` when the firmware reports an
    invalid `percentage` (`-1`/`NaN`) — the common case on PX4/ArduPilot LiPo packs.
    The voltage→charge map is a clamped linear approximation (presence-of-charge,
    not precise range-remaining). Without `voltageRange`, invalid samples are still
    dropped. A valid `percentage` always wins.
  - Re-exports `mergeChannels` from `@altara/core`.

  **@altara/core**
  - Add `mergeChannels(sources)` — union several single-value sources into one
    channel-tagged `AltaraDataSource` for multi-input components like the PFD.
  - `Gauge` gains `mockProfile?: 'sine' | 'ramp'`; `'ramp'` drains `max → min` and
    resets (a believable draining-battery demo).
  - `LiveMap` now turns its marker's nose along the orbit in `mockMode` (great-circle
    bearing of travel); a controlled `heading` prop still wins.

  **@altara/aerospace, @altara/av, @altara/industrial, @altara/mqtt**
  - No code change — patch release only to re-sync their `@altara/core` peer pin to
    the new core version (`^0.1.0`), so the core minor doesn't force major bumps.
    Each couples to core via type-only / public, unchanged API.

## 0.0.2

### Patch Changes

- f0e783e: Add per-package `README.md`, bundled `LICENSE`, and the npm-rendered metadata fields (`repository`, `homepage`, `bugs`, `keywords`, `author`). The npm package pages had no README, no source link, and no description — `npm install @altara/core` worked but the discovery story was broken. Both packages now ship a focused README and link back to the GitHub repo and the sibling package.
