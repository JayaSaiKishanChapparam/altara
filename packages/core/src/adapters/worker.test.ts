import { describe, expect, it, vi } from 'vitest';
import { createWorkerDataSource, type WorkerLike } from './worker';

class FakeWorker implements WorkerLike {
  posted: unknown[] = [];
  terminated = false;
  private listeners: Array<(ev: MessageEvent) => void> = [];

  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  addEventListener(_: 'message', cb: (ev: MessageEvent) => void) {
    this.listeners.push(cb);
  }

  // Test helper — simulates the worker posting back to the main thread.
  emit(data: unknown) {
    const ev = new MessageEvent('message', { data });
    for (const cb of this.listeners) cb(ev);
  }
}

describe('createWorkerDataSource', () => {
  it('posts a start envelope with url + flushHz + subscribeMessage to the worker', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({
      url: 'ws://test',
      flushHz: 30,
      subscribeMessage: { op: 'subscribe', topic: '/x' },
      workerImpl: () => w,
    });
    expect(w.posted[0]).toEqual({
      type: 'start',
      config: {
        url: 'ws://test',
        subscribeMessage: { op: 'subscribe', topic: '/x' },
        flushHz: 30,
        extractorSource: undefined,
      },
    });
    ds.destroy();
  });

  it('starts in connecting state and reflects status messages from the worker', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    expect(ds.status).toBe('connecting');
    w.emit({ type: 'status', value: 'connected' });
    expect(ds.status).toBe('connected');
    w.emit({ type: 'status', value: 'error' });
    expect(ds.status).toBe('error');
    ds.destroy();
  });

  it('dispatches batched samples to subscribers and appends to history', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const sub = vi.fn();
    ds.subscribe(sub);
    w.emit({
      type: 'batch',
      samples: [
        { value: 1, timestamp: 100 },
        { value: 2, timestamp: 200 },
      ],
    });
    expect(sub).toHaveBeenCalledTimes(2);
    expect(ds.getHistory().map((h) => h.value)).toEqual([1, 2]);
    ds.destroy();
  });

  it('respects bufferSize when trimming history', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', bufferSize: 3, workerImpl: () => w });
    const samples = Array.from({ length: 6 }, (_, i) => ({ value: i, timestamp: i }));
    w.emit({ type: 'batch', samples });
    expect(ds.getHistory().map((h) => h.value)).toEqual([3, 4, 5]);
    ds.destroy();
  });

  it('destroy posts {type:"stop"} and terminates the worker (idempotent)', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    ds.destroy();
    expect(w.terminated).toBe(true);
    expect(w.posted.some((m) => (m as { type: string }).type === 'stop')).toBe(true);
    expect(() => ds.destroy()).not.toThrow();
    expect(ds.status).toBe('disconnected');
  });

  it('unsubscribe stops delivery to that subscriber only', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const a = vi.fn();
    const b = vi.fn();
    const offA = ds.subscribe(a);
    ds.subscribe(b);
    w.emit({ type: 'batch', samples: [{ value: 1, timestamp: 1 }] });
    offA();
    a.mockClear();
    b.mockClear();
    w.emit({ type: 'batch', samples: [{ value: 2, timestamp: 2 }] });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    ds.destroy();
  });
});
