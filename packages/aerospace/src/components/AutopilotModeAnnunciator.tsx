import { useEffect, useState } from 'react';
import type { AutopilotModeAnnunciatorProps, FmaModes, FmaStatus } from '../types';

const STATUS_BG: Record<FmaStatus, string> = {
  active: 'rgba(29,158,117,0.18)',
  armed: 'rgba(55,138,221,0.18)',
  caution: 'rgba(239,159,39,0.20)',
  off: 'transparent',
};
const STATUS_FG: Record<FmaStatus, string> = {
  active: '#1D9E75',
  armed: '#37D3E0',
  caution: '#EF9F27',
  off: '#7A7872',
};

const ORDER: Array<keyof FmaModes> = ['autothrottle', 'lateral', 'vertical', 'ap', 'fd'];
const ORDER_LABELS: Record<keyof FmaModes, string> = {
  autothrottle: 'A/T',
  lateral: 'LAT',
  vertical: 'VRT',
  ap: 'AP',
  fd: 'FD',
};

function Tile({ slotLabel, modeLabel, status }: { slotLabel: string; modeLabel: string; status: FmaStatus }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 2,
        padding: '6px 10px',
        minWidth: 72,
        background: STATUS_BG[status],
        border: `1px solid ${status === 'off' ? 'var(--vt-border)' : STATUS_FG[status]}`,
        borderRadius: 4,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 9, color: 'var(--vt-text-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {slotLabel}
      </span>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 600,
          color: STATUS_FG[status],
          letterSpacing: '0.04em',
        }}
      >
        {modeLabel || '—'}
      </span>
    </div>
  );
}

const MOCK_SEQUENCE: FmaModes[] = [
  {
    autothrottle: { label: 'SPD', status: 'active' },
    lateral: { label: 'HDG', status: 'active' },
    vertical: { label: 'VS', status: 'active' },
    ap: { label: 'AP1', status: 'active' },
    fd: { label: 'FD', status: 'active' },
  },
  {
    autothrottle: { label: 'SPD', status: 'active' },
    lateral: { label: 'NAV', status: 'armed' },
    vertical: { label: 'ALT', status: 'armed' },
    ap: { label: 'AP1', status: 'active' },
    fd: { label: 'FD', status: 'active' },
  },
  {
    autothrottle: { label: 'THR', status: 'active' },
    lateral: { label: 'LOC', status: 'active' },
    vertical: { label: 'GS', status: 'armed' },
    ap: { label: 'AP1', status: 'active' },
    fd: { label: 'FD', status: 'active' },
  },
  {
    autothrottle: { label: 'IDLE', status: 'caution' },
    lateral: { label: 'ROLL', status: 'caution' },
    vertical: { label: 'PITCH', status: 'caution' },
    ap: { label: 'OFF', status: 'off' },
    fd: { label: 'FD', status: 'armed' },
  },
];

/**
 * Flight mode annunciator strip — mirrors the FMA at the top of a
 * Boeing/Airbus/G1000 PFD. Each slot shows armed (cyan) vs active
 * (green) vs caution (amber). Off slots are dim.
 */
export function AutopilotModeAnnunciator({ modes, mockMode, className }: AutopilotModeAnnunciatorProps) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => setStep((n) => (n + 1) % MOCK_SEQUENCE.length), 2200);
    return () => clearInterval(id);
  }, [mockMode]);

  const live: FmaModes | undefined = mockMode ? MOCK_SEQUENCE[step] : modes;

  return (
    <div
      className={['vt-component vt-fma', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        gap: 6,
        padding: 6,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        fontFamily: 'sans-serif',
      }}
      role="group"
      aria-label="Autopilot flight mode annunciator"
    >
      {ORDER.map((slot) => {
        const m = live?.[slot];
        return (
          <Tile
            key={slot}
            slotLabel={ORDER_LABELS[slot]}
            modeLabel={m?.label ?? ''}
            status={m?.status ?? 'off'}
          />
        );
      })}
    </div>
  );
}
