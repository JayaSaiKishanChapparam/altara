# @altara/aerospace

**Flight-instrument React components for Altara.** Embeddable Primary Flight Display, HSI, altimeter, airspeed, VSI, engine cluster, TCAS, TAWS, FMA, fuel gauge, and radio altimeter — built for drone ground stations, eVTOL monitoring, UAV simulators, and aerospace research.

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

## License

MIT
