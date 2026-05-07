import type { AltaraDataSource } from '@altara/core';

/** Discrete sizes used by most aerospace gauges. */
export type InstrumentSize = 'sm' | 'md' | 'lg';

// ── PrimaryFlightDisplay (PFD) ──────────────────────────────────────────
export interface PrimaryFlightDisplayProps {
  /** Full telemetry stream. Channels: roll, pitch, heading, airspeed, altitude, vs. */
  dataSource?: AltaraDataSource;
  /** Bank angle in degrees. Overrides dataSource if provided. */
  roll?: number;
  /** Pitch angle in degrees. Positive = nose up. */
  pitch?: number;
  /** Magnetic heading 0–360°. */
  heading?: number;
  /** Indicated airspeed in knots. */
  airspeed?: number;
  /** Pressure altitude in feet. */
  altitude?: number;
  /** Vertical speed in ft/min. */
  vs?: number;
  /** Kollsman window setting (inHg). */
  altimeterSetting?: number;
  /** Renders flight director command bars. */
  showFlightDirector?: boolean;
  /** Flight director commanded roll. */
  fdRoll?: number;
  /** Flight director commanded pitch. */
  fdPitch?: number;
  /** Controls canvas dimensions. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Drives a simulated flight maneuver automatically. */
  mockMode?: boolean;
  /** Root element class for CSS token overrides. */
  className?: string;
}

// ── HorizontalSituationIndicator (HSI) ─────────────────────────────────
export interface HorizontalSituationIndicatorProps {
  /** Live data source; channels: heading, headingBug, course, courseDev. */
  dataSource?: AltaraDataSource;
  /** Current magnetic heading (0–360°). */
  heading?: number;
  /** Selected heading — the cyan bug on the compass rose. */
  headingBug?: number;
  /** Selected course needle direction. */
  course?: number;
  /** CDI deviation: –1 full left to +1 full right. */
  courseDev?: number;
  /** TO/FROM indicator on the CDI. */
  toFrom?: 'to' | 'from' | 'off';
  /** Bearing pointer 1 direction (degrees). */
  bearing1?: number;
  /** Bearing pointer 2 direction (degrees). */
  bearing2?: number;
  /** Ground speed in knots — displayed in readout. */
  groundSpeed?: number;
  /** Distance to next waypoint in nm. */
  distanceToWaypoint?: number;
  /** Canvas diameter in pixels. */
  size?: number;
  /** Animates heading sweep and CDI oscillation. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── Altimeter ───────────────────────────────────────────────────────────
export interface AltimeterProps {
  /** Current altitude in feet. */
  altitude?: number;
  /** Live data source — most-recent value drives the altitude display. */
  dataSource?: AltaraDataSource;
  /** Kollsman window setting in inHg. */
  altimeterSetting?: number;
  /** Airport/terrain elevation for AGL calculation. */
  groundElevation?: number;
  /** Displays above-ground-level readout below main display. */
  showAGL?: boolean;
  /** sm = 120px, md = 180px, lg = 240px. */
  size?: InstrumentSize;
  /** Simulates a climb and descent cycle. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── VerticalSpeedIndicator (VSI) ───────────────────────────────────────
export interface VerticalSpeedIndicatorProps {
  /** Vertical speed in ft/min. Clamped to display range. */
  vs?: number;
  /** Live data source. */
  dataSource?: AltaraDataSource;
  /** Max/min display range in ft/min. */
  range?: number;
  /** Gauge diameter. */
  size?: InstrumentSize;
  /** Oscillates between ±500 ft/min. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── AirspeedIndicator ──────────────────────────────────────────────────
export interface AirspeedIndicatorProps {
  /** Indicated airspeed in knots. */
  airspeed?: number;
  /** Live data source. */
  dataSource?: AltaraDataSource;
  /** Stall speed, flaps extended (bottom of white arc). */
  vso?: number;
  /** Stall speed, clean configuration (bottom of green arc). */
  vs1?: number;
  /** Maximum flap extended speed (top of white arc). */
  vfe?: number;
  /** Maximum structural cruising speed (top of green arc). */
  vno?: number;
  /** Never-exceed speed (red line). */
  vne?: number;
  /** Dial diameter. */
  size?: InstrumentSize;
  /** Sweeps through normal operating range. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── EngineInstrumentCluster (EIC) ──────────────────────────────────────
export interface EngineThresholds {
  rpm?: { warn?: number; danger?: number };
  egt?: { warn?: number; danger?: number };
  fuelFlow?: { warn?: number; danger?: number };
  oilPressure?: { warn?: number; danger?: number; lowWarn?: number; lowDanger?: number };
  oilTemp?: { warn?: number; danger?: number };
}

export interface EngineInstrumentClusterProps {
  /** Engine RPM. Array for multi-engine. */
  rpm?: number | number[];
  /** Exhaust gas temp in °C. */
  egt?: number | number[];
  /** Fuel flow in gal/hr. */
  fuelFlow?: number;
  /** Oil pressure in PSI. */
  oilPressure?: number;
  /** Oil temperature in °C. */
  oilTemp?: number;
  /** Number of engines to display. */
  engineCount?: 1 | 2 | 4;
  /** Per-parameter warn/danger values. */
  thresholds?: EngineThresholds;
  /** Simulates running engine telemetry. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── RadioAltimeter ─────────────────────────────────────────────────────
export interface RadioAltimeterProps {
  /** AGL altitude in feet (from radar altimeter). */
  radioAltitude?: number;
  /** Live data source. */
  dataSource?: AltaraDataSource;
  /** Decision-height bug in feet AGL. Triggers visual alert when breached. */
  decisionHeight?: number;
  /** Maximum AGL altitude shown (feet). Default: 2500. */
  maxAltitude?: number;
  /** Fires once when radio altitude first descends below decisionHeight. */
  onDecisionHeight?: () => void;
  /** Display size. */
  size?: InstrumentSize;
  /** Animates a synthetic low-altitude approach. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── TerrainAwareness (TAWS / EGPWS-lite) ───────────────────────────────
export interface TerrainAwarenessProps {
  /** Aircraft AGL altitude in feet (used to compute terrain proximity). */
  radioAltitude?: number;
  /** Aircraft heading in degrees. */
  heading?: number;
  /** Vertical speed in ft/min. Negative descent triggers earlier warnings. */
  vs?: number;
  /** Square terrain grid sampled around the aircraft. Each cell = elevation in feet MSL. */
  terrainGrid?: number[][];
  /** Cell size in nm — used to scale the grid on the display. */
  cellSizeNm?: number;
  /** Aircraft pressure altitude in feet MSL — used to compute terrain delta. */
  altitude?: number;
  /** Display width in pixels. */
  width?: number;
  /** Display height in pixels. */
  height?: number;
  /** Generates a synthetic terrain ridge ahead. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── TCASDisplay ─────────────────────────────────────────────────────────
export type TcasThreatLevel = 'other' | 'proximate' | 'ta' | 'ra';

export interface TcasTraffic {
  /** Stable id (e.g. ICAO24 hex). */
  id: string;
  /** Bearing relative to ownship in degrees (0 = nose). */
  bearing: number;
  /** Slant range in nautical miles. */
  rangeNm: number;
  /** Relative altitude in hundreds of feet (positive = above). */
  relAltFL: number;
  /** Vertical trend in ft/min — drives up/down arrow next to glyph. */
  verticalTrend?: number;
  /** Threat level. */
  level: TcasThreatLevel;
  /** Optional callsign / tail number rendered beside the glyph. */
  callsign?: string;
}

