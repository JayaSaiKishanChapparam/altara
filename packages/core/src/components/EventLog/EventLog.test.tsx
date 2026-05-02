import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventLog } from './EventLog';
import type { EventLogEntry } from '../../adapters/types';

const t0 = new Date('2025-01-01T12:00:00Z').getTime();
const e = (n: number, severity: EventLogEntry['severity'], msg: string): EventLogEntry => ({
  timestamp: t0 + n * 1000,
  severity,
  message: msg,
});

describe('EventLog', () => {
  it('renders one row per entry with severity color border', () => {
    const { container } = render(
      <EventLog
        entries={[
          e(0, 'info', 'startup'),
          e(1, 'warn', 'careful'),
          e(2, 'error', 'broken'),
        ]}
      />,
    );
    const rows = container.querySelectorAll('.vt-event-log__row');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.getAttribute('data-severity')).toBe('info');
    expect(rows[1]!.getAttribute('data-severity')).toBe('warn');
    expect(rows[2]!.getAttribute('data-severity')).toBe('error');
  });

  it('filter=warn hides info rows; filter=error hides info+warn rows', () => {
    const entries = [
      e(0, 'info', 'startup'),
      e(1, 'warn', 'careful'),
      e(2, 'error', 'broken'),
    ];
    const { container, rerender } = render(<EventLog entries={entries} filter="warn" />);
    let rows = container.querySelectorAll('.vt-event-log__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.getAttribute('data-severity')).toBe('warn');

    rerender(<EventLog entries={entries} filter="error" />);
    rows = container.querySelectorAll('.vt-event-log__row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute('data-severity')).toBe('error');
  });

  it('user can change the filter from the toolbar', () => {
    const entries = [
      e(0, 'info', 'startup'),
      e(1, 'error', 'broken'),
    ];
    const { container } = render(<EventLog entries={entries} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'error' } });
    expect(container.querySelectorAll('.vt-event-log__row')).toHaveLength(1);
  });

  it('caps the number of displayed rows at maxEntries (newest kept)', () => {
    const entries = Array.from({ length: 20 }, (_, i) => e(i, 'info', `m${i}`));
    const { container } = render(<EventLog entries={entries} maxEntries={5} />);
    const rows = container.querySelectorAll('.vt-event-log__row');
    expect(rows).toHaveLength(5);
    expect(rows[0]!.textContent).toMatch(/m15/);
    expect(rows[4]!.textContent).toMatch(/m19/);
  });

  it('exposes role=log with aria-live for assistive tech', () => {
    render(<EventLog entries={[]} />);
    const log = screen.getByRole('log');
    expect(log.getAttribute('aria-live')).toBe('polite');
  });

  it('shows visible / total count in the toolbar', () => {
    render(
      <EventLog
        entries={[e(0, 'info', 'a'), e(1, 'warn', 'b'), e(2, 'error', 'c')]}
        filter="warn"
      />,
    );
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
});
