/**
 * Universal data-source contract — every adapter and every component
 * communicates through this interface (blueprint §5.2). Frozen API:
 * additive changes only.
 */

/** Connection lifecycle states emitted by every adapter. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** A single sample emitted by an `AltaraDataSource`. */
export interface TelemetryValue {
  /** Wall-clock time of the sample, in unix milliseconds. */
  timestamp: number;
  /** The numeric measurement. NaN values are dropped by adapters. */
  value: number;
  /** Optional channel tag — used when one source emits several streams (e.g. a multi-axis IMU). */
  channel?: string;
}

/**
 * Live data source contract. Every adapter (rosbridge, MQTT, mock,
 * worker) implements this; every component consumes it.
 */
export interface AltaraDataSource {
  /** Subscribe to live values. Returns an unsubscribe function. */
  subscribe(callback: (value: TelemetryValue) => void): () => void;
  /** Buffered history for initial render — typically the last N samples. */
  getHistory(): TelemetryValue[];
  /** Current connection state. */
  readonly status: ConnectionStatus;
  /** Cleanup — call when the owning component unmounts. */
  destroy(): void;
}

// ── Component prop types ────────────────────────────────────────────────

/** A single channel rendered by `TimeSeries` / `MultiAxisPlot`. */
export interface TimeSeriesChannel {
  /** Stable channel id; matches `TelemetryValue.channel` for routing. */
  key: string;
  /** Human-readable label rendered in the legend. */
  label: string;
  /** Optional explicit color. Defaults to a slot from the palette. */
  color?: string;
  /** Optional unit suffix shown next to the label (e.g. `'°'`, `'rad/s'`). */
  unit?: string;
}

/** Horizontal threshold line drawn across a chart. */
export interface Threshold {
  /** Y-value at which the line is drawn. */
  value: number;
  /** CSS color — accepts var() references like `'var(--vt-color-warn)'`. */
  color: string;
  /** Optional label for documentation purposes (not rendered today). */
  label?: string;
}

export interface TimeSeriesProps {
  /** Live data source. Accepts any `AltaraDataSource` — rosbridge, MQTT, worker, or mock. */
  dataSource?: AltaraDataSource;
  /** Channel configuration. Each channel is rendered as a separate line with its own colour and label. */
  channels?: TimeSeriesChannel[];
  /** Visible time window in milliseconds. Only data within this window is rendered. Default: 30_000 (30s). */
  windowMs?: number;
  /** Per-channel ring-buffer capacity (samples). Older samples are discarded when full. Default: 10_000. */
  bufferSize?: number;
  /** Horizontal threshold lines. Each renders as a dashed line in its configured color. */
  thresholds?: Threshold[];
  /** Target render frame rate. Drop to 30 for battery-constrained devices. Default: 60. */
  fps?: number;
  /** Enable built-in synthetic data — no `dataSource` required. Useful for demos and Storybook. */
  mockMode?: boolean;
  /** Canvas height in pixels. Default: 240. */
  height?: number;
  /** Theme override (currently unused — themes are inherited from `AltaraProvider`). */
  theme?: 'dark' | 'light' | 'auto';
  /** CSS class applied to the root element. Use to scope CSS-token overrides. */
  className?: string;
}

/** A `TimeSeriesChannel` plus the axis it renders against in `MultiAxisPlot`. */
export interface MultiAxisChannel extends TimeSeriesChannel {
  /** Which y-axis this channel renders against. Default: `'left'`. */
  axis?: 'left' | 'right';
}

