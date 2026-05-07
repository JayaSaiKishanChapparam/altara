import { useEffect, useState } from 'react';
import type { VerticalSpeedIndicatorProps } from '../types';
import type { TelemetryValue } from '@altara/core';
import { clamp } from '../utils/tokens';

const SIZE_PX = { sm: 120, md: 180, lg: 240 } as const;
const VB = 200;
const C = VB / 2;
const R = 80;
/** VSI sweep is 270° centered at the 9-o'clock — 0 ft/min points left. */
const SWEEP_DEG = 270;
const HALF = SWEEP_DEG / 2;

function vsToAngle(vs: number, range: number): number {
  const t = clamp(vs / range, -1, 1);
  return t * HALF;
}

/** Convert "compass" degrees (0=up) into SVG x/y at radius `r`. */
function polar(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: C + Math.sin(rad) * r, y: C - Math.cos(rad) * r };
}

function arcPath(startDeg: number, endDeg: number, r = R): string {
  const a = polar(startDeg, r);
  const b = polar(endDeg, r);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/**
 * Vertical speed indicator. Arc gauge ±range ft/min. Pointer rotates
 * around the dial center; central digital readout shows the value.
 */
export function VerticalSpeedIndicator({
  vs: vsProp,
  dataSource,
  range = 2000,
  size = 'md',
  mockMode,
  className,
}: VerticalSpeedIndicatorProps) {
  const [vs, setVs] = useState<number>(vsProp ?? 0);
  const [hasValue, setHasValue] = useState<boolean>(vsProp !== undefined);

  useEffect(() => {
    if (vsProp !== undefined) {
      setVs(vsProp);
      setHasValue(true);
    }
  }, [vsProp]);

  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => {
      setVs(v.value);
      setHasValue(true);
    };
    const hist = dataSource.getHistory();
    const last = hist.length > 0 ? hist[hist.length - 1] : undefined;
    if (last) apply(last);
    const off = dataSource.subscribe(apply);
    return () => { off(); };
  }, [dataSource]);

  useEffect(() => {
    if (!mockMode || dataSource) return;
    const id = setInterval(() => {
      setVs(Math.sin(performance.now() / 1500) * 500);
      setHasValue(true);
    }, 60);
    return () => clearInterval(id);
  }, [mockMode, dataSource]);

  const px = SIZE_PX[size];
  const angle = vsToAngle(vs, range);
  const baseArc = arcPath(-HALF, HALF);

  // Tick marks every range/4
  const ticks: { deg: number; label: string; major: boolean }[] = [];
  for (let i = -4; i <= 4; i++) {
    const v = (i / 4) * range;
    ticks.push({ deg: vsToAngle(v, range), label: `${Math.abs(v) / 1000}`, major: i !== 0 });
  }

  return (
    <div
      className={['vt-component vt-vsi', className].filter(Boolean).join(' ')}
      style={{ width: px, height: px, display: 'inline-block', color: 'var(--vt-text-primary)' }}
      role="img"
      aria-label={`Vertical speed: ${hasValue ? Math.round(vs) : 'no data'} feet per minute`}
    >
      <svg viewBox={`0 0 ${VB} ${VB}`} width={px} height={px} aria-hidden="true" style={{ display: 'block' }}>
        <circle cx={C} cy={C} r={R + 8} fill="var(--vt-bg-elevated)" stroke="var(--vt-border)" strokeWidth={2} />
        <circle cx={C} cy={C} r={R} fill="#0E0F10" />
        <path d={baseArc} fill="none" stroke="var(--vt-border)" strokeWidth={6} strokeLinecap="round" />

        {ticks.map((t, i) => {
          const inner = polar(t.deg, R - 14);
          const outer = polar(t.deg, R - 4);
          const lab = polar(t.deg, R - 28);
          return (
            <g key={i}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#FFFFFF"
                strokeWidth={t.major ? 1.6 : 2}
              />
              <text x={lab.x} y={lab.y + 4} fill="#FFFFFF" fontSize={11} textAnchor="middle" fontFamily="monospace">
                {t.label}
              </text>
            </g>
          );
        })}

        {/* Up / Down annunciators */}
        <text x={C} y={C - 50} textAnchor="middle" fill="#1D9E75" fontSize={9} fontFamily="sans-serif">
          UP
        </text>
        <text x={C} y={C + 58} textAnchor="middle" fill="#E24B4A" fontSize={9} fontFamily="sans-serif">
          DOWN
        </text>

        {/* Pointer */}
        <g transform={`rotate(${angle} ${C} ${C})`}>
          <polygon
            points={`${C - 3},${C} ${C + 3},${C} ${C + 1},${C - R + 12} ${C - 1},${C - R + 12}`}
            fill="#F4D03F"
            stroke="#F4D03F"
            strokeWidth={1}
            transform={`rotate(-90 ${C} ${C})`}
          />
        </g>
        <circle cx={C} cy={C} r={4} fill="#F4D03F" />

        {/* Digital readout */}
        <text x={C} y={C + 30} textAnchor="middle" fill="#FFFFFF" fontSize={14} fontFamily="monospace">
          {hasValue ? `${Math.round(vs)}` : '—'}
        </text>
        <text x={C} y={C + 44} textAnchor="middle" fill="var(--vt-text-label)" fontSize={9} fontFamily="sans-serif">
          ft/min
        </text>
      </svg>
    </div>
  );
}
