import type { ConnectionBarProps, ConnectionStatus } from '../../adapters/types';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connecting: 'warn',
  connected: 'active',
  disconnected: 'danger',
  error: 'danger',
};

function formatLatency(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms)) return '—';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatRate(rate: number | undefined): string {
  if (rate === undefined || Number.isNaN(rate)) return '—';
  if (rate < 10) return `${rate.toFixed(1)}/s`;
  return `${Math.round(rate)}/s`;
}

/**
 * Persistent status strip: connection state dot + URL + latency + msg/sec.
 * Controlled component — the consumer measures latency and rate (e.g. via
 * useWebSocket + a 5s sliding window per blueprint §6.2) and feeds them in.
 */
export function ConnectionBar({
  url,
  status,
  latencyMs,
  messagesPerSecond,
  className,
}: ConnectionBarProps) {
  return (
    <div
      className={['vt-connection-bar', className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-label={`${STATUS_LABEL[status]} — ${url}`}
    >
      <span
        className="vt-status-dot"
        data-status={STATUS_DOT[status]}
        aria-hidden="true"
      />
      <span aria-label="connection status">{STATUS_LABEL[status]}</span>
      <span className="vt-connection-bar__url" title={url}>
        {url}
      </span>
      <span className="vt-connection-bar__metric" aria-label="latency">
        <span className="vt-connection-bar__metric-label">lat</span>
        {formatLatency(latencyMs)}
      </span>
      <span className="vt-connection-bar__metric" aria-label="messages per second">
        <span className="vt-connection-bar__metric-label">rate</span>
        {formatRate(messagesPerSecond)}
      </span>
    </div>
  );
}
