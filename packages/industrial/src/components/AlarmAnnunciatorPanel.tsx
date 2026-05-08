import { useEffect, useState } from 'react';
import type { AlarmAnnunciatorPanelProps, AlarmDef, AlarmState } from '../types';

const STATE_BG: Record<AlarmState, string> = {
  normal: 'transparent',
  warning: 'rgba(239,159,39,0.18)',
  alarm: 'rgba(226,75,74,0.22)',
  acknowledged: 'rgba(55,138,221,0.18)',
};
const STATE_BORDER: Record<AlarmState, string> = {
  normal: 'var(--vt-border)',
  warning: 'var(--vt-color-warn)',
  alarm: 'var(--vt-color-danger)',
  acknowledged: 'var(--vt-color-info)',
};

const DEFAULT_ALARMS: AlarmDef[] = [
  { id: 'pumpHigh', label: 'PUMP HIGH', priority: 1, group: 'pumps' },
  { id: 'tankLow', label: 'TANK LOW', priority: 2, group: 'tanks' },
  { id: 'valveStuck', label: 'VALVE STUCK', priority: 1, group: 'valves' },
  { id: 'tempHigh', label: 'TEMP HIGH', priority: 1, group: 'thermal' },
  { id: 'flowLow', label: 'FLOW LOW', priority: 2, group: 'flow' },
  { id: 'pressHigh', label: 'PRESS HIGH', priority: 1, group: 'pressure' },
  { id: 'levelHigh', label: 'LEVEL HIGH', priority: 2, group: 'tanks' },
  { id: 'commLost', label: 'COMM LOST', priority: 1, group: 'system' },
  { id: 'doorOpen', label: 'DOOR OPEN', priority: 3, group: 'system' },
  { id: 'estop', label: 'E-STOP', priority: 1, group: 'system' },
  { id: 'lubricLow', label: 'LUBE LOW', priority: 2, group: 'pumps' },
  { id: 'voltageLow', label: 'VOLTAGE LOW', priority: 1, group: 'system' },
];

/**
 * Industrial alarm annunciator panel. A grid of labelled tiles styled
 * after physical control-room panels. Unacknowledged `alarm` /
 * `warning` tiles blink at `flashRate` Hz. Click a tile to fire
 * `onAcknowledge`.
 */
export function AlarmAnnunciatorPanel({
  alarms: alarmsProp,
  states: statesProp,
  onAcknowledge,
  columns = 6,
  groupBy,
  flashRate = 2,
  mockMode,
  className,
}: AlarmAnnunciatorPanelProps) {
  const alarms = alarmsProp ?? (mockMode ? DEFAULT_ALARMS : []);
  const [states, setStates] = useState<Record<string, AlarmState>>(statesProp ?? {});

  useEffect(() => { if (statesProp) setStates(statesProp); }, [statesProp]);

  // mockMode: random triggers / clears.
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      setStates((prev) => {
        const next = { ...prev };
        const all = DEFAULT_ALARMS;
        // Randomly trigger 2-3 alarms; randomly clear 1.
        for (let i = 0; i < 3; i++) {
          const a = all[Math.floor(Math.random() * all.length)]!;
          const cur = next[a.id] ?? 'normal';
          if (cur === 'normal' && Math.random() < 0.4) {
            next[a.id] = a.priority === 1 ? 'alarm' : 'warning';
          }
        }
        const clearTarget = all[Math.floor(Math.random() * all.length)]!;
        if ((next[clearTarget.id] === 'alarm' || next[clearTarget.id] === 'warning') && Math.random() < 0.3) {
          next[clearTarget.id] = 'normal';
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [mockMode]);

  const visible = groupBy ? alarms.filter((a) => a.group === groupBy) : alarms;

  return (
    <>
      <style>{`
        @keyframes vt-alarm-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      <div
        className={['vt-component vt-alarms', className].filter(Boolean).join(' ')}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(96px, 1fr))`,
          gap: 6,
          padding: 12,
          background: 'var(--vt-bg-panel)',
          border: '1px solid var(--vt-border)',
          borderRadius: 6,
          fontFamily: 'sans-serif',
        }}
        role="group"
        aria-label="Industrial alarm annunciator panel"
      >
        {visible.map((a) => {
          const state = states[a.id] ?? 'normal';
          const blink = state === 'alarm' || state === 'warning';
          const dur = blink ? `${1 / Math.max(flashRate, 0.1)}s` : 'unset';
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                if (state === 'alarm' || state === 'warning') {
                  setStates((prev) => ({ ...prev, [a.id]: 'acknowledged' }));
                  onAcknowledge?.(a.id);
                }
              }}
              style={{
                background: STATE_BG[state],
                border: `1px solid ${STATE_BORDER[state]}`,
                color: 'var(--vt-text-primary)',
                padding: '12px 8px',
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textAlign: 'center',
                cursor: state === 'normal' ? 'default' : 'pointer',
                animation: blink ? `vt-alarm-blink ${dur} ease-in-out infinite` : 'none',
              }}
              aria-pressed={state === 'acknowledged'}
              aria-label={`${a.label} — ${state}`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
