import type { AltaraDataSource, ConnectionStatus, TelemetryValue } from '@altara/core';

/** One numeric sample in a recording. `t` is recording-relative milliseconds. */
export interface ReplaySample {
  t: number;
  c: string;
  v: number;
}

/** One event-log entry in a recording. `t` is recording-relative milliseconds. */
export interface ReplayEvent {
  t: number;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

/** The on-disk fixture format written by scripts/generate-synthetic-session.mjs. */
export interface ReplayRecording {
  version: number;
  /** Unix ms at which the session's first sample is stamped. Display only. */
  startedAt: number;
  durationMs: number;
  channels: string[];
  samples: ReplaySample[];
  events: ReplayEvent[];
}

export interface ReplayDataSourceOptions {
  /**
   * How much recording-time history `getHistory()` hands back, ending at the
   * playhead. Needs to comfortably exceed the widest chart `windowMs` on
   * screen. Default: 60_000.
   */
  historyWindowMs?: number;
  /** Restart from 0 on reaching the end. Default: true. */
  loop?: boolean;
}

export interface SeekInfo {
  playhead: number;
  /** True when the playhead moved backward — accumulating components must remount. */
  backward: boolean;
}

/** How often the transport UI is notified, in ms. Sample emission is per-frame. */
const UI_TICK_MS = 100;

/**
 * Plays a pre-generated session back through the `AltaraDataSource` interface,
 * so every Altara component drives off it unchanged.
 *
 * The bundled session is **synthetic**, not a capture off real hardware — it is
 * produced by `scripts/generate-synthetic-session.mjs` from the same mock
 * generators the live demo tabs use. The class itself is agnostic: hand it a
 * real capture in the same shape and it plays that back identically.
 *
 * ## Two timebases
 *
 * The class deliberately keeps two clocks apart:
 *
 * - **Recording time** (`playhead`, `ReplaySample.t`) — milliseconds from the
 *   start of the session. This is the scrubber's coordinate system and the
 *   only timebase the transport UI ever touches.
 * - **Wall-clock time** — what components see on `TelemetryValue.timestamp`.
 *   Every emitted sample is re-stamped to `Date.now()`-relative time.
 *
 * The re-stamp is what makes replay work at all: `TimeSeries` anchors its
 * x-axis to `Date.now()` and discards anything older than `windowMs`, so
 * samples carrying their original session timestamps would buffer correctly
 * and then render as an empty chart. Mapping recording time onto live
 * wall-clock — at the current playback `speed` — keeps that path identical to
 * live.
 *
 * The mapping is a single affine transform, rebased on every play, seek, and
 * speed change:
 *
 *   wallclock = anchorWall + (t - anchorT) / speed
 */
export class ReplayDataSource implements AltaraDataSource {
  private readonly recording: ReplayRecording;
  private readonly historyWindowMs: number;
  private readonly loop: boolean;

  private readonly subscribers = new Set<(v: TelemetryValue) => void>();
  private readonly tickListeners = new Set<(playhead: number) => void>();
  private readonly seekListeners = new Set<(info: SeekInfo) => void>();
  private readonly channelViews = new Map<string, AltaraDataSource>();

  /** Playhead in recording-relative ms. */
  private _playhead = 0;
  private _playing = false;
  private _speed = 1;
  private destroyed = false;

  /** Affine anchor: recording time `anchorT` maps to wall-clock `anchorWall`. */
  private anchorT = 0;
  private anchorWall = Date.now();

  /** Index of the next sample to emit. */
  private cursor = 0;

  private rafId: number | null = null;
  private lastUiTick = 0;

  constructor(recording: ReplayRecording, options: ReplayDataSourceOptions = {}) {
    this.recording = recording;
    this.historyWindowMs = options.historyWindowMs ?? 60_000;
    this.loop = options.loop ?? true;
    this.rebase();
  }

  // ── AltaraDataSource ──────────────────────────────────────────────────

