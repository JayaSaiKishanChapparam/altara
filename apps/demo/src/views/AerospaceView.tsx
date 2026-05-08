import {
  AirspeedIndicator,
  Altimeter,
  AutopilotModeAnnunciator,
  EngineInstrumentCluster,
  FuelGauge,
  HorizontalSituationIndicator,
  PrimaryFlightDisplay,
  RadioAltimeter,
  TCASDisplay,
  TerrainAwareness,
  VerticalSpeedIndicator,
} from '@altara/aerospace';

export function AerospaceView() {
  return (
    <div className="demo-view">
      <div className="demo-card" style={{ display: 'flex', justifyContent: 'center' }}>
        <PrimaryFlightDisplay mockMode size="lg" showFlightDirector />
      </div>

      <div className="demo-grid-3">
        <div className="demo-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>Airspeed (knots)</h3>
          <AirspeedIndicator mockMode size="md" vso={45} vs1={55} vfe={120} vno={170} vne={200} />
        </div>
        <div className="demo-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>Altimeter (ft)</h3>
          <Altimeter mockMode size="md" altimeterSetting={29.92} />
        </div>
        <div className="demo-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>VSI (ft/min)</h3>
          <VerticalSpeedIndicator mockMode size="md" range={2000} />
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">HSI — heading + course deviation</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <HorizontalSituationIndicator mockMode size={260} />
          </div>
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">TCAS — traffic advisory</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TCASDisplay mockMode size={260} />
          </div>
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">Terrain Awareness (TAWS)</h3>
          <TerrainAwareness mockMode width={520} height={260} />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Engine cluster</h3>
          <EngineInstrumentCluster mockMode />
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">Autopilot mode annunciator</h3>
          <AutopilotModeAnnunciator mockMode />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Radio altimeter (AGL)</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RadioAltimeter mockMode size="md" decisionHeight={200} />
          </div>
        </div>
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">Fuel — multi-tank</h3>
        <FuelGauge mockMode />
      </div>
    </div>
  );
}
