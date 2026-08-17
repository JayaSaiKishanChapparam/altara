/**
 * Verification harness for the Replay tab. Drives the built demo in a real
 * browser and asserts the things that would silently break: that the
 * re-stamped timebase actually puts samples inside TimeSeries' visible
 * window, and that a backward scrub neither freezes nor duplicates the
 * accumulating components.
 *
 * Usage: node scripts/verify-replay.mjs   (expects vite preview on :4173)
 */
import { chromium } from 'playwright';

// Override to check a base-path build, e.g. the /altara/demo/ subpath Pages serves:
//   REPLAY_URL=http://localhost:4173/altara/demo/ node scripts/verify-replay.mjs
const URL = process.env.REPLAY_URL ?? 'http://localhost:4173/';
const results = [];
let failures = 0;

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Fraction of canvas pixels differing from the dominant (background) colour. */
function inkOf(sel) {
  const c = document.querySelector(sel);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const { width, height } = c;
  const d = ctx.getImageData(0, 0, width, height).data;
  const counts = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = -1;
  for (const n of counts.values()) if (n > best) best = n;
  const total = width * height;
  return { inkRatio: (total - best) / total, distinctColors: counts.size };
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => check('no uncaught page errors', false, e.message));
await page.setViewportSize({ width: 1440, height: 1400 });
await page.goto(URL, { waitUntil: 'networkidle' });

await page.getByRole('tab', { name: 'Replay' }).click();
await page.waitForSelector('input[aria-label="Scrub playhead"]', { timeout: 10_000 });
check('replay tab mounts and fixture loads', true);

const scrubber = page.locator('input[aria-label="Scrub playhead"]');
const readout = page.locator('.demo-card', { hasText: 'Transport' }).locator('span').last();
const eventRows = page.locator('.vt-event-log__list > *');
const attitudeLabel = () => page.locator('[aria-label^="Attitude:"]').getAttribute('aria-label');
const batteryPct = async () =>
  Number(
    ((await page.locator('.demo-card', { hasText: 'Battery' }).innerText()).match(
      /(\d+\.?\d*)\s*%/,
    ) ?? [])[1],
  );

const seekTo = async (ms) => {
  await scrubber.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ).set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, ms);
  await page.waitForTimeout(500);
};

// ── Playback ────────────────────────────────────────────────────────────
await page.waitForTimeout(6000);
const t1 = Number(await scrubber.inputValue());
check('playhead advances during playback', t1 > 3000, `playhead=${t1}ms after ~6s wall`);

// ── The critical check: TimeSeries actually renders ──────────────────────
const ts = await page.evaluate(inkOf, '.vt-timeseries__canvas');
check(
  'TimeSeries renders data (re-stamped timebase lands in window)',
  ts && ts.inkRatio > 0.01 && ts.distinctColors > 5,
  ts ? `ink=${(ts.inkRatio * 100).toFixed(2)}% colors=${ts.distinctColors}` : 'canvas missing',
);

// ── Pattern A instruments ───────────────────────────────────────────────
const att1 = await attitudeLabel();
const attRoll = Number((att1.match(/roll (-?\d+\.\d+)/) ?? [])[1]);
const attPitch = Number((att1.match(/pitch (-?\d+\.\d+)/) ?? [])[1]);
check(
  'Attitude reads only roll/pitch (within recorded ranges)',
  Math.abs(attRoll) <= 18.5 && Math.abs(attPitch) <= 8.5,
  `${att1} — recorded roll ±18°, pitch ±8°`,
);

const pfd = await page.evaluate(inkOf, '.vt-pfd canvas');
check('PFD renders', pfd && pfd.inkRatio > 0.05, pfd ? `ink=${(pfd.inkRatio * 100).toFixed(1)}%` : 'canvas missing');

const att = await page.evaluate(inkOf, '.vt-component:not(.vt-pfd) canvas');
check('Attitude canvas renders', att && att.inkRatio > 0.05, att ? `ink=${(att.inkRatio * 100).toFixed(1)}%` : 'canvas missing');

const bat1 = await batteryPct();
check('Gauge reads recorded battery', Number.isFinite(bat1) && bat1 > 30 && bat1 < 95, `battery=${bat1}%`);

