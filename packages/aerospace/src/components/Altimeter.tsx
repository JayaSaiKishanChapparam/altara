import { useEffect, useState } from 'react';
import type { AltimeterProps } from '../types';
import type { TelemetryValue } from '@altara/core';

const SIZE_PX = { sm: 120, md: 180, lg: 240 } as const;

/**
 * Drum-and-pointer altimeter rendered in SVG. The hundreds pointer
 * sweeps around the dial; the drums show thousands and tens-of-feet
 * digits. Kollsman setting is shown in the side window.
 */
export function Altimeter({
  altitude: altProp,
  dataSource,
  altimeterSetting = 29.92,
  groundElevation = 0,
  showAGL = false,
  size = 'md',
  mockMode,
  className,
}: AltimeterProps) {
  const [altitude, setAltitude] = useState<number>(altProp ?? 0);
  const [hasValue, setHasValue] = useState<boolean>(altProp !== undefined);

  useEffect(() => {
    if (altProp !== undefined) {
      setAltitude(altProp);
      setHasValue(true);
    }
  }, [altProp]);

  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => {
      setAltitude(v.value);
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
      const t = performance.now() / 1000;
      // Climb from 1500 to 5500 ft and back, slowly.
      setAltitude(3500 + Math.sin(t * 0.1) * 2000);
      setHasValue(true);
    }, 50);
    return () => clearInterval(id);
  }, [mockMode, dataSource]);

  const px = SIZE_PX[size];
  const VB = 200;
  const C = VB / 2;
  const R = 88;

  // Hundreds-of-feet pointer: 0–1000 → 0–360°.
  const hundreds = ((altitude % 1000) + 1000) % 1000;
  const angle = (hundreds / 1000) * 360;
  const thousands = Math.floor(altitude / 1000);
  const agl = altitude - groundElevation;

  return (
    <div
      className={['vt-component vt-altimeter', className].filter(Boolean).join(' ')}
      style={{ width: px, height: showAGL ? px + 28 : px, display: 'inline-block', color: 'var(--vt-text-primary)' }}
      role="img"
      aria-label={`Altimeter: ${hasValue ? Math.round(altitude) : 'no data'} feet, setting ${altimeterSetting.toFixed(2)}`}
    >
      <svg viewBox={`0 0 ${VB} ${VB}`} width={px} height={px} aria-hidden="true" style={{ display: 'block' }}>
        {/* Bezel */}
        <circle cx={C} cy={C} r={R + 6} fill="var(--vt-bg-elevated)" stroke="var(--vt-border)" strokeWidth={2} />
        <circle cx={C} cy={C} r={R} fill="#0E0F10" stroke="var(--vt-border)" strokeWidth={1} />
        {/* Tick marks at every 50 ft (every 18°) */}
        {Array.from({ length: 20 }).map((_, i) => {
          const a = (i * 18 - 90) * (Math.PI / 180);
          const major = i % 2 === 0;
          const r1 = R - 4;
          const r2 = major ? R - 16 : R - 10;
          return (
            <line
              key={i}
              x1={C + Math.cos(a) * r1}
              y1={C + Math.sin(a) * r1}
              x2={C + Math.cos(a) * r2}
              y2={C + Math.sin(a) * r2}
              stroke="#FFFFFF"
              strokeWidth={major ? 1.6 : 1}
            />
          );
        })}
        {/* Numeric labels at hundreds */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i * 36 - 90) * (Math.PI / 180);
          const lr = R - 26;
          return (
            <text
              key={i}
              x={C + Math.cos(a) * lr}
              y={C + Math.sin(a) * lr + 5}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={14}
              fontFamily="monospace"
            >
              {i}
            </text>
          );
        })}

        {/* Thousands drum */}
        <rect x={C - 30} y={C - 6} width={36} height={24} fill="#000" stroke="#FFFFFF" />
        <text x={C - 12} y={C + 11} textAnchor="middle" fill="#FFFFFF" fontSize={16} fontFamily="monospace">
          {hasValue ? thousands : '—'}
        </text>
        {/* Kollsman window */}
        <rect x={C + 20} y={C - 6} width={48} height={20} fill="#000" stroke="#FFFFFF" />
        <text x={C + 44} y={C + 9} textAnchor="middle" fill="#1D9E75" fontSize={11} fontFamily="monospace">
          {altimeterSetting.toFixed(2)}
        </text>

        {/* Hundreds pointer */}
        <g transform={`rotate(${angle} ${C} ${C})`}>
          <polygon
            points={`${C - 4},${C - R + 14} ${C + 4},${C - R + 14} ${C + 2},${C + 12} ${C - 2},${C + 12}`}
            fill="#FFFFFF"
            stroke="#FFFFFF"
            strokeWidth={1}
          />
        </g>
        <circle cx={C} cy={C} r={4} fill="#FFFFFF" />

        {/* Label */}
        <text x={C} y={VB - 18} textAnchor="middle" fill="var(--vt-text-label)" fontSize={10} fontFamily="sans-serif">
          ALT FEET
        </text>
      </svg>
      {showAGL && (
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--vt-font-mono, monospace)',
            fontSize: 12,
            color: 'var(--vt-text-muted)',
            paddingTop: 4,
          }}
        >
          AGL {hasValue ? `${Math.round(agl)} ft` : '—'}
        </div>
      )}
    </div>
  );
}
