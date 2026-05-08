import type { AltaraDataSource } from '@altara/core';

// ── WaterfallSpectrogram ───────────────────────────────────────────────
export type ColorMap = 'heat' | 'viridis' | 'plasma' | 'grayscale';

export interface WaterfallSpectrogramProps {
  /** Raw time-domain signal stream. The component runs FFT internally. */
  dataSource?: AltaraDataSource;
  /** FFT window size. Larger = better frequency resolution. */
  fftSize?: 256 | 512 | 1024 | 2048;
  /** Signal sample rate in Hz. */
  sampleRate?: number;
  /** Minimum frequency to display in Hz. */
  freqMin?: number;
  /** Maximum frequency to display in Hz. */
  freqMax?: number;
  /** Color encoding for amplitude. */
  colorMap?: ColorMap;
  /** dB range for color mapping. */
  dbRange?: [number, number];
  /** Rows-per-second scrolled. */
  scrollRate?: number;
  /** Canvas width in pixels. */
  width?: number;
  /** Canvas height in pixels. */
  height?: number;
  /** Generates a synthetic vibration signal with harmonic content. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── PIDTuningPanel ─────────────────────────────────────────────────────
export interface PIDTuningPanelProps {
  /** Desired setpoint stream. */
  setpointSource?: AltaraDataSource;
  /** Measured process value stream. */
  processSource?: AltaraDataSource;
  /** Controller output stream. */
  outputSource?: AltaraDataSource;
  /** Proportional gain shown in the readout panel. */
  kp?: number;
  /** Integral gain. */
  ki?: number;
  /** Derivative gain. */
  kd?: number;
  /** Acceptable error band (drawn as a corridor). */
  errorBand?: number;
  /** Engineering unit for axis labels. */
  unit?: string;
  /** Visible time window. */
  windowMs?: number;
  /** Simulates a second-order system under PID control. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── OEEDashboard ───────────────────────────────────────────────────────
export interface OEELoss {
  category: string;
  minutes: number;
}

export interface OEEDashboardProps {
  /** Availability ratio (0–1). Planned time minus downtime. */
  availability?: number;
  /** Performance ratio (0–1). Ideal cycle time over actual. */
  performance?: number;
  /** Quality ratio (0–1). Good units over total produced. */
  quality?: number;
  /** OEE target line shown on gauges. World-class = 0.85. */
  oeeTarget?: number;
  /** Loss-category breakdown for the Pareto chart. */
  lossCategories?: OEELoss[];
  /** Current shift label displayed in header. */
  shift?: string;
  /** Generates an 8-hour shift with realistic OEE variation. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── AlarmAnnunciatorPanel ──────────────────────────────────────────────
export type AlarmState = 'normal' | 'warning' | 'alarm' | 'acknowledged';

export interface AlarmDef {
  id: string;
  label: string;
  priority?: 1 | 2 | 3;
  group?: string;
}

export interface AlarmAnnunciatorPanelProps {
  /** Alarm definitions — what tiles to display. */
  alarms?: AlarmDef[];
  /** Map of alarm id → current state. */
  states?: Record<string, AlarmState>;
  /** Callback fired when the operator clicks/acknowledges a tile. */
  onAcknowledge?: (id: string) => void;
  /** Tiles per row. */
  columns?: number;
  /** Optional group filter — only render alarms whose `group` matches. */
  groupBy?: string;
  /** Blink rate in Hz for unacknowledged alarms. */
  flashRate?: number;
  /** Randomly trigger and clear alarms every few seconds. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── TrendRecorder ──────────────────────────────────────────────────────
export interface TrendChannel {
  key: string;
  label: string;
  color: string;
  unit?: string;
  /** Y-axis lower bound for this channel. */
  min: number;
  /** Y-axis upper bound for this channel. */
  max: number;
  source?: AltaraDataSource;
}

export type TrendTimeScale = '1m' | '5m' | '15m' | '1h' | '4h' | '8h' | '24h';

