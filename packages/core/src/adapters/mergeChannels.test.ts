import { describe, expect, it, vi } from 'vitest';
import type { AltaraDataSource, ConnectionStatus, TelemetryValue } from './types';
import { mergeChannels } from './mergeChannels';

/** Minimal in-memory source whose emissions and status we control. */
function fakeSource(initialHistory: TelemetryValue[] = []): AltaraDataSource & {
  emit: (v: TelemetryValue) => void;
  setStatus: (s: ConnectionStatus) => void;
  destroyed: boolean;
} {
  const subs = new Set<(v: TelemetryValue) => void>();
  const history = [...initialHistory];
  let status: ConnectionStatus = 'connected';
  let destroyed = false;
  return {
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getHistory: () => history.slice(),
    get status() {
      return status;
    },
    destroy() {
      destroyed = true;
      subs.clear();
    },
    emit(v) {
      history.push(v);
      for (const cb of subs) cb(v);
    },
    setStatus(s) {
      status = s;
    },
    get destroyed() {
      return destroyed;
    },
  };
}

describe('mergeChannels', () => {
  it('tags each source emission with its channel key', () => {
    const roll = fakeSource();
    const pitch = fakeSource();
    const merged = mergeChannels({ roll, pitch });
    const sub = vi.fn();
    merged.subscribe(sub);

    roll.emit({ timestamp: 1, value: 12 });
    pitch.emit({ timestamp: 2, value: -3 });

    expect(sub.mock.calls[0][0]).toEqual({ timestamp: 1, value: 12, channel: 'roll' });
    expect(sub.mock.calls[1][0]).toEqual({ timestamp: 2, value: -3, channel: 'pitch' });
  });

  it('overwrites any pre-existing channel on the sample with the key', () => {
    const src = fakeSource();
    const merged = mergeChannels({ heading: src });
    const sub = vi.fn();
    merged.subscribe(sub);
    src.emit({ timestamp: 1, value: 90, channel: 'something-else' });
    expect(sub.mock.calls[0][0].channel).toBe('heading');
  });

  it('replays merged history tagged and ordered by timestamp', () => {
    const roll = fakeSource([{ timestamp: 30, value: 1 }]);
    const pitch = fakeSource([{ timestamp: 10, value: 2 }, { timestamp: 20, value: 3 }]);
    const merged = mergeChannels({ roll, pitch });
    expect(merged.getHistory()).toEqual([
      { timestamp: 10, value: 2, channel: 'pitch' },
      { timestamp: 20, value: 3, channel: 'pitch' },
      { timestamp: 30, value: 1, channel: 'roll' },
    ]);
  });

  it('reports worst-of status across children', () => {
    const a = fakeSource();
    const b = fakeSource();
    const merged = mergeChannels({ a, b });
    expect(merged.status).toBe('connected');
    b.setStatus('connecting');
    expect(merged.status).toBe('connecting');
    a.setStatus('error');
    expect(merged.status).toBe('error');
  });

  it('unsubscribe stops delivery; destroy tears down every child', () => {
    const a = fakeSource();
    const b = fakeSource();
    const merged = mergeChannels({ a, b });
    const sub = vi.fn();
    const off = merged.subscribe(sub);
    off();
    a.emit({ timestamp: 1, value: 1 });
    expect(sub).not.toHaveBeenCalled();

    merged.destroy();
    expect(a.destroyed).toBe(true);
    expect(b.destroyed).toBe(true);
  });
});
