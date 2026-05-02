import { describe, expect, it, vi } from 'vitest';
import { createMqttAdapter, type MqttClientLike } from './mqtt';

type Listener = (...args: unknown[]) => void;

class FakeMqttClient implements MqttClientLike {
  listeners = new Map<string, Listener[]>();
  subscribed: string[] = [];
  ended = false;

  on(event: string, cb: Listener) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(cb);
    this.listeners.set(event, arr);
  }
  emit(event: string, ...args: unknown[]) {
    for (const cb of this.listeners.get(event) ?? []) cb(...args);
  }
  subscribe(topic: string) {
    this.subscribed.push(topic);
  }
  unsubscribe(_topic: string) {
    /* no-op */
  }
  end() {
    this.ended = true;
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createMqttAdapter', () => {
  it('subscribes to the configured topic on connect and forwards JSON values', async () => {
    const fake = new FakeMqttClient();
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'sensors/temp',
      valueExtractor: (msg) => (msg as { c: number }).c,
      connectImpl: () => fake,
    });
    await flush();
    fake.emit('connect');
    expect(fake.subscribed).toEqual(['sensors/temp']);
    expect(ds.status).toBe('connected');

    const sub = vi.fn();
    ds.subscribe(sub);
    fake.emit('message', 'sensors/temp', new TextEncoder().encode(JSON.stringify({ c: 21.4 })));
    expect(sub).toHaveBeenCalledTimes(1);
    expect(sub.mock.calls[0][0].value).toBe(21.4);
    ds.destroy();
  });

  it('decodes payloadFormat=string', async () => {
    const fake = new FakeMqttClient();
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'x',
      payloadFormat: 'string',
      valueExtractor: (msg) => Number(msg),
      connectImpl: () => fake,
    });
    await flush();
    fake.emit('connect');
    const sub = vi.fn();
    ds.subscribe(sub);
    fake.emit('message', 'x', new TextEncoder().encode('42.5'));
    expect(sub.mock.calls[0][0].value).toBe(42.5);
    ds.destroy();
  });

  it('decodes payloadFormat=binary', async () => {
    const fake = new FakeMqttClient();
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'x',
      payloadFormat: 'binary',
      valueExtractor: (msg) => (msg as Uint8Array)[0]!,
      connectImpl: () => fake,
    });
    await flush();
    fake.emit('connect');
    const sub = vi.fn();
    ds.subscribe(sub);
    fake.emit('message', 'x', new Uint8Array([7, 8, 9]));
    expect(sub.mock.calls[0][0].value).toBe(7);
    ds.destroy();
  });

  it('ignores messages on other topics and bad JSON', async () => {
    const fake = new FakeMqttClient();
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'wanted',
      valueExtractor: (m) => (m as { v: number }).v,
      connectImpl: () => fake,
    });
    await flush();
    fake.emit('connect');
    const sub = vi.fn();
    ds.subscribe(sub);
    fake.emit('message', 'other', new TextEncoder().encode(JSON.stringify({ v: 1 })));
    fake.emit('message', 'wanted', new TextEncoder().encode('not-json'));
    expect(sub).not.toHaveBeenCalled();
    ds.destroy();
  });

  it('reflects connect/reconnect/error/close on status', async () => {
    const fake = new FakeMqttClient();
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'x',
      valueExtractor: () => 1,
      connectImpl: () => fake,
    });
    await flush();
    expect(ds.status).toBe('connecting');
    fake.emit('connect');
    expect(ds.status).toBe('connected');
    fake.emit('reconnect');
    expect(ds.status).toBe('connecting');
    fake.emit('error', new Error('boom'));
    expect(ds.status).toBe('error');
    fake.emit('close');
    expect(ds.status).toBe('disconnected');
    ds.destroy();
  });

  it('keeps history bounded by bufferSize', async () => {
    const fake = new FakeMqttClient();
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'x',
      bufferSize: 2,
      valueExtractor: (m) => (m as { v: number }).v,
      connectImpl: () => fake,
    });
    await flush();
    fake.emit('connect');
    for (let i = 0; i < 5; i++) {
      fake.emit('message', 'x', new TextEncoder().encode(JSON.stringify({ v: i })));
    }
    expect(ds.getHistory().map((h) => h.value)).toEqual([3, 4]);
    ds.destroy();
  });

  it('ends the client when destroyed before connect resolves', async () => {
    const fake = new FakeMqttClient();
    let resolveConn!: (c: MqttClientLike) => void;
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'x',
      valueExtractor: () => 1,
      connectImpl: () => new Promise<MqttClientLike>((r) => (resolveConn = r)),
    });
    ds.destroy();
    resolveConn(fake);
    await flush();
    expect(fake.ended).toBe(true);
  });

  it('marks status=error when connectImpl rejects', async () => {
    const ds = createMqttAdapter({
      url: 'ws://broker',
      topic: 'x',
      valueExtractor: () => 1,
      connectImpl: () => Promise.reject(new Error('nope')),
    });
    await flush();
    expect(ds.status).toBe('error');
    ds.destroy();
  });
});