export interface TrendRecorderProps {
  /** Channel configuration. Up to 8 channels render simultaneously. */
  channels?: TrendChannel[];
  /** Time scale selector. */
  timeScale?: TrendTimeScale;
  /** Horizontal grid lines at Y-axis divisions. */
  showGrid?: boolean;
  /** Channel legend with current value readouts. */
  showLegend?: boolean;
  /** Panel background color. */
  backgroundColor?: string;
  /** Generates 4 channels of slow-changing process data. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── PIDNode (ISA 5.1 instrument symbol) ────────────────────────────────
export type PIDLocation = 'field' | 'panel' | 'dcs';
export type PIDStatus = 'normal' | 'warning' | 'alarm' | 'offline';

export interface PIDNodeProps {
  /** Measured-variable letter. F=flow, T=temp, P=pressure, L=level, A=analysis. */
  firstLetter?: string;
  /** Function letters. I=indicate, C=control, T=transmit, R=record, A=alarm. */
  functionLetters?: string;
  /** Symbol style: solid (field), dashed (panel), shared display (DCS). */
  location?: PIDLocation;
  /** Live value displayed in the symbol. */
  value?: number;
  /** Engineering unit for the value display. */
  unit?: string;
  /** Status drives border color. */
  status?: PIDStatus;
  /** SVG diameter. */
  size?: number;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── ProcessFlowDiagram ─────────────────────────────────────────────────
export type PFDNodeType = 'tank' | 'pump' | 'valve' | 'heat-exchanger' | 'instrument';

export interface PFDNode {
  id: string;
  type: PFDNodeType;
  /** Top-left x in SVG units. */
  x: number;
  /** Top-left y in SVG units. */
  y: number;
  label?: string;
}

export interface PFDEdge {
  /** Source node id. */
  from: string;
  /** Target node id. */
  to: string;
  /** Active flow renders the pipe in `--vt-color-active`. */
  active?: boolean;
}

export interface ProcessFlowDiagramProps {
  /** Process elements with positions and types. */
  nodes?: PFDNode[];
  /** Pipe connections between nodes. */
  edges?: PFDEdge[];
  /** Live values keyed by node id. */
  values?: Record<string, number>;
  /** SVG viewport width in pixels. */
  width?: number;
  /** SVG viewport height in pixels. */
  height?: number;
  /** Enables click/hover interactions on nodes. */
  interactive?: boolean;
  /** Animates a simple 3-tank process flow. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── MotorDashboard ─────────────────────────────────────────────────────
export interface MotorFault {
  code: string;
  description: string;
  /** Unix-ms when the fault was raised. */
  timestamp: number;
}

export interface MotorDashboardProps {
  /** Motor shaft speed in RPM. */
  rpm?: number;
  /** Shaft torque in Nm. */
  torque?: number;
  /** Phase current in amps. */
  current?: number;
  /** Winding temperature in °C. */
  temperature?: number;
  /** Active fault codes with descriptions. */
  faults?: MotorFault[];
  /** Nameplate rated speed (gauge scaling). */
  ratedRPM?: number;
  /** Nameplate rated current (gauge scaling). */
  ratedCurrent?: number;
  /** Simulates motor startup and a thermal fault event. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── PredictiveMaintenanceGauge ─────────────────────────────────────────
export interface HealthContributor {
  name: string;
  /** 0..100 — higher is healthier. */
  score: number;
  /** 0..1 — share of the overall index this metric carries. */
  weight: number;
}

export interface PredictiveMaintenanceGaugeProps {
  /** Computed health index 0–100. */
  healthScore?: number;
  /** Remaining useful life in days. */
  rulDays?: number;
  /** Confidence interval (± days) on the RUL estimate. */
  confidence?: number;
  /** Per-metric breakdown rendered below the main gauge. */
  contributors?: HealthContributor[];
  /** ISO date string for the last maintenance event. */
  lastMaintenance?: string;
  /** ISO date string for next scheduled maintenance. */
  nextScheduled?: string;
  /** Gauge size. */
  size?: 'sm' | 'md' | 'lg';
  /** Simulates gradual health degradation over time. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}
