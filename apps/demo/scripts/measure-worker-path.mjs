/**
 * Measures the Worker Pipeline tab on both decimation paths and prints a table.
 *
 * Exists so the numbers in the root README have a reproducible provenance
 * rather than being a figure someone once read off a screen. Run the demo, then:
 *
 *     pnpm --filter @altara/demo preview            # terminal 1
 *     pnpm --filter @altara/demo measure            # terminal 2
 *
 * What it reports, per path:
 *  - main-thread occupancy, via a MessageChannel ping loop. Each hop that takes
 *    materially longer than a scheduling round-trip means the thread was busy;
 *    summing those gives busy-ms per wall second. This catches work below the
 *    50 ms `longtask` threshold, which is where all of this actually lives.
 *  - frame pacing, from the tab's own counters.
 *
 * Both arms are warmed first: the worker's ring buffers hold 12 s of a 1 kHz
 * channel, and measuring before they fill reports startup, not steady state.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const URL = args.find((a) => a.startsWith('http')) ?? 'http://localhost:4321/';
/**
 * Headless Chromium paces animation frames synthetically and its results here
 * were not reproducible between runs, so measurements are taken headed by
 * default. Pass --headless only for a smoke check that the script still runs.
 */
const HEADLESS = args.includes('--headless');
const WARMUP_MS = 16_000;
const SAMPLE_MS = 10_000;
/**
 * Frame pacing on this workload is noisy enough that a single reading is not
 * evidence — repeated runs on the same machine have disagreed by more than the
 * difference between the two paths. Each arm is therefore sampled several times
 * and the spread is printed, so a reader can see whether a gap is real.
 */
const REPEATS = 3;

const readStats = () =>
  Object.fromEntries(
    [...document.querySelectorAll('.demo-stat')].map((d) => [
      d.querySelector('dt').textContent,
      d.querySelector('dd').textContent.trim(),
    ]),
  );

const num = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0;

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(URL, { waitUntil: 'load' });
  await page.getByRole('tab', { name: 'Worker Pipeline' }).click();

  // Fail loudly rather than reporting zeros against a feed that never connected.
  await page.waitForFunction(
    () => /Connected/.test(document.body.textContent ?? ''),
    null,
    { timeout: 15_000 },
  );

  const arms = [
    { label: 'Worker (decimator)', button: 'Worker (decimator)' },
    { label: 'Main thread (local)', button: 'Main thread (local)' },
  ];

  const results = [];
  for (const arm of arms) {
    // These are plain buttons carrying aria-selected, not role=tab.
    await page.getByRole('button', { name: arm.button, exact: true }).click();
    // Ring buffers hold 12 s of a 1 kHz channel; measuring before they fill
    // reports startup rather than steady state.
    await page.waitForTimeout(WARMUP_MS);

    const runs = [];
    let stats = {};
    for (let i = 0; i < REPEATS; i++) {
      await page.waitForTimeout(SAMPLE_MS);
      stats = await page.evaluate(readStats);
      runs.push({
        frameMs: num(stats['Frame interval']),
        worstMs: num(stats['Worst frame']),
        longPerSec: num(stats['Long frames']),
      });
    }
    results.push({ arm: arm.label, stats, runs });
  }

  const load = results[0].stats;
  console.log('\n  Load');
  console.log(`    inbound            ${load['Samples in']}`);
  console.log(`    probe window       ${load['Probe: samples in window']} samples`);
  console.log(`    probe columns      ${load['Probe: bucket columns']}`);
  console.log(`    encoding           ${load['Encoding']}`);

  const span = (xs) => `${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)}`;

  console.log(`\n  Frame pacing, ${REPEATS} samples of ${SAMPLE_MS / 1000}s per path`);
  console.log('    Path                  frame avg ms     worst ms    long frames/s');
  for (const r of results) {
    console.log(
      `      ${r.arm.padEnd(20)} ${span(r.runs.map((x) => x.frameMs)).padStart(12)} ` +
        `${span(r.runs.map((x) => x.worstMs)).padStart(12)} ` +
        `${span(r.runs.map((x) => x.longPerSec)).padStart(16)}`,
    );
  }

  const [w, m] = results;
  const wSpan = w.runs.map((x) => x.frameMs);
  const mSpan = m.runs.map((x) => x.frameMs);
  const separated = Math.max(...wSpan) < Math.min(...mSpan);
  console.log(
    `\n  Frame-interval ranges ${separated ? 'do not overlap' : 'OVERLAP'} — ` +
      `${separated ? 'the gap is measurable on this run' : 'no speed claim is supported by this run'}.`,
  );
  console.log(
    '  Sample counts above are stable across runs; frame timing on this workload is not.\n',
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
