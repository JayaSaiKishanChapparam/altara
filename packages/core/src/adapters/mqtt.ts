import type { AltaraDataSource, ConnectionStatus, TelemetryValue } from './types';

/**
 * Minimal subset of the `mqtt.Client` API we use. The `mqtt` package is an
 * optional peer dep — if the consumer uses MQTT they install it themselves
 * (blueprint §13, "Bundle size creep").
 */
export interface MqttClientLike {
  on(event: 'connect', cb: () => void): void;
  on(event: 'message', cb: (topic: string, payload: Uint8Array) => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  on(event: 'close', cb: () => void): void;
  on(event: 'reconnect', cb: () => void): void;
  subscribe(topic: string, cb?: (err: Error | null) => void): void;
  unsubscribe(topic: string): void;
  end(force?: boolean): void;
}

export interface MqttAdapterOptions {
  /** Broker URL — typically `ws://` or `wss://` for browser use. */
  url: string;
  /** MQTT topic to subscribe to. Wildcards (`+`, `#`) follow MQTT rules. */
  topic: string;
  /** Pull a numeric sample out of the decoded payload. Receives the full message + the source topic. */
  valueExtractor: (payload: unknown, topic: string) => number;
  /** How to decode raw bytes before passing to `valueExtractor`. Default: `'json'`. */
  payloadFormat?: 'json' | 'string' | 'binary';
  /** History ring-buffer capacity (samples). Default: 10_000. */
  bufferSize?: number;
  /**
   * Inject a connect function for tests or custom transports. Defaults
   * to dynamically importing the `mqtt` peer dep and calling `connect(url)`.
   */
  connectImpl?: (url: string) => MqttClientLike | Promise<MqttClientLike>;
}

const decoder = new TextDecoder();

function decodePayload(payload: Uint8Array, format: 'json' | 'string' | 'binary'): unknown {
  if (format === 'binary') return payload;
  const text = decoder.decode(payload);
  if (format === 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * AltaraDataSource over MQTT. Designed for browsers — pair with a broker
 * that exposes the WebSocket transport (Mosquitto, EMQX, HiveMQ).
 */
export function createMqttAdapter(options: MqttAdapterOptions): AltaraDataSource {
  const {
    url,
    topic,
    valueExtractor,
    payloadFormat = 'json',
    bufferSize = 10_000,
    connectImpl,
  } = options;

  const subscribers = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  let status: ConnectionStatus = 'connecting';
  let client: MqttClientLike | null = null;
  let destroyed = false;

  const onMessage = (incomingTopic: string, payload: Uint8Array) => {
    if (incomingTopic !== topic) return;
    const decoded = decodePayload(payload, payloadFormat);
    if (decoded === undefined) return;
    let value: number;
    try {
      value = valueExtractor(decoded, incomingTopic);
    } catch {
      return;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    const sample: TelemetryValue = { value, timestamp: Date.now() };
    history.push(sample);
    if (history.length > bufferSize) history.splice(0, history.length - bufferSize);
    for (const cb of subscribers) cb(sample);
  };

  const wireClient = (c: MqttClientLike) => {
    client = c;
    c.on('connect', () => {
      status = 'connected';
      c.subscribe(topic);
    });
    c.on('message', onMessage);
    c.on('error', () => {
      status = 'error';
    });
    c.on('reconnect', () => {
      status = 'connecting';
    });
    c.on('close', () => {
      if (destroyed) return;
      status = 'disconnected';
    });
  };

  const resolveClient = async (): Promise<MqttClientLike> => {
    if (connectImpl) return connectImpl(url);
    // Dynamic import keeps `mqtt` out of the core bundle. The spec is
    // routed through a variable so static bundler analysis (vite, vitest)
    // doesn't try to pre-resolve a peer dep we may not have installed.
    const moduleName = 'mqtt';
    const mod = (await import(/* @vite-ignore */ moduleName)) as {
      connect: (url: string) => MqttClientLike;
    };
    return mod.connect(url);
  };

  void resolveClient()
    .then((c) => {
      if (destroyed) {
        c.end(true);
        return;
      }
      wireClient(c);
    })
    .catch(() => {
      status = 'error';
    });

  return {
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    getHistory: () => history.slice(),
    get status() {
      return status;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const c = client;
      client = null;
      if (c) {
        try {
          c.unsubscribe(topic);
        } catch {
          // ignore — broker may already be gone
        }
        c.end(true);
      }
      subscribers.clear();
      status = 'disconnected';
    },
  };
}
