import {
  Attitude,
  EventLog,
  Gauge,
  MultiAxisPlot,
  SignalPanel,
  TimeSeries,
  createMockDataSource,
  randomWalk,
  sineWave,
  stepFunction,
} from '@altara/core';
import type { EventLogEntry } from '@altara/core';
import { useEffect, useState } from 'react';

const SAMPLE_EVENTS: EventLogEntry[] = [
  { timestamp: Date.now() - 60_000, severity: 'info', message: 'Telemetry link established at 250 Hz' },
  { timestamp: Date.now() - 45_000, severity: 'info', message: 'Calibration complete — IMU offsets within tolerance' },
  { timestamp: Date.now() - 30_000, severity: 'warn', message: 'Battery cell #3 voltage 3.42 V approaching low threshold' },
  { timestamp: Date.now() - 22_000, severity: 'info', message: 'Mission planner loaded waypoints (n=14)' },
  { timestamp: Date.now() - 11_000, severity: 'error', message: 'GPS dropout — DOP exceeded 5.0 for 1.2 s' },
  { timestamp: Date.now() - 4_000, severity: 'info', message: 'GPS fix restored (8 satellites)' },
];

export function CoreView() {
  const [events, setEvents] = useState<EventLogEntry[]>(SAMPLE_EVENTS);

  useEffect(() => {
    const id = setInterval(() => {
      setEvents((prev) => [
        ...prev.slice(-12),
        {
          timestamp: Date.now(),
          severity: Math.random() < 0.15 ? 'warn' : 'info',
          message:
            Math.random() < 0.15
              ? 'Telemetry frame skipped — buffer overrun'
              : `Heartbeat ${new Date().toLocaleTimeString()} — link nominal`,
        },
      ]);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="demo-view">
      <div className="demo-grid-2">
        <div className="demo-card">
          <h3 className="demo-card-title">TimeSeries — multi-channel canvas</h3>
          <TimeSeries
            mockMode
            height={220}
            channels={[
              { key: 'roll', label: 'Roll', unit: '°', color: '#1D9E75' },
              { key: 'pitch', label: 'Pitch', unit: '°', color: '#378ADD' },
              { key: 'yaw', label: 'Yaw', unit: '°', color: '#D946EF' },
            ]}
          />
        </div>

        <div className="demo-card">
          <h3 className="demo-card-title">MultiAxisPlot — dual y-axis</h3>
          <MultiAxisPlot
            mockMode
            height={220}
            leftAxisLabel="Altitude (m)"
            rightAxisLabel="Speed (m/s)"
            channels={[
              { key: 'altitude', label: 'Altitude', unit: 'm', color: '#1D9E75', axis: 'left' },
              { key: 'speed', label: 'Speed', unit: 'm/s', color: '#EF9F27', axis: 'right' },
            ]}
          />
        </div>
      </div>

      <div className="demo-grid-3">
        <div className="demo-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>Gauge</h3>
          <Gauge
            mockMode
            min={0}
            max={100}
            label="Battery"
            unit="%"
            size="md"
            thresholds={[
              { value: 20, color: 'var(--vt-data-danger)' },
              { value: 40, color: 'var(--vt-data-warn)' },
            ]}
          />
        </div>

        <div className="demo-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>Attitude</h3>
          <Attitude mockMode size={200} />
        </div>

        <div className="demo-card">
          <h3 className="demo-card-title">SignalPanel</h3>
          <SignalPanel
            columns={2}
            signals={[
              {
                key: 'alt',
                label: 'Altitude',
                unit: 'm',
                dataSource: createMockDataSource({ generator: sineWave(0.1, 120), hz: 5 }),
              },
              {
                key: 'spd',
                label: 'Speed',
                unit: 'm/s',
                dataSource: createMockDataSource({ generator: sineWave(0.3, 8), hz: 5 }),
              },
              {
                key: 'hdg',
                label: 'Heading',
                unit: '°',
                dataSource: createMockDataSource({ generator: sineWave(0.05, 180), hz: 5 }),
              },
              {
                key: 'temp',
                label: 'Temp',
                unit: '°C',
                dataSource: createMockDataSource({ generator: randomWalk(0.05, 50, 0.5), hz: 5 }),
              },
              {
                key: 'sats',
                label: 'Satellites',
                unit: '',
                dataSource: createMockDataSource({ generator: stepFunction(2000, 7, 9), hz: 1 }),
              },
              {
                key: 'rssi',
                label: 'RSSI',
                unit: 'dBm',
                dataSource: createMockDataSource({ generator: randomWalk(0.05, 120, 0.5), hz: 5 }),
              },
            ]}
          />
        </div>
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">EventLog</h3>
        <EventLog entries={events} maxEntries={20} />
      </div>
    </div>
  );
}
