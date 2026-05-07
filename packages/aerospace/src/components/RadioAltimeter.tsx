import { useEffect, useRef, useState } from 'react';
import type { RadioAltimeterProps } from '../types';
import type { TelemetryValue } from '@altara/core';
import { clamp } from '../utils/tokens';

const SIZES = {
  sm: { w: 140, h: 90, font: 28 },
  md: { w: 200, h: 120, font: 40 },
  lg: { w: 260, h: 150, font: 52 },
} as const;

/**
 * Radar/radio altimeter — digital AGL display from 0 to maxAltitude
 * (default 2500 ft) with a decision-height bug. The display flashes
 * amber when the aircraft descends through DH; `onDecisionHeight` fires
 * exactly once per descent, latched until altitude rises back above.
 */
export function RadioAltimeter({
  radioAltitude: altProp,
  dataSource,
  decisionHeight,
  maxAltitude = 2500,
  onDecisionHeight,
  size = 'md',
  mockMode,
  className,
}: RadioAltimeterProps) {
  const [alt, setAlt] = useState<number>(altProp ?? maxAltitude);
  const [hasValue, setHasValue] = useState<boolean>(altProp !== undefined);
  const armed = useRef<boolean>(true);

  useEffect(() => {
    if (altProp !== undefined) {
      setAlt(altProp);
      setHasValue(true);
    }
  }, [altProp]);

  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => {
      setAlt(v.value);
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
    let value = 1800;
    let dir = -1;
    const id = setInterval(() => {
      value += dir * 8;
      if (value < 50) dir = 1;
      if (value > 1800) dir = -1;
      setAlt(value);
      setHasValue(true);
    }, 80);
    return () => clearInterval(id);
  }, [mockMode, dataSource]);

  // Decision-height callback edge: trigger once when crossing DH downward.
  useEffect(() => {
    if (decisionHeight === undefined || !hasValue) return;
    if (alt > decisionHeight + 10) armed.current = true;
    if (armed.current && alt <= decisionHeight) {
      armed.current = false;
      onDecisionHeight?.();
    }
  }, [alt, decisionHeight, hasValue, onDecisionHeight]);

  const dim = SIZES[size];
  const value = clamp(alt, 0, maxAltitude);
  const inDhZone = decisionHeight !== undefined && hasValue && value <= decisionHeight;
  const color = inDhZone ? 'var(--vt-color-warn)' : 'var(--vt-color-active)';

  // Vertical bar visualisation: grows up from the bottom (closer to ground).
  const barFrac = 1 - value / maxAltitude;

  return (
    <div
      className={['vt-component vt-radio-alt', className].filter(Boolean).join(' ')}
      style={{
        width: dim.w,
        height: dim.h,
        display: 'inline-grid',
        gridTemplateColumns: '12px 1fr',
        gap: 8,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        padding: 8,
        color: 'var(--vt-text-primary)',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
      role="img"
      aria-label={`Radio altitude: ${hasValue ? `${Math.round(alt)} feet AGL` : 'no data'}${decisionHeight !== undefined ? `, decision height ${decisionHeight}` : ''}`}
    >
      <div
        style={{
          position: 'relative',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: 2,
          border: '1px solid var(--vt-border)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${barFrac * 100}%`,
            background: color,
            transition: 'height 80ms linear',
          }}
        />
        {decisionHeight !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: -4,
              right: -4,
              bottom: `${(1 - decisionHeight / maxAltitude) * 100}%`,
              height: 2,
              background: 'var(--vt-color-warn)',
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Radio ALT
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: dim.font,
            color,
            lineHeight: 1,
          }}
        >
          {hasValue ? Math.round(value) : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--vt-text-muted)' }}>
          {decisionHeight !== undefined ? `DH ${decisionHeight} ft` : 'ft AGL'}
          {inDhZone ? ' • MINIMUMS' : ''}
        </span>
      </div>
    </div>
  );
}
