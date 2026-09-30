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
        bufferSize: 10_000,
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

describe('createWorkerDataSource — decimator viewport protocol', () => {
  const frameFor = (
    id: string,
    epoch: number,
    seq: number,
    extra: Record<string, unknown> = {},
  ) => ({
    type: 'frame',
    id,
    epoch,
    seq,
    tMin: 1_000,
    windowMs: 30_000,
    plotW: 800,
    channels: [{ key: 'a', mode: 'points', visibleCount: 1, extent: { min: 0, max: 1 } }],
    ...extra,
  });

  const msgs = (w: FakeWorker, type: string) =>
    w.posted.filter((m) => (m as { type: string }).type === type) as Array<
      Record<string, unknown>
    >;

  it('forwards bufferSize to the worker so it can size its ring buffers', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', bufferSize: 512, workerImpl: () => w });
    expect(w.posted[0]).toMatchObject({ type: 'start', config: { bufferSize: 512 } });
    ds.destroy();
  });

  it('exposes a decimator and posts a viewport with an incrementing epoch', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    expect(ds.decimator).toBeDefined();
    const view = ds.decimator!.acquire();

    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 640 });

    expect(msgs(w, 'viewport')).toEqual([
      { type: 'viewport', id: 'v1', epoch: 1, channels: ['a'], windowMs: 30_000, plotW: 800 },
      { type: 'viewport', id: 'v1', epoch: 2, channels: ['a'], windowMs: 30_000, plotW: 640 },
    ]);
    ds.destroy();
  });

  it('ignores an unchanged viewport — ResizeObserver fires far more often than the size changes', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    const spec = { channels: ['a', 'b'], windowMs: 30_000, plotW: 800 };
    view.setViewport(spec);
    view.setViewport({ ...spec });
    view.setViewport({ ...spec });
    expect(msgs(w, 'viewport')).toHaveLength(1);

    view.setViewport({ ...spec, windowMs: 10_000 });
    expect(msgs(w, 'viewport')).toHaveLength(2);
    ds.destroy();
  });

  it('exposes the latest frame matching the current epoch', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });

    expect(view.getFrame()).toBeNull();
    w.emit(frameFor('v1', 1, 1));
    expect(view.getFrame()).toMatchObject({ epoch: 1, seq: 1 });
    w.emit(frameFor('v1', 1, 2));
    expect(view.getFrame()).toMatchObject({ seq: 2 });
    ds.destroy();
  });

  it('drops a frame decimated against a superseded viewport', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    w.emit(frameFor('v1', 1, 1));

    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 400 });
    w.emit(frameFor('v1', 1, 2, { plotW: 800 }));
    expect(view.getFrame()).toMatchObject({ epoch: 1, seq: 1 });

    w.emit(frameFor('v1', 2, 3, { plotW: 400 }));
    expect(view.getFrame()).toMatchObject({ epoch: 2, seq: 3, plotW: 400 });
    ds.destroy();
  });

  it('keeps the last good frame across a viewport change instead of blanking', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    w.emit(frameFor('v1', 1, 1));
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 400 });
    expect(view.getFrame()).not.toBeNull();
    ds.destroy();
  });

  it('acknowledges every frame including stale ones, so credit is never stranded', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    w.emit(frameFor('v1', 1, 1));
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 400 });
    w.emit(frameFor('v1', 1, 2)); // stale, dropped for rendering

    expect(msgs(w, 'ack')).toEqual([
      { type: 'ack', id: 'v1', epoch: 1, seq: 1 },
      { type: 'ack', id: 'v1', epoch: 1, seq: 2 },
    ]);
    ds.destroy();
  });

  it('acknowledges a frame for a released subscription rather than stranding its credit', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    view.release();

    // A frame already in flight when the chart unmounted.
    w.emit(frameFor('v1', 1, 1));
    expect(msgs(w, 'ack')).toEqual([{ type: 'ack', id: 'v1', epoch: 1, seq: 1 }]);
    expect(view.getFrame()).toBeNull();
    ds.destroy();
  });

  it('release posts a release envelope once and then goes quiet', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    view.release();
    view.release();
    expect(msgs(w, 'release')).toEqual([{ type: 'release', id: 'v1' }]);

    // A released handle must not resurrect itself.
    view.setViewport({ channels: ['a'], windowMs: 1, plotW: 1 });
    expect(msgs(w, 'viewport')).toHaveLength(1);
    ds.destroy();
  });

  it('stops acking and clears the frame once destroyed', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });
    w.emit(frameFor('v1', 1, 1));
    ds.destroy();

    const before = msgs(w, 'ack').length;
    w.emit(frameFor('v1', 1, 2));
    expect(msgs(w, 'ack')).toHaveLength(before);
    expect(view.getFrame()).toBeNull();
    view.setViewport({ channels: ['a'], windowMs: 1, plotW: 1 });
    expect(msgs(w, 'viewport')).toHaveLength(1);
  });

  it('leaves the raw batch path untouched while frames are flowing', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const sub = vi.fn();
    ds.subscribe(sub);
    const view = ds.decimator!.acquire();
    view.setViewport({ channels: ['a'], windowMs: 30_000, plotW: 800 });

    w.emit(frameFor('v1', 1, 1));
    w.emit({ type: 'batch', samples: [{ value: 42, timestamp: 1 }] });

    expect(sub).toHaveBeenCalledTimes(1);
    expect(ds.getHistory().map((h) => h.value)).toEqual([42]);
    ds.destroy();
  });
});

