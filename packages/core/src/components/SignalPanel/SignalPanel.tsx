import { useEffect, useReducer, useRef } from 'react';
import type {
  AltaraDataSource,
  SignalPanelProps,
  SignalPanelSignal,
  TelemetryValue,
} from '../../adapters/types';

type SignalState = 'active' | 'warn' | 'danger' | 'stale' | 'neutral';

interface SignalSnapshot {
  value: TelemetryValue | null;
  flashSeq: number;
}

function classifySignal(
  signal: SignalPanelSignal,
  snapshot: SignalSnapshot,
  now: number,
  staleAfterMs: number,
): SignalState {
  if (!snapshot.value) return 'neutral';
  if (now - snapshot.value.timestamp > staleAfterMs) return 'stale';
  const direction = signal.thresholdDirection ?? 'above';
  const v = snapshot.value.value;
  const breaches = (threshold: number) =>
    direction === 'above' ? v >= threshold : v <= threshold;
  if (signal.dangerAt !== undefined && breaches(signal.dangerAt)) return 'danger';
  if (signal.warnAt !== undefined && breaches(signal.warnAt)) return 'warn';
  return 'active';
}

function formatValue(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

/**
 * Compact grid of named telemetry values. Every signal owns its own
 * subscription; the row dot turns amber/red on threshold breach and gray
 * once a sample is older than `staleAfterMs` (blueprint §6.1).
 *
 * Hot path: subscriptions write directly into a ref (no re-render per
 * sample) and a single setState bumps a tick counter which invalidates
 * memoised dot/value computations during the next animation frame.
 */
export function SignalPanel({
  signals,
  staleAfterMs = 5000,
  columns = 1,
  className,
}: SignalPanelProps) {
  const snapshotsRef = useRef<Record<string, SignalSnapshot>>({});
  const [, tick] = useReducer((n: number) => (n + 1) % 1_000_000, 0);

  // (Re)subscribe whenever the signal list changes.
  useEffect(() => {
    snapshotsRef.current = {};
    const unsubs: Array<() => void> = [];

    for (const signal of signals) {
      snapshotsRef.current[signal.key] = { value: null, flashSeq: 0 };
      const ds = signal.dataSource as AltaraDataSource | undefined;
      if (!ds) continue;
      // Replay the last sample so the row paints with data immediately.
      const history = ds.getHistory();
      const last = history.length > 0 ? history[history.length - 1]! : null;
      if (last) {
        snapshotsRef.current[signal.key] = { value: last, flashSeq: 0 };
      }
      const off = ds.subscribe((v) => {
        const prev = snapshotsRef.current[signal.key] ?? { value: null, flashSeq: 0 };
        snapshotsRef.current[signal.key] = { value: v, flashSeq: prev.flashSeq + 1 };
        tick();
      });
      unsubs.push(off);
    }

    return () => {
      for (const off of unsubs) off();
    };
  }, [signals]);

  // Periodic re-render so stale detection updates even when no new samples arrive.
  useEffect(() => {
    if (staleAfterMs <= 0) return;
    const id = setInterval(tick, Math.max(staleAfterMs / 2, 250));
    return () => clearInterval(id);
  }, [staleAfterMs]);

  const now = Date.now();

  return (
    <div
      className={['vt-signal-panel', className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="group"
      aria-label="Telemetry signals"
    >
      {signals.map((signal) => {
        const snap = snapshotsRef.current[signal.key] ?? { value: null, flashSeq: 0 };
        const state = classifySignal(signal, snap, now, staleAfterMs);
        const valueText = formatValue(snap.value?.value);
        return (
          <div
            key={signal.key}
            className="vt-signal-row"
            data-flash={snap.flashSeq > 0 ? 'true' : 'false'}
            // Re-key the animation by sequence so a CSS keyframe replays on every update.
            style={{ animationName: snap.flashSeq > 0 ? 'vt-flash' : undefined }}
            aria-label={`${signal.label} ${valueText}${signal.unit ? ' ' + signal.unit : ''}`}
          >
            <span className="vt-signal-row__label">{signal.label}</span>
            <span className="vt-signal-row__value">
              {valueText}
              {signal.unit ? <span className="vt-signal-row__unit"> {signal.unit}</span> : null}
            </span>
            <span
              className="vt-status-dot"
              data-status={state === 'neutral' ? 'stale' : state}
              aria-label={`status ${state}`}
              role="status"
            />
          </div>
        );
      })}
    </div>
  );
}
