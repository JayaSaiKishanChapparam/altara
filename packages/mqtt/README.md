# @altara/mqtt

**MQTT-over-WebSocket adapter for Altara.** Subscribe to an MQTT broker topic from React in one line and pipe live samples (sensor values, IoT state, telemetry) into any [`@altara/core`](https://www.npmjs.com/package/@altara/core) component. Built for industrial-IoT dashboards, smart-building monitors, and home-automation HMIs.

[![npm version](https://img.shields.io/npm/v/@altara/mqtt?color=A06CD5&label=npm)](https://www.npmjs.com/package/@altara/mqtt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@altara/mqtt?color=378ADD&label=gzip)](https://bundlephobia.com/package/@altara/mqtt)
[![types included](https://img.shields.io/badge/types-included-1D9E75)](https://www.npmjs.com/package/@altara/mqtt)
[![license](https://img.shields.io/npm/l/@altara/mqtt?color=888780)](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE)

## Install

```bash
npm install @altara/core @altara/mqtt mqtt
```

`mqtt` is an optional peer dependency — install it only if you actually use MQTT. The browser build connects via `ws://` or `wss://`.

## Quick start

```tsx
import { AltaraProvider, TimeSeries } from '@altara/core';
import { createMqttAdapter } from '@altara/mqtt';

const source = createMqttAdapter({
  url: 'ws://broker.local:8083/mqtt',
  topic: 'sensors/temp/room1',
  // Pull a number out of each decoded message.
  valueExtractor: (payload) => (payload as { celsius: number }).celsius,
});

export function App() {
  return (
    <AltaraProvider theme="dark">
      <TimeSeries dataSource={source} height={240} />
    </AltaraProvider>
  );
}
```

## What you get

- **`createMqttAdapter`** — typed factory that returns an `AltaraDataSource`. Auto-decodes JSON / string / binary payloads; supports MQTT topic wildcards (`+`, `#`).
- **`MqttAdapterOptions` / `MqttClientLike`** — the option bag and the minimal client interface, exported for advanced custom-transport scenarios.

## Relationship to `@altara/core`

The implementation lives in `@altara/core` and is also exported from there. `@altara/mqtt` is a thin specialised re-export that mirrors `@altara/ros` — pulling it into a project is a clear signal that the app talks to an MQTT broker, and keeps the installation surface symmetrical across telemetry transports.

If you already depend on `@altara/core`, you can `import { createMqttAdapter } from '@altara/core'` directly with no behavioral difference.

## Documentation

- **[📚 Connecting MQTT guide (live Storybook)](https://jayasaikishanchapparam.github.io/altara/storybook/?path=/docs/guides-connecting-mqtt--api-reference)** — broker setup, topic-wildcard routing, JSON vs binary payload handling, throttling, reconnection.
- **[🛰️ Live demo dashboard](https://jayasaikishanchapparam.github.io/altara/demo/)** — IoT-style components an MQTT feed would drive.

Or run Storybook locally:

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm --filter @altara/storybook storybook
```

Then open **Guides → Connecting MQTT**.

## Sibling packages

| Package | What it does |
| --- | --- |
| [`@altara/core`](https://www.npmjs.com/package/@altara/core) | Components, hooks, MQTT/mock adapters, design tokens. The starting point. |
| [`@altara/aerospace`](https://www.npmjs.com/package/@altara/aerospace) | Flight instruments — PFD, HSI, altimeter, airspeed, VSI, engine cluster, TCAS, TAWS, FMA, fuel gauge, radio altimeter. |
| [`@altara/ros`](https://www.npmjs.com/package/@altara/ros) | ROS2 / rosbridge adapter + typed factories for common `sensor_msgs/*` message types. |

## Links

- [Storybook (live)](https://jayasaikishanchapparam.github.io/altara/storybook/) · [Demo dashboard (live)](https://jayasaikishanchapparam.github.io/altara/demo/)
- [GitHub repository](https://github.com/JayaSaiKishanChapparam/altara)
- [Issue tracker](https://github.com/JayaSaiKishanChapparam/altara/issues)
- [Discussions](https://github.com/JayaSaiKishanChapparam/altara/discussions)
- [`mqtt` package](https://www.npmjs.com/package/mqtt) — the browser/Node MQTT client used under the hood

## License

MIT — see [LICENSE](https://github.com/JayaSaiKishanChapparam/altara/blob/main/LICENSE).
