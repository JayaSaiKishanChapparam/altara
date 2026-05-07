# @altara/mqtt

**MQTT-over-WebSocket adapter for Altara.** Subscribe to an MQTT broker topic from React in one line and pipe live samples into any [`@altara/core`](https://www.npmjs.com/package/@altara/core) component.

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

## License

MIT
