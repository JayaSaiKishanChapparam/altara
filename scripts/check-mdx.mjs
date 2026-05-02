/**
 * Visit every MDX page in Storybook (`type: 'docs'` entries from
 * `Altara/`, `Guides/`, `Cookbook/`, `Comparisons/`) and confirm:
 *  - the page loads without page errors
 *  - sentinel content from the MDX appears
 */
import { chromium } from 'playwright';

const STORYBOOK = 'http://localhost:6006';

const indexRes = await fetch(`${STORYBOOK}/index.json`);
const index = await indexRes.json();
const docs = Object.values(index.entries).filter((e) => {
  if (e.type !== 'docs') return false;
  const title = e.title ?? '';
  return (
    title.startsWith('Altara/') ||
    title.startsWith('Guides/') ||
    title.startsWith('Cookbook/') ||
    title.startsWith('Comparisons/')
  );
});

const sentinels = {
  'Altara/Introduction': 'Real-time telemetry UI for React',
  'Guides/Getting started': 'Render your first component',
  'Guides/Connecting ROS2': 'Start rosbridge',
  'Guides/Connecting MQTT': 'MQTT-over-WebSocket adapter',
  'Guides/Mock data': 'four built-in generators',
  'Guides/Theming': 'CSS custom properties exclusively',
  'Guides/Performance': 'Web Worker pipeline',
  'Cookbook/Drone dashboard': 'ground-control-station',
  'Cookbook/Robot arm monitor': 'six-DOF robotic arm',
  'Cookbook/IoT sensor grid': 'twelve sensors over MQTT',
  'Comparisons/Altara vs Grafana': 'Use Grafana when',
  'Comparisons/Altara vs Foxglove': 'Use Foxglove when',
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });

let allOk = true;
for (const entry of docs) {
  const page = await ctx.newPage();
  let pageError = null;
  page.on('pageerror', (e) => {
    pageError = e.message;
  });
  await page.goto(`${STORYBOOK}/iframe.html?id=${entry.id}&viewMode=docs`, {
    waitUntil: 'load',
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);

  const text = await page.evaluate(() => document.body.innerText);
  const sentinel = sentinels[entry.title];
  const found = sentinel ? text.includes(sentinel) : true;
  if (!pageError && found) {
    console.log(`✓ ${entry.title}`);
  } else {
    allOk = false;
    console.log(`✗ ${entry.title}`);
    if (pageError) console.log(`    page error: ${pageError}`);
    if (!found) console.log(`    sentinel missing: ${JSON.stringify(sentinel)}`);
  }
  await page.close();
}

await browser.close();
process.exit(allOk ? 0 : 1);