export interface TCASDisplayProps {
  /** Traffic list. Render order is by threat level; RA on top. */
  traffic?: TcasTraffic[];
  /** Maximum range ring in nm. */
  rangeNm?: number;
  /** Number of range rings rendered. */
  rings?: number;
  /** Display size in pixels (square). */
  size?: number;
  /** Generates 4–6 synthetic targets, including occasional RA. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── AutopilotModeAnnunciator ────────────────────────────────────────────
export type FmaStatus = 'armed' | 'active' | 'off' | 'caution';

export interface FmaModes {
  /** Lateral mode — e.g. HDG, NAV, LOC, ROLL. */
  lateral?: { label: string; status: FmaStatus };
  /** Vertical mode — e.g. ALT, VS, FLCH, GS. */
  vertical?: { label: string; status: FmaStatus };
  /** Autothrottle mode — e.g. SPD, THR, IDLE. */
  autothrottle?: { label: string; status: FmaStatus };
  /** Autopilot master state — AP1, AP2, both, or off. */
  ap?: { label: string; status: FmaStatus };
  /** Flight director engagement. */
  fd?: { label: string; status: FmaStatus };
}

export interface AutopilotModeAnnunciatorProps {
  /** Current FMA modes. Missing tiles render blank. */
  modes?: FmaModes;
  /** Drives a synthetic mode-change sequence. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── FuelGauge ───────────────────────────────────────────────────────────
export interface FuelTank {
  /** Stable id. */
  id: string;
  /** Display label (e.g. "L MAIN", "R AUX"). */
  label: string;
  /** Current fuel quantity in gallons (or kg if you want — the component is unit-agnostic, the unit prop just labels). */
  quantity: number;
  /** Maximum capacity for this tank. */
  capacity: number;
}

export interface FuelGaugeProps {
  /** Tanks to display. Rendered as bar gauges in declaration order. */
  tanks?: FuelTank[];
  /** Engineering unit shown on each readout. */
  unit?: string;
  /** Total target / required reserve — drawn as a horizontal threshold across the totaliser. */
  reserve?: number;
  /** Per-tank low warning (fraction of capacity). Default: 0.2. */
  lowWarn?: number;
  /** Per-tank low danger (fraction of capacity). Default: 0.1. */
  lowDanger?: number;
  /** Animates fuel consumption across the tank set. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}
