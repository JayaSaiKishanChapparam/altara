# @altara/aerospace

**Flight-instrument React components for Altara.** Embeddable Primary Flight Display (PFD), Horizontal Situation Indicator (HSI), altimeter, airspeed indicator, vertical speed indicator (VSI), engine instrument cluster, TCAS traffic display, terrain-awareness display (TAWS), autopilot mode annunciator, fuel gauge, and radio altimeter — for drone ground stations, eVTOL monitoring, UAV simulators, aviation dashboards, and aerospace research.

[![npm version](https://img.shields.io/npm/v/@altara/aerospace?color=378ADD&label=npm)](https://www.npmjs.com/package/@altara/aerospace)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/aerospace?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/aerospace)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/aerospace)
[![license](https://img.shields.io/npm/l/@altara/aerospace?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

![Primary Flight Display with flight director](https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/aerospace-pfd-fd.gif)

## Install

```bash
npm install @altara/core @altara/aerospace
```

Import the design-token stylesheet from `@altara/core` once at your app root:

```ts
import '@altara/core/styles.css';
```

## Quick start

```tsx
import { AltaraProvider } from '@altara/core';
import { PrimaryFlightDisplay } from '@altara/aerospace';

export function App() {
  return (
    <AltaraProvider theme="dark">
      <PrimaryFlightDisplay mockMode size="lg" />
    </AltaraProvider>
  );
}
```

## Components

| Component | Description |
| --- | --- |
| `PrimaryFlightDisplay` | Composite PFD — attitude sphere + airspeed/altitude/heading tapes + VSI + flight director. |
| `HorizontalSituationIndicator` | Garmin G1000-style HSI with course needle, CDI, heading bug, two bearing pointers. |
| `Altimeter` | Drum-and-pointer altitude display with Kollsman window and optional AGL readout. |
| `VerticalSpeedIndicator` | Arc gauge ±2000 ft/min with central digital readout. |
| `AirspeedIndicator` | Round dial with FAA arc zones (white / green / yellow) and Vne red line. |
| `EngineInstrumentCluster` | Multi-engine RPM/EGT/fuel-flow/oil bar gauges with per-parameter thresholds. |
| `RadioAltimeter` | Digital AGL readout with decision-height bug and crossing callback. |
| `TerrainAwareness` | TAWS-style forward terrain footprint coloured by relative altitude. |
| `TCASDisplay` | Plan-position traffic display with threat-level glyphs. |
| `AutopilotModeAnnunciator` | Flight mode annunciator strip — A/T, lateral, vertical, AP, FD. |
| `FuelGauge` | Per-tank bar gauges with totaliser and reserve marker. |

## Showcase

<table>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/aerospace-pfd.gif" width="380" alt="Primary Flight Display"/><br/>
<sub><b>PrimaryFlightDisplay</b></sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/aerospace-hsi.gif" width="240" alt="Horizontal Situation Indicator"/><br/>
<sub><b>HorizontalSituationIndicator</b></sub>
</td>
</tr>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/aerospace-asi.gif" width="180" alt="Airspeed Indicator"/><br/>
<sub><b>AirspeedIndicator</b></sub>
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/aerospace-tcas.gif" width="280" alt="TCAS Display"/><br/>
<sub><b>TCASDisplay</b></sub>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<img src="https://raw.githubusercontent.com/JayaSaiKishanChapparam/altara/main/apps/storybook/public/gifs/aerospace-taws.gif" width="360" alt="Terrain Awareness"/><br/>
<sub><b>TerrainAwareness</b></sub>
</td>
</tr>
</table>

> Live, interactive demos of every component are at the [Altara Storybook](https://github.com/JayaSaiKishanChapparam/altara) — `pnpm --filter @altara/storybook storybook`.

## Data sources

Every component accepts an `AltaraDataSource` from `@altara/core`. The PFD/HSI route by `TelemetryValue.channel` (`roll`, `pitch`, `heading`, `airspeed`, `altitude`, `vs`, etc.). Single-value components (`Altimeter`, `AirspeedIndicator`, `VerticalSpeedIndicator`, `RadioAltimeter`) take any data source directly.

Pair with [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) to wire a PFD to a `sensor_msgs/Imu` topic, or with [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) for broker-published telemetry.

## Documentation

The full component playground — Default + Playground stories per component, props in the Controls panel, dark/light theme toggle — lives in the project Storybook. Run it locally:

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm --filter @altara/storybook storybook
```

Then open the **Aerospace/** section.

## Sibling packages

| Package | What it does |
| --- | --- |
| [`@altara/core`](https://www.npmjs.com/package/@altara/core) | Components, hooks, MQTT/mock adapters, design tokens. The starting point. |
| [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) | ROS2 / rosbridge adapter + typed factories for common `sensor_msgs/*` message types. |
| [`@altara/mqtt`](https://www.npmjs.com/package/@altara/mqtt) | MQTT-over-WebSocket adapter for IoT brokers. |

## Links

- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [Issue tracker](https://github.com/JayaSaiKishanChapparam/altara/issues)
- [Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
