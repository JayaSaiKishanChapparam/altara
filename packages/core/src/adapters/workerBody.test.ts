import { describe, expect, it } from 'vitest';
import { installWorkerBody, type SocketLike, type WorkerScopeLike } from './workerBody';
import type { DecimatedChannel, DecimatedFrame } from './types';

/** Stands in for the WebSocket the worker owns. */
class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;

  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }

  /** Test helper — deliver an inbound frame from the server. */
  deliver(data: unknown) {
    this.onmessage?.({ data });
  }
}

/**
 * Drives `installWorkerBody` with a controllable clock and flush timer so the
 * protocol can be stepped deterministically.
 */
class Harness {
  readonly posted: Array<Record<string, unknown>> = [];
  readonly socket = new FakeSocket();
  clock = 10_000;
  private flushFn: (() => void) | null = null;
  private timerLive = false;
  readonly scope: WorkerScopeLike;

  constructor() {
    const posted = this.posted;
    this.scope = {
      postMessage(msg: unknown) {
        posted.push(msg as Record<string, unknown>);
      },
      onmessage: null,
    };
    installWorkerBody(this.scope, {
      createSocket: () => this.socket,
      now: () => this.clock,
      setInterval: (fn: () => void) => {
        this.flushFn = fn;
        this.timerLive = true;
        return 1;
      },
      clearInterval: () => {
        this.timerLive = false;
      },
    });
  }

  send(msg: unknown) {
    this.scope.onmessage?.({ data: msg });
  }

  start(config: Record<string, unknown> = {}) {
    this.send({ type: 'start', config: { url: 'ws://test', flushHz: 60, ...config } });
  }

  /** Advance the flush timer one tick. */
  tick() {
    this.flushFn?.();
  }

  get timerRunning() {
    return this.timerLive;
  }

  frames(): DecimatedFrame[] {
    return this.posted.filter((m) => m.type === 'frame') as unknown as DecimatedFrame[];
  }

  lastFrame(): DecimatedFrame {
    const f = this.frames();
    return f[f.length - 1]!;
  }

  batches(): Array<{ samples: Array<{ value: number; channel?: string }> }> {
    return this.posted.filter((m) => m.type === 'batch') as unknown as Array<{
      samples: Array<{ value: number; channel?: string }>;
    }>;
  }

  ack(frame: DecimatedFrame & { id?: string }) {
    this.send({ type: 'ack', id: frame.id ?? 'v1', epoch: frame.epoch, seq: frame.seq });
  }

  viewport(
    spec: Partial<{ id: string; epoch: number; channels: string[]; windowMs: number; plotW: number }>,
  ) {
    this.send({
      type: 'viewport',
      id: 'v1',
      epoch: 1,
      channels: ['a'],
      windowMs: 1000,
      plotW: 100,
      ...spec,
    });
  }

  release(id: string) {
    this.send({ type: 'release', id });
  }

  framesFor(id: string): Array<DecimatedFrame & { id: string }> {
    return (this.frames() as Array<DecimatedFrame & { id: string }>).filter((f) => f.id === id);
  }

  /** Push `n` samples on `channel`, one per millisecond of the fake clock. */
  feed(n: number, channel?: string, value: (i: number) => number = (i) => i) {
    for (let i = 0; i < n; i++) {
      this.clock += 1;
      this.socket.deliver(
        JSON.stringify(channel ? { value: value(i), channel } : { data: value(i) }),
      );
    }
  }
}

const chan = (frame: DecimatedFrame, key: string): DecimatedChannel =>
  frame.channels.find((c) => c.key === key)!;

