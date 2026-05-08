import {
  CameraFeed,
  ControlTrace,
  LiDARPointCloud,
  ObjectDetectionOverlay,
  OccupancyGrid,
  PerceptionStateMachine,
  RadarSweep,
  SLAMMap,
  SensorHealthMatrix,
} from '@altara/av';

export function AvView() {
  return (
    <div className="demo-view">
      <div className="demo-card">
        <h3 className="demo-card-title">LiDAR — Three.js point cloud (10 Hz)</h3>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LiDARPointCloud mockMode width={900} height={420} colorMode="intensity" cameraPreset="iso" showGrid />
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">Occupancy Grid + planner</h3>
          <OccupancyGrid mockMode width={420} height={420} />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Radar — sweep + targets</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RadarSweep mockMode size={360} range={150} />
          </div>
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">Camera + perception overlays</h3>
          <CameraFeed mockMode width={520} height={300} label="Front (RGB)" />
          <div style={{ marginTop: 12 }}>
            <ObjectDetectionOverlay mockMode width={520} height={120} />
          </div>
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">SLAM — pose graph + occupancy</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SLAMMap mockMode size={340} showPoseGraph />
          </div>
        </div>
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">Vehicle control trace — throttle / brake / steering</h3>
        <ControlTrace mockMode windowMs={20_000} showPhase />
      </div>

      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">Perception state machine</h3>
          <PerceptionStateMachine mockMode />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">Sensor health matrix</h3>
          <SensorHealthMatrix mockMode />
        </div>
      </div>
    </div>
  );
}
