import {
  AlarmAnnunciatorPanel,
  MotorDashboard,
  OEEDashboard,
  PIDTuningPanel,
  PredictiveMaintenanceGauge,
  ProcessFlowDiagram,
  TrendRecorder,
  WaterfallSpectrogram,
} from '@altara/industrial';

export function IndustrialView() {
  return (
    <div className="demo-view">
      <div className="demo-card">
        <h3 className="demo-card-title">Waterfall spectrogram — FFT (1024) on synthetic vibration</h3>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <WaterfallSpectrogram mockMode width={900} height={360} fftSize={1024} sampleRate={2048} />
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">OEE — availability × performance × quality</h3>
          <OEEDashboard mockMode shift="A1" />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Alarm annunciator — control-room grid</h3>
          <AlarmAnnunciatorPanel mockMode columns={4} />
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">PID tuning — setpoint / PV / output</h3>
          <PIDTuningPanel mockMode kp={2.4} ki={0.6} kd={0.15} unit="°C" />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Trend recorder — multi-pen</h3>
          <TrendRecorder mockMode />
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">Process flow diagram — tanks / pumps / valves</h3>
          <ProcessFlowDiagram mockMode width={520} height={320} />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Motor dashboard</h3>
          <MotorDashboard mockMode />
        </div>
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">Predictive maintenance — health index + RUL</h3>
        <PredictiveMaintenanceGauge mockMode />
      </div>
    </div>
  );
}
