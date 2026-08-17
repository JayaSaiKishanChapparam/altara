/**
 * Offline capture: generates the bundled replay fixture for apps/demo's
 * Replay tab.
 *
 * This builds the same shape of mock sources the GCS view shows, merges them
 * into one channel-tagged `AltaraDataSource` via `mergeChannels`, drains
 * `getHistory()`, and writes a single JSON file.
 *
 * Note on "runs 60s": rather than sleeping for a wall-clock minute, each
 * source is created with `seedCount = hz * durationSec`, which makes
 * `createMockDataSource` synthesise the entire window up-front from the same
 * generators the live path would call. The emitted samples are identical to
 * what a 60-second subscription would have collected, but capture is instant
 * and repeatable. Nothing is recorded from the render path — this is a
 * build-time script, never imported by the app.
 *
 * Usage: node scripts/generate-replay-fixture.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createMockDataSource,
  custom,
  mergeChannels,
} from '../packages/core/dist/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../apps/demo/public/replay/gcs-session.json');

const DURATION_MS = 60_000;
const DURATION_S = DURATION_MS / 1000;

// Fixed origin so every generator sees elapsed seconds in [0, 60] rather than
// absolute unix time. Computed before the sources are constructed so it lines
// up with the `Date.now() - seedCount * periodMs` start each source picks.
const ORIGIN = Date.now() - DURATION_MS;
const secs = (tMs) => (tMs - ORIGIN) / 1000;

const wrap360 = (deg) => ((deg % 360) + 360) % 360;

// ── Flight profile ──────────────────────────────────────────────────────
// Mirrors PrimaryFlightDisplay's own mockMode profile (a stylised
// cruise-with-occasional-bank) so the replay looks like the live GCS tab.
const flight = {
  roll: (s) => Math.sin(s * 0.25) * 18,
  pitch: (s) => Math.sin(s * 0.4 + 0.7) * 8,
  heading: (s) => wrap360(90 + Math.sin(s * 0.15) * 25),
  airspeed: (s) => 120 + Math.sin(s * 0.3) * 12,
  altitude: (s) => 4500 + Math.sin(s * 0.18) * 220,
  vs: (s) => Math.cos(s * 0.18) * 600,
  fdRoll: (s) => Math.sin(s * 0.25 + 0.5) * 12,
  fdPitch: (s) => Math.sin(s * 0.4 + 1.3) * 5,
};

// ── Ground track ────────────────────────────────────────────────────────
// A ~120 m orbit around downtown SF, matching LiveMap's mockMode geometry.
const LAT0 = 37.7749;
const LNG0 = -122.4194;
const EARTH_R = 6_378_137;
const RADIUS_M = 320;
const OMEGA = (2 * Math.PI) / 40; // one lap per 40 s
const D_LAT = (RADIUS_M / EARTH_R) * (180 / Math.PI);
const D_LNG = D_LAT / Math.cos((LAT0 * Math.PI) / 180);

const track = {
  lat: (s) => LAT0 + D_LAT * Math.sin(OMEGA * s),
  lng: (s) => LNG0 + D_LNG * Math.cos(OMEGA * s),
  // Tangent to the orbit, so the map marker's nose points along travel.
  mapHeading: (s) => {
    const dLat = D_LAT * OMEGA * Math.cos(OMEGA * s);
    const dLng = -D_LNG * OMEGA * Math.sin(OMEGA * s);
    const latRad = (track.lat(s) * Math.PI) / 180;
    return wrap360((Math.atan2(dLng * Math.cos(latRad), dLat) * 180) / Math.PI);
  },
};

// ── Battery ─────────────────────────────────────────────────────────────
// Monotonic drain 92% -> 34% with a little sensor noise, so the Gauge's
// warn/danger thresholds actually get crossed during the session.
const battery = (s) => {
  const drain = 92 - (58 * s) / DURATION_S;
  return Math.max(0, Math.min(100, drain + Math.sin(s * 1.7) * 0.4));
};

/** channel -> { hz, gen, precision } */
const CHANNELS = {
  roll: { hz: 10, gen: flight.roll, precision: 3 },
  pitch: { hz: 10, gen: flight.pitch, precision: 3 },
  heading: { hz: 10, gen: flight.heading, precision: 3 },
  airspeed: { hz: 10, gen: flight.airspeed, precision: 3 },
  altitude: { hz: 10, gen: flight.altitude, precision: 2 },
  vs: { hz: 10, gen: flight.vs, precision: 2 },
  fdRoll: { hz: 10, gen: flight.fdRoll, precision: 3 },
  fdPitch: { hz: 10, gen: flight.fdPitch, precision: 3 },
  lat: { hz: 5, gen: track.lat, precision: 6 },
  lng: { hz: 5, gen: track.lng, precision: 6 },
  mapHeading: { hz: 5, gen: track.mapHeading, precision: 2 },
  battery: { hz: 2, gen: battery, precision: 2 },
};

const EVENTS = [
  { t: 1_500, severity: 'info', message: 'MAVLink heartbeat — FCU connected' },
  { t: 9_000, severity: 'info', message: 'EKF2 ready — GPS fix (11 satellites)' },
  { t: 18_000, severity: 'info', message: 'Mode: AUTO.MISSION — 14 waypoints loaded' },
  { t: 27_000, severity: 'info', message: 'Waypoint 3/14 reached' },
  { t: 36_000, severity: 'warn', message: 'Wind gust 12 m/s — compensating' },
  { t: 45_000, severity: 'info', message: 'Waypoint 6/14 reached' },
  { t: 52_000, severity: 'warn', message: 'Battery 38% — RTL threshold approaching' },
  { t: 58_000, severity: 'info', message: 'Holding altitude 4500 ft' },
];

// ── Capture ─────────────────────────────────────────────────────────────

const sources = {};
for (const [channel, { hz, gen }] of Object.entries(CHANNELS)) {
  sources[channel] = createMockDataSource({
    generator: custom((tMs) => gen(secs(tMs))),
    hz,
    seedCount: Math.round(hz * DURATION_S),
  });
}

const merged = mergeChannels(sources);
const history = merged.getHistory(); // already tagged by key and sorted by timestamp
merged.destroy();

if (history.length === 0) {
  throw new Error('capture produced no samples — check seedCount / generators');
}

const startedAt = history[0].timestamp;
const round = (v, p) => Number(v.toFixed(p));

const samples = history.map((s) => ({
  t: s.timestamp - startedAt,
  c: s.channel,
  v: round(s.value, CHANNELS[s.channel].precision),
}));

// mergeChannels sorts by timestamp, but re-sort defensively so the replay
// cursor can rely on a single forward scan.
samples.sort((a, b) => a.t - b.t);

const durationMs = samples[samples.length - 1].t;

const fixture = {
  version: 1,
  startedAt,
  durationMs,
  channels: Object.keys(CHANNELS),
  samples,
  events: EVENTS.filter((e) => e.t <= durationMs),
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(fixture));

const bytes = JSON.stringify(fixture).length;
console.log(`wrote ${OUT_PATH}`);
console.log(
  `  ${samples.length} samples across ${fixture.channels.length} channels, ` +
    `${fixture.events.length} events, ${(durationMs / 1000).toFixed(1)}s, ` +
    `${(bytes / 1024).toFixed(0)} KB`,
);
