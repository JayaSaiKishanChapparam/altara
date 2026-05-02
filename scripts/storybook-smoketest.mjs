/**
 * Storybook smoke test. Visits every Telemetry/* story in the running
 * Storybook, captures console + page errors, screenshots each, and
 * exits non-zero if any story emits an error.
 *
 * Usage: node scripts/storybook-smoketest.mjs
 * Assumes: pnpm --filter @altara/docs storybook  is running on :6006
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, '../.smoketest-screenshots');
const STORYBOOK_URL = 'http://localhost:6006';
const SETTLE_MS = 3500;

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const indexRes = await fetch(`${STORYBOOK_URL}/index.json`);
if (!indexRes.ok) {
  console.error(`Failed to fetch ${STORYBOOK_URL}/index.json — is Storybook running?`);
  process.exit(1);
}
const index = await indexRes.json();
const PREFIX = process.env.SMOKETEST_PREFIX ?? 'Telemetry/';
const stories = Object.values(index.entries).filter(
  (e) => e.type === 'story' && e.title?.startsWith(PREFIX),
);

console.log(`Found ${stories.length} Telemetry/* stories.`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });

const results = [];

for (const story of stories) {
  const errors = [];
  const consoleErrors = [];
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Expected: WithROS2 stories try to connect to ws://localhost:9090
    // and a missing rosbridge server is fine — the components render the
    // 'connecting' state correctly.
    if (
      /WebSocket connection to .*9090.* failed/i.test(text) ||
      /ERR_CONNECTION_REFUSED/.test(text)
    ) {
      return;
    }
    consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    errors.push(err.message + '\n' + (err.stack ?? ''));
  });

  const url = `${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`;
  let navError = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForTimeout(SETTLE_MS);
  } catch (e) {
    navError = e.message;
  }

  const safeName = story.id.replace(/[^a-z0-9-]/gi, '_');
  const screenshotPath = resolve(SCREENSHOT_DIR, `${safeName}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch {
    // ignore screenshot failures — they often follow page errors
  }

  results.push({
    id: story.id,
    title: story.title,
    name: story.name,
    navError,
    pageErrors: errors,
    consoleErrors,
    screenshot: screenshotPath,
  });

  await page.close();
}

await browser.close();

const failed = results.filter(
  (r) => r.navError || r.pageErrors.length > 0 || r.consoleErrors.length > 0,
);

const report = {
  total: results.length,
  failed: failed.length,
  results,
};

writeFileSync(
  resolve(SCREENSHOT_DIR, 'report.json'),
  JSON.stringify(report, null, 2),
);

console.log(`\n=== Storybook smoke test summary ===`);
console.log(`Total stories visited: ${results.length}`);
console.log(`Stories with errors:   ${failed.length}\n`);

for (const r of failed) {
  console.log(`✗ ${r.title} — ${r.name}`);
  if (r.navError) console.log(`    nav error: ${r.navError}`);
  for (const e of r.pageErrors) {
    console.log(`    page error: ${e.split('\n')[0]}`);
  }
  for (const c of r.consoleErrors) {
    console.log(`    console.error: ${c}`);
  }
  console.log('');
}

if (failed.length === 0) {
  console.log('All stories rendered without errors.');
} else {
  console.log(`Screenshots + report.json: ${SCREENSHOT_DIR}`);
}

process.exit(failed.length > 0 ? 1 : 0);
