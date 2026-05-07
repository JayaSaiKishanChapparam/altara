// @altara/mqtt — MQTT-over-WebSocket adapter for Altara.
//
// The implementation lives in @altara/core (so the same factory is also
// available there for consumers who already depend on core). This package
// is a thin specialised re-export that mirrors @altara/ros: pulling in
// `@altara/mqtt` is a clear signal that an app uses MQTT, and keeps the
// installation surface symmetrical across telemetry transports.

export { createMqttAdapter } from '@altara/core';
export type { MqttAdapterOptions, MqttClientLike } from '@altara/core';
