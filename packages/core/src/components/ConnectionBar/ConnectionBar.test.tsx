import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionBar } from './ConnectionBar';

describe('ConnectionBar', () => {
  it('renders URL, status label, latency, and rate', () => {
    const { container } = render(
      <ConnectionBar
        url="ws://localhost:9090"
        status="connected"
        latencyMs={42}
        messagesPerSecond={120}
      />,
    );
    expect(screen.getByText('ws://localhost:9090')).toBeTruthy();
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('42 ms')).toBeTruthy();
    expect(screen.getByText('120/s')).toBeTruthy();
    expect(container.querySelector('.vt-status-dot')!.getAttribute('data-status')).toBe('active');
  });

  it('maps status → dot color and label', () => {
    const cases: Array<['connecting' | 'connected' | 'disconnected' | 'error', string, string]> = [
      ['connecting', 'warn', 'Connecting'],
      ['connected', 'active', 'Connected'],
      ['disconnected', 'danger', 'Disconnected'],
      ['error', 'danger', 'Error'],
    ];
    for (const [status, dot, label] of cases) {
      const { container, unmount } = render(
        <ConnectionBar url="ws://x" status={status} latencyMs={1} messagesPerSecond={0} />,
      );
      expect(container.querySelector('.vt-status-dot')!.getAttribute('data-status')).toBe(dot);
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it('formats missing/zero metrics as em-dash and sub-millisecond', () => {
    render(<ConnectionBar url="ws://x" status="connecting" />);
    // Two metrics → two em-dashes.
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('formats large latencies into seconds and large rates as integers', () => {
    render(
      <ConnectionBar
        url="ws://x"
        status="connected"
        latencyMs={2500}
        messagesPerSecond={1234.6}
      />,
    );
    expect(screen.getByText('2.50 s')).toBeTruthy();
    expect(screen.getByText('1235/s')).toBeTruthy();
  });
});