describe('worker body — connection and raw batch path', () => {
  it('sends the subscribe envelope on open and reports status transitions', () => {
    const h = new Harness();
    h.start({ subscribeMessage: { op: 'subscribe', topic: '/x' } });

    h.socket.onopen?.();
    expect(h.socket.sent).toEqual([JSON.stringify({ op: 'subscribe', topic: '/x' })]);
    expect(h.posted).toContainEqual({ type: 'status', value: 'connected' });

    h.socket.onerror?.();
    expect(h.posted).toContainEqual({ type: 'status', value: 'error' });
    h.socket.onclose?.();
    expect(h.posted).toContainEqual({ type: 'status', value: 'disconnected' });
  });

  it('keeps forwarding raw samples even with no viewport declared', () => {
    const h = new Harness();
    h.start();
    h.feed(3);
    h.tick();

    expect(h.batches()).toHaveLength(1);
    expect(h.batches()[0]!.samples.map((s) => s.value)).toEqual([0, 1, 2]);
    // No viewport yet, so no decimated geometry.
    expect(h.frames()).toHaveLength(0);
  });

  it('drops malformed messages without killing the socket', () => {
    const h = new Harness();
    h.start();
    h.socket.deliver('not json');
    h.socket.deliver(JSON.stringify({ data: 'not a number' }));
    h.feed(1);
    h.tick();
    expect(h.batches()[0]!.samples.map((s) => s.value)).toEqual([0]);
  });

  it('routes channel-tagged samples from an extractor returning an array', () => {
    const h = new Harness();
    h.start({
      extractorSource:
        '(m) => [{ value: m.roll, channel: "roll" }, { value: m.pitch, channel: "pitch" }]',
    });
    h.socket.deliver(JSON.stringify({ roll: 1, pitch: 2 }));
    h.tick();
    expect(h.batches()[0]!.samples).toEqual([
      { value: 1, timestamp: expect.any(Number), channel: 'roll' },
      { value: 2, timestamp: expect.any(Number), channel: 'pitch' },
    ]);
  });

  it('stop clears the timer and closes the socket', () => {
    const h = new Harness();
    h.start();
    h.send({ type: 'stop' });
    expect(h.timerRunning).toBe(false);
    expect(h.socket.closed).toBe(true);
  });
});

describe('worker body — decimated frame protocol', () => {
  it('emits a frame per flush once a viewport is declared, echoing its epoch', () => {
    const h = new Harness();
    h.start();
    h.viewport({ epoch: 7 });
    h.feed(5);
    h.tick();

    const frame = h.lastFrame();
    expect(frame.epoch).toBe(7);
    expect(frame.seq).toBe(1);
    expect(frame.plotW).toBe(100);
    expect(frame.windowMs).toBe(1000);
    // Window is derived worker-side from its own clock, never sent per frame.
    expect(frame.tMin).toBe(h.clock - 1000);
  });

  it('adopts samples buffered before the first viewport named the channel', () => {
    const h = new Harness();
    h.start();
    h.feed(4); // untagged, arrives before any viewport
    h.viewport({ channels: ['a'] });
    h.tick();

    expect(chan(h.lastFrame(), 'a').visibleCount).toBe(4);
  });

  it('sends points below one sample per column and buckets above it', () => {
    const h = new Harness();
    h.start();
    h.viewport({ plotW: 10, windowMs: 100_000 });

    h.feed(5);
    h.tick();
    const sparse = chan(h.lastFrame(), 'a');
    expect(sparse.mode).toBe('points');
    expect(Array.from(sparse.pointV!)).toEqual([0, 1, 2, 3, 4]);

    h.ack(h.lastFrame());
    h.feed(40);
    h.tick();
    const dense = chan(h.lastFrame(), 'a');
    expect(dense.mode).toBe('buckets');
    expect(dense.visibleCount).toBe(45);
    expect(dense.bucket!.length).toBeLessThanOrEqual(10);
  });

  it('bucket min/max are data-space values and preserve spikes', () => {
    const h = new Harness();
    h.start();
    h.viewport({ plotW: 2, windowMs: 100_000 });
    // A single huge spike among small values must survive decimation.
    h.feed(20, undefined, (i) => (i === 9 ? 999 : 1));
    h.tick();

    const c = chan(h.lastFrame(), 'a');
    expect(c.mode).toBe('buckets');
    expect(Math.max(...Array.from(c.maxV!))).toBe(999);
    expect(Math.min(...Array.from(c.minV!))).toBe(1);
    expect(c.extent).toEqual({ min: 1, max: 999 });
  });

  it('reports an empty channel rather than omitting it', () => {
    const h = new Harness();
    h.start();
    h.viewport({ channels: ['a', 'missing'] });
    h.feed(2, 'a');
    h.tick();

    const frame = h.lastFrame();
    expect(frame.channels.map((c) => c.key)).toEqual(['a', 'missing']);
    expect(chan(frame, 'missing').visibleCount).toBe(0);
    expect(chan(frame, 'missing').extent).toBeUndefined();
  });

  it('excludes samples that have scrolled out of the window', () => {
    const h = new Harness();
    h.start();
    h.viewport({ plotW: 1000, windowMs: 5 });
    h.feed(10, undefined, (i) => i);
    h.tick();

    // Ten samples one ms apart; the window covers [now-5, now] inclusive, so
    // the four oldest have scrolled out and the newest six remain.
    const c = chan(h.lastFrame(), 'a');
    expect(c.visibleCount).toBe(6);
    expect(Array.from(c.pointV!)).toEqual([4, 5, 6, 7, 8, 9]);
  });
});

