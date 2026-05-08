import { useEffect, useState } from 'react';
import type { SensorHealthMatrixProps, SensorStatus } from '../types';

const STATUS_BG = {
  active: 'rgba(29,158,117,0.15)',
  warn: 'rgba(239,159,39,0.15)',
  stale: 'rgba(95,94,90,0.18)',
  error: 'rgba(226,75,74,0.18)',
  off: 'transparent',
} as const;

const STATUS_COLOR = {
  active: 'var(--vt-color-active)',
  warn: 'var(--vt-color-warn)',
  stale: 'var(--vt-color-stale)',
  error: 'var(--vt-color-danger)',
  off: 'var(--vt-text-muted)',
} as const;

const DEFAULT_MOCK: SensorStatus[] = [
  { name: 'LiDAR (top)', topic: '/velodyne_points', expectedHz: 10, status: 'active' },
  { name: 'Camera (front)', topic: '/cam/front', expectedHz: 30, status: 'active' },
  { name: 'Camera (left)', topic: '/cam/left', expectedHz: 30, status: 'active' },
  { name: 'Camera (right)', topic: '/cam/right', expectedHz: 30, status: 'active' },
  { name: 'IMU', topic: '/imu', expectedHz: 100, status: 'active' },
  { name: 'GPS', topic: '/fix', expectedHz: 5, status: 'active' },
  { name: 'Radar (front)', topic: '/radar/front', expectedHz: 20, status: 'active' },
  { name: 'Wheel Encoder', topic: '/odom', expectedHz: 50, status: 'active' },
];

/**
 * Grid of sensor-health tiles. Each tile shows sensor name, current
 * status, expected rate, and (when available) the time since the last
 * update in seconds. Inspired by the Autoware diagnostic panel layout.
 */
export function SensorHealthMatrix({
  sensors: sensorsProp,
  staleAfterMs = 2000,
  compact = false,
  mockMode,
  className,
}: SensorHealthMatrixProps) {
  const [sensors, setSensors] = useState<SensorStatus[]>(sensorsProp ?? DEFAULT_MOCK);

  useEffect(() => { if (sensorsProp) setSensors(sensorsProp); }, [sensorsProp]);

  // mockMode: occasional dropouts on rotating sensors
  useEffect(() => {
    if (!mockMode) return;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const dropoutIdx = Math.floor(tick / 4) % DEFAULT_MOCK.length;
      const errIdx = (Math.floor(tick / 12) % DEFAULT_MOCK.length);
      const next: SensorStatus[] = DEFAULT_MOCK.map((s, i) => {
        let status: SensorStatus['status'] = 'active';
        if (i === errIdx && tick % 24 < 4) status = 'error';
        else if (i === dropoutIdx) status = 'stale';
        return { ...s, status, lastUpdate: Date.now() - (status === 'stale' ? 4000 : 200) };
      });
      setSensors(next);
    }, 700);
    return () => clearInterval(id);
  }, [mockMode]);

  const cols = compact ? sensors.length : 4;

  return (
    <div
      className={['vt-component vt-sensor-matrix', className].filter(Boolean).join(' ')}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(120px, 1fr))`,
        gap: 8,
        padding: 12,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        fontFamily: 'sans-serif',
        color: 'var(--vt-text-primary)',
      }}
      role="group"
      aria-label="Sensor health matrix"
    >
      {sensors.map((s) => {
        const status = s.status ?? (s.lastUpdate && Date.now() - s.lastUpdate > staleAfterMs ? 'stale' : 'active');
        const ageS = s.lastUpdate ? (Date.now() - s.lastUpdate) / 1000 : null;
        return (
          <div
            key={s.name}
            style={{
              padding: '8px 10px',
              background: STATUS_BG[status],
              border: `1px solid ${STATUS_COLOR[status]}`,
              borderRadius: 4,
              display: 'grid',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</span>
            {s.topic && (
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--vt-text-muted)' }}>
                {s.topic}
              </span>
            )}
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace' }}>
              <span style={{ color: STATUS_COLOR[status], textTransform: 'uppercase' }}>{status}</span>
              {s.expectedHz && (
                <span style={{ color: 'var(--vt-text-muted)' }}>{s.expectedHz} Hz</span>
              )}
            </span>
            {ageS !== null && (
              <span style={{ fontSize: 10, color: 'var(--vt-text-muted)' }}>
                {ageS < 1 ? `${Math.round(ageS * 1000)} ms ago` : `${ageS.toFixed(1)} s ago`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
