import type { PIDNodeProps, PIDStatus } from '../types';

const STATUS_COLOR: Record<PIDStatus, string> = {
  normal: 'var(--vt-color-active)',
  warning: 'var(--vt-color-warn)',
  alarm: 'var(--vt-color-danger)',
  offline: 'var(--vt-text-muted)',
};

/**
 * Single P&ID instrument symbol per the ISA 5.1 standard.
 *
 *   firstLetter — measured variable: F (flow), T (temp), P (pressure),
 *                 L (level), A (analysis).
 *   functionLetters — function: I (indicate), C (control), T (transmit),
 *                     R (record), A (alarm). Combine like "IC" (indicating
 *                     controller) or "TR" (recording transmitter).
 *
 *   location — solid circle (field), dashed circle (panel-mounted),
 *              circle-with-line (DCS / shared display).
 *
 * Designed to be composed into ProcessFlowDiagram or used standalone
 * as an inline indicator next to a value readout.
 */
export function PIDNode({
  firstLetter = 'T',
  functionLetters = 'IC',
  location = 'field',
  value,
  unit = '',
  status = 'normal',
  size = 80,
  className,
}: PIDNodeProps) {
  const r = 36;
  const cx = 50;
  const cy = 50;
  const color = STATUS_COLOR[status];

  return (
    <div
      className={['vt-component vt-pidnode', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block' }}
      role="img"
      aria-label={`${firstLetter}${functionLetters} (${location}) — ${status}${value !== undefined ? `, ${value} ${unit}` : ''}`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {/* Body — solid (field), dashed (panel), or with shared-display line (DCS). */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--vt-bg-elevated)"
          stroke={color}
          strokeWidth={location === 'panel' ? 2 : 2.5}
          strokeDasharray={location === 'panel' ? '4 3' : 'none'}
        />
        {location === 'dcs' && (
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={color} strokeWidth={1.5} />
        )}
        {/* Tag letters */}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle" fill="var(--vt-text-primary)" fontSize={16} fontFamily="monospace" fontWeight={600}
        >
          {firstLetter}{functionLetters}
        </text>
        {/* Value */}
        {value !== undefined ? (
          <text x={cx} y={cy + 14} textAnchor="middle" fill={color} fontSize={11} fontFamily="monospace">
            {Number.isFinite(value) ? value.toFixed(1) : '—'}
            {unit ? <tspan fontSize={9} dx={2}>{unit}</tspan> : null}
          </text>
        ) : (
          <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--vt-text-muted)" fontSize={9} fontFamily="sans-serif">
            {status.toUpperCase()}
          </text>
        )}
      </svg>
    </div>
  );
}