const sigText = await page.locator('.demo-card', { hasText: 'SignalPanel' }).innerText();
const sigNums = sigText.match(/-?\d+\.?\d*\s*(kt|ft|fpm|°)/g) ?? [];
check('SignalPanel rows all populated', sigNums.length === 4, sigNums.join(', ') || 'none');

const markers = await page.locator('.vt-live-map__heading-arrow').count();
check('LiveMap renders marker from recorded GPS', markers > 0, `markers=${markers}`);

// ── Forward, then backward scrub ────────────────────────────────────────
await page.getByRole('button', { name: 'Pause' }).click();
await seekTo(50_000);
const rowsLate = await eventRows.count();
const batLate = await batteryPct();
const attLate = await attitudeLabel();
check('forward seek advances events', rowsLate >= 6, `rows at 50s=${rowsLate} (fixture has 7 events <=50s)`);

await seekTo(5_000);
const afterSeek = Number(await scrubber.inputValue());
check('backward scrub moves playhead back', afterSeek <= 5200, `50000ms -> ${afterSeek}ms`);

const readoutText = (await readout.innerText()).trim();
check('readout tracks recording-relative time', /^0:0[45]\.\d \/ 0:59\.\d$/.test(readoutText), readoutText);

const rowsEarly = await eventRows.count();
check(
  'EventLog rewinds on backward scrub (no duplicates)',
  rowsEarly < rowsLate && rowsEarly === 1,
  `${rowsLate} rows at 50s -> ${rowsEarly} row at 5s (only t=1.5s event)`,
);

const batEarly = await batteryPct();
check('Gauge snaps backward on seek', batEarly > batLate, `${batLate}% at 50s -> ${batEarly}% at 5s (drains, so earlier = higher)`);

const attEarly = await attitudeLabel();
check('Attitude snaps on seek while paused', attEarly !== attLate, `${attLate} -> ${attEarly}`);

const tsAfter = await page.evaluate(inkOf, '.vt-timeseries__canvas');
check(
  'TimeSeries still renders after backward scrub (no freeze/blank)',
  tsAfter && tsAfter.inkRatio > 0.01,
  tsAfter ? `ink=${(tsAfter.inkRatio * 100).toFixed(2)}%` : 'canvas missing',
);

// Seek determinism: returning to the same playhead reproduces the same state.
await seekTo(50_000);
const batAgain = await batteryPct();
check('seek is deterministic (same playhead -> same value)', batAgain === batLate, `${batLate}% then ${batAgain}%`);

// ── Resume + speed ──────────────────────────────────────────────────────
await seekTo(5_000);
await page.getByRole('button', { name: 'Play' }).click();

// Regression guard: a transport re-render must not tear down TimeSeries'
// render loop. Inline array props for `thresholds`/`channels` would blank the
// canvas on every 10 Hz playhead tick.
const tsImmediate = await page.evaluate(inkOf, '.vt-timeseries__canvas');
check(
  'TimeSeries survives transport re-render (no effect churn)',
  tsImmediate && tsImmediate.distinctColors > 1,
  tsImmediate ? `colors=${tsImmediate.distinctColors} ink=${(tsImmediate.inkRatio * 100).toFixed(2)}%` : 'missing',
);

await page.getByRole('button', { name: '2×' }).click();
const tsAfterSpeed = await page.evaluate(inkOf, '.vt-timeseries__canvas');
check(
  'TimeSeries survives speed change',
  tsAfterSpeed && tsAfterSpeed.distinctColors > 1,
  tsAfterSpeed ? `colors=${tsAfterSpeed.distinctColors}` : 'missing',
);
const tA = Number(await scrubber.inputValue());
await page.waitForTimeout(3000);
const tB = Number(await scrubber.inputValue());
const advanced = tB - tA;
check('2× speed advances ~2× realtime', advanced > 4500 && advanced < 8000, `advanced ${advanced}ms in 3000ms wall`);

const tsFinal = await page.evaluate(inkOf, '.vt-timeseries__canvas');
check(
  'TimeSeries renders at 2× after resume',
  tsFinal && tsFinal.inkRatio > 0.01,
  tsFinal ? `ink=${(tsFinal.inkRatio * 100).toFixed(2)}%` : 'missing',
);

await page.screenshot({ path: '/tmp/replay-verify.png', fullPage: true });
console.log('\nscreenshot: /tmp/replay-verify.png');
console.log(`\n${results.length - failures}/${results.length} checks passed`);
await browser.close();
process.exit(failures > 0 ? 1 : 0);
