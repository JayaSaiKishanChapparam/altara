import { useEffect, useState } from 'react';
import type { FuelGaugeProps, FuelTank } from '../types';
import { clamp } from '../utils/tokens';

const DEFAULT_MOCK_TANKS: FuelTank[] = [
  { id: 'L', label: 'L MAIN', quantity: 36, capacity: 60 },
  { id: 'C', label: 'CTR', quantity: 8, capacity: 40 },
  { id: 'R', label: 'R MAIN', quantity: 38, capacity: 60 },
];

function statusFor(qty: number, cap: number, lowWarn: number, lowDanger: number): 'ok' | 'warn' | 'danger' {
  const pct = qty / (cap || 1);
  if (pct <= lowDanger) return 'danger';
  if (pct <= lowWarn) return 'warn';
  return 'ok';
}

const STATUS_COLOR = {
  ok: 'var(--vt-color-active)',
  warn: 'var(--vt-color-warn)',
  danger: 'var(--vt-color-danger)',
} as const;

/**
 * Per-tank fuel quantity bar gauges with a totaliser. Tanks render in
 * declaration order; status colour reflects each tank's fraction of
 * capacity. The totaliser is the sum of all tanks; when `reserve` is
 * given it draws a horizontal threshold line on the totaliser bar.
 */
export function FuelGauge({
  tanks,
  unit = 'gal',
  reserve,
  lowWarn = 0.2,
  lowDanger = 0.1,
  mockMode,
  className,
}: FuelGaugeProps) {
  const [mockState, setMockState] = useState<FuelTank[]>(DEFAULT_MOCK_TANKS);

  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      setMockState((prev) =>
        prev.map((t) => ({ ...t, quantity: Math.max(0, t.quantity - 0.05 - Math.random() * 0.05) })),
      );
    }, 800);
    return () => clearInterval(id);
  }, [mockMode]);

  // Reset mock state if user toggles mockMode back on after burnout.
  useEffect(() => {
    if (mockMode) {
      setMockState((prev) => {
        const totalEmpty = prev.reduce((acc, t) => acc + t.quantity, 0) <= 0.5;
        return totalEmpty ? DEFAULT_MOCK_TANKS : prev;
      });
    }
  }, [mockMode]);

  const live: FuelTank[] = mockMode ? mockState : tanks ?? [];
  const total = live.reduce((acc, t) => acc + t.quantity, 0);
  const totalCap = live.reduce((acc, t) => acc + t.capacity, 0);

  return (
    <div
      className={['vt-component vt-fuel', className].filter(Boolean).join(' ')}
      style={{
        display: 'grid',
        gap: 6,
        padding: 12,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        color: 'var(--vt-text-primary)',
        fontFamily: 'sans-serif',
        minWidth: 280,
      }}
      role="group"
      aria-label={`Fuel: total ${total.toFixed(1)} ${unit}`}
    >
      {live.map((t) => {
        const pct = clamp(t.quantity / (t.capacity || 1), 0, 1);
        const status = statusFor(t.quantity, t.capacity, lowWarn, lowDanger);
        return (
          <div
            key={t.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr 80px',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
              background: 'var(--vt-bg-elevated)',
              borderRadius: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: 'var(--vt-text-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {t.label}
            </span>
            <div
              style={{
                height: 14,
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--vt-border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct * 100}%`,
                  height: '100%',
                  background: STATUS_COLOR[status],
                  transition: 'width 250ms ease-out, background 250ms',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
                textAlign: 'right',
              }}
            >
              {t.quantity.toFixed(1)}
              <span style={{ fontSize: 10, color: 'var(--vt-text-muted)', marginLeft: 4 }}>
                / {t.capacity}
              </span>
            </span>
          </div>
        );
      })}

      {/* Totaliser */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '70px 1fr 80px',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          background: '#0E0F10',
          border: '1px solid var(--vt-border)',
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Total
        </span>
        <div
          style={{
            position: 'relative',
            height: 16,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid var(--vt-border)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(totalCap > 0 ? total / totalCap : 0) * 100}%`,
              height: '100%',
              background: 'var(--vt-color-info)',
            }}
          />
          {reserve !== undefined && totalCap > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${clamp(reserve / totalCap, 0, 1) * 100}%`,
                width: 2,
                background: 'var(--vt-color-warn)',
              }}
              aria-hidden="true"
            />
          )}
        </div>
        <span
          style={{
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 14,
            textAlign: 'right',
            fontWeight: 600,
          }}
        >
          {total.toFixed(1)}
          <span style={{ fontSize: 10, color: 'var(--vt-text-muted)', marginLeft: 4 }}>{unit}</span>
        </span>
      </div>
    </div>
  );
}