describe('worker body — backpressure and staleness', () => {
  it('sends at most one unacknowledged frame, coalescing rather than queueing', () => {
    const h = new Harness();
    h.start();
    h.viewport({});
    h.feed(2);

    h.tick();
    expect(h.frames()).toHaveLength(1);

    // Main thread is stalled: no ack, so further flushes produce nothing.
    h.feed(2);
    h.tick();
    h.tick();
    expect(h.frames()).toHaveLength(1);

    // Once acknowledged the next flush carries the *latest* state, not a backlog.
    h.ack(h.lastFrame());
    h.tick();
    expect(h.frames()).toHaveLength(2);
    expect(chan(h.lastFrame(), 'a').visibleCount).toBe(4);
  });

  it('keeps flushing raw batches while decimated frames are blocked', () => {
    const h = new Harness();
    h.start();
    h.viewport({});
    h.feed(1);
    h.tick();

    h.feed(1);
    h.tick();
    // Frame credit is spent, but latest-value consumers still get their samples.
    expect(h.frames()).toHaveLength(1);
    expect(h.batches()).toHaveLength(2);
  });

  it('ignores an ack carrying a superseded epoch', () => {
    const h = new Harness();
    h.start();
    h.viewport({ epoch: 1 });
    h.feed(1);
    h.tick();
    const stale = h.lastFrame();

    h.viewport({ epoch: 2, plotW: 200 });
    h.tick();
    const fresh = h.lastFrame();
    expect(fresh.epoch).toBe(2);

    // A late ack for epoch 1 must not release credit held by epoch 2.
    h.send({ type: 'ack', epoch: stale.epoch, seq: stale.seq });
    h.tick();
    expect(h.frames()).toHaveLength(2);

    h.ack(fresh);
    h.tick();
    expect(h.frames()).toHaveLength(3);
  });

  it('a new viewport releases credit so a fresh frame is not blocked by an unacked stale one', () => {
    const h = new Harness();
    h.start();
    h.viewport({ epoch: 1 });
    h.feed(1);
    h.tick();
    expect(h.frames()).toHaveLength(1);

    // Never acked — but the viewport changed, so that frame is being discarded
    // by the renderer anyway and must not hold the pipeline.
    h.viewport({ epoch: 2, plotW: 250 });
    h.tick();
    expect(h.frames()).toHaveLength(2);
    expect(h.lastFrame().epoch).toBe(2);
    expect(h.lastFrame().plotW).toBe(250);
  });
});

describe('worker body — ring buffer ownership', () => {
  it('drops the oldest samples, never the newest, once capacity is reached', () => {
    const h = new Harness();
    h.start({ bufferSize: 4 });
    h.viewport({ plotW: 1000, windowMs: 1_000_000 });
    h.feed(10);
    h.tick();

    const c = chan(h.lastFrame(), 'a');
    expect(c.mode).toBe('points');
    // Capacity 4: the four most recent survive.
    expect(Array.from(c.pointV!)).toEqual([6, 7, 8, 9]);
  });

  it('buffers channels independently', () => {
    const h = new Harness();
    h.start({ extractorSource: '(m) => ({ value: m.v, channel: m.c })' });
    h.viewport({ channels: ['a', 'b'], plotW: 1000, windowMs: 1_000_000 });
    h.socket.deliver(JSON.stringify({ v: 1, c: 'a' }));
    h.socket.deliver(JSON.stringify({ v: 2, c: 'b' }));
    h.socket.deliver(JSON.stringify({ v: 3, c: 'a' }));
    h.tick();

    const frame = h.lastFrame();
    expect(Array.from(chan(frame, 'a').pointV!)).toEqual([1, 3]);
    expect(Array.from(chan(frame, 'b').pointV!)).toEqual([2]);
  });
});

