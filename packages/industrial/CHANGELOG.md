# @altara/industrial

## 0.1.2

### Patch Changes

- 6aede91: Sync `@altara/core` peer range to `^0.2.0` (no API change). Keeps the core minor
  in range so the changesets peer cascade stays a patch sync rather than forcing a
  1.0.0 major (same fix as #8 for the 0.1.0 release).

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

- 8419cc9: Add `@altara/industrial` — SCADA / HMI React components for manufacturing, energy, and process-control applications. Nine components: `WaterfallSpectrogram` (FFT + Canvas heat-map waterfall, flagship — built for vibration/acoustic/RF analysis), `OEEDashboard` (availability × performance × quality with Pareto), `AlarmAnnunciatorPanel` (industrial control-room alarm grid with blink + acknowledge), `TrendRecorder` (multi-pen up-to-8-channel chart recorder), `PIDTuningPanel` (setpoint/PV/output overlay with Kp/Ki/Kd readouts), `PIDNode` (single ISA 5.1 instrument symbol), `ProcessFlowDiagram` (composable tanks/pumps/heat-exchangers/valves), `MotorDashboard` (RPM/torque/current/temp gauges + fault log), and `PredictiveMaintenanceGauge` (weighted health-index + RUL estimate). Every component supports `mockMode`, reads Altara design tokens, and consumes any `AltaraDataSource`. Inline radix-2 FFT keeps the spectrogram dependency-free; for very large FFT sizes, push the work to a Web Worker via `createWorkerDataSource` from `@altara/core`.
