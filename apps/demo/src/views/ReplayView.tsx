import { useEffect, useMemo, useState } from 'react';
import { Attitude, EventLog, Gauge, LiveMap, SignalPanel, TimeSeries } from '@altara/core';
import { PrimaryFlightDisplay } from '@altara/aerospace';
import { ReplayDataSource } from '../replay/ReplayDataSource';
import type { ReplayRecording } from '../replay/ReplayDataSource';

const FIXTURE_URL = `${import.meta.env.BASE_URL}replay/synthetic-session.json`;
const SPEEDS = [0.5, 1, 2] as const;

// Hoisted because the transport re-renders this view ~10x/second. TimeSeries
// keys its rAF effect on `thresholds` and `fps`, so an inline array literal
// would tear the render loop down and reallocate its scratch buffers on every
// tick — which also blanks the canvas until the next frame.
const TS_CHANNELS = [
  { key: 'roll', label: 'Roll', unit: '°' },
  { key: 'pitch', label: 'Pitch', unit: '°' },
];
const TS_THRESHOLDS = [
  { value: 30, color: 'var(--vt-color-warn)' },
  { value: -30, color: 'var(--vt-color-warn)' },
];
const GAUGE_THRESHOLDS = [
  { value: 0, color: 'var(--vt-color-danger)' },
  { value: 20, color: 'var(--vt-color-warn)' },
  { value: 40, color: 'var(--vt-color-active)' },
];