  subscribe(callback: (value: TelemetryValue) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Playhead-windowed history, re-stamped onto wall-clock. Returns the last
   * `historyWindowMs` of recording time ending at the playhead — which is what
   * lets a freshly remounted chart repaint a scrubbed-back view.
   */
  getHistory(): TelemetryValue[] {
    // While paused the playhead is frozen but wall-clock keeps moving, so a
    // stale anchor would push history further into the past the longer the
    // pause lasts. Re-anchoring keeps the window ending at "now".
    if (!this._playing) this.rebase();

    const from = this._playhead - this.historyWindowMs;
    const start = this.firstIndexAfter(from - 1);
    const end = this.firstIndexAfter(this._playhead);
    const out: TelemetryValue[] = [];
    for (let i = start; i < end; i++) {
      const s = this.recording.samples[i]!;
      out.push({ timestamp: this.wallFor(s.t), value: s.v, channel: s.c });
    }
    return out;
  }

  get status(): ConnectionStatus {
    if (this.destroyed) return 'disconnected';
    // `ConnectionStatus` has no 'paused' member, so a paused replay reports
    // 'connecting' — the source is alive but not streaming.
    return this._playing ? 'connected' : 'connecting';
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this._playing = false;
    this.stopLoop();
    this.subscribers.clear();
    this.tickListeners.clear();
    this.seekListeners.clear();
    this.channelViews.clear();
  }

  // ── Transport ─────────────────────────────────────────────────────────

  get playhead(): number {
    return this._playhead;
  }

  get duration(): number {
    return this.recording.durationMs;
  }

  get playing(): boolean {
    return this._playing;
  }

  get speed(): number {
    return this._speed;
  }

  get events(): ReplayEvent[] {
    return this.recording.events;
  }

  play(): void {
    if (this.destroyed || this._playing) return;
    if (this._playhead >= this.duration) this.seek(0);
    this._playing = true;
    this.rebase();
    this.startLoop();
    this.notifyTick();
  }

  pause(): void {
    if (!this._playing) return;
    // Settle the playhead at exactly where wall-clock had carried it.
    this._playhead = this.computePlayhead();
    this._playing = false;
    this.rebase();
    this.stopLoop();
    this.notifyTick();
  }

  setSpeed(speed: number): void {
    if (speed <= 0 || speed === this._speed) return;
    // Settle at the current playhead under the old rate, then re-anchor so the
    // new rate applies from here forward instead of retroactively.
    if (this._playing) this._playhead = this.computePlayhead();
    this._speed = speed;
    this.rebase();
    this.notifyTick();
  }

  /**
   * Jump the playhead to a recording-relative time. Emits a snapshot of the
   * most recent sample on every channel so latest-wins components repaint
   * immediately, even while paused.
   */
  seek(t: number): void {
    if (this.destroyed) return;
    const clamped = Math.max(0, Math.min(this.duration, t));
    const backward = clamped < this._playhead;
    this._playhead = clamped;
    this.rebase();
    this.cursor = this.firstIndexAfter(clamped);
    this.emitSnapshot();
    this.notifyTick();
    for (const cb of this.seekListeners) cb({ playhead: clamped, backward });
  }

  /** Subscribe to playhead movement (throttled to ~10 Hz) for the transport UI. */
  onTick(callback: (playhead: number) => void): () => void {
    this.tickListeners.add(callback);
    return () => {
      this.tickListeners.delete(callback);
    };
  }

  /** Subscribe to seeks. `backward: true` means accumulating components must remount. */
  onSeek(callback: (info: SeekInfo) => void): () => void {
    this.seekListeners.add(callback);
    return () => {
      this.seekListeners.delete(callback);
    };
  }

  /**
   * A single-channel view onto this source, for components that read
   * `TelemetryValue.value` without inspecting `channel` (Gauge, SignalPanel).
   */
  channel(name: string): AltaraDataSource {
    return this.view([name]);
  }

  /**
   * A view restricted to `channels`. Needed by any component that doesn't
   * ignore channels it wasn't configured for — `Attitude`, for instance, routes
   * `'pitch'` and treats *everything else* as roll, so handing it the full
   * merged source would drive its roll axis from battery and GPS samples.
   * `TimeSeries` and `PrimaryFlightDisplay` drop unknown channels and can take
   * the source directly.
   *
   * Cached so the returned identity is stable across renders — components key
   * their subscribe effect on `dataSource`, and a fresh object every render
   * would resubscribe every render.
   */
  view(channels: string[]): AltaraDataSource {
    const key = channels.slice().sort().join('|');
    const cached = this.channelViews.get(key);
    if (cached) return cached;

    const allowed = new Set(channels);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const parent = this;
    const view: AltaraDataSource = {
      subscribe(callback) {
        return parent.subscribe((v) => {
          if (v.channel !== undefined && allowed.has(v.channel)) callback(v);
        });
      },
      getHistory() {
        return parent
          .getHistory()
          .filter((v) => v.channel !== undefined && allowed.has(v.channel));
      },
      get status() {
        return parent.status;
      },
      // Views don't own the recording — tearing one down must not stop replay.
      destroy() {},
    };
    this.channelViews.set(key, view);
    return view;
  }

  /** Most recent value at or before the playhead, or undefined. Used for controlled props. */
  valueAt(channel: string, t = this._playhead): number | undefined {
    const end = this.firstIndexAfter(t);
    for (let i = end - 1; i >= 0; i--) {
      const s = this.recording.samples[i]!;
      if (s.c === channel) return s.v;
    }
    return undefined;
  }

  /** Events up to the playhead, re-stamped onto wall-clock for EventLog. */
  eventsUpTo(t = this._playhead): Array<{ timestamp: number; message: string; severity: ReplayEvent['severity'] }> {
    const out = [];
    for (const e of this.recording.events) {
      if (e.t > t) break;
      out.push({ timestamp: this.wallFor(e.t), message: e.message, severity: e.severity });
    }
    return out;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Recording time -> wall-clock, under the current anchor and speed. */
  private wallFor(t: number): number {
    return this.anchorWall + (t - this.anchorT) / this._speed;
  }

  /** Pin the current playhead to the current wall-clock. */
  private rebase(): void {
    this.anchorT = this._playhead;
    this.anchorWall = Date.now();
  }

  private computePlayhead(): number {
    return Math.min(
      this.duration,
      this.anchorT + (Date.now() - this.anchorWall) * this._speed,
    );
  }

  /** First index whose sample time is strictly greater than `t`. */
  private firstIndexAfter(t: number): number {
    const samples = this.recording.samples;
    let lo = 0;
    let hi = samples.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (samples[mid]!.t <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private emit(sample: ReplaySample): void {
    const value: TelemetryValue = {
      timestamp: this.wallFor(sample.t),
      value: sample.v,
      channel: sample.c,
    };
    for (const cb of this.subscribers) cb(value);
  }

  /**
   * Emit the latest sample on each channel at or before the playhead, oldest
   * first, so latest-wins instruments land on the scrubbed-to state.
   */
  private emitSnapshot(): void {
    const pending = new Set(this.recording.channels);
    const picked: ReplaySample[] = [];
    for (let i = this.cursor - 1; i >= 0 && pending.size > 0; i--) {
      const s = this.recording.samples[i]!;
      if (!pending.has(s.c)) continue;
      pending.delete(s.c);
      picked.push(s);
    }
    for (let i = picked.length - 1; i >= 0; i--) this.emit(picked[i]!);
  }

  private startLoop(): void {
    if (this.rafId !== null || typeof window === 'undefined') return;
    const frame = () => {
      this.rafId = requestAnimationFrame(frame);
      this.step();
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private stopLoop(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private step(): void {
    if (!this._playing || this.destroyed) return;

    const next = this.computePlayhead();
    const samples = this.recording.samples;
    while (this.cursor < samples.length && samples[this.cursor]!.t <= next) {
      this.emit(samples[this.cursor]!);
      this.cursor++;
    }
    this._playhead = next;

    const now = Date.now();
    if (now - this.lastUiTick >= UI_TICK_MS) {
      this.lastUiTick = now;
      this.notifyTick();
    }

    if (next >= this.duration) {
      if (this.loop) {
        // Wrapping is a backward seek — listeners remount accumulating charts.
        this.seek(0);
      } else {
        this.pause();
      }
    }
  }

  private notifyTick(): void {
    for (const cb of this.tickListeners) cb(this._playhead);
  }
}
