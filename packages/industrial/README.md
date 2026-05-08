# @altara/industrial

**Industrial / SCADA / HMI React components for Altara.** Embeddable waterfall spectrogram (FFT + Canvas), OEE dashboard, PID tuning panel, alarm annunciator, multi-pen trend recorder, P&ID instrument symbols, process flow diagram, motor dashboard, and predictive-maintenance gauge — for manufacturing HMIs, energy control rooms, water-treatment dashboards, smart-factory monitors, and process-control UIs.

[![npm version](https://img.shields.io/npm/v/@altara/industrial?color=EF9F27&label=npm)](https://www.npmjs.com/package/@altara/industrial)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/industrial?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/industrial)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/industrial)
[![license](https://img.shields.io/npm/l/@altara/industrial?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

![Waterfall spectrogram](https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/industrial-spectrogram.gif)

## Install

```bash
npm install @altara/core @altara/industrial
```

Import the design-token stylesheet from `@altara/core` once at your app root:

```ts
import '@altara/core/styles.css';
```

## Quick start

```tsx
import { AltaraProvider } from '@altara/core';
import { WaterfallSpectrogram, OEEDashboard, AlarmAnnunciatorPanel } from '@altara/industrial';

export function FactoryFloor() {
  return (
    <AltaraProvider theme="dark">
      <WaterfallSpectrogram mockMode width={720} height={360} />
      <OEEDashboard mockMode shift="A1" />
      <AlarmAnnunciatorPanel mockMode columns={6} />
    </AltaraProvider>
  );
}
```

## Components

| Component | Description |
| --- | --- |
| `WaterfallSpectrogram` | Real-time FFT spectrogram waterfall — Hann window + radix-2 FFT, dB color mapping (heat / viridis / plasma / grayscale). Built for vibration / acoustic / RF analysis. |
| `OEEDashboard` | Overall Equipment Effectiveness — three ring gauges (availability × performance × quality) + Pareto loss-category chart. |
| `AlarmAnnunciatorPanel` | Industrial alarm tile grid — blink while unacknowledged, click to acknowledge, priority-based status colors. |
| `TrendRecorder` | Multi-pen chart recorder, up to 8 channels each on its own Y range. Time scales from 1 minute to 24 hours. |
| `PIDTuningPanel` | Setpoint / process-value / controller-output overlay with Kp/Ki/Kd readouts and live error band. |
| `PIDNode` | Single P&ID instrument symbol per the ISA 5.1 standard (FIC, TT, PIC, …). Field / panel / DCS location styles. |
| `ProcessFlowDiagram` | Composable SVG diagram — tanks, pumps, heat exchangers, valves, instruments connected by flow paths. |
| `MotorDashboard` | Motor health — RPM, torque, current, temperature in arc gauges + active fault log. |
| `PredictiveMaintenanceGauge` | Weighted health index from contributor metrics (vibration / temperature / current / acoustic), plus RUL with confidence band. |

## Showcase

<table>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/industrial-oee.gif" width="300" alt="OEE dashboard"/><br/>
<sub><b>OEEDashboard</b></sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/industrial-alarms.gif" width="380" alt="Alarm annunciator panel"/><br/>
<sub><b>AlarmAnnunciatorPanel</b></sub>
</td>
</tr>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/industrial-pid.gif" width="380" alt="PID tuning panel"/><br/>
<sub><b>PIDTuningPanel</b></sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/industrial-trend.gif" width="380" alt="Trend recorder"/><br/>
<sub><b>TrendRecorder</b></sub>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/industrial-pfd.gif" width="640" alt="Process flow diagram"/><br/>
<sub><b>ProcessFlowDiagram</b></sub>
</td>
</tr>
</table>

## FFT performance

`WaterfallSpectrogram` runs an inline radix-2 Cooley-Tukey FFT — fine at `fftSize ≤ 2048` and `scrollRate ≤ 30 Hz` on modern hardware. For very large FFTs at high cadences, push the work into a Web Worker via [`createWorkerDataSource`](https://www.npmjs.com/package/@altara/core) from `@altara/core` to keep the main thread at 60 fps.

## Data sources

Every component accepts an `AltaraDataSource` from `@altara/core`. Pair with [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) for broker-published industrial telemetry (Mosquitto, HiveMQ, EMQX), or [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) for collaborative-robotics / process-line ROS2 deployments.

## Documentation

- **[📚 Storybook](https://jayasaikishanchapparam.github.io/altara/storybook/)** — open the **Industrial/** section for the full component playground.
- **[🛰️ Live demo](https://jayasaikishanchapparam.github.io/altara/demo/)** — Industrial / SCADA tab (spectrogram, OEE, alarms, motor, trend recorder, P&ID).

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
| [`@altara/core`](https://www.npmjs.com/package/@altara/core) | Components, hooks, MQTT/mock adapters, design tokens. The starting point. |
| [`@altara/aerospace`](https://www.npmjs.com/package/@altara/aerospace) | Flight instruments — PFD, HSI, altimeter, airspeed, VSI, engine cluster, TCAS, TAWS, FMA, fuel gauge, radio altimeter. |
| [`@altara/av`](https://www.npmjs.com/package/@altara/av) | Autonomous-vehicle UI — LiDAR (Three.js), occupancy grid, object detection, path planner, perception state machine, SLAM, radar, control trace. |
| [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) | ROS2 / rosbridge adapter + typed factories for common `sensor_msgs/*` message types. |
| [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) | MQTT-over-WebSocket adapter for IoT brokers. |

## Links

- [Storybook (live)](https://jayasaikishanchapparam.github.io/altara/storybook/) · [Demo dashboard (live)](https://jayasaikishanchapparam.github.io/altara/demo/)
- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [Issue tracker](https://github.com/JayaSaiKishanChapparam/altara/issues)
- [Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
