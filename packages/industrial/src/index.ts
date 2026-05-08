// @altara/industrial — SCADA / HMI React components.

export { WaterfallSpectrogram } from './components/WaterfallSpectrogram';
export { PIDTuningPanel } from './components/PIDTuningPanel';
export { OEEDashboard } from './components/OEEDashboard';
export { AlarmAnnunciatorPanel } from './components/AlarmAnnunciatorPanel';
export { TrendRecorder } from './components/TrendRecorder';
export { PIDNode } from './components/PIDNode';
export { ProcessFlowDiagram } from './components/ProcessFlowDiagram';
export { MotorDashboard } from './components/MotorDashboard';
export { PredictiveMaintenanceGauge } from './components/PredictiveMaintenanceGauge';

export type {
  WaterfallSpectrogramProps,
  ColorMap,
  PIDTuningPanelProps,
  OEEDashboardProps,
  OEELoss,
  AlarmAnnunciatorPanelProps,
  AlarmDef,
  AlarmState,
  TrendRecorderProps,
  TrendChannel,
  TrendTimeScale,
  PIDNodeProps,
  PIDLocation,
  PIDStatus,
  ProcessFlowDiagramProps,
  PFDNode,
  PFDNodeType,
  PFDEdge,
  MotorDashboardProps,
  MotorFault,
  PredictiveMaintenanceGaugeProps,
  HealthContributor,
} from './types';