describe('createWorkerDataSource — several consumers on one source', () => {
  const msgs = (w: FakeWorker, type: string) =>
    w.posted.filter((m) => (m as { type: string }).type === type) as Array<
      Record<string, unknown>
    >;

  it('gives each consumer an independent id, epoch, and viewport', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const a = ds.decimator!.acquire();
    const b = ds.decimator!.acquire();

    a.setViewport({ channels: ['gyro_x'], windowMs: 10_000, plotW: 800 });
    b.setViewport({ channels: ['vibe', 'current'], windowMs: 30_000, plotW: 400 });

    expect(msgs(w, 'viewport')).toEqual([
      { type: 'viewport', id: 'v1', epoch: 1, channels: ['gyro_x'], windowMs: 10_000, plotW: 800 },
      {
        type: 'viewport',
        id: 'v2',
        epoch: 1,
        channels: ['vibe', 'current'],
        windowMs: 30_000,
        plotW: 400,
      },
    ]);
    ds.destroy();
  });

  it('routes frames to the consumer they were decimated for', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const a = ds.decimator!.acquire();
    const b = ds.decimator!.acquire();
    a.setViewport({ channels: ['gyro_x'], windowMs: 10_000, plotW: 800 });
    b.setViewport({ channels: ['vibe'], windowMs: 10_000, plotW: 400 });

    const mk = (id: string, seq: number, key: string, plotW: number) => ({
      type: 'frame',
      id,
      epoch: 1,
      seq,
      tMin: 0,
      windowMs: 10_000,
      plotW,
      channels: [{ key, mode: 'buckets', visibleCount: 99, extent: { min: 0, max: 1 } }],
    });

    w.emit(mk('v1', 1, 'gyro_x', 800));
    w.emit(mk('v2', 2, 'vibe', 400));

    expect(a.getFrame()?.channels[0]!.key).toBe('gyro_x');
    expect(a.getFrame()?.plotW).toBe(800);
    expect(b.getFrame()?.channels[0]!.key).toBe('vibe');
    expect(b.getFrame()?.plotW).toBe(400);
    ds.destroy();
  });

  it('one consumer resizing does not disturb the other', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const a = ds.decimator!.acquire();
    const b = ds.decimator!.acquire();
    a.setViewport({ channels: ['x'], windowMs: 10_000, plotW: 800 });
    b.setViewport({ channels: ['y'], windowMs: 10_000, plotW: 400 });

    const frame = (id: string, epoch: number, seq: number) => ({
      type: 'frame',
      id,
      epoch,
      seq,
      tMin: 0,
      windowMs: 10_000,
      plotW: 400,
      channels: [],
    });
    w.emit(frame('v2', 1, 1));
    expect(b.getFrame()).not.toBeNull();

    // `a` resizes: only its own epoch advances, and `b`'s frame still stands.
    a.setViewport({ channels: ['x'], windowMs: 10_000, plotW: 640 });
    expect(msgs(w, 'viewport').at(-1)).toMatchObject({ id: 'v1', epoch: 2 });
    expect(b.getFrame()).not.toBeNull();
    ds.destroy();
  });

  it('releasing one consumer leaves the other running', () => {
    const w = new FakeWorker();
    const ds = createWorkerDataSource({ url: 'ws://test', workerImpl: () => w });
    const a = ds.decimator!.acquire();
    const b = ds.decimator!.acquire();
    a.setViewport({ channels: ['x'], windowMs: 10_000, plotW: 800 });
    b.setViewport({ channels: ['y'], windowMs: 10_000, plotW: 400 });
    a.release();

    const frame = {
      type: 'frame',
      id: 'v2',
      epoch: 1,
      seq: 5,
      tMin: 0,
      windowMs: 10_000,
      plotW: 400,
      channels: [{ key: 'y', mode: 'points', visibleCount: 3 }],
    };
    w.emit(frame);
    expect(msgs(w, 'release')).toEqual([{ type: 'release', id: 'v1' }]);
    expect(b.getFrame()?.seq).toBe(5);
    ds.destroy();
  });
});