export interface MultiAxisPlotProps {
  /** Live data source. Channels are routed by `TelemetryValue.channel` matching `MultiAxisChannel.key`. */
  dataSource?: AltaraDataSource;
  /** Channel configuration. Required — at least one channel per axis you want to display. */
  channels: MultiAxisChannel[];
  /** Visible time window in milliseconds. Default: 30_000. */
  windowMs?: number;
  /** Per-channel ring-buffer capacity (samples). Default: 10_000. */
  bufferSize?: number;
  /** Target render frame rate. Default: 60. */
  fps?: number;
  /** Canvas height in pixels. Default: 240. */
  height?: number;
  /** Enable built-in synthetic data — no `dataSource` required. */
  mockMode?: boolean;
  /** Label rendered next to the left y-axis (rotated 90° CCW). */
  leftAxisLabel?: string;
  /** Label rendered next to the right y-axis (rotated 90° CW). */
  rightAxisLabel?: string;
  /** Threshold lines. `axis` defaults to `'left'` if omitted. */
  thresholds?: Array<Threshold & { axis?: 'left' | 'right' }>;
  /** CSS class applied to the root element. */
  className?: string;
}

/** A single grid placement used by `DashboardLayout`. */
export interface DashboardItem {
  /** Stable id — must match the React `key` of the corresponding child. */
  i: string;
  /** Grid column origin (0-indexed). */
  x: number;
  /** Grid row origin (0-indexed). */
  y: number;
  /** Width in grid columns. */
  w: number;
  /** Height in grid rows. */
  h: number;
  /** Minimum allowed width during user-resize. */
  minW?: number;
  /** Minimum allowed height during user-resize. */
  minH?: number;
  /** When true, this item cannot be dragged or resized. */
  static?: boolean;
}

export interface DashboardLayoutProps {
  /** Initial / current grid layout. Treated as initial when uncontrolled. */
  layout: DashboardItem[];
  /** Total grid columns. Default: 12. */
  cols?: number;
  /** Pixel height of each row. Default: 60. */
  rowHeight?: number;
  /** Container width in px. Auto-sized via `WidthProvider` when omitted. */
  width?: number;
  /** Allow drag. Default: true. */
  isDraggable?: boolean;
  /** Allow resize. Default: true. */
  isResizable?: boolean;
  /** Fires after each drag or resize with the updated layout. */
  onLayoutChange?: (layout: DashboardItem[]) => void;
  /** CSS class applied to the root element. */
  className?: string;
  /** Panels — each child must have a React `key` that matches a layout entry's `i`. */
  children?: React.ReactNode;
}

/** Configuration for the worker-backed pipeline (`createWorkerDataSource`). */
export interface WorkerPipelineOptions {
  /** WebSocket URL the worker should connect to. */
  url: string;
  /**
   * Optional protocol-specific subscribe envelope, sent on connect. For
   * raw WebSocket sources omit; for rosbridge pass
   * `{ op: 'subscribe', topic, type }`.
   */
  subscribeMessage?: unknown;
  /**
   * Maximum batch flush rate (Hz). The worker accumulates incoming
   * samples and posts them at this cadence regardless of inbound rate.
   * Default: 60.
   */
  flushHz?: number;
  /**
   * Per-message extractor evaluated **inside the worker**. Provided as a
   * source string because functions cannot be cloned across the worker
   * boundary. Receives the parsed JSON message and returns a number, or
   * `undefined` to drop the sample. Default extracts `.data`
   * (std_msgs/Float* style).
   */
  extractorSource?: string;
  /** History ring-buffer capacity on the main thread. Default: 10_000. */
  bufferSize?: number;
}

