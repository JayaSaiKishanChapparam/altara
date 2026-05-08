import { useEffect, useState } from 'react';
import type { MotorDashboardProps, MotorFault } from '../types';
import { clamp } from '../utils/tokens';

interface DialProps {
  label: string;
  value: number;
  unit: string;
  max: number;
  warn?: number;
  danger?: number;
}

function Dial({ label, value, unit, max, warn, danger }: DialProps) {
  const pct = clamp(value / max, 0, 1);
  const color = danger !== undefined && value >= danger
    ? 'var(--vt-color-danger)'
    : warn !== undefined && value >= warn
      ? 'var(--vt-color-warn)'
      : 'var(--vt-color-active)';
  // 270° sweep arc gauge
  const r = 32;
  const cx = 40;
  const cy = 40;
  const start = -135;
  const sweep = 270;
  const tot = 2 * Math.PI * r;
  // sweep length proportional to 270/360
  const arcLen = tot * (sweep / 360);
  const dash = arcLen * pct;
  return (
    <div style={{ textAlign: 'center', minWidth: 110 }}>
      <svg viewBox="0 0 80 80" width={100} height={100} aria-hidden="true">
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke="var(--vt-border)" strokeWidth={6}
          strokeDasharray={`${arcLen} ${tot}`}
          transform={`rotate(${start + 90} ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="butt"
          strokeDasharray={`${dash} ${tot}`}
          transform={`rotate(${start + 90} ${cx} ${cy})`}
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="var(--vt-text-primary)" fontSize={14} fontFamily="monospace" fontWeight={600}>
          {value.toFixed(0)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--vt-text-muted)" fontSize={8} fontFamily="sans-serif">
          {unit}
        </text>
      </svg>
      <div style={{ fontSize: 10, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Comprehensive motor health dashboard — RPM, torque, current,
 * temperature in four arc gauges plus an active-fault log. Used in
 * CNC machines, robotics actuators, and conveyor systems.
 */
export function MotorDashboard({
  rpm: rpmProp,
  torque: torqueProp,
  current: currProp,
  temperature: tempProp,
  faults: faultsProp,
  ratedRPM = 3000,
  ratedCurrent = 10,
  mockMode,
  className,
}: MotorDashboardProps) {
  const [rpm, setRpm] = useState(rpmProp ?? 0);
  const [torque, setTorque] = useState(torqueProp ?? 0);
  const [current, setCurrent] = useState(currProp ?? 0);
  const [temp, setTemp] = useState(tempProp ?? 25);
  const [faults, setFaults] = useState<MotorFault[]>(faultsProp ?? []);

  useEffect(() => { if (rpmProp !== undefined) setRpm(rpmProp); }, [rpmProp]);
  useEffect(() => { if (torqueProp !== undefined) setTorque(torqueProp); }, [torqueProp]);
  useEffect(() => { if (currProp !== undefined) setCurrent(currProp); }, [currProp]);
  useEffect(() => { if (tempProp !== undefined) setTemp(tempProp); }, [tempProp]);
  useEffect(() => { if (faultsProp) setFaults(faultsProp); }, [faultsProp]);

  // mockMode: startup ramp + thermal alarm episode
  useEffect(() => {
    if (!mockMode) return;
    const t0 = performance.now();
    let cycle = 0;
    const id = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const phase = (t / 12) % 1;
      // Ramp 0 → rated and steady-state idle around ratedRPM*0.7
      const ramp = phase < 0.25 ? phase * 4 : 1;
      setRpm(ratedRPM * 0.7 * ramp + Math.sin(t * 0.5) * 50);
      setTorque(8 + Math.sin(t * 0.4) * 1.5);
      setCurrent(ratedCurrent * 0.6 + Math.sin(t * 0.6) * 0.8);
      setTemp(40 + ramp * 30 + (phase > 0.85 ? 25 : 0));
      // Trigger a fault around the thermal spike
      if (phase > 0.86 && cycle === 0) {
        cycle = 1;
        setFaults([{ code: 'OT_001', description: 'Winding over-temperature', timestamp: Date.now() }]);
      }
      if (phase < 0.05 && cycle === 1) { cycle = 0; setFaults([]); }
    }, 80);
    return () => clearInterval(id);
  }, [mockMode, ratedRPM, ratedCurrent]);

  return (
    <div
      className={['vt-component vt-motor', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-grid',
        gap: 10,
        padding: 12,
        minWidth: 480,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        fontFamily: 'sans-serif',
        color: 'var(--vt-text-primary)',
      }}
      role="group"
      aria-label="Motor dashboard"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Dial label="RPM" value={rpm} unit="rpm" max={ratedRPM * 1.2} warn={ratedRPM * 0.95} danger={ratedRPM * 1.05} />
        <Dial label="Torque" value={torque} unit="Nm" max={20} warn={15} danger={18} />
        <Dial label="Current" value={current} unit="A" max={ratedCurrent * 1.5} warn={ratedCurrent * 0.95} danger={ratedCurrent * 1.1} />
        <Dial label="Temp" value={temp} unit="°C" max={120} warn={85} danger={105} />
      </div>
      <div
        style={{
          padding: 8,
          background: 'var(--vt-bg-elevated)',
          border: '1px solid var(--vt-border)',
          borderRadius: 4,
          minHeight: 60,
        }}
      >
        <div style={{ fontSize: 10, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          Faults
        </div>
        {faults.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--vt-text-muted)' }}>None active</div>
        ) : (
          faults.map((f) => (
            <div key={f.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11 }}>
              <span style={{ color: 'var(--vt-color-danger)', fontFamily: 'monospace' }}>{f.code}</span>
              <span style={{ color: 'var(--vt-text-primary)' }}>{f.description}</span>
              <span style={{ color: 'var(--vt-text-muted)', fontFamily: 'monospace', fontSize: 10 }}>
                {new Date(f.timestamp).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
