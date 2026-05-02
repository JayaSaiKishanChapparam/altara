import { useEffect, useState } from 'react';
import type { GaugeProps, Threshold } from '../../adapters/types';
import { sineWave } from '../../utils/mockData';

const SIZE_PX = { sm: 120, md: 180, lg: 240 } as const;
const VIEWBOX = 200;
const CENTER = VIEWBOX / 2;
const RADIUS = 80;
/** Sweep spans from −135° to +135° (270° total — open at the bottom). */
const SWEEP_DEGREES = 270;
const HALF_SWEEP = SWEEP_DEGREES / 2;

/** Convert "compass" degrees (0°=up, clockwise positive) to an SVG coordinate. */
function polar(angleDeg: number, r = RADIUS): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

function arcPath(startDeg: number, endDeg: number, r = RADIUS): string {
  const start = polar(startDeg, r);
  const end = polar(endDeg, r);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function valueToAngle(value: number, min: number, max: number): number {
  const t = clamp((value - min) / (max - min || 1), 0, 1);
  return -HALF_SWEEP + t * SWEEP_DEGREES;
}

function thresholdSegments(thresholds: Threshold[] | undefined, min: number, max: number) {
  if (!thresholds?.length) return [];
  // Sort by value; each segment runs from this threshold to the next (or to max).
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  const segments: Array<{ from: number; to: number; color: string }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]!;
    const next = sorted[i + 1];
    const from = valueToAngle(t.value, min, max);
    const to = valueToAngle(next ? next.value : max, min, max);
    if (to > from) segments.push({ from, to, color: t.color });
  }
  return segments;
}

/**
 * Analog-style gauge. SVG arc 135°→45° (270° sweep, open at the bottom).
 * The needle uses the SVG `transform` attribute (`rotate(angle cx cy)`)
 * so the rotation pivot is unambiguous in user coords across browsers
 * — CSS `transform` on an SVG `<g>` requires `transform-box: view-box`
 * for that to work consistently, which has spotty browser support.
 *
 * Smooth motion comes from the data source itself emitting at 30+ Hz
 * rather than from a CSS transition (which only animates CSS-property
 * transforms, not the SVG attribute).
 */
export function Gauge({
  dataSource,
  min,
  max,
  unit,
  label,
  thresholds,
  size = 'md',
  mockMode,
  className,
}: GaugeProps) {
  const [value, setValue] = useState<number>(() => (min + max) / 2);
  const [hasValue, setHasValue] = useState(false);

  // Real data source subscription.
  useEffect(() => {
    if (!dataSource) return;
    const last = dataSource.getHistory().at(-1);
    if (last) {
      setValue(last.value);
      setHasValue(true);
    }
    const off = dataSource.subscribe((v) => {
      setValue(v.value);
      setHasValue(true);
    });
    return () => {
      off();
    };
  }, [dataSource]);

  // mockMode: animate needle back-and-forth across the full range.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const amp = (max - min) / 2;
    const center = (min + max) / 2;
    const gen = sineWave(0.25, amp);
    const id = setInterval(() => {
      setValue(center + gen(performance.now()));
      setHasValue(true);
    }, 50);
    return () => clearInterval(id);
  }, [mockMode, dataSource, min, max]);

  const sizePx = SIZE_PX[size];
  const angle = valueToAngle(value, min, max);
  const segments = thresholdSegments(thresholds, min, max);
  const baseArc = arcPath(-HALF_SWEEP, HALF_SWEEP);

  return (
    <div
      className={['vt-gauge', className].filter(Boolean).join(' ')}
      style={{ width: sizePx, height: sizePx }}
      role="img"
      aria-label={`${label ?? 'Gauge'}: ${hasValue ? value.toFixed(2) : 'no data'}${unit ? ' ' + unit : ''}`}
    >
      <svg
        className="vt-gauge__svg"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={sizePx}
        height={sizePx}
        aria-hidden="true"
      >
        <path
          d={baseArc}
          fill="none"
          stroke="var(--vt-border)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {segments.map((s, i) => (
          <path
            key={i}
            d={arcPath(s.from, s.to)}
            fill="none"
            stroke={s.color}
            strokeWidth={12}
            strokeLinecap="butt"
          />
        ))}
        {/* Needle. Drawn pointing straight up, rotated via the SVG transform
            attribute so the pivot (CENTER, CENTER) is in user coords. */}
        <g transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
          <line
            x1={CENTER}
            y1={CENTER}
            x2={CENTER}
            y2={CENTER - RADIUS + 8}
            stroke="var(--vt-text-primary)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER} r={6} fill="var(--vt-text-primary)" />
        </g>
        {label ? (
          <text
            className="vt-gauge__label"
            x={CENTER}
            y={CENTER + 26}
            textAnchor="middle"
          >
            {label}
          </text>
        ) : null}
        <text
          className="vt-gauge__value"
          x={CENTER}
          y={CENTER + 52}
          textAnchor="middle"
          fontSize={20}
        >
          {hasValue ? value.toFixed(1) : '—'}
          {unit ? <tspan fontSize={12} dx={4}>{unit}</tspan> : null}
        </text>
      </svg>
    </div>
  );
}
