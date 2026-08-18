# @altara/ros

## 0.1.2

### Patch Changes

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

## 0.1.1

### Patch Changes

- 6aede91: Sync `@altara/core` peer range to `^0.2.0` (no API change). Keeps the core minor
  in range so the changesets peer cascade stays a patch sync rather than forcing a
  1.0.0 major (same fix as #8 for the 0.1.0 release).

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
- Updated dependencies [f0e783e]
  - @altara/core@0.0.2