describe('worker body — several viewports on one ingest stream', () => {
  it('serves each viewport its own channels and pixel width from shared buffers', () => {
    const h = new Harness();
    h.start({ extractorSource: '(m) => ({ value: m.v, channel: m.c })' });
    h.viewport({ id: 'chart-a', channels: ['a'], plotW: 100, windowMs: 100_000 });
    h.viewport({ id: 'chart-b', channels: ['b'], plotW: 40, windowMs: 100_000 });

    for (let i = 0; i < 3; i++) h.socket.deliver(JSON.stringify({ v: i, c: 'a' }));
    h.socket.deliver(JSON.stringify({ v: 9, c: 'b' }));
    h.tick();

    const a = h.framesFor('chart-a').at(-1)!;
    const b = h.framesFor('chart-b').at(-1)!;
    expect(a.channels.map((c) => c.key)).toEqual(['a']);
    expect(a.plotW).toBe(100);
    expect(Array.from(chan(a, 'a').pointV!)).toEqual([0, 1, 2]);
    expect(b.channels.map((c) => c.key)).toEqual(['b']);
    expect(b.plotW).toBe(40);
    expect(Array.from(chan(b, 'b').pointV!)).toEqual([9]);
  });

  it('two viewports over the same channel decimate independently', () => {
    const h = new Harness();
    h.start();
    // Same channel, very different widths: one buckets, the other has room for points.
    h.viewport({ id: 'wide', channels: ['a'], plotW: 1000, windowMs: 100_000 });
    h.viewport({ id: 'narrow', channels: ['a'], plotW: 4, windowMs: 100_000 });
    h.feed(40);
    h.tick();

    const wide = chan(h.framesFor('wide').at(-1)!, 'a');
    const narrow = chan(h.framesFor('narrow').at(-1)!, 'a');
    expect(wide.mode).toBe('points');
    expect(wide.visibleCount).toBe(40);
    expect(narrow.mode).toBe('buckets');
    expect(narrow.visibleCount).toBe(40);
    expect(narrow.bucket!.length).toBeLessThanOrEqual(4);
    // Same underlying samples, so the extents must agree exactly.
    expect(narrow.extent).toEqual(wide.extent);
  });

  it('credit is per viewport — one stalled consumer does not starve the other', () => {
    const h = new Harness();
    h.start();
    h.viewport({ id: 'x', channels: ['a'] });
    h.viewport({ id: 'y', channels: ['a'] });
    h.feed(2);

    h.tick();
    expect(h.framesFor('x')).toHaveLength(1);
    expect(h.framesFor('y')).toHaveLength(1);

    // Only `y` acknowledges. `x` is stalled.
    h.ack(h.framesFor('y')[0]!);
    h.tick();
    h.tick();
    expect(h.framesFor('x')).toHaveLength(1);
    expect(h.framesFor('y')).toHaveLength(2);
  });

  it('an ack naming one viewport does not release another viewport credit', () => {
    const h = new Harness();
    h.start();
    h.viewport({ id: 'x', channels: ['a'] });
    h.viewport({ id: 'y', channels: ['a'] });
    h.feed(1);
    h.tick();

    const xFrame = h.framesFor('x')[0]!;
    // Ack x's sequence number but address it to y.
    h.send({ type: 'ack', id: 'y', epoch: xFrame.epoch, seq: xFrame.seq });
    h.tick();
    expect(h.framesFor('x')).toHaveLength(1);
    expect(h.framesFor('y')).toHaveLength(1);
  });

  it('releasing one viewport stops its frames and leaves the other running', () => {
    const h = new Harness();
    h.start();
    h.viewport({ id: 'x', channels: ['a'] });
    h.viewport({ id: 'y', channels: ['a'] });
    h.feed(1);
    h.tick();
    h.ack(h.framesFor('x')[0]!);
    h.ack(h.framesFor('y')[0]!);

    h.release('x');
    h.tick();
    expect(h.framesFor('x')).toHaveLength(1);
    expect(h.framesFor('y')).toHaveLength(2);
  });

  it('replacing one viewport bumps only its own epoch', () => {
    const h = new Harness();
    h.start();
    h.viewport({ id: 'x', channels: ['a'], epoch: 1 });
    h.viewport({ id: 'y', channels: ['a'], epoch: 1 });
    h.feed(1);
    h.tick();

    h.viewport({ id: 'x', channels: ['a'], epoch: 2, plotW: 250 });
    h.ack(h.framesFor('y')[0]!);
    h.tick();

    expect(h.framesFor('x').at(-1)!.epoch).toBe(2);
    expect(h.framesFor('x').at(-1)!.plotW).toBe(250);
    expect(h.framesFor('y').at(-1)!.epoch).toBe(1);
  });

  it('stop clears every viewport', () => {
    const h = new Harness();
    h.start();
    h.viewport({ id: 'x', channels: ['a'] });
    h.viewport({ id: 'y', channels: ['a'] });
    h.feed(1);
    h.tick();
    const before = h.frames().length;

    h.send({ type: 'stop' });
    h.tick();
    expect(h.frames()).toHaveLength(before);
  });
});
