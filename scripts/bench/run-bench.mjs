/**
 * Drives the Canvas-vs-SVG benchmark page in a real Chromium and records frame
 * timing. Run the dev server first, then this:
 *
 *   pnpm --filter @altara/demo dev &        # serves http://localhost:5173/bench/
 *   node scripts/bench/run-bench.mjs
 *
 * Env:
 *   BENCH_URL   default http://localhost:5173/bench/
 *   HEADLESS    "1" to run headless (no true vsync; numbers differ — see README)
 *   BENCH_NS    comma list of N values, default "1,10,50,200"
 *   BENCH_MS    per-config duration ms, default 4000
 *
 * Writes scripts/bench/results.json and prints a table + the exact
 * browser/machine the numbers were taken on.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const url = process.env.BENCH_URL ?? 'http://localhost:5173/bench/';
const headless = process.env.HEADLESS === '1';
const ns = (process.env.BENCH_NS ?? '1,10,50,200').split(',').map((s) => parseInt(s, 10));
const durationMs = parseInt(process.env.BENCH_MS ?? '4000', 10);

const here = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch({ headless });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

// Optional CPU throttling via CDP to emulate slower hardware (4 = 4x slowdown).
const cpuThrottle = parseFloat(process.env.CPU_THROTTLE ?? '1');
if (cpuThrottle > 1) {
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
}

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__bench && window.__bench.ready', null, { timeout: 15000 });

const env = await page.evaluate(() => ({
  ua: navigator.userAgent,
  dpr: window.devicePixelRatio,
  stageW: document.getElementById('stage')?.clientWidth,
}));

const mode = process.env.MODE ?? 'render'; // 'render' | 'alloc'

const machine = {
  platform: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: os.cpus()[0]?.model,
  cores: os.cpus().length,
  memGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
};
const browserInfo = { name: 'chromium', version: browser.version(), headless, cpuThrottle, userAgent: env.ua };
const viewport = { width: 1440, height: 900, deviceScaleFactor: env.dpr, stageWidthCss: env.stageW };
const banner = () => {
  console.log(`\nMachine : ${machine.cpu} (${machine.cores} cores), ${machine.platform}`);
  console.log(
    `Browser : Chromium ${browserInfo.version}${headless ? ' [headless]' : ' [headed]'}` +
      `${cpuThrottle > 1 ? ` [${cpuThrottle}x CPU]` : ''}, DPR ${viewport.deviceScaleFactor}, stage ${viewport.stageWidthCss}px`,
  );
};
const printTable = (head, rows) => {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padStart(widths[i])).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
};

if (mode === 'alloc') {
  const channelsList = (process.env.ALLOC_CHANNELS ?? '6,24').split(',').map((s) => parseInt(s, 10));
  const bufferSize = parseInt(process.env.ALLOC_BUFFER ?? '10000', 10);
  const allocMs = parseInt(process.env.ALLOC_MS ?? '60000', 10);
  page.setDefaultTimeout(channelsList.length * 2 * allocMs + 60000);
  const results = await page.evaluate(
    ([ch, buf, dur]) => window.__bench.runAllocMatrix(ch, buf, dur),
    [channelsList, bufferSize, allocMs],
  );
  const report = {
    takenAt: new Date().toISOString(),
    machine,
    browser: browserInfo,
    viewport,
    config: { mode, channelsList, bufferSize, durationMs: allocMs },
    results,
  };
  writeFileSync(join(here, 'results-alloc.json'), JSON.stringify(report, null, 2));
  banner();
  console.log(`Config  : channels=[${channelsList.join(', ')}], buffer=${bufferSize}, ${allocMs}ms each\n`);
  printTable(
    ['mode', 'ch', 'buf', 'alloc/frame', 'frameP50', 'frameP99', 'frameMax', '>25ms', 'workP50', 'workP99', 'workMax', 'work>5ms', 'frames'],
    results.map((m) => [
      m.mode, m.channels, m.bufferSize, m.allocPerFrame,
      m.p50FrameMs, m.p99FrameMs, m.maxFrameMs, m.longFrames25,
      m.workP50Ms, m.workP99Ms, m.workMaxMs, m.workSpikes5, m.frames,
    ]),
  );
  if (errors.length) console.log(`\nPage errors:\n${errors.join('\n')}`);
  console.log(`\nWrote scripts/bench/results-alloc.json`);
} else {
  page.setDefaultTimeout(ns.length * 3 * durationMs + 30000);
  const results = await page.evaluate(
    ([nsArg, dur]) => window.__bench.runMatrix(nsArg, dur),
    [ns, durationMs],
  );
  const report = {
    takenAt: new Date().toISOString(),
    machine,
    browser: browserInfo,
    viewport,
    config: { mode, ns, durationMs },
    results,
  };
  writeFileSync(join(here, 'results.json'), JSON.stringify(report, null, 2));
  banner();
  console.log(`Config  : N=[${ns.join(', ')}], ${durationMs}ms each, target 60fps\n`);
  printTable(
    ['mode', 'N', 'fps', 'frameMean', 'frameP95', 'frameMax', 'dropped', 'workMean', 'workP95', 'jank%'],
    results.map((m) => [
      m.mode, m.n, m.achievedFps, m.meanFrameMs, m.p95FrameMs, m.maxFrameMs,
      m.droppedFrames, m.meanWorkMs, m.p95WorkMs, m.jankPct,
    ]),
  );
  if (errors.length) console.log(`\nPage errors:\n${errors.join('\n')}`);
  console.log(`\nWrote scripts/bench/results.json`);
}

await browser.close();
