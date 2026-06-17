# @altara/mqtt

## 0.1.1

### Patch Changes

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

## 0.1.0

### Minor Changes

- 41038a5: Make `@altara/mqtt` publicly publishable. The package is no longer marked `private`, the `package.json` shape now matches `@altara/core` / `@altara/ros` (homepage, repository, bugs, author, keywords, sideEffects, typecheck script, README + LICENSE in the tarball), and the entry point re-exports `createMqttAdapter`, `MqttAdapterOptions`, and `MqttClientLike` from `@altara/core`. Mirrors how `@altara/ros` is structured — a thin specialised package that signals "this app talks to an MQTT broker".

## 0.0.1

### Patch Changes

- Updated dependencies [f0e783e]
  - @altara/core@0.0.2