function formatClock(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * Replay tab — the GCS four-up driven entirely by a synthetic session instead
 * of mockMode. One `ReplayDataSource` feeds every component; the transport
 * below works in recording-relative time.
 *
 * Two component families need different handling on a backward scrub:
 *
 * - **Latest-wins** (PFD, Attitude, Gauge, SignalPanel) read the newest sample
 *   into a ref and repaint from it. `seek()` emits a per-channel snapshot, so
 *   they snap to the scrubbed-to state with no remount.
 * - **Accumulating** (TimeSeries, and LiveMap's GPS track) append into an
 *   internal buffer that never self-clears. They're keyed on `chartEpoch`,
 *   which bumps on every backward seek, so React remounts them and they
 *   re-seed cleanly from `getHistory()`.
 */
export function ReplayView() {
  const [recording, setRecording] = useState<ReplayRecording | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<ReplayDataSource | null>(null);

  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  // Bumped on every backward seek to remount accumulating components.
  const [chartEpoch, setChartEpoch] = useState(0);

  // Load the bundled fixture.
  useEffect(() => {
    let cancelled = false;
    fetch(FIXTURE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${FIXTURE_URL}`);
        return r.json() as Promise<ReplayRecording>;
      })
      .then((data) => {
        if (!cancelled) setRecording(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Own the source in an effect (not a memo) so StrictMode's double-mount
  // tears down the first instance and leaves a live second one.
  useEffect(() => {
    if (!recording) return;
    const s = new ReplayDataSource(recording);
    setSource(s);
    setPlayhead(0);
    s.play();
    setPlaying(true);
    setSpeed(s.speed);
    return () => {
      s.destroy();
      setSource(null);
      setPlaying(false);
    };
  }, [recording]);

  // Transport UI wiring.
  useEffect(() => {
    if (!source) return;
    const offTick = source.onTick(setPlayhead);
    const offSeek = source.onSeek(({ backward }) => {
      if (backward) setChartEpoch((n) => n + 1);
    });
    return () => {
      offTick();
      offSeek();
    };
  }, [source]);

  // Controlled-prop values for LiveMap, resolved at the playhead. `valueAt`
  // returns a stable number between samples, so these memos keep the position
  // object identity stable and LiveMap only extends its track on real motion.
  const lat = source?.valueAt('lat', playhead);
  const lng = source?.valueAt('lng', playhead);
  const mapHeading = source?.valueAt('mapHeading', playhead);
  const position = useMemo(
    () => (lat !== undefined && lng !== undefined ? { lat, lng } : undefined),
    [lat, lng],
  );

  // Rebuild the entries array only when the visible event set actually
  // changes, not on every 10 Hz tick.
  const eventCount = source ? source.events.filter((e) => e.t <= playhead).length : 0;
  const events = useMemo(
    () => source?.eventsUpTo(playhead) ?? [],
    // `playhead` is deliberately excluded — `eventCount` is the meaningful edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, eventCount],
  );

  const signals = useMemo(
    () =>
      source
        ? [
            { key: 'airspeed', label: 'Airspeed', unit: 'kt', dataSource: source.channel('airspeed') },
            { key: 'altitude', label: 'Altitude', unit: 'ft', dataSource: source.channel('altitude') },
            { key: 'vs', label: 'Vertical speed', unit: 'fpm', dataSource: source.channel('vs') },
            { key: 'heading', label: 'Heading', unit: '°', dataSource: source.channel('heading') },
          ]
        : [],
    [source],
  );

  const duration = source?.duration ?? 0;

  const handleToggle = () => {
    if (!source) return;
    if (source.playing) {
      source.pause();
      setPlaying(false);
    } else {
      source.play();
      setPlaying(true);
    }
  };

  const handleSpeed = (next: number) => {
    if (!source) return;
    source.setSpeed(next);
    setSpeed(next);
  };

  const handleScrub = (next: number) => {
    if (!source) return;
    source.seek(next);
  };

  if (loadError) {
    return (
      <div className="demo-view">
        <div className="demo-card">
          <h3 className="demo-card-title">Replay</h3>
          <p style={{ color: 'var(--vt-color-danger)', margin: 0 }}>
            Could not load the synthetic session: {loadError}
          </p>
          <p style={{ color: 'var(--vt-text-secondary)', marginBottom: 0 }}>
            Regenerate it with <code>node scripts/generate-synthetic-session.mjs</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="demo-view">
        <div className="demo-card">
          <h3 className="demo-card-title">Replay</h3>
          <p style={{ color: 'var(--vt-text-secondary)', margin: 0 }}>
            Loading synthetic session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-view">
      <div className="demo-card">
        <h3 className="demo-card-title">
          Transport — synthetic session ({(duration / 1000).toFixed(0)}s)
        </h3>
        <div className="demo-row" style={{ alignItems: 'center' }}>
          <button className="demo-tab" onClick={handleToggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>

          {SPEEDS.map((s) => (
            <button
              key={s}
              className="demo-tab"
              aria-selected={speed === s}
              onClick={() => handleSpeed(s)}
            >
              {s}×
            </button>
          ))}

          <input
            type="range"
            min={0}
            max={duration}
            step={100}
            value={playhead}
            onChange={(e) => handleScrub(Number(e.target.value))}
            aria-label="Scrub playhead"
            style={{ flex: '1 1 240px', minWidth: 200, accentColor: 'var(--vt-color-info)' }}
          />

          <span
            style={{
              fontFamily: 'var(--vt-font-mono, monospace)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--vt-text-secondary)',
              minWidth: 110,
              textAlign: 'right',
            }}
          >
            {formatClock(playhead)} / {formatClock(duration)}
          </span>
        </div>
      </div>

      <div className="demo-grid-2">
        <div className="demo-card" style={{ display: 'flex', justifyContent: 'center' }}>
          <PrimaryFlightDisplay dataSource={source} size="lg" showFlightDirector />
        </div>
        <div className="demo-card">
          <h3 className="demo-card-title">LiveMap — synthetic GPS track</h3>
          {/* `.vt-live-map` is height:100%, so Leaflet needs an ancestor with a
              definite height — a min-height alone lets the map grow unbounded. */}
          <div style={{ height: 420 }}>
            <LiveMap
              key={`map-${chartEpoch}`}
              {...(position ? { position } : {})}
              {...(mapHeading !== undefined ? { heading: mapHeading } : {})}
            />
          </div>
        </div>
      </div>

      <div className="demo-grid-3">
        <div
          className="demo-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>
            Battery
          </h3>
          <Gauge
            dataSource={source.channel('battery')}
            min={0}
            max={100}
            label="Battery"
            unit="%"
            size="md"
            thresholds={GAUGE_THRESHOLDS}
          />
        </div>

        <div className="demo-card">
          <h3 className="demo-card-title">SignalPanel — flight state</h3>
          <SignalPanel signals={signals} />
        </div>

        <div
          className="demo-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 className="demo-card-title" style={{ alignSelf: 'flex-start' }}>
            Attitude
          </h3>
          {/* Fed the full merged source on purpose: @altara/core >= 0.2.1
              drops channels Attitude doesn't own. Before that fix this needed
              a restricted view, or the battery channel drove the horizon. */}
          <Attitude dataSource={source} size={180} />
        </div>
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">TimeSeries — roll / pitch history</h3>
        <TimeSeries
          key={`ts-${chartEpoch}`}
          dataSource={source}
          channels={TS_CHANNELS}
          windowMs={20_000}
          height={220}
          thresholds={TS_THRESHOLDS}
        />
      </div>

      <div className="demo-card">
        <h3 className="demo-card-title">EventLog — replayed to playhead</h3>
        <EventLog entries={events} maxEntries={20} />
      </div>
    </div>
  );
}
