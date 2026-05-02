import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EventLogEntry, EventLogProps } from '../../adapters/types';

const SEVERITY_RANK: Record<EventLogEntry['severity'], number> = {
  info: 0,
  warn: 1,
  error: 2,
};

function passesFilter(entry: EventLogEntry, filter: NonNullable<EventLogProps['filter']>) {
  if (filter === 'all') return true;
  if (filter === 'warn') return SEVERITY_RANK[entry.severity] >= SEVERITY_RANK.warn;
  return SEVERITY_RANK[entry.severity] >= SEVERITY_RANK.error;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Scrollable timestamped event log. Auto-scrolls to the latest entry only
 * while the user is already pinned to the bottom — scroll up to pause,
 * scroll back down to resume (blueprint §6.2).
 */
export function EventLog({
  entries,
  maxEntries = 500,
  filter: filterProp = 'all',
  className,
}: EventLogProps) {
  const [filter, setFilter] = useState<NonNullable<EventLogProps['filter']>>(filterProp);
  useEffect(() => setFilter(filterProp), [filterProp]);

  const visible = useMemo(() => {
    const filtered = entries.filter((e) => passesFilter(e, filter));
    if (filtered.length > maxEntries) return filtered.slice(filtered.length - maxEntries);
    return filtered;
  }, [entries, maxEntries, filter]);

  const listRef = useRef<HTMLUListElement>(null);
  const pinnedRef = useRef(true);
  const lastVisibleLengthRef = useRef(0);

  // Track whether user has scrolled away from the bottom.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
      pinnedRef.current = distanceToBottom <= 4;
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, []);

  // After paint: if a new entry arrived and the user is pinned, scroll down.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (visible.length > lastVisibleLengthRef.current && pinnedRef.current) {
      list.scrollTop = list.scrollHeight;
    }
    lastVisibleLengthRef.current = visible.length;
  }, [visible.length]);

  return (
    <div
      className={['vt-event-log', className].filter(Boolean).join(' ')}
      role="log"
      aria-live="polite"
      aria-label="Event log"
    >
      <div className="vt-event-log__toolbar">
        <label>
          severity{' '}
          <select
            className="vt-event-log__filter"
            value={filter}
            onChange={(e) =>
              setFilter(e.currentTarget.value as NonNullable<EventLogProps['filter']>)
            }
          >
            <option value="all">all</option>
            <option value="warn">warn+</option>
            <option value="error">error only</option>
          </select>
        </label>
        <span style={{ marginLeft: 'auto' }}>
          {visible.length} / {entries.length}
        </span>
      </div>
      <ul className="vt-event-log__list" ref={listRef}>
        {visible.map((entry, i) => (
          <li
            key={`${entry.timestamp}-${i}`}
            className="vt-event-log__row"
            data-severity={entry.severity}
          >
            <span className="vt-event-log__time">{formatTime(entry.timestamp)}</span>
            <span className="vt-event-log__message">{entry.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
