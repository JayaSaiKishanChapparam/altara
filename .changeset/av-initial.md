---
'@altara/av': minor
---

Add `@altara/av` — autonomous-vehicle React components for ADS / robotaxi / robotics dashboards. Eleven components: `LiDARPointCloud` (Three.js, flagship), `OccupancyGrid`, `ObjectDetectionOverlay`, `PathPlannerOverlay`, `VelocityVectorDisplay`, `PerceptionStateMachine`, `SensorHealthMatrix`, `CameraFeed`, `ControlTrace`, `RadarSweep`, and `SLAMMap`. Three.js is an optional peer dep — `LiDARPointCloud` lazy-imports it at runtime and renders a friendly "install three" placeholder when absent. Every component supports `mockMode`, reads Altara design tokens, and consumes any `AltaraDataSource`.
