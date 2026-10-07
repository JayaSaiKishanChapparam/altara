/**
 * Pixel test for the chart draw path. Renders real `TimeSeries` and
 * `MultiAxisPlot` instances in Chromium and reads back what each canvas painted.
 *
 * The unit tests can't check this: they stub `getContext` with no-op functions,
 * so they pass whether or not anything was drawn. That gap is how #39 shipped. In
 * min/max bucket mode a flat signal rendered nothing and a lone spike
 * disappeared, across two releases, with every test green.
 *
 * For each case it asserts that the line is:
 *  - present: it spans most of the plot,
 *  - connected: there is a line pixel in at least 98% of the device-pixel columns
 *    between its two ends (separate per-column segments with gaps between them
 *    fail this),
 *  - shaped right: a spike reaches the top of the plot; a sine spans most of
 *    its height.
 *
 * Usage: `pnpm --filter @altara/core test:pixels` (needs Playwright's Chromium:
 * `pnpm exec playwright install chromium`). Set `PIXEL_TEST_SCREENSHOT=<path>`
 * to save a full-page screenshot whatever the result; on failure one is always
 * saved to the temp dir.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DPR = 2;
/** Settle time: the worker path needs a flush, a frame, and a draw. */
const SETTLE_MS = 1_500;
/** The top-left legend uses the line colour too; ignore its box (CSS px). */
const LEGEND = { w: 80, h: 30 };

const { outputFiles } = await build({
  entryPoints: [join(here, 'fixture.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'error',
});
const bundle = outputFiles[0].text;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: DPR, viewport: { width: 900, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.setContent('<!doctype html><html><body style="margin:0;background:#000"></body></html>');
await page.addScriptTag({ content: bundle });
await page.waitForFunction(() => window.__mounted === true);
await page.waitForTimeout(SETTLE_MS);

const stats = await page.evaluate(
  ({ legend, dpr }) =>
    window.__cases.map((c) => {
      const canvas = document.querySelector(`#${c.id} canvas`);
      const { width: w, height: h } = canvas;
      const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      const cols = new Uint8Array(w);
      let count = 0;
      let minX = w;
      let maxX = -1;
      let minY = h;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < legend.w * dpr && y < legend.h * dpr) continue;
          const i = (y * w + x) * 4;
          // Magenta, allowing for antialiasing against the dark panel.
          if (px[i] > 120 && px[i + 1] < 90 && px[i + 2] > 120) {
            count++;
            cols[x] = 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      let covered = 0;
      for (let x = minX; x <= maxX; x++) covered += cols[x];
      const span = maxX >= minX ? maxX - minX + 1 : 0;
      return { ...c, w, h, count, span, coverage: span ? covered / span : 0, minY, maxY };
    }),
  { legend: LEGEND, dpr: DPR },
);

let failed = 0;
const pct = (x) => `${(x * 100).toFixed(0)}%`;
for (const s of stats) {
  const problems = [];
  if (s.count === 0) problems.push('nothing drawn');
  else {
    if (s.span < 0.7 * s.w) problems.push(`trace spans only ${pct(s.span / s.w)} of the width`);
    if (s.coverage < 0.98) problems.push(`trace is broken: ${pct(s.coverage)} of columns painted`);
    if (s.kind === 'spike' && s.minY > 0.25 * s.h) problems.push('spike missing (nothing near the top)');
    if (s.kind === 'sine' && s.maxY - s.minY < 0.5 * s.h) problems.push('sine is flattened');
  }
  if (problems.length) failed++;
  console.log(
    `${problems.length ? '✗' : '✓'} ${s.id.padEnd(28)} n=${String(s.n).padEnd(5)} px=${String(s.count).padEnd(6)} ` +
      `span=${pct(s.w ? s.span / s.w : 0).padEnd(4)} cols=${pct(s.coverage).padEnd(4)}` +
      (problems.length ? `  ← ${problems.join('; ')}` : ''),
  );
}
for (const e of pageErrors) console.error(`page error: ${e}`);

const requested = process.env.PIXEL_TEST_SCREENSHOT;
if (requested) await page.screenshot({ path: requested, fullPage: true });
if (failed || pageErrors.length) {
  const shot = requested ?? join(tmpdir(), 'altara-pixel-test.png');
  if (!requested) await page.screenshot({ path: shot, fullPage: true });
  console.error(`\n${failed} of ${stats.length} cases failed. Screenshot: ${shot}`);
}
await browser.close();
process.exit(failed || pageErrors.length ? 1 : 0);