export interface GaugeProps {
  /** Live data source. Most-recent value drives the needle. */
  dataSource?: AltaraDataSource;
  /** Minimum displayable value (left end of the arc). */
  min: number;
  /** Maximum displayable value (right end of the arc). */
  max: number;
  /** Unit suffix shown next to the readout (e.g. `'%'`, `'rpm'`). */
  unit?: string;
  /** Label rendered inside the gauge above the readout. */
  label?: string;
  /** Threshold zones rendered as colored arc segments. Sorted ascending by `value`. */
  thresholds?: Threshold[];
  /** Pixel size: `'sm'` 120, `'md'` 180, `'lg'` 240. Default: `'md'`. */
  size?: 'sm' | 'md' | 'lg';
  /** Animate the needle through the range with a built-in sine wave. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

export interface AttitudeProps {
  /** Roll in degrees (positive = right wing down). Overridden by `dataSource` if both are set. */
  roll?: number;
  /** Pitch in degrees (positive = nose up). Overridden by `dataSource` if both are set. */
  pitch?: number;
  /** Live data source. Samples are routed by `TelemetryValue.channel` (`'roll'` or `'pitch'`). */
  dataSource?: AltaraDataSource;
  /** Outer diameter in pixels (square). Default: 220. */
  size?: number;
  /** Animate roll/pitch through gentle out-of-phase oscillation. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

/** A single signal row in `SignalPanel`. */
export interface SignalPanelSignal {
  /** Stable signal id — used as the React key. */
  key: string;
  /** Label rendered on the left of the row. */
  label: string;
  /** Optional unit suffix (e.g. `'V'`, `'°C'`). */
  unit?: string;
  /** Live data source for this row. Without one the row shows `'—'`. */
  dataSource?: AltaraDataSource;
  /** Value at which the status dot turns amber. */
  warnAt?: number;
  /** Value at which the status dot turns red. */
  dangerAt?: number;
  /**
   * Comparison direction for warn/danger thresholds. `'above'` (default)
   * flags when value ≥ threshold; `'below'` flags when value ≤ threshold.
   */
  thresholdDirection?: 'above' | 'below';
}

export interface SignalPanelProps {
  /** Signals to display. Each becomes one row. */
  signals: SignalPanelSignal[];
  /** Mark a row stale (gray dot) when the latest sample is older than this many ms. Default: 5000. */
  staleAfterMs?: number;
  /** Number of grid columns. Default: 1. */
  columns?: number;
  /** CSS class applied to the root element. */
  className?: string;
}

/** A circular geofence overlay rendered on `LiveMap`. */
export interface LiveMapGeofence {
  /** `[latitude, longitude]` of the circle center. */
  center: [number, number];
  /** Radius in meters. */
  radius: number;
  /** Stroke color. Defaults to `'var(--vt-color-warn)'`. */
  color?: string;
}

export interface LiveMapProps {
  /** Latest GPS fix. Each new value extends the polyline track. */
  position?: { lat: number; lng: number };
  /** Vehicle heading in degrees clockwise from north. Drives the marker arrow. Default: 0. */
  heading?: number;
  /** Maximum positions retained in the polyline track. Default: 200. */
  trackLength?: number;
  /** Optional geofence overlays. */
  geofences?: LiveMapGeofence[];
  /** Animate a simulated drone orbit pattern when no `position` is supplied. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

/** A single timestamped entry in `EventLog`. */
export interface EventLogEntry {
  /** Wall-clock time of the event, in unix milliseconds. */
  timestamp: number;
  /** Display message. Wrapped to multiple lines if needed. */
  message: string;
  /** Severity level — drives the left-border color. */
  severity: 'info' | 'warn' | 'error';
}

export interface EventLogProps {
  /** Entries to display. Pass the full list — `EventLog` filters and slices internally. */
  entries: EventLogEntry[];
  /** Maximum number of rows displayed at once. Older entries are trimmed. Default: 500. */
  maxEntries?: number;
  /** Severity filter. `'warn'` shows warn+error; `'error'` shows error only. Default: `'all'`. */
  filter?: 'all' | 'warn' | 'error';
  /** CSS class applied to the root element. */
  className?: string;
}

export interface ConnectionBarProps {
  /** Connection URL displayed in the strip. */
  url: string;
  /** Current connection state — drives the dot color and label. */
  status: ConnectionStatus;
  /** Round-trip latency in milliseconds. Shown as `'lat 14 ms'`; `'—'` when omitted. */
  latencyMs?: number;
  /** Inbound message rate (messages/second). Shown as `'rate 250/s'`; `'—'` when omitted. */
  messagesPerSecond?: number;
  /** CSS class applied to the root element. */
  className?: string;
}
