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

/** Connection + buffering options shared by single- and multi-channel adapters. */
export interface RosbridgeConnectionOptions {
  /** rosbridge_server WebSocket URL — typically `ws://hostname:9090`. */
  url: string;
  /** ROS topic to subscribe to (e.g. `'/drone/battery'`). */
  topic: string;
  /** ROS message type as advertised by the publisher (e.g. `'sensor_msgs/BatteryState'`). */
  messageType: string;
  /** History ring-buffer capacity (samples), per channel. Default: 10_000. */
  bufferSize?: number;
  /** If set, drop *messages* that arrive less than this many ms after the previous one. */
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

/** Single-channel adapter: pull one number per message. Returns one `AltaraDataSource`. */
export interface RosbridgeAdapterOptions extends RosbridgeConnectionOptions {
  /** Pull a single numeric sample out of the ROS message body. Throwing or returning NaN drops it. */
  valueExtractor: (msg: unknown) => number;
}

/**
 * A map of channel name → extractor pulling that channel's number from the
 * message. The message is untyped wire JSON, so extractors receive `any` — this
 * keeps inline extractors terse (`m => m.heading`); cast if you want safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChannelExtractors = Record<string, (msg: any) => number>;

/**
 * Multi-channel adapter: pull several named numbers out of each message over a
 * single socket. Returns `{ [name]: AltaraDataSource }` — one independent
 * single-value source per channel, all sharing the same connection. Feed those
 * into `mergeChannels` to drive a multi-input component like the PFD.
 */
export interface RosbridgeChannelAdapterOptions<C extends ChannelExtractors>
  extends RosbridgeConnectionOptions {
  /**
   * Channel extractors, e.g. `{ roll: m => …, pitch: m => … }`. Each pulls one
   * number; throwing or returning NaN drops just that channel for the message,
   * the others still emit. All channels from one message share its timestamp.
   */
  channels: C;
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

interface ChannelState {
  subscribers: Set<(v: TelemetryValue) => void>;
  history: TelemetryValue[];
  extract: (msg: unknown) => number;
}

/**
 * Shared rosbridge connection that fans each inbound message out to one or more
 * named channels, returning an `AltaraDataSource` per channel. A single socket
 * (one `subscribe`/`unsubscribe`) backs every channel; the socket is torn down
 * once the *last* channel source is destroyed.
 */
function createConnection(
  opts: RosbridgeConnectionOptions,
  extractors: ChannelExtractors,
): Record<string, AltaraDataSource> {
  const {
    url,
    topic,
    messageType,
    bufferSize = 10_000,
    throttleMs,
    timeSource = 'wallclock',
    socketImpl,
    reconnectDelay = 1000,
  } = opts;

  const SocketCtor = socketImpl ?? (globalThis.WebSocket as typeof WebSocket);
  if (!SocketCtor) {
    throw new Error('createRosbridgeAdapter: no WebSocket implementation available');
  }

  const channelNames = Object.keys(extractors);
  const channels: Record<string, ChannelState> = {};
  const live = new Set<string>();
  for (const name of channelNames) {
    channels[name] = { subscribers: new Set(), history: [], extract: extractors[name]! };
    live.add(name);
  }

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

    // Compute the message timestamp once so every channel from this message
    // shares it (and the 'relative' clock advances per message, not per channel).
    let timestamp: number;
    if (timeSource === 'message') {
      timestamp = extractStampMs(parsed.msg) ?? wallNow;
    } else if (timeSource === 'relative') {
      if (firstSampleAt === null) firstSampleAt = wallNow;
      timestamp = wallNow - firstSampleAt;
    } else {
      timestamp = wallNow;
    }

    for (const name of channelNames) {
      const st = channels[name]!;
      let value: number;
      try {
        value = st.extract(parsed.msg);
      } catch {
        continue; // one bad channel doesn't drop the others
      }
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      const sample: TelemetryValue = { value, timestamp };
      st.history.push(sample);
      if (st.history.length > bufferSize) {
        st.history.splice(0, st.history.length - bufferSize);
      }
      for (const cb of st.subscribers) cb(sample);
    }
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

  const teardown = () => {
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
    for (const name of channelNames) channels[name]!.subscribers.clear();
    setStatus('disconnected');
  };

  connect();

  const result: Record<string, AltaraDataSource> = {};
  for (const name of channelNames) {
    const st = channels[name]!;
    result[name] = {
      subscribe(cb) {
        st.subscribers.add(cb);
        return () => {
          st.subscribers.delete(cb);
        };
      },
      getHistory: () => st.history.slice(),
      get status() {
        return status;
      },
      destroy() {
        if (!live.has(name)) return;
        live.delete(name);
        st.subscribers.clear();
        // Tear the shared socket down only when the last channel is released.
        if (live.size === 0) teardown();
      },
    };
  }
  return result;
}

const SINGLE = '__value__';

/**
 * Implements `AltaraDataSource` over a rosbridge_suite WebSocket. Sends a
 * `subscribe` op on connect and pushes each inbound message through the
 * caller's extractor(s).
 *
 * - Pass `valueExtractor` for a single numeric channel → returns one `AltaraDataSource`.
 * - Pass `channels` (a `{ name: extractor }` map) for several numbers off one
 *   socket → returns `{ [name]: AltaraDataSource }`. Feed those into
 *   `mergeChannels` to drive a multi-input component such as `PrimaryFlightDisplay`.
 */
export function createRosbridgeAdapter(options: RosbridgeAdapterOptions): AltaraDataSource;
export function createRosbridgeAdapter<C extends ChannelExtractors>(
  options: RosbridgeChannelAdapterOptions<C>,
): { [K in keyof C]: AltaraDataSource };
export function createRosbridgeAdapter(
  options: RosbridgeAdapterOptions | RosbridgeChannelAdapterOptions<ChannelExtractors>,
): AltaraDataSource | Record<string, AltaraDataSource> {
  if ('channels' in options && options.channels) {
    const names = Object.keys(options.channels);
    if (names.length === 0) {
      throw new Error('createRosbridgeAdapter: `channels` must define at least one channel');
    }
    return createConnection(options, options.channels);
  }
  if (typeof (options as RosbridgeAdapterOptions).valueExtractor !== 'function') {
    throw new Error('createRosbridgeAdapter: provide either `valueExtractor` or `channels`');
  }
  return createConnection(options, {
    [SINGLE]: (options as RosbridgeAdapterOptions).valueExtractor,
  })[SINGLE]!;
}
