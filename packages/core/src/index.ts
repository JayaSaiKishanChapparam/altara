// Altara core public API — v1.0.

// ── Provider ─────────────────────────────────────────────
export { AltaraProvider, useAltara } from './AltaraProvider';
export type { AltaraProviderProps, AltaraTheme, AltaraContextValue } from './AltaraProvider';

// ── Components ───────────────────────────────────────────
export { SignalPanel } from './components/SignalPanel';
export { ConnectionBar } from './components/ConnectionBar';
export { Gauge } from './components/Gauge';
export { TimeSeries } from './components/TimeSeries';
export { MultiAxisPlot } from './components/MultiAxisPlot';
export { Attitude } from './components/Attitude';
export { LiveMap } from './components/LiveMap';
export { EventLog } from './components/EventLog';
export { DashboardLayout } from './components/DashboardLayout';

// ── Hooks ────────────────────────────────────────────────
export { useWebSocket } from './hooks/useWebSocket';
export type { UseWebSocketOptions, UseWebSocketResult } from './hooks/useWebSocket';
export { useRingBuffer } from './hooks/useRingBuffer';
export { useTelemetry } from './hooks/useTelemetry';
export type { UseTelemetryResult } from './hooks/useTelemetry';

// ── Adapters ─────────────────────────────────────────────
// Note: createRosbridgeAdapter now lives in @altara/ros.
export { createMqttAdapter } from './adapters/mqtt';
export type { MqttAdapterOptions, MqttClientLike } from './adapters/mqtt';
export { createWorkerDataSource } from './adapters/worker';
export type { CreateWorkerDataSourceOptions, WorkerLike } from './adapters/worker';

// ── Utilities ────────────────────────────────────────────
export { RingBuffer } from './utils/RingBuffer';
export {
  createMockDataSource,
  custom,
  randomWalk,
  sineWave,
  stepFunction,
} from './utils/mockData';
export type { MockGenerator, MockDataSourceOptions } from './utils/mockData';

// ── Types ────────────────────────────────────────────────
export type {
  AltaraDataSource,
  ConnectionStatus,
  TelemetryValue,
  Threshold,
  TimeSeriesProps,
  TimeSeriesChannel,
  MultiAxisPlotProps,
  MultiAxisChannel,
  GaugeProps,
  AttitudeProps,
  SignalPanelProps,
  SignalPanelSignal,
  LiveMapProps,
  LiveMapGeofence,
  EventLogProps,
  EventLogEntry,
  ConnectionBarProps,
  DashboardItem,
  DashboardLayoutProps,
  WorkerPipelineOptions,
} from './adapters/types';
