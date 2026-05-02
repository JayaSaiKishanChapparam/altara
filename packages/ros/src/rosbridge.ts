import type { AltaraDataSource, ConnectionStatus, TelemetryValue } from '@altara/core';

/**
 * ROS timestamps in messages typically arrive as `{ sec, nanosec }`. We
 * normalize everything to unix milliseconds (blueprint §13, "ROS timestamp
 * mismatch"). The `timeSource` option chooses which clock to expose:
 *   - 'wallclock' — use the receiver-side Date.now() at message arrival
 *   - 'message'   — use the ROS-supplied header.stamp if present, else wallclock
 *   - 'relative'  — milliseconds since the first received sample
 */
export type TimeSource = 'wallclock' | 'message' | 'relative';

export interface RosbridgeAdapterOptions {
  /** rosbridge_server WebSocket URL — typically `ws://hostname:9090`. */
  url: string;
  /** ROS topic to subscribe to (e.g. `'/drone/battery'`). */
  topic: string;
  /** ROS message type as advertised by the publisher (e.g. `'sensor_msgs/BatteryState'`). */
  messageType: string;
  /** Pull a numeric sample out of the ROS message body. Throwing or returning NaN drops the sample. */
  valueExtractor: (msg: unknown) => number;
  /** History ring-buffer capacity (samples). Default: 10_000. */
  bufferSize?: number;
  /** If set, drop samples that arrive less than this many ms after the previous one. */
  throttleMs?: number;
  /**
   * Which clock drives the sample's `timestamp`. Default: `'wallclock'`.
   * - `'wallclock'` — receiver-side `Date.now()` at message arrival.
   * - `'message'`   — ROS-supplied `header.stamp` if present, else wallclock.
   * - `'relative'`  — milliseconds since the first received sample.
   */
  timeSource?: TimeSource;
  /** Inject a WebSocket constructor for tests. Defaults to `globalThis.WebSocket`. */
  socketImpl?: typeof WebSocket;
  /** Auto-reconnect base delay in ms. Doubles per attempt, capped at 30 s. Default: 1000. */
  reconnectDelay?: number;
}

interface RosbridgeMessage {
  op: string;
  topic?: string;
  msg?: unknown;
  type?: string;
}

interface RosHeaderStamp {
  sec: number;
  nanosec: number;
}

function extractStampMs(msg: unknown): number | undefined {
  if (typeof msg !== 'object' || msg === null) return undefined;
  const m = msg as { header?: { stamp?: RosHeaderStamp }; stamp?: RosHeaderStamp };
  const stamp = m.header?.stamp ?? m.stamp;
  if (!stamp || typeof stamp.sec !== 'number' || typeof stamp.nanosec !== 'number') {
    return undefined;
  }
  return stamp.sec * 1000 + stamp.nanosec / 1_000_000;
}

const MAX_BACKOFF_MS = 30_000;

/**
 * Implements AltaraDataSource over a rosbridge_suite WebSocket. Sends a
 * `subscribe` op on connect and pushes each inbound message through the
 * caller's `valueExtractor`.
 */
export function createRosbridgeAdapter(options: RosbridgeAdapterOptions): AltaraDataSource {
  const {
    url,
    topic,
    messageType,
    valueExtractor,
    bufferSize = 10_000,
    throttleMs,
    timeSource = 'wallclock',
    socketImpl,
    reconnectDelay = 1000,
  } = options;

  const SocketCtor = socketImpl ?? (globalThis.WebSocket as typeof WebSocket);
  if (!SocketCtor) {
    throw new Error('createRosbridgeAdapter: no WebSocket implementation available');
  }

  const subscribers = new Set<(v: TelemetryValue) => void>();
  const history: TelemetryValue[] = [];
  let status: ConnectionStatus = 'connecting';
  let socket: WebSocket | null = null;
  let lastEmitMs = Number.NEGATIVE_INFINITY;
  let firstSampleAt: number | null = null;
  let attempts = 0;
  let destroyed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: ConnectionStatus) => {
    status = next;
  };

  const handleMessage = (data: string) => {
    let parsed: RosbridgeMessage;
    try {
      parsed = JSON.parse(data) as RosbridgeMessage;
    } catch {
      return;
    }
    if (parsed.op !== 'publish' || parsed.topic !== topic) return;

    const wallNow = Date.now();
    if (throttleMs !== undefined && wallNow - lastEmitMs < throttleMs) return;
    lastEmitMs = wallNow;

    let value: number;
    try {
      value = valueExtractor(parsed.msg);
    } catch {
      return;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) return;

    let timestamp: number;
    if (timeSource === 'message') {
      timestamp = extractStampMs(parsed.msg) ?? wallNow;
    } else if (timeSource === 'relative') {
      if (firstSampleAt === null) firstSampleAt = wallNow;
      timestamp = wallNow - firstSampleAt;
    } else {
      timestamp = wallNow;
    }

    const sample: TelemetryValue = { value, timestamp };
    history.push(sample);
    if (history.length > bufferSize) history.splice(0, history.length - bufferSize);
    for (const cb of subscribers) cb(sample);
  };

  const connect = () => {
    if (destroyed) return;
    setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new SocketCtor(url);
    } catch {
      setStatus('error');
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      setStatus('connected');
      attempts = 0;
      ws.send(JSON.stringify({ op: 'subscribe', topic, type: messageType }));
    };
    ws.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : '';
      if (data) handleMessage(data);
    };
    ws.onerror = () => {
      setStatus('error');
    };
    ws.onclose = () => {
      socket = null;
      if (destroyed) {
        setStatus('disconnected');
        return;
      }
      setStatus('disconnected');
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (destroyed) return;
    const delay = Math.min(reconnectDelay * 2 ** attempts, MAX_BACKOFF_MS);
    attempts += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  connect();

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
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const sock = socket;
      socket = null;
      if (sock && (sock.readyState === SocketCtor.OPEN || sock.readyState === SocketCtor.CONNECTING)) {
        try {
          sock.send(JSON.stringify({ op: 'unsubscribe', topic }));
        } catch {
          // socket may have died mid-call; ignore
        }
        sock.close();
      }
      subscribers.clear();
      setStatus('disconnected');
    },
  };
}
