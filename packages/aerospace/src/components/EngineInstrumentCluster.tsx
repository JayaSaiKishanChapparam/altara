import { useEffect, useState } from 'react';
import type { EngineInstrumentClusterProps, EngineThresholds } from '../types';
import { clamp } from '../utils/tokens';

interface BarGaugeProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  warn?: number;
  danger?: number;
  /** When true, low values trigger warn/danger (oil pressure semantics). */
  lowSide?: boolean;
}

function statusFor(value: number, warn?: number, danger?: number, lowSide = false): 'ok' | 'warn' | 'danger' {
  if (lowSide) {
    if (danger !== undefined && value <= danger) return 'danger';
    if (warn !== undefined && value <= warn) return 'warn';
    return 'ok';
  }
  if (danger !== undefined && value >= danger) return 'danger';
  if (warn !== undefined && value >= warn) return 'warn';
  return 'ok';
}

function BarGauge({ label, unit, value, min, max, warn, danger, lowSide }: BarGaugeProps) {
  const pct = clamp((value - min) / (max - min || 1), 0, 1);
  const status = statusFor(value, warn, danger, lowSide);
  const color = status === 'danger' ? 'var(--vt-color-danger)' : status === 'warn' ? 'var(--vt-color-warn)' : 'var(--vt-color-active)';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 60px',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: 'var(--vt-bg-elevated)',
        borderRadius: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--vt-text-label)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'sans-serif',
        }}
      >
        {label}
      </span>
      <div
        style={{
          height: 10,
          background: 'rgba(0,0,0,0.4)',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid var(--vt-border)',
        }}
      >
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, transition: 'width 100ms linear' }} />
      </div>
      <span
        style={{
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 13,
          textAlign: 'right',
          color: 'var(--vt-text-primary)',
        }}
      >
        {Math.round(value)}
        <span style={{ fontSize: 10, color: 'var(--vt-text-muted)', marginLeft: 4 }}>{unit}</span>
      </span>
    </div>
  );
}

const DEFAULT_THRESHOLDS: Required<{
  rpm: { warn: number; danger: number };
  egt: { warn: number; danger: number };
  fuelFlow: { warn: number; danger: number };
  oilPressure: { warn: number; danger: number; lowWarn: number; lowDanger: number };
  oilTemp: { warn: number; danger: number };
}> = {
  rpm: { warn: 2700, danger: 3000 },
  egt: { warn: 750, danger: 850 },
  fuelFlow: { warn: 18, danger: 22 },
  oilPressure: { warn: 80, danger: 95, lowWarn: 25, lowDanger: 15 },
  oilTemp: { warn: 110, danger: 125 },
};

/**
 * Engine Instrument Cluster — RPM, EGT, fuel flow, oil pressure/temp.
 * Multi-engine variants (1, 2, 4) render side-by-side RPM/EGT columns
 * while sharing fuel and oil readouts (typical fixed-wing twin layout).
 */
export function EngineInstrumentCluster({
  rpm = 0,
  egt = 0,
  fuelFlow = 0,
  oilPressure = 0,
  oilTemp = 0,
  engineCount = 1,
  thresholds,
  mockMode,
  className,
}: EngineInstrumentClusterProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [mockMode]);

  const t = mockMode ? performance.now() / 1000 : 0;
  const sin = (hz: number, phase = 0) => Math.sin(t * hz + phase);

  const rpms = mockMode
    ? Array.from({ length: engineCount }, (_, i) => 2400 + sin(0.4, i * 0.3) * 80)
    : Array.isArray(rpm) ? rpm : [rpm];
  const egts = mockMode
    ? Array.from({ length: engineCount }, (_, i) => 690 + sin(0.3, i * 0.6) * 30)
    : Array.isArray(egt) ? egt : [egt];

  const ff = mockMode ? 11.5 + sin(0.25) * 1.2 : fuelFlow;
  const op = mockMode ? 65 + sin(0.18) * 5 : oilPressure;
  const ot = mockMode ? 90 + sin(0.15) * 4 : oilTemp;

  const th: EngineThresholds = thresholds ?? {};

  return (
    <div
      className={['vt-component vt-eic', className].filter(Boolean).join(' ')}
      data-tick={tick}
      style={{
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        padding: 12,
        color: 'var(--vt-text-primary)',
        fontFamily: 'sans-serif',
        display: 'grid',
        gap: 12,
        minWidth: 320,
      }}
      role="group"
      aria-label="Engine instrument cluster"
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${engineCount}, 1fr)`, gap: 8 }}>
        {rpms.map((v, i) => (
          <div key={`rpm-${i}`} style={{ display: 'grid', gap: 4 }}>
            <div
              style={{
                fontSize: 10,
                color: 'var(--vt-text-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: 'center',
              }}
            >
              {engineCount > 1 ? `ENG ${i + 1}` : 'ENGINE'}
            </div>
            <BarGauge
              label="RPM"
              unit=""
              value={v}
              min={0}
              max={3500}
              warn={th.rpm?.warn ?? DEFAULT_THRESHOLDS.rpm.warn}
              danger={th.rpm?.danger ?? DEFAULT_THRESHOLDS.rpm.danger}
            />
            <BarGauge
              label="EGT"
              unit="°C"
              value={egts[i] ?? 0}
              min={400}
              max={900}
              warn={th.egt?.warn ?? DEFAULT_THRESHOLDS.egt.warn}
              danger={th.egt?.danger ?? DEFAULT_THRESHOLDS.egt.danger}
            />
          </div>
        ))}
      </div>

      <BarGauge
        label="FF"
        unit="gph"
        value={ff}
        min={0}
        max={25}
        warn={th.fuelFlow?.warn ?? DEFAULT_THRESHOLDS.fuelFlow.warn}
        danger={th.fuelFlow?.danger ?? DEFAULT_THRESHOLDS.fuelFlow.danger}
      />
      <BarGauge
        label="OIL P"
        unit="psi"
        value={op}
        min={0}
        max={120}
        warn={th.oilPressure?.lowWarn ?? DEFAULT_THRESHOLDS.oilPressure.lowWarn}
        danger={th.oilPressure?.lowDanger ?? DEFAULT_THRESHOLDS.oilPressure.lowDanger}
        lowSide
      />
      <BarGauge
        label="OIL T"
        unit="°C"
        value={ot}
        min={0}
        max={140}
        warn={th.oilTemp?.warn ?? DEFAULT_THRESHOLDS.oilTemp.warn}
        danger={th.oilTemp?.danger ?? DEFAULT_THRESHOLDS.oilTemp.danger}
      />
    </div>
  );
}
