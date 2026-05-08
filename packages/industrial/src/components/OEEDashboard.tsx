import { useEffect, useState } from 'react';
import type { OEEDashboardProps, OEELoss } from '../types';
import { clamp } from '../utils/tokens';

const RING_R = 40;
const RING_C = 50;
const RING_CIRC = 2 * Math.PI * RING_R;

interface RingProps {
  label: string;
  value: number;
  target: number;
}

function Ring({ label, value, target }: RingProps) {
  const v = clamp(value, 0, 1);
  const dash = RING_CIRC * v;
  const status = v >= target ? '#1D9E75' : v >= target - 0.1 ? '#EF9F27' : '#E24B4A';
  return (
    <div style={{ textAlign: 'center', minWidth: 110 }}>
      <svg viewBox="0 0 100 100" width={110} height={110} aria-hidden="true">
        <circle cx={RING_C} cy={RING_C} r={RING_R} fill="none" stroke="var(--vt-border)" strokeWidth={8} />
        <circle
          cx={RING_C} cy={RING_C} r={RING_R}
          fill="none" stroke={status} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${dash} ${RING_CIRC}`}
          transform={`rotate(-90 ${RING_C} ${RING_C})`}
        />
        <text x={RING_C} y={RING_C - 2} textAnchor="middle" fill="var(--vt-text-primary)" fontSize={18} fontFamily="monospace" fontWeight={600}>
          {Math.round(v * 100)}
        </text>
        <text x={RING_C} y={RING_C + 14} textAnchor="middle" fill="var(--vt-text-muted)" fontSize={9} fontFamily="sans-serif">
          %
        </text>
      </svg>
      <div style={{ fontSize: 10, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  );
}

function Pareto({ losses }: { losses: OEELoss[] }) {
  if (!losses.length) return null;
  const sorted = [...losses].sort((a, b) => b.minutes - a.minutes);
  const max = sorted[0]!.minutes || 1;
  const totalShown = sorted.slice(0, 5);
  return (
    <div style={{ display: 'grid', gap: 4, padding: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Loss Pareto
      </div>
      {totalShown.map((l) => (
        <div key={l.category} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 50px', gap: 6, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--vt-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.category}
          </span>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--vt-border)', borderRadius: 1 }}>
            <div style={{ width: `${(l.minutes / max) * 100}%`, height: '100%', background: 'var(--vt-color-warn)' }} />
          </div>
          <span style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: 'var(--vt-text-primary)' }}>
            {l.minutes}m
          </span>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_LOSSES: OEELoss[] = [
  { category: 'Changeover', minutes: 42 },
  { category: 'Material wait', minutes: 28 },
  { category: 'Minor stops', minutes: 22 },
  { category: 'Speed loss', minutes: 18 },
  { category: 'Defects', minutes: 9 },
];

/**
 * Overall Equipment Effectiveness dashboard. OEE = availability ×
 * performance × quality. Renders three ring gauges plus a Pareto of
 * loss categories — the universal manufacturing KPI in one panel.
 */
export function OEEDashboard({
  availability: aProp,
  performance: pProp,
  quality: qProp,
  oeeTarget = 0.85,
  lossCategories,
  shift,
  mockMode,
  className,
}: OEEDashboardProps) {
  const [a, setA] = useState(aProp ?? 1);
  const [p, setP] = useState(pProp ?? 1);
  const [q, setQ] = useState(qProp ?? 1);

  useEffect(() => { if (aProp !== undefined) setA(aProp); }, [aProp]);
  useEffect(() => { if (pProp !== undefined) setP(pProp); }, [pProp]);
  useEffect(() => { if (qProp !== undefined) setQ(qProp); }, [qProp]);

  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      setA(0.86 + Math.sin(t * 0.05) * 0.06);
      setP(0.78 + Math.sin(t * 0.07 + 0.4) * 0.08);
      setQ(0.94 + Math.sin(t * 0.03 + 1.0) * 0.04);
    }, 800);
    return () => clearInterval(id);
  }, [mockMode]);

  const oee = a * p * q;
  const losses = lossCategories ?? (mockMode ? DEFAULT_LOSSES : []);

  return (
    <div
      className={['vt-component vt-oee', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-grid',
        gap: 12,
        padding: 12,
        minWidth: 520,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        color: 'var(--vt-text-primary)',
        fontFamily: 'sans-serif',
      }}
      role="group"
      aria-label={`OEE dashboard — overall ${(oee * 100).toFixed(1)}%`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          OEE {(oee * 100).toFixed(1)}%
          <span style={{ fontSize: 10, color: 'var(--vt-text-muted)', marginLeft: 8, fontWeight: 400 }}>
            target {Math.round(oeeTarget * 100)}%
          </span>
        </span>
        {shift && (
          <span style={{ fontSize: 10, color: 'var(--vt-text-muted)' }}>
            Shift: {shift}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-around' }}>
        <Ring label="Availability" value={a} target={oeeTarget} />
        <Ring label="Performance" value={p} target={oeeTarget} />
        <Ring label="Quality" value={q} target={oeeTarget} />
      </div>
      <Pareto losses={losses} />
    </div>
  );
}
