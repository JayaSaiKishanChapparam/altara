// @altara/aerospace — flight instruments for drones, UAVs, eVTOL, and ground stations.

export { PrimaryFlightDisplay } from './components/PrimaryFlightDisplay';
export { HorizontalSituationIndicator } from './components/HorizontalSituationIndicator';
export { Altimeter } from './components/Altimeter';
export { VerticalSpeedIndicator } from './components/VerticalSpeedIndicator';
export { AirspeedIndicator } from './components/AirspeedIndicator';
export { EngineInstrumentCluster } from './components/EngineInstrumentCluster';
export { RadioAltimeter } from './components/RadioAltimeter';
export { TerrainAwareness } from './components/TerrainAwareness';
export { TCASDisplay } from './components/TCASDisplay';
export { AutopilotModeAnnunciator } from './components/AutopilotModeAnnunciator';
export { FuelGauge } from './components/FuelGauge';

export type {
  PrimaryFlightDisplayProps,
  HorizontalSituationIndicatorProps,
  AltimeterProps,
  VerticalSpeedIndicatorProps,
  AirspeedIndicatorProps,
  EngineInstrumentClusterProps,
  EngineThresholds,
  RadioAltimeterProps,
  TerrainAwarenessProps,
  TCASDisplayProps,
  TcasTraffic,
  TcasThreatLevel,
  AutopilotModeAnnunciatorProps,
  FmaModes,
  FmaStatus,
  FuelGaugeProps,
  FuelTank,
  InstrumentSize,
} from './types';
