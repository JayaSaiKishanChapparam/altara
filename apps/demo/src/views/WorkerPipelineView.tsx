import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionBar,
  Gauge,
  MultiAxisPlot,
  SignalPanel,
  TimeSeries,
  createWorkerDataSource,
} from '@altara/core';
import type { AltaraDataSource, ConnectionStatus, DecimatorSubscription } from '@altara/core';

/**
 * Must match `TELEMETRY_PATH` in scripts/telemetry-server.mjs, which Vite mounts
 * on the dev and preview servers. Same origin, so the URL follows the page.
 */
const TELEMETRY_PATH = '/altara-telemetry';

const telemetryUrl = () =>
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${TELEMETRY_PATH}`;

/** The feed batches every channel into one message; hand the worker the array. */
const EXTRACTOR_SOURCE = '(m) => m.samples';

/**
 * One worker serves every chart on this tab. `decimator.acquire()` hands each
 * consumer an independent viewport, so the two plots below — different channels,
 * different widths — share one socket, one set of ring buffers, and one ingest
 * pass. The stats panel acquires a third viewport of its own, which is what the
 * numbers under "probe viewport" are measured from.
 */
const FEED_CHANNELS = [
  'gyro_x',
  'gyro_y',
  'gyro_z',
  'vibe',
  'current',
  'altitude',
  'battery',
];

/**
 * Hoisted because this view re-renders once a second to publish counters.
 * `TimeSeries` keys its rAF effect on `thresholds`, so an inline array literal
 * would tear the render loop down — and release its worker viewport — on every
 * tick, leaving the canvas blank. Same reason ReplayView hoists its own.
 */
const GYRO_THRESHOLDS = [
  { value: 100, color: 'var(--vt-color-warn)' },
  { value: -100, color: 'var(--vt-color-warn)' },
];
const BATTERY_THRESHOLDS = [
  { value: 20, color: 'var(--vt-color-danger)' },
  { value: 40, color: 'var(--vt-color-warn)' },
];

/** Channels and width the stats panel's own subscription asks for. */
const PROBE_CHANNELS = ['gyro_x', 'gyro_y', 'gyro_z', 'vibe', 'current'];
const PROBE_PLOT_W = 1000;

/** Per-channel ring-buffer capacity, inside the worker. 12 s of a 1 kHz channel. */
const BUFFER_SIZE = 12_000;
/** Visible window. At 1 kHz this is 10,000 samples per channel on screen. */
const WINDOW_MS = 10_000;

const GYRO_CHANNELS = [
  { key: 'gyro_x', label: 'Gyro X', unit: '°/s', color: '#1D9E75' },
  { key: 'gyro_y', label: 'Gyro Y', unit: '°/s', color: '#378ADD' },
  { key: 'gyro_z', label: 'Gyro Z', unit: '°/s', color: '#D946EF' },
];

const LOAD_CHANNELS = [
  { key: 'vibe', label: 'Vibration', unit: 'm/s²', color: '#EF9F27', axis: 'left' as const },
  { key: 'current', label: 'Current', unit: 'A', color: '#E24B4A', axis: 'right' as const },
];

/** Latest-value rows, and the channels they need a filtered view of. */
const SIGNAL_ROWS = [
  { key: 'altitude', label: 'Altitude', unit: 'm' },
  { key: 'current', label: 'Current', unit: 'A' },
  { key: 'gyro_x', label: 'Gyro X', unit: '°/s' },
  { key: 'vibe', label: 'Vibration', unit: 'm/s²' },
] as const;

type Mode = 'worker' | 'main';

/**
 * Where the samples come from. The *pipeline* is identical either way — real
 * Web Worker, real ring buffers, real decimation, real protocol. Only the socket
 * underneath differs.
 */
type Feed = 'probing' | 'live' | 'simulated';

/** How long to wait for the telemetry server before falling back. */
const PROBE_TIMEOUT_MS = 2_000;

/**
 * Is a telemetry server reachable on this origin? Statically hosted there is
 * none, so the tab runs the same worker against an in-worker flight model
 * instead. Resolves false rather than rejecting — a failed probe is a normal
 * outcome, not an error.
 */
function probeTelemetry(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      resolve(ok);
    };
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      resolve(false);
      return;
    }
    socket.onopen = () => done(true);
    socket.onerror = () => done(false);
    socket.onclose = () => done(false);
    setTimeout(() => done(false), PROBE_TIMEOUT_MS);
  });
}

interface Stats {
  status: ConnectionStatus;
  totalSamples: number;
  samplesPerSecond: number;
  /** Sum of `visibleCount` across the frame's channels — samples behind the plot. */
  visibleSamples: number;
  /** Sum of populated pixel columns across the frame's channels. */
  buckets: number;
  /** Which geometry encoding the worker chose, collapsed across channels. */
  encoding: string;
  frameEpoch: number | null;
  frameSeq: number | null;
  plotW: number | null;
  /** Mean interval between animation frames over the last second. */
  avgFrameMs: number;
  worstFrameMs: number;
  /** Frames that took longer than two 60 fps budgets — visible jank. */
  longFrames: number;
  /** False when rAF did not fire at all — a backgrounded tab, not a fast one. */
  framesObserved: boolean;
}

/**
 * Presents the same live source to a chart with and without the decimator
 * capability, so the two render paths can be compared on identical data.
 * `destroy` is deliberately inert: the real source outlives this view of it.
 */
function withoutDecimator(source: AltaraDataSource): AltaraDataSource {
  return {
    subscribe: (cb) => source.subscribe(cb),
    getHistory: () => source.getHistory(),
    get status() {
      return source.status;
    },
    destroy: () => {},
  };
}

/**
 * Worker pipeline tab — the only tab driven by a real socket.
 *
 * `createWorkerDataSource` spawns a worker that owns the WebSocket, the
 * per-channel ring buffers, and min/max decimation, then pushes render-ready
 * geometry. The toggle swaps the charts between that path and the local one
 * (buffer on the main thread, decimate in the draw pass) on the same 5 kHz feed,
 * and the panel reports what each costs.
 *
 * Every number below is read from the source or measured in this component —
 * nothing here is a fixed prop.
 */
export function WorkerPipelineView() {
  const [source, setSource] = useState<AltaraDataSource | null>(null);
  const [feed, setFeed] = useState<Feed>('probing');
  const [mode, setMode] = useState<Mode>('worker');
  const [stats, setStats] = useState<Stats | null>(null);
  const [url] = useState(telemetryUrl);

  // Own the source in an effect (not a memo) so StrictMode's double-mount tears
  // down the first worker instead of leaking it — same pattern as ReplayView.
  useEffect(() => {
    let cancelled = false;
    let created: AltaraDataSource | null = null;

    const spawn = (live: boolean) => {
      if (cancelled) return;
      created = createWorkerDataSource({
        url: telemetryUrl(),
        subscribeMessage: { channels: FEED_CHANNELS },
        extractorSource: EXTRACTOR_SOURCE,
        bufferSize: BUFFER_SIZE,
        flushHz: 60,
        // With no server reachable, hand `createWorkerDataSource` a worker that
        // runs the library's own body against an in-worker flight model. The
        // pipeline is unchanged; only the socket is simulated.
        ...(live
          ? {}
          : {
              workerImpl: () =>
                new Worker(new URL('../telemetry/simulatedWorker.ts', import.meta.url), {
                  type: 'module',
                }),
            }),
      });
      setSource(created);
      setFeed(live ? 'live' : 'simulated');
    };

    void probeTelemetry(telemetryUrl()).then(spawn);

    return () => {
      cancelled = true;
      created?.destroy();
      setSource(null);
      setFeed('probing');
    };
  }, []);

  // Count real inbound samples. Incremented ~5000×/s, so it is kept in a ref and
  // only lifted into state once a second — re-rendering per sample would itself
  // be the bottleneck the tab is trying to measure.
  const counter = useRef({ total: 0, since: 0, at: 0 });
  useEffect(() => {
    const bump = () => {
      counter.current.total += 1;
      counter.current.since += 1;
    };
    const off = source?.subscribe(bump);
    return () => off?.();
  }, [source]);

  // Frame pacing, measured on this component's own rAF. Runs in the same frame
  // callback list as the charts, so the deltas are what the user actually sees.
  const frames = useRef({ count: 0, total: 0, worst: 0, long: 0, last: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const f = frames.current;
      if (f.last !== 0) {
        const delta = now - f.last;
        f.count += 1;
        f.total += delta;
        if (delta > f.worst) f.worst = delta;
        if (delta > 33.4) f.long += 1;
      }
      f.last = now;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reset the pacing window when the path changes, so each arm is measured clean.
  useEffect(() => {
    frames.current = { count: 0, total: 0, worst: 0, long: 0, last: 0 };
  }, [mode]);

  // The stats panel is itself a consumer: it acquires a third viewport on the
  // same source. In main-thread mode it acquires nothing, so the worker stops
  // decimating entirely and the comparison measures one path at a time.
  const probe = useRef<DecimatorSubscription | null>(null);
  useEffect(() => {
    if (!source?.decimator || mode !== 'worker') return;
    const view = source.decimator.acquire();
    view.setViewport({
      channels: PROBE_CHANNELS,
      windowMs: WINDOW_MS,
      plotW: PROBE_PLOT_W,
    });
    probe.current = view;
    return () => {
      view.release();
      probe.current = null;
    };
  }, [source, mode]);

  // Aggregate once a second.
  useEffect(() => {
    if (!source) return;
    counter.current.at = performance.now();
    const id = setInterval(() => {
      const frame = probe.current?.getFrame() ?? null;
      const f = frames.current;

      // Divide by the interval that actually elapsed, not the 1000 ms we asked
      // for. A backgrounded tab throttles timers, and assuming 1 s there would
      // report a rate several times higher than the feed is really delivering.
      const now = performance.now();
      const elapsedSec = Math.max((now - counter.current.at) / 1000, 0.001);
      counter.current.at = now;

      let visibleSamples = 0;
      let buckets = 0;
      const encodings = new Set<string>();
      for (const c of frame?.channels ?? []) {
        visibleSamples += c.visibleCount;
        buckets += c.bucket?.length ?? 0;
        if (c.visibleCount > 0) encodings.add(c.mode);
      }

      setStats({
        status: source.status,
        totalSamples: counter.current.total,
        samplesPerSecond: Math.round(counter.current.since / elapsedSec),
        visibleSamples,
        buckets,
        encoding: encodings.size ? [...encodings].join(' + ') : '—',
        frameEpoch: frame?.epoch ?? null,
        frameSeq: frame?.seq ?? null,
        plotW: frame?.plotW ?? null,
        avgFrameMs: f.count ? f.total / f.count : 0,
        worstFrameMs: f.worst,
        longFrames: Math.round(f.long / elapsedSec),
        framesObserved: f.count > 0,
      });

      counter.current.since = 0;
      frames.current = { ...f, count: 0, total: 0, worst: 0, long: 0 };
    }, 1000);
    return () => clearInterval(id);
  }, [source, mode]);

  // Both charts read the same source; each acquires its own viewport internally.
  const chartSource = useMemo(
    () => (source ? (mode === 'worker' ? source : withoutDecimator(source)) : undefined),
    [source, mode],
  );

  // Single-channel views for the latest-value components, built once per source.
  const raw = useMemo(() => {
    const map = {} as Record<RawChannel, AltaraDataSource | undefined>;
    for (const key of RAW_CHANNELS) map[key] = source ? channelView(source, key) : undefined;
    return map;
  }, [source]);

  const decimatingInWorker = mode === 'worker' && Boolean(source?.decimator);
  const simulated = feed === 'simulated';

  return (
    <div className="demo-view">
      <div className="demo-card">
        <h3 className="demo-card-title">
          {simulated ? 'Data source — simulated' : 'Live feed — real socket, real rates'}
        </h3>
        {/* Conditional spread rather than `prop={maybeUndefined}` — the repo
            builds with exactOptionalPropertyTypes, so an explicit `undefined`
            is not the same as an absent prop. */}
        <ConnectionBar
          url={simulated ? 'simulated://in-worker-flight-model' : url}
          status={stats?.status ?? 'connecting'}
          {...(stats ? { messagesPerSecond: stats.samplesPerSecond } : {})}
        />
        {simulated && (
          <p style={{ fontSize: 13, color: 'var(--vt-text-secondary)', margin: '12px 0 0' }}>
            <strong style={{ color: 'var(--vt-color-warn)' }}>
              The data is simulated. The pipeline is not.
            </strong>{' '}
            No telemetry server is reachable on this origin, so the flight model runs
            inside the Web Worker in place of the socket. Everything downstream is the
            real library: the worker owns the ring buffers, runs the min/max decimation,
            and speaks the same epoch and single-credit protocol to the charts. The
            counters below are measured, not scripted. To drive it from an actual
            WebSocket instead, run <code>pnpm --filter @altara/demo dev</code>, which
            serves the same model over <code>{TELEMETRY_PATH}</code>.
          </p>
        )}
        {feed === 'probing' && (
          <p style={{ fontSize: 13, color: 'var(--vt-text-secondary)', margin: '12px 0 0' }}>
            Looking for a telemetry server on this origin…
          </p>
        )}
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">Decimation path</h3>
        <div className="demo-row" style={{ alignItems: 'center' }}>
          <button
            className="demo-tab"
            aria-selected={mode === 'worker'}
            onClick={() => setMode('worker')}
          >
            Worker (decimator)
          </button>
          <button
            className="demo-tab"
            aria-selected={mode === 'main'}
            onClick={() => setMode('main')}
          >
            Main thread (local)
          </button>
          <span style={{ fontSize: 13, color: 'var(--vt-text-secondary)' }}>
            {decimatingInWorker
              ? 'Both charts and this panel hold independent viewports on one worker. No raw samples reach the draw pass.'
              : 'Charts buffer every sample and decimate inside requestAnimationFrame.'}
          </span>
        </div>

        <dl className="demo-stats">
          <Stat
            label="Decimating in"
            value={decimatingInWorker ? 'Web Worker' : 'Main thread'}
            tone={decimatingInWorker ? 'good' : 'warn'}
          />
          <Stat
            label="Sample source"
            value={simulated ? 'Simulated (in worker)' : 'WebSocket'}
            {...(simulated ? { tone: 'warn' as const } : {})}
          />
          <Stat label="Samples in" value={fmtRate(stats?.samplesPerSecond)} unit="/s" />
          <Stat label="Samples received" value={fmt(stats?.totalSamples)} />
          <Stat
            label="Probe: samples in window"
            value={decimatingInWorker ? fmt(stats?.visibleSamples) : 'not reported'}
          />
          <Stat
            label="Probe: bucket columns"
            value={decimatingInWorker ? fmt(stats?.buckets) : 'n/a'}
            unit={decimatingInWorker && stats?.buckets ? ' cols' : ''}
          />
          <Stat label="Encoding" value={decimatingInWorker ? (stats?.encoding ?? '—') : 'local'} />
          <Stat
            label="Frame interval"
            value={stats && !stats.framesObserved ? 'tab inactive' : fmtMs(stats?.avgFrameMs)}
            unit={stats && !stats.framesObserved ? '' : ' ms avg'}
          />
          <Stat
            label="Worst frame"
            value={stats && !stats.framesObserved ? '—' : fmtMs(stats?.worstFrameMs)}
            unit={stats && !stats.framesObserved ? '' : ' ms'}
            tone={(stats?.worstFrameMs ?? 0) > 33.4 ? 'warn' : 'good'}
          />
          <Stat
            label="Long frames"
            value={stats && !stats.framesObserved ? '—' : fmt(stats?.longFrames)}
            unit={stats && !stats.framesObserved ? '' : ' / s'}
            tone={(stats?.longFrames ?? 0) > 0 ? 'warn' : 'good'}
          />
          <Stat
            label="Probe: epoch / seq"
            value={
              decimatingInWorker && stats?.frameSeq !== null && stats?.frameSeq !== undefined
                ? `${stats.frameEpoch} / ${stats.frameSeq}`
                : '—'
            }
          />
          <Stat
            label="Probe: width"
            value={decimatingInWorker && stats?.plotW ? `${Math.round(stats.plotW)}` : '—'}
            unit={decimatingInWorker && stats?.plotW ? ' px' : ''}
          />
          <Stat label="Window" value={String(WINDOW_MS / 1000)} unit=" s" />
        </dl>
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">
          TimeSeries — body rates, 1 kHz per channel
        </h3>
        <TimeSeries
          {...(chartSource ? { dataSource: chartSource } : {})}
          channels={GYRO_CHANNELS}
          windowMs={WINDOW_MS}
          bufferSize={BUFFER_SIZE}
          height={260}
          thresholds={GYRO_THRESHOLDS}
        />
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">MultiAxisPlot — vibration vs current draw</h3>
        <MultiAxisPlot
          {...(chartSource ? { dataSource: chartSource } : {})}
          channels={LOAD_CHANNELS}
          windowMs={WINDOW_MS}
          bufferSize={BUFFER_SIZE}
          height={240}
          leftAxisLabel="Vibration (m/s²)"
          rightAxisLabel="Current (A)"
        />
      </div>

      <div className="demo-grid-2">
        <div
          className="demo-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>
            Gauge — battery, via subscribe()
          </h3>
          <Gauge
            {...(raw.battery ? { dataSource: raw.battery } : {})}
            min={0}
            max={100}
            label="Battery"
            unit="%"
            size="md"
            thresholds={BATTERY_THRESHOLDS}
          />
        </div>

        <div className="demo-card">
          <h3 className="demo-card-title">SignalPanel — latest-value consumers</h3>
          <p style={{ fontSize: 13, color: 'var(--vt-text-secondary)', margin: '0 0 12px' }}>
            These read the raw <code>subscribe()</code> stream, which the worker keeps
            delivering unchanged. Moving decimation off the main thread did not alter
            the contract these components rely on.
          </p>
          <SignalPanel
            columns={2}
            signals={SIGNAL_ROWS.map((row) => ({
              ...row,
              ...(raw[row.key] ? { dataSource: raw[row.key]! } : {}),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Narrow a multi-channel source to one channel. `Gauge` and `SignalPanel` rows
 * take the newest value from whatever they are given, so they need the stream
 * filtered rather than routed. `destroy` is inert — the real source owns its own
 * lifetime.
 */
function channelView(source: AltaraDataSource, channel: string): AltaraDataSource {
  return {
    subscribe: (cb) =>
      source.subscribe((v) => {
        if (v.channel === channel) cb(v);
      }),
    getHistory: () => source.getHistory().filter((v) => v.channel === channel),
    get status() {
      return source.status;
    },
    destroy: () => {},
  };
}

/** Channels the latest-value components below need their own view of. */
const RAW_CHANNELS = ['battery', 'altitude', 'current', 'gyro_x', 'vibe'] as const;
type RawChannel = (typeof RAW_CHANNELS)[number];

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());
const fmtRate = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());
const fmtMs = (n: number | undefined) => (n === undefined || n === 0 ? '—' : n.toFixed(1));

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'good' | 'warn';
}) {
  const color =
    tone === 'warn'
      ? 'var(--vt-color-warn)'
      : tone === 'good'
        ? 'var(--vt-color-active)'
        : 'var(--vt-text-primary)';
  return (
    <div className="demo-stat">
      <dt>{label}</dt>
      <dd style={{ color }}>
        {value}
        {unit ? <span className="demo-stat__unit">{unit}</span> : null}
      </dd>
    </div>
  );
}
