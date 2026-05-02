/**
 * Verify the autodocs Docs tab is reading JSDoc for every Components/*
 * page. Checks for distinctive prop-description text we wrote in Phase 2.
 */
import { chromium } from 'playwright';

const STORYBOOK = 'http://localhost:6006';

// Per-component sentinel substrings drawn from JSDoc just added.
// If these appear in the Docs tab, the JSDoc is wired up correctly.
const checks = [
  ['components-timeseries--api-reference', ['Visible time window', 'Per-channel ring-buffer']],
  ['components-gauge--api-reference', ['Minimum displayable value', 'Maximum displayable value']],
  ['components-attitude--api-reference', ['Roll in degrees', 'Outer diameter in pixels']],
  ['components-signalpanel--api-reference', ['Signals to display']],
  ['components-livemap--api-reference', ['Latest GPS fix']],
  ['components-eventlog--api-reference', ['Entries to display', 'Severity filter']],
  ['components-connectionbar--api-reference', ['Round-trip latency']],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });

let allOk = true;
for (const [id, sentinels] of checks) {
  const page = await ctx.newPage();
  await page.goto(`${STORYBOOK}/iframe.html?id=${id}&viewMode=docs`, {
    waitUntil: 'load',
    timeout: 20_000,
  });
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText);
  const missing = sentinels.filter((s) => !text.includes(s));
  if (missing.length === 0) {
    console.log(`✓ ${id}`);
  } else {
    allOk = false;
    console.log(`✗ ${id} — missing: ${JSON.stringify(missing)}`);
  }
  await page.close();
}

await browser.close();
process.exit(allOk ? 0 : 1);
