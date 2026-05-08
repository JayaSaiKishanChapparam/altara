import { useEffect, useState } from 'react';
import type { PredictiveMaintenanceGaugeProps, HealthContributor } from '../types';
import { clamp } from '../utils/tokens';

const SIZE_PX = { sm: 200, md: 260, lg: 320 } as const;

const DEFAULT_CONTRIBUTORS: HealthContributor[] = [
  { name: 'Vibration RMS', score: 78, weight: 0.4 },
  { name: 'Temperature trend', score: 86, weight: 0.3 },
  { name: 'Current signature', score: 71, weight: 0.2 },
  { name: 'Acoustic emission', score: 92, weight: 0.1 },
];

function statusColor(score: number): string {
  if (score < 40) return 'var(--vt-color-danger)';
  if (score < 70) return 'var(--vt-color-warn)';
  return 'var(--vt-color-active)';
}

/**
 * Predictive-maintenance health-index gauge. Combines weighted
 * contributor scores into a single 0..100 health number, plus an
 * estimated remaining-useful-life readout with confidence band.
 *
 * `healthScore` is treated as authoritative if provided; otherwise
 * we compute it from `contributors` as the weighted sum.
 */
export function PredictiveMaintenanceGauge({
  healthScore: scoreProp,
  rulDays: rulProp,
  confidence,
  contributors: contributorsProp,
  lastMaintenance,
  nextScheduled,
  size = 'md',
  mockMode,
  className,
}: PredictiveMaintenanceGaugeProps) {
  const [contributors, setContributors] = useState<HealthContributor[]>(
    contributorsProp ?? (mockMode ? DEFAULT_CONTRIBUTORS : []),
  );
  const [score, setScore] = useState<number | undefined>(scoreProp);
  const [rul, setRul] = useState<number | undefined>(rulProp);

  useEffect(() => { if (contributorsProp) setContributors(contributorsProp); }, [contributorsProp]);
  useEffect(() => { if (scoreProp !== undefined) setScore(scoreProp); }, [scoreProp]);
  useEffect(() => { if (rulProp !== undefined) setRul(rulProp); }, [rulProp]);

  // mockMode: gradual degradation
  useEffect(() => {
    if (!mockMode) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const decay = Math.max(0, 90 - t * 0.6);
      const next = DEFAULT_CONTRIBUTORS.map((c, i) => ({
        ...c,
        score: Math.max(0, Math.min(100, decay + Math.sin(t * 0.4 + i) * 6 + i * -2)),
      }));
      setContributors(next);
      const total = next.reduce((acc, c) => acc + c.score * c.weight, 0);
      setScore(total);
      setRul(Math.max(0, Math.round((total / 100) * 90)));
    }, 800);
    return () => clearInterval(id);
  }, [mockMode]);

  const computed = score !== undefined
    ? score
    : contributors.reduce((acc, c) => acc + c.score * c.weight, 0);
  const v = clamp(computed, 0, 100);
  const color = statusColor(v);
  const px = SIZE_PX[size];

  // Arc gauge — 270° sweep starting at -135°
  const r = 70;
  const cx = 100;
  const cy = 100;
  const totalArc = (270 / 360) * 2 * Math.PI * r;
  const dash = totalArc * (v / 100);

  return (
    <div
      className={['vt-component vt-predmaint', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-grid',
        gap: 8,
        padding: 12,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        fontFamily: 'sans-serif',
        color: 'var(--vt-text-primary)',
        minWidth: px,
      }}
      role="img"
      aria-label={`Predictive maintenance — health ${v.toFixed(0)} / 100${rul !== undefined ? `, RUL ${rul} days` : ''}`}
    >
      <svg viewBox="0 0 200 180" width={px} height={(px * 180) / 200} aria-hidden="true">
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke="var(--vt-border)" strokeWidth={10}
          strokeDasharray={`${totalArc} 999`} transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="butt"
          strokeDasharray={`${dash} 999`} transform={`rotate(135 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={32} fontFamily="monospace" fontWeight={600}>
          {v.toFixed(0)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--vt-text-muted)" fontSize={10} fontFamily="sans-serif">
          health index
        </text>
        {rul !== undefined && (
          <text x={cx} y={cy + 38} textAnchor="middle" fill="var(--vt-text-primary)" fontSize={13} fontFamily="monospace">
            RUL {rul} d
            {confidence !== undefined && (
              <tspan fill="var(--vt-text-muted)" fontSize={10} dx={4}>±{confidence}</tspan>
            )}
          </text>
        )}
      </svg>

      {contributors.length > 0 && (
        <div style={{ display: 'grid', gap: 3 }}>
          {contributors.map((c) => (
            <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 36px', gap: 6, alignItems: 'center', fontSize: 10 }}>
              <span style={{ color: 'var(--vt-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--vt-border)', borderRadius: 1 }}>
                <div style={{ width: `${clamp(c.score, 0, 100)}%`, height: '100%', background: statusColor(c.score) }} />
              </div>
              <span style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                {c.score.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {(lastMaintenance || nextScheduled) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--vt-text-muted)', borderTop: '1px solid var(--vt-border)', paddingTop: 6 }}>
          {lastMaintenance && <span>Last: {lastMaintenance}</span>}
          {nextScheduled && <span>Next: {nextScheduled}</span>}
        </div>
      )}
    </div>
  );
}
