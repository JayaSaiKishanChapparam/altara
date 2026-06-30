/**
 * Builds the RingBuffer deep-dive figure from the committed alloc A/B results,
 * so the picture and the numbers can never diverge. Emits an SVG and rasterizes
 * it to PNG (via Playwright) into docs/assets/. Style matches make-chart.mjs.
 *
 *   node scripts/bench/make-chart-alloc.mjs
 *
 * Two panels, both the 24-channel allocate-vs-reuse contrast:
 *   Panel A (results-alloc-baseline.json, 1x throttle, 60s): per-frame main-thread
 *           work — p50/p99/max bars + the 16.7ms vsync line. Metric: work>5ms
 *           (workSpikes5) is a valid GC signal ONLY at 1x.
 *   Panel B (results-alloc-cpu6x.json, 6x throttle, 30s): dropped frames
 *           (longFrames25 = frame delta >25ms). The payoff: 363 -> 0.
 * The two panels measure DIFFERENT quantities; each is labelled with its throttle
 * and its exact metric so they can't be conflated.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (f) => JSON.parse(readFileSync(join(here, f), 'utf8')).results;
const find = (rows, mode, ch) => rows.find((r) => r.mode === mode && r.channels === ch);

const base = read('results-alloc-baseline.json'); // 1x throttle, 60s
const six = read('results-alloc-cpu6x.json'); // 6x throttle, 30s

// Panel A: per-frame work at 24ch, copy vs reuse (1x throttle).
const aCopy = find(base, 'alloc-copy', 24);
const aReuse = find(base, 'alloc-reuse', 24);
// Panel B: dropped frames (longFrames25) at 6ch and 24ch, copy vs reuse (6x).
const bCopy24 = find(six, 'alloc-copy', 24);
const bReuse24 = find(six, 'alloc-reuse', 24);
const bCopy6 = find(six, 'alloc-copy', 6);
const bReuse6 = find(six, 'alloc-reuse', 6);

const ALLOC = '#E24B4A'; // allocate (copy) — red, "this is the cost"
const REUSE = '#1D9E75'; // reuse (zero-copy) — green, matches the Canvas figure
const FG = '#E8E6DF';
const DIM = '#7A7872';
const AXIS = '#A8A6A0';
const GRID = '#2E3133';
const BUDGET_COLOR = '#9E7CD5';

const W = 1200, H = 675;
const BUDGET = 16.7;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const txt = (x, y, s, opts = {}) =>
  `<text x="${x}" y="${y}" fill="${opts.fill || DIM}" font-size="${opts.size || 15}" font-family="ui-monospace, monospace" text-anchor="${opts.anchor || 'middle'}"${opts.weight ? ` font-weight="${opts.weight}"` : ''}>${esc(s)}</text>`;
const rotTxt = (x, y, s, opts = {}) => txt(x, y, s, opts).replace('<text', `<text transform="rotate(-90 ${x} ${y})"`);
const bar = (x, y, w, h, fill, op = 1) =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" fill="${fill}" fill-opacity="${op}"/>`;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
svg += `<rect width="${W}" height="${H}" fill="#181A1B"/>`;

// Title + subtitle
svg += txt(70, 40, 'RingBuffer read path — allocate vs reuse at 24 channels', { fill: FG, size: 22, anchor: 'start', weight: 700 });
svg += txt(70, 62, 'i9-9880H · Chromium 147 · DPR 2 · @altara/core 0.2.0 · 10k-sample buffers · lower is better', { fill: DIM, size: 14, anchor: 'start' });

// Shared legend (allocate vs reuse) — one horizontal row, below the subtitle.
const legend = [
  { x: 70, color: ALLOC, label: 'allocate — getValues/getTimes (copy)' },
  { x: 560, color: REUSE, label: 'reuse — readInto (zero-copy)' },
];
for (const l of legend) {
  svg += `<rect x="${l.x}" y="78" width="14" height="14" fill="${l.color}"/>`;
  svg += txt(l.x + 20, 90, l.label, { anchor: 'start', fill: FG, size: 14 });
}

// ---- Panel geometry ----
const yT = 150, yB = 560;
const pA = { x0: 78, x1: 560 };
const pB = { x0: 672, x1: 1122 };

// Panel sub-titles
svg += txt(pA.x0, 114, 'A · per-frame main-thread work', { fill: FG, size: 17, anchor: 'start', weight: 700 });
svg += txt(pA.x0, 134, '1× CPU · 60 s · spikes = frames with work > 5 ms (workSpikes5)', { fill: '#9A9892', size: 13, anchor: 'start' });
svg += txt(pB.x0, 114, 'B · dropped frames', { fill: FG, size: 17, anchor: 'start', weight: 700 });
svg += txt(pB.x0, 134, '6× CPU · 30 s · dropped = frame Δ > 25 ms (longFrames25)', { fill: '#9A9892', size: 13, anchor: 'start' });

// ===================== Panel A: work ms =====================
{
  const yMax = 20;
  const Y = (v) => yB - (v / yMax) * (yB - yT);
  // gridlines
  for (const v of [0, 5, 10, 15, 20]) {
    svg += `<line x1="${pA.x0}" y1="${Y(v)}" x2="${pA.x1}" y2="${Y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    svg += txt(pA.x0 - 10, Y(v) + 5, String(v), { anchor: 'end' });
  }
  svg += rotTxt(34, (yT + yB) / 2, 'per-frame work (ms)', { fill: AXIS });
  // 60fps budget line
  svg += `<line x1="${pA.x0}" y1="${Y(BUDGET)}" x2="${pA.x1}" y2="${Y(BUDGET)}" stroke="${BUDGET_COLOR}" stroke-width="2" stroke-dasharray="7 5"/>`;
  svg += txt(pA.x1 - 4, Y(BUDGET) - 7, '16.7 ms — 60 fps budget', { anchor: 'end', fill: '#B6A0DC', size: 13 });

  const groups = [
    { label: 'allocate', color: ALLOC, row: aCopy },
    { label: 'reuse', color: REUSE, row: aReuse },
  ];
  const metrics = [
    { key: 'workP50Ms', tick: 'p50', op: 1 },
    { key: 'workP99Ms', tick: 'p99', op: 0.72 },
    { key: 'workMaxMs', tick: 'max', op: 0.46 },
  ];
  const gCenters = [pA.x0 + 132, pA.x0 + 350];
  const bw = 40, step = 52;
  groups.forEach((g, gi) => {
    const cx = gCenters[gi];
    const startX = cx - step; // three bars centered
    metrics.forEach((m, mi) => {
      const v = g.row[m.key];
      const x = startX + mi * step - bw / 2;
      svg += bar(x, Y(v), bw, yB - Y(v), g.color, m.op);
      svg += txt(x + bw / 2, Y(v) - 7, v.toFixed(1), { fill: FG, size: 13, weight: 700 });
      svg += txt(x + bw / 2, yB + 18, m.tick, { fill: AXIS, size: 12.5 });
    });
    // group label + spike count
    svg += txt(cx, yB + 40, g.label, { fill: g.color, size: 15, weight: 700 });
    svg += txt(cx, yB + 60, `${g.row.workSpikes5} spikes > 5 ms`, { fill: DIM, size: 12.5 });
  });
}

// ===================== Panel B: dropped frames =====================
{
  const yMax = 400;
  const Y = (v) => yB - (v / yMax) * (yB - yT);
  for (const v of [0, 100, 200, 300, 400]) {
    svg += `<line x1="${pB.x0}" y1="${Y(v)}" x2="${pB.x1}" y2="${Y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    svg += txt(pB.x0 - 10, Y(v) + 5, String(v), { anchor: 'end' });
  }
  svg += rotTxt(pB.x0 - 52, (yT + yB) / 2, 'dropped frames in 30 s', { fill: AXIS });

  const groups = [
    { ch: '6 ch', copy: bCopy6, reuse: bReuse6 },
    { ch: '24 ch', copy: bCopy24, reuse: bReuse24 },
  ];
  const gCenters = [pB.x0 + 130, pB.x0 + 330];
  const bw = 64;
  groups.forEach((g, gi) => {
    const cx = gCenters[gi];
    const bars = [
      { v: g.copy.longFrames25, color: ALLOC, x: cx - bw - 8 },
      { v: g.reuse.longFrames25, color: REUSE, x: cx + 8 },
    ];
    for (const b of bars) {
      svg += bar(b.x, Y(b.v), bw, yB - Y(b.v), b.color, 1);
      // a zero bar gets a baseline tick + label above the axis
      const labelY = b.v === 0 ? yB - 6 : Y(b.v) - 8;
      svg += txt(b.x + bw / 2, labelY, String(b.v), { fill: FG, size: 15, weight: 700 });
    }
    svg += txt(cx, yB + 40, g.ch, { fill: AXIS, size: 15, weight: 700 });
  });
}

svg += `</svg>`;

mkdirSync(join(root, 'docs', 'assets'), { recursive: true });
const svgPath = join(root, 'docs', 'assets', 'ringbuffer-alloc.svg');
writeFileSync(svgPath, svg);
console.log('wrote', svgPath);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(svg, { waitUntil: 'load' });
const pngPath = join(root, 'docs', 'assets', 'ringbuffer-alloc.png');
await page.locator('svg').screenshot({ path: pngPath });
await browser.close();
console.log('wrote', pngPath);

// Print plotted numbers so they're auditable next to the article's tables.
console.log('\n--- PLOTTED NUMBERS ---');
console.log('Panel A (1x, 24ch) work ms:');
console.log('  allocate  p50/p99/max =', aCopy.workP50Ms, aCopy.workP99Ms, aCopy.workMaxMs, '| spikes>5ms =', aCopy.workSpikes5);
console.log('  reuse     p50/p99/max =', aReuse.workP50Ms, aReuse.workP99Ms, aReuse.workMaxMs, '| spikes>5ms =', aReuse.workSpikes5);
console.log('Panel B (6x) dropped frames (longFrames25):');
console.log('  6ch   allocate/reuse =', bCopy6.longFrames25, '/', bReuse6.longFrames25);
console.log('  24ch  allocate/reuse =', bCopy24.longFrames25, '/', bReuse24.longFrames25);
