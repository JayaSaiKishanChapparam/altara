import { useEffect, useState } from 'react';
import { EventLog, Gauge, LiveMap } from '@altara/core';
import type { EventLogEntry } from '@altara/core';
import { PrimaryFlightDisplay } from '@altara/aerospace';

/**
 * Drone GCS panel — PFD + moving map + battery + event log, the four-up layout
 * the dev.to article builds. Everything runs on mockMode so the page is alive
 * with no drone attached. The real MAVROS wiring (rosbridge) is shown verbatim
 * in the commented block below and compile-checked in src/examples/gcs-wiring.tsx.
 *
 *   import { createImuAdapter, createRosbridgeAdapter, mergeChannels } from '@altara/ros';
 *
 *   const imu = createImuAdapter({ url, topic: '/mavros/imu/data' });           // roll, pitch
 *   const hud = createRosbridgeAdapter({
 *     url, topic: '/mavros/vfr_hud', messageType: 'mavros_msgs/VFR_HUD',
 *     channels: {
 *       heading:  m => m.heading,
 *       airspeed: m => m.airspeed * 1.94384, // m/s -> kt
 *       altitude: m => m.altitude * 3.28084, // m -> ft
 *     },
 *   });
 *   const source = mergeChannels({
 *     roll: imu.roll, pitch: imu.pitch,
 *     heading: hud.heading, airspeed: hud.airspeed, altitude: hud.altitude,
 *   });
 *   // <PrimaryFlightDisplay dataSource={source} showFlightDirector />
 */

const GCS_EVENTS: EventLogEntry[] = [
  { timestamp: Date.now() - 48_000, severity: 'info', message: 'MAVLink heartbeat — FCU connected' },
  { timestamp: Date.now() - 36_000, severity: 'info', message: 'EKF2 ready — GPS fix (11 satellites)' },
  { timestamp: Date.now() - 24_000, severity: 'info', message: 'Mode: AUTO.MISSION — 14 waypoints loaded' },
  { timestamp: Date.now() - 12_000, severity: 'warn', message: 'Battery 38% — RTL threshold approaching' },
  { timestamp: Date.now() - 4_000, severity: 'info', message: 'Waypoint 6/14 reached' },
];

const TICKS: Array<Omit<EventLogEntry, 'timestamp'>> = [
  { severity: 'info', message: 'Telemetry nominal — 250 Hz' },
  { severity: 'info', message: 'Holding altitude 4500 ft' },
  { severity: 'warn', message: 'Wind gust 12 m/s — compensating' },
  { severity: 'info', message: 'Heading capture complete' },
];

export function GcsView() {
  const [events, setEvents] = useState<EventLogEntry[]>(GCS_EVENTS);
  // Rotate the LiveMap heading so the marker turns its nose (mockMode already
  // does this off its orbit; this also demonstrates a controlled heading).

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      const tick = TICKS[i % TICKS.length]!;
      i += 1;
      setEvents((prev) => [
        ...prev.slice(-14),
        { timestamp: Date.now(), severity: tick.severity, message: tick.message },
      ]);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="demo-view">
      <div className="demo-grid-2">
        <div className="demo-card" style={{ display: 'flex', justifyContent: 'center' }}>
          <PrimaryFlightDisplay mockMode size="lg" showFlightDirector />
        </div>
        <div className="demo-card" style={{ minHeight: 320 }}>
          <h3 className="demo-card-title">LiveMap — GPS track</h3>
          <LiveMap mockMode />
        </div>
      </div>

      <div className="demo-grid-3">
        <div
          className="demo-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>
            Battery
          </h3>
          <Gauge
            mockMode
            mockProfile="ramp"
            min={0}
            max={100}
            label="Battery"
            unit="%"
            size="md"
            thresholds={[
              { value: 0, color: 'var(--vt-color-danger)' },
              { value: 20, color: 'var(--vt-color-warn)' },
              { value: 40, color: 'var(--vt-color-active)' },
            ]}
          />
        </div>

        <div className="demo-card" style={{ gridColumn: 'span 2' }}>
          <h3 className="demo-card-title">EventLog — /rosout</h3>
          <EventLog entries={events} maxEntries={20} />
        </div>
      </div>
    </div>
  );
}
