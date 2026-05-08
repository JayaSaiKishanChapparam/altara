import type { AltaraDataSource } from '@altara/core';

// ── LiDARPointCloud ────────────────────────────────────────────────────
export interface LiDARPointCloudProps {
  /** PointCloud2 data stream. The component decodes binary fields itself. */
  dataSource?: AltaraDataSource;
  /** How to color individual points. */
  colorMode?: 'intensity' | 'height' | 'return' | 'flat';
  /** Height range in meters for the height colormap. */
  heightRange?: [number, number];
  /** Size of each point in pixels. */
  pointSize?: number;
  /** Point budget for performance. The renderer decimates if exceeded. */
  maxPoints?: number;
  /** Renders a ground plane grid. */
  showGrid?: boolean;
  /** Camera position preset. `'follow'` tracks the vehicle origin. */
  cameraPreset?: 'top' | 'iso' | 'follow';
  /** When true, renders a vehicle bounding box at the origin. */
  vehicleFrame?: boolean;
  /** Canvas width in pixels. */
  width?: number;
  /** Canvas height in pixels. */
  height?: number;
  /** Generates a synthetic urban-scene point cloud at 10 Hz. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── OccupancyGrid ──────────────────────────────────────────────────────
export interface OccupancyGridProps {
  /** nav_msgs/OccupancyGrid stream. Optional — pass `grid` directly otherwise. */
  dataSource?: AltaraDataSource;
  /** Static grid (rows × cols). Cell values: 0 = free, 100 = occupied, -1 = unknown. */
  grid?: number[][];
  /** Canvas display width in pixels. */
  width?: number;
  /** Canvas display height in pixels. */
  height?: number;
  /** Vehicle pose in grid coordinates. */
  vehiclePos?: { x: number; y: number; theta: number };
  /** Navigation goal marker. */
  goal?: { x: number; y: number };
  /** Planned path as array of grid-frame waypoints. */
  path?: Array<{ x: number; y: number }>;
  /** Color for free cells. */
  colorFree?: string;
  /** Color for occupied cells. */
  colorOccupied?: string;
  /** Color for unknown cells. */
  colorUnknown?: string;
  /** Generates a synthetic room map with moving vehicle. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── ObjectDetectionOverlay ─────────────────────────────────────────────
export interface Detection {
  label: string;
  confidence: number;
  /** Top-left x in pixels (image coordinates). */
  x: number;
  /** Top-left y. */
  y: number;
  w: number;
  h: number;
  color?: string;
}

export interface ObjectDetectionOverlayProps {
  /** Background image source — URL or data source emitting CompressedImage frames. */
  imageSource?: string | AltaraDataSource;
  /** Bounding boxes to render on top of the image. */
  detections?: Detection[];
  /** Map from class name to hex color. */
  classColors?: Record<string, string>;
  /** Renders confidence score on each box label. */
  showConfidence?: boolean;
  /** Hides detections below this confidence threshold. */
  minConfidence?: number;
  /** Display width in pixels. */
  width?: number;
  /** Display height in pixels. */
  height?: number;
  /** Overlays animated detection boxes on a synthetic scene. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── PathPlannerOverlay ─────────────────────────────────────────────────
export interface PathPlannerOverlayProps {
  /** Global planner waypoints (lat/lon). */
  plannedPath?: Array<{ lat: number; lon: number }>;
  /** Recorded trajectory. */
  actualPath?: Array<{ lat: number; lon: number; timestamp: number }>;
  /** Current vehicle position. */
  currentPos?: { lat: number; lon: number };
  /** Cross-track error in meters that triggers warning coloring. */
  crossTrackWarning?: number;
  /** Colors the planned path based on deviation from actual. */
  showDeviation?: boolean;
  /** Display width in pixels. */
  width?: number;
  /** Display height in pixels. */
  height?: number;
  /** Animates a vehicle following and deviating from a path. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── VelocityVectorDisplay ──────────────────────────────────────────────
export interface VelocityVectorDisplayProps {
  /** Linear velocity, forward axis (m/s). */
  vx?: number;
  /** Linear velocity, lateral axis (m/s). */
  vy?: number;
  /** Angular velocity, yaw rate (rad/s). */
  omega?: number;
  /** Live data source — channels: `vx`, `vy`, `omega`. */
  dataSource?: AltaraDataSource;
  /** Arrow scale factor. */
  scale?: number;
  /** SVG bounding box size in pixels. */
  size?: number;
  /** Cycles through forward, reverse, and turning motions. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── PerceptionStateMachine ─────────────────────────────────────────────
export type PerceptionStatus = 'active' | 'stale' | 'error' | 'off';

export interface PerceptionModule {
  name: string;
  status: PerceptionStatus;
  latencyMs?: number;
  topic?: string;
}

export interface PerceptionStateMachineProps {
  /** Modules to display as state nodes. */
  modules?: PerceptionModule[];
  /** Subscribes to diagnostic_msgs/DiagnosticArray. */
  dataSource?: AltaraDataSource;
  /** Mark a module stale if no update within this many ms. */
  staleness?: number;
  /** Generates a simulated perception stack with occasional errors. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── SensorHealthMatrix ─────────────────────────────────────────────────
export interface SensorStatus {
  name: string;
  topic?: string;
  expectedHz?: number;
  /** Unix-ms timestamp of the last update. */
  lastUpdate?: number;
  status?: 'active' | 'warn' | 'stale' | 'error' | 'off';
}

