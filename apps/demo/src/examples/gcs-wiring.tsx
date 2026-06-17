/**
 * COMPILE-GATE FIXTURE — canonical MAVROS wiring snippets for the drone-GCS
 * article. These functions are typechecked by `tsc -b` (apps/demo build) but
 * never mounted, so no real WebSocket is opened. If any @altara API drifts,
 * the demo build fails — which is the point: the article quotes these verbatim.
 *
 * Each block is the exact, copy-paste-ready example referenced in the article.
 */
import { useEffect, useMemo, useState } from 'react';
import { EventLog, Gauge, LiveMap, type EventLogEntry } from '@altara/core';
import { PrimaryFlightDisplay } from '@altara/aerospace';
import {
  createBatteryStateAdapter,
  createImuAdapter,
  createRosbridgeAdapter,
  mergeChannels,
} from '@altara/ros';

// ── 1. Primary Flight Display — two sockets (IMU + VFR_HUD) ────────────────
// roll/pitch from one sensor_msgs/Imu; heading/airspeed/altitude from one
// mavros_msgs/VFR_HUD. mergeChannels unions them into a single channel-tagged
// source for the PFD.
export function LivePrimaryFlightDisplay({ url }: { url: string }) {
  const source = useMemo(() => {
    const imu = createImuAdapter({ url, topic: '/mavros/imu/data' });
    const hud = createRosbridgeAdapter({
      url,
      topic: '/mavros/vfr_hud',
      messageType: 'mavros_msgs/VFR_HUD',
      channels: {
        heading: (m) => m.heading,
        airspeed: (m) => m.airspeed * 1.94384, // m/s -> kt
        altitude: (m) => m.altitude * 3.28084, // m -> ft
      },
    });
    return mergeChannels({
      roll: imu.roll,
      pitch: imu.pitch,
      heading: hud.heading,
      airspeed: hud.airspeed,
      altitude: hud.altitude,
    });
  }, [url]);

  useEffect(() => () => source.destroy(), [source]);

  return <PrimaryFlightDisplay dataSource={source} showFlightDirector />;
}

// ── 2. LiveMap — GPS from one sensor_msgs/NavSatFix socket ──────────────────
// lat/lng pulled as two channels off a single socket, merged, then accumulated
// into the {lat,lng} position LiveMap renders.
export function LiveDroneMap({ url }: { url: string }) {
  const source = useMemo(() => {
    const gps = createRosbridgeAdapter({
      url,
      topic: '/mavros/global_position/global',
      messageType: 'sensor_msgs/NavSatFix',
      channels: {
        lat: (m) => m.latitude,
        lng: (m) => m.longitude,
      },
    });
    return mergeChannels({ lat: gps.lat, lng: gps.lng });
  }, [url]);

  const [position, setPosition] = useState<{ lat: number; lng: number }>();
  useEffect(() => {
    const latest: { lat?: number; lng?: number } = {};
    const off = source.subscribe((v) => {
      if (v.channel === 'lat') latest.lat = v.value;
      if (v.channel === 'lng') latest.lng = v.value;
      if (latest.lat !== undefined && latest.lng !== undefined) {
        setPosition({ lat: latest.lat, lng: latest.lng });
      }
    });
    return () => {
      off();
      source.destroy();
    };
  }, [source]);

  return position ? <LiveMap position={position} trackLength={800} /> : <LiveMap />;
}

// ── 3. Battery gauge — voltage-fallback SoC ─────────────────────────────────
// createBatteryStateAdapter derives an approximate state-of-charge from voltage
// when the firmware reports an invalid percentage (-1/NaN) — the common case on
// PX4/ArduPilot LiPo packs. The estimate is presence-of-charge, not precise
// range-remaining (the LiPo discharge curve is non-linear).
export function LiveBatteryGauge({ url }: { url: string }) {
  const source = useMemo(
    () =>
      createBatteryStateAdapter({
        url,
        topic: '/mavros/battery',
        voltageRange: { min: 14.0, max: 16.8 }, // 4S LiPo (3.5–4.2 V/cell)
      }),
    [url],
  );
  useEffect(() => () => source.destroy(), [source]);

  return (
    <Gauge
      dataSource={source}
      min={0}
      max={100}
      label="Battery"
      unit="%"
      thresholds={[
        { value: 0, color: 'var(--vt-color-danger)' },
        { value: 20, color: 'var(--vt-color-warn)' },
        { value: 40, color: 'var(--vt-color-active)' },
      ]}
    />
  );
}

// ── 4. EventLog — text logs via raw /rosout over rosbridge ──────────────────
// @altara is numeric-by-design (TelemetryValue carries a number), so text logs
// talk to rosbridge directly rather than through an adapter. You own the
// EventLogEntry[] array and pass it in.
const ROSOUT_LEVEL: Record<number, EventLogEntry['severity']> = {
  20: 'info',
  30: 'warn',
  40: 'error',
  50: 'error', // rcl_interfaces/Log fatal -> error
};

export function RosoutEventLog({ url }: { url: string }) {
  const [entries, setEntries] = useState<EventLogEntry[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onopen = () =>
      ws.send(JSON.stringify({ op: 'subscribe', topic: '/rosout', type: 'rcl_interfaces/Log' }));
    ws.onmessage = (e) => {
      const data = typeof e.data === 'string' ? e.data : '';
      if (!data) return;
      const env = JSON.parse(data) as {
        op: string;
        topic?: string;
        msg?: { level: number; name: string; msg: string; stamp?: { sec: number; nanosec: number } };
      };
      if (env.op !== 'publish' || env.topic !== '/rosout' || !env.msg) return;
      const m = env.msg;
      if (m.level < 20) return; // skip debug
      setEntries((prev) =>
        [
          ...prev,
          {
            timestamp: m.stamp ? m.stamp.sec * 1000 + m.stamp.nanosec / 1e6 : Date.now(),
            severity: ROSOUT_LEVEL[m.level] ?? 'info',
            message: `[${m.name}] ${m.msg}`,
          },
        ].slice(-500),
      );
    };
    return () => ws.close();
  }, [url]);

  return <EventLog entries={entries} maxEntries={500} />;
}
