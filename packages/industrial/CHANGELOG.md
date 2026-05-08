# @altara/industrial

## 0.1.0

### Minor Changes

- 8419cc9: Add `@altara/industrial` — SCADA / HMI React components for manufacturing, energy, and process-control applications. Nine components: `WaterfallSpectrogram` (FFT + Canvas heat-map waterfall, flagship — built for vibration/acoustic/RF analysis), `OEEDashboard` (availability × performance × quality with Pareto), `AlarmAnnunciatorPanel` (industrial control-room alarm grid with blink + acknowledge), `TrendRecorder` (multi-pen up-to-8-channel chart recorder), `PIDTuningPanel` (setpoint/PV/output overlay with Kp/Ki/Kd readouts), `PIDNode` (single ISA 5.1 instrument symbol), `ProcessFlowDiagram` (composable tanks/pumps/heat-exchangers/valves), `MotorDashboard` (RPM/torque/current/temp gauges + fault log), and `PredictiveMaintenanceGauge` (weighted health-index + RUL estimate). Every component supports `mockMode`, reads Altara design tokens, and consumes any `AltaraDataSource`. Inline radix-2 FFT keeps the spectrogram dependency-free; for very large FFT sizes, push the work to a Web Worker via `createWorkerDataSource` from `@altara/core`.
