---
"@altara/ros": minor
"@altara/core": minor
"@altara/aerospace": patch
---

ROS wiring ergonomics for multi-signal telemetry, plus a battery SoC fix.

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

**@altara/aerospace**

- No code change — patch release only to re-sync its `@altara/core` peer pin to
  the new core version.
