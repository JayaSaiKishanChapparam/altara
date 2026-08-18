# @altara/core

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