export interface SensorHealthMatrixProps {
  /** Sensors to display. Renders one tile per entry. */
  sensors?: SensorStatus[];
  /** Pulls from diagnostic_msgs/DiagnosticArray. */
  dataSource?: AltaraDataSource;
  /** Mark sensor stale after this many ms without update. */
  staleAfterMs?: number;
  /** Renders in compact single-row mode for narrow panels. */
  compact?: boolean;
  /** Simulates 6 sensors with periodic dropout events. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── CameraFeed ─────────────────────────────────────────────────────────
export interface CameraOverlay {
  type: 'crosshair' | 'grid' | 'box';
  /** Bounding box overlay — image-frame pixels. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: string;
}

export interface CameraFeedProps {
  /** Stream emitting decoded frames or image URLs. */
  dataSource?: AltaraDataSource;
  /** Static or MJPEG stream URL as alternative to dataSource. */
  imageUrl?: string;
  /** Overlay descriptors painted on top of each frame. */
  overlays?: CameraOverlay[];
  /** Display width in pixels. */
  width?: number;
  /** Display height in pixels. */
  height?: number;
  /** Camera label shown in corner (e.g. "Front Camera"). */
  label?: string;
  /** Renders a synthetic animated scene. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── ControlTrace ───────────────────────────────────────────────────────
export interface ControlTraceProps {
  /** Throttle channel (0–100%). */
  throttleSource?: AltaraDataSource;
  /** Brake pressure channel (0–100%). */
  brakeSource?: AltaraDataSource;
  /** Steering angle channel (degrees). */
  steeringSource?: AltaraDataSource;
  /** Visible time window in ms. */
  windowMs?: number;
  /** Links pan/zoom across all three channels. */
  syncScroll?: boolean;
  /** Renders phase markers — accelerating / braking / turning. */
  showPhase?: boolean;
  /** Generates realistic drive control data. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── RadarSweep ─────────────────────────────────────────────────────────
export interface RadarTarget {
  id: string;
  /** Bearing relative to ownship in degrees (0 = ahead). */
  bearing: number;
  /** Range in meters. */
  rangeM: number;
  /** Last time the target was painted (unix ms). */
  lastSeen?: number;
}

export interface RadarSweepProps {
  /** Live target stream; channel = id, value = range, optional `bearing` via custom sources. */
  dataSource?: AltaraDataSource;
  /** Static target list. Used when no dataSource is provided. */
  targets?: RadarTarget[];
  /** Maximum display range in meters. */
  range?: number;
  /** Sweep speed in rotations per second. */
  sweepRate?: number;
  /** Seconds for which target dots remain visible. */
  persistence?: number;
  /** Canvas diameter in pixels. */
  size?: number;
  /** Simulates 3–5 moving targets. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}

// ── SLAMMap ────────────────────────────────────────────────────────────
export interface SLAMPose {
  x: number;
  y: number;
  theta: number;
  /** Marks loop-closure events for highlighted rendering. */
  loopClosure?: boolean;
}

export interface SLAMMapProps {
  /** nav_msgs/OccupancyGrid stream (SLAM output). */
  mapSource?: AltaraDataSource;
  /** Pre-built occupancy grid (rows × cols). */
  grid?: number[][];
  /** nav_msgs/Odometry stream. */
  poseSource?: AltaraDataSource;
  /** Pre-built pose history. */
  poses?: SLAMPose[];
  /** Renders pose-graph nodes and edges. */
  showPoseGraph?: boolean;
  /** Display size in pixels. */
  size?: number;
  /** Simulates an expanding SLAM map with a loop-closure event. */
  mockMode?: boolean;
  /** CSS class applied to the root element. */
  className?: string;
}
