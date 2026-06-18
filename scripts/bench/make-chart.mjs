/**
 * Builds the article's figure from the committed 3-way benchmark results, so the
 * picture and the numbers can never diverge. Emits an SVG and rasterizes it to
 * PNG (via Playwright) into docs/assets/.
 *
 *   node scripts/bench/make-chart.mjs
 *
 * X: N (element count, log scale, 1 -> 1200). Y: per-frame main-thread work (ms).
 * Series: svg-react, svg-imperative, canvas, plus the 16.7ms (60fps) budget line.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (f) => JSON.parse(readFileSync(join(here, f), 'utf8')).results;

// Merge all measured N points per mode, dedup N (first wins), sort ascending.
const all = [...read('results-3way-baseline.json'), ...read('results-3way-highN.json'), ...read('results-3way-extra.json')];
const MODES = ['svg-react', 'svg-imperative', 'canvas'];
const COLOR = { 'svg-react': '#E24B4A', 'svg-imperative': '#EF9F27', canvas: '#1D9E75' };
const series = {};
for (const mode of MODES) {
  const seen = new Set();
  series[mode] = all
    .filter((r) => r.mode === mode)
    .filter((r) => (seen.has(r.n) ? false : seen.add(r.n)))
    .map((r) => ({ n: r.n, work: r.meanWorkMs }))
    .sort((a, b) => a.n - b.n);
}

const W = 1200, H = 675;
const xL = 78, xR = 1110, yT = 70, yB = 590;
const BUDGET = 16.7;
const yMaxData = Math.max(...MODES.flatMap((m) => series[m].map((d) => d.work)));
const yMax = Math.ceil(yMaxData / 10) * 10; // ~70

const lx = (n) => Math.log10(n);
const xMin = lx(1), xMax = lx(1200);
const X = (n) => xL + ((lx(n) - xMin) / (xMax - xMin)) * (xR - xL);
const Y = (v) => yB - (v / yMax) * (yB - yT);

const txt = (x, y, s, opts = {}) =>
  `<text x="${x}" y="${y}" fill="${opts.fill || '#7A7872'}" font-size="${opts.size || 15}" font-family="ui-monospace, monospace" text-anchor="${opts.anchor || 'middle'}"${opts.weight ? ` font-weight="${opts.weight}"` : ''}>${s}</text>`;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
svg += `<rect width="${W}" height="${H}" fill="#181A1B"/>`;
svg += txt(xL, 40, 'Canvas vs SVG — per-frame main-thread work as element count scales', { fill: '#E8E6DF', size: 22, anchor: 'start', weight: 700 });
svg += txt(xL, 60, 'i9-9880H · Chromium 147 · DPR 2 · lower is better', { fill: '#7A7872', size: 14, anchor: 'start' });

// Y gridlines + labels
for (const v of [0, 10, 20, 30, 40, 50, 60, 70].filter((v) => v <= yMax)) {
  svg += `<line x1="${xL}" y1="${Y(v)}" x2="${xR}" y2="${Y(v)}" stroke="#2E3133" stroke-width="1"/>`;
  svg += txt(xL - 12, Y(v) + 5, String(v), { anchor: 'end' });
}
svg += txt(28, (yT + yB) / 2, 'per-frame work (ms)', { anchor: 'middle', fill: '#A8A6A0' }).replace('<text', `<text transform="rotate(-90 28 ${(yT + yB) / 2})"`);

// X gridlines + labels (log)
for (const n of [1, 10, 50, 100, 200, 400, 800, 1200]) {
  svg += `<line x1="${X(n)}" y1="${yT}" x2="${X(n)}" y2="${yB}" stroke="#2E3133" stroke-width="1" stroke-dasharray="2 4"/>`;
  svg += txt(X(n), yB + 24, String(n), {});
}
svg += txt((xL + xR) / 2, H - 16, 'N (telemetry widgets on screen, log scale)', { fill: '#A8A6A0', size: 15 });

// 60fps budget line
svg += `<line x1="${xL}" y1="${Y(BUDGET)}" x2="${xR}" y2="${Y(BUDGET)}" stroke="#9E7CD5" stroke-width="2" stroke-dasharray="7 5"/>`;
svg += txt(xR - 6, Y(BUDGET) - 8, '16.7 ms — 60 fps frame budget', { anchor: 'end', fill: '#B6A0DC', size: 14 });

// Series
for (const mode of MODES) {
  const pts = series[mode].map((d) => `${X(d.n).toFixed(1)},${Y(d.work).toFixed(1)}`).join(' ');
  svg += `<polyline points="${pts}" fill="none" stroke="${COLOR[mode]}" stroke-width="3"/>`;
  for (const d of series[mode]) svg += `<circle cx="${X(d.n).toFixed(1)}" cy="${Y(d.work).toFixed(1)}" r="4" fill="${COLOR[mode]}"/>`;
}

// Legend (top-left inside plot)
let ly = yT + 16;
const LABEL = { 'svg-react': 'SVG via React (flushSync/frame)', 'svg-imperative': 'SVG imperative (mutate by ref)', canvas: 'Canvas (rAF, full repaint)' };
for (const mode of MODES) {
  svg += `<line x1="${xL + 16}" y1="${ly}" x2="${xL + 44}" y2="${ly}" stroke="${COLOR[mode]}" stroke-width="3"/>`;
  svg += `<circle cx="${xL + 30}" cy="${ly}" r="4" fill="${COLOR[mode]}"/>`;
  svg += txt(xL + 54, ly + 5, LABEL[mode], { anchor: 'start', fill: '#E8E6DF', size: 15 });
  ly += 26;
}
svg += `</svg>`;

mkdirSync(join(root, 'docs', 'assets'), { recursive: true });
const svgPath = join(root, 'docs', 'assets', 'canvas-vs-svg-work.svg');
writeFileSync(svgPath, svg);
console.log('wrote', svgPath);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(svg, { waitUntil: 'load' });
const pngPath = join(root, 'docs', 'assets', 'canvas-vs-svg-work.png');
await page.locator('svg').screenshot({ path: pngPath });
await browser.close();
console.log('wrote', pngPath);

// Print the series so the numbers are auditable next to the picture.
for (const mode of MODES) console.log(mode, JSON.stringify(series[mode]));
