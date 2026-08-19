#!/usr/bin/env node
/**
 * Record the demo app's Replay tab being *scrubbed*, for the replay deep-dive
 * article. Companion to `scripts/record-gifs.js`, which records Storybook
 * stories that just sit there and animate — this one has to drive the transport
 * UI, because the interaction IS the subject.
 *
 * The choreography below is deliberate, not decoration:
 *
 *   1. ~4 s of 1x playback   — instruments live, TimeSeries scrolling.
 *   2. Pause, then a real mouse drag of the scrubber *backward* — this is the
 *      money shot: TimeSeries and LiveMap are keyed on `chartEpoch`, so a
 *      backward seek remounts them and they re-seed from `getHistory()`.
 *   3. Hold ~1.6 s on the scrubbed-to state so a reader can register that the
 *      playhead is mid-timeline, not at zero. The cover PNG is cut from here.
 *   4. 2x, resume — the chart visibly scrolls twice as fast.
 *
 * ## Why this doesn't use Playwright's `recordVideo`
 *
 * `record-gifs.js` records a WebM and transcodes it, which is fine for a small
 * looping story. It is not fine here. VP8 is lossy, so even a *frozen* page
 * differs pixel-for-pixel between frames, and that defeats the GIF encoder's
 * inter-frame transparency optimisation completely — measured on this exact
 * clip, 14 frames of a paused, motionless dashboard cost 556 KB via WebM
 * versus 124 KB (i.e. one frame) when the frames are byte-identical. The whole
 * 11 s clip came out at 9.4 MB.
 *
 * So frames come off CDP `Page.screencast` as lossless PNGs (~27 fps at
 * 2000x1560, fast enough not to disturb the interaction) and are resampled to
 * an exact 10 fps by nearest timestamp. Static regions then stay bit-identical
 * and compress to nothing.
 *
 * The session is SYNTHETIC (scripts/generate-synthetic-session.mjs). Nothing
 * here is a real flight and nothing should be captioned as one.
 *
 * Output, matching the docs/assets convention `record-gifs.js` established:
 *   docs/assets/replay-scrub.gif   capture-quality; `optimize-gifs.mjs` reduces it
 *   docs/assets/replay-cover.png   article cover — the paused, scrubbed-to frame
 *
 * Usage:
 *   1. pnpm --filter @altara/demo build
 *   2. pnpm --filter @altara/demo exec vite preview --port 4321
 *   3. node scripts/record-replay-gif.js
 *   4. node scripts/optimize-gifs.mjs
 */
const { chromium } = require('playwright');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DEMO = process.env.DEMO_URL || 'http://localhost:4321';
const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, '.gif-tmp/replay');

// 1820x1560 frames the whole GCS grid — transport, PFD, map, battery,
// SignalPanel, attitude, TimeSeries and EventLog — with nothing scrolled off.
// The width is chosen so `optimize-gifs.mjs`'s 0.55 scale lands the shipped
// GIF at ~1000 px; 1820 is also still wide enough for the two-up row, which
// needs ~1475 px before the fixed-width PFD starts to squeeze its card.
const W = 1820;
const H = 1560;

/** Output frame rate. Matches `optimize-gifs.mjs`'s GIF_FPS, so its `fps`
 *  filter is a no-op and never re-drops frames unevenly. */
const FPS = 10;

// Recording-time (ms into the synthetic session) the transport starts from.
// Far enough in that the EventLog has entries and the chart has history.
const START_AT = 34_000;
// Where the backward drag lands, as a fraction of the scrubber track. ~0.23 is
// unambiguously mid-timeline — the point of the cover frame.
const SCRUB_TO_FRACTION = 0.23;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(5, '0');

/** Drag the range input's thumb to `fraction` of its track, as a user would. */
async function dragScrubber(page, range, fraction, steps = 14) {
  const box = await range.boundingBox();
  const value = Number(await range.inputValue());
  const max = Number(await range.getAttribute('max'));
  // Chromium's range thumb is ~16px wide; the usable track is inset by half
  // that at each end. Close enough — 8px here is ~0.3s of a 60s recording.
  const inset = 8;
  const trackX = box.x + inset;
  const trackW = box.width - inset * 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(trackX + (value / max) * trackW, y);
  await page.mouse.down();
  await sleep(120);
  await page.mouse.move(trackX + fraction * trackW, y, { steps });
  await sleep(120);
  await page.mouse.up();
}

async function main() {
  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
  } catch {
    console.error('ffmpeg is not on PATH. `brew install ffmpeg`.');
    process.exit(1);
  }
  const probe = await fetch(DEMO).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(
      `Could not reach ${DEMO}. Start the demo first:\n` +
        '  pnpm --filter @altara/demo build\n' +
        '  pnpm --filter @altara/demo exec vite preview --port 4321',
    );
    process.exit(1);
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'seq'), { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();

  await page.goto(DEMO, { waitUntil: 'load', timeout: 30_000 });
  await page.getByRole('tab', { name: 'Replay' }).click();
  await page.waitForSelector('input[type="range"]');
  const range = page.locator('input[type="range"]');

  // ── Setup, before a single frame is captured ────────────────────────────
  // Jump forward first, then let it run: OSM tiles need a beat to land, and
  // TimeSeries needs a beat to fill its 20 s window with post-seek samples.
  await sleep(1200);
  const max = Number(await range.getAttribute('max'));
  await dragScrubber(page, range, START_AT / max, 6);
  await page.waitForFunction(
    () => document.querySelectorAll('.leaflet-tile-loaded').length >= 12,
    undefined,
    { timeout: 20_000 },
  );
  await sleep(8000);

  // ── Capture ─────────────────────────────────────────────────────────────
  const frames = [];
  const writes = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', (f) => {
    const i = frames.length;
    frames.push({ ts: f.metadata.timestamp, arrived: Date.now() });
    const file = path.join(TMP, 'raw', `f${pad(i)}.png`);
    writes.push(fs.promises.writeFile(file, Buffer.from(f.data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'png',
    maxWidth: W,
    maxHeight: H,
    everyNthFrame: 1,
  });
  await sleep(500); // let the first frames flow before the clip proper starts

  const marks = {};
  const clipStart = Date.now();
  const mark = (name) => {
    marks[name] = (Date.now() - clipStart) / 1000;
  };

  mark('play1x');
  await sleep(4000);

  mark('pause');
  await page.getByRole('button', { name: 'Pause' }).click();
  await sleep(400);

  mark('scrubStart');
  await dragScrubber(page, range, SCRUB_TO_FRACTION);
  mark('scrubEnd');
  const scrubbedTo = Number(await range.inputValue());
  await sleep(1600);

  mark('speed2x');
  await page.getByRole('button', { name: '2×' }).click();
  await sleep(400);
  await page.getByRole('button', { name: 'Play' }).click();

  mark('play2x');
  await sleep(4200);
  mark('end');

  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  await Promise.all(writes);
  await browser.close();

  if (frames.length < 30) throw new Error(`only ${frames.length} frames captured`);

  // ── Resample to an exact FPS by nearest timestamp ────────────────────────
  // `metadata.timestamp` is the compositor's swap time in seconds; `arrived`
  // is wall-clock, and is what the marks above are in. Anchor one to the other
  // on the frame nearest the start of the clip.
  const startIdx = frames.reduce(
    (best, f, i) => (Math.abs(f.arrived - clipStart) < Math.abs(frames[best].arrived - clipStart) ? i : best),
    0,
  );
  const tsAtClipStart = frames[startIdx].ts;
  const toTs = (clipSeconds) => tsAtClipStart + clipSeconds;

  const nearest = (ts) =>
    frames.reduce((best, f, i) => (Math.abs(f.ts - ts) < Math.abs(frames[best].ts - ts) ? i : best), 0);

  const duration = marks.end;
  const count = Math.floor(duration * FPS);
  for (let i = 0; i < count; i++) {
    const src = path.join(TMP, 'raw', `f${pad(nearest(toTs(i / FPS)))}.png`);
    // Hardlink rather than copy — the raw set is ~400 MB.
    fs.linkSync(src, path.join(TMP, 'seq', `s${pad(i)}.png`));
  }

  // Mid-hold on the scrubbed-to state: paused, playhead visibly mid-timeline.
  const posterIdx = nearest(toTs((marks.scrubEnd + marks.speed2x) / 2));

  console.log(
    `captured ${frames.length} frames over ${(frames[frames.length - 1].ts - frames[0].ts).toFixed(2)}s ` +
      `(${(frames.length / (frames[frames.length - 1].ts - frames[0].ts)).toFixed(1)} fps) ` +
      `-> ${count} frames @ ${FPS} fps`,
  );
  console.log(
    `clip ${duration.toFixed(2)}s  scrubbedTo ${(scrubbedTo / 1000).toFixed(1)}s / ${(max / 1000).toFixed(1)}s ` +
      `(${((scrubbedTo / max) * 100).toFixed(0)}% along)`,
  );
  console.log('marks:', JSON.stringify(marks));

  const outDir = path.join(ROOT, 'docs/assets');
  fs.mkdirSync(outDir, { recursive: true });
  const gif = path.join(outDir, 'replay-scrub.gif');

  // Same single-pass split/palettegen/paletteuse shape `optimize-gifs.mjs`
  // uses. `dither: none` because the OSM tiles are photographic and mostly
  // static — dithering them makes every frame differ everywhere.
  execSync(
    `ffmpeg -y -v error -framerate ${FPS} -i "${path.join(TMP, 'seq', `s%05d.png`)}" ` +
      `-vf "split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none" ` +
      `-loop 0 "${gif}"`,
    { stdio: 'inherit' },
  );

  // Cover still, cut from the lossless frame rather than the palettised GIF —
  // dev.to's cover_image is static-only, so this is the article's face.
  const cover = path.join(outDir, 'replay-cover.png');
  execSync(
    `ffmpeg -y -v error -i "${path.join(TMP, 'raw', `f${pad(posterIdx)}.png`)}" ` +
      `-vf "scale=1200:-1:flags=lanczos" "${cover}"`,
    { stdio: 'inherit' },
  );

  fs.writeFileSync(
    path.join(TMP, 'marks.json'),
    JSON.stringify({ duration, count, posterIdx, scrubbedTo, max, marks }, null, 2),
  );

  for (const f of [gif, cover]) {
    console.log(`✓ ${path.relative(ROOT, f)}  ${(fs.statSync(f).size / 1024 / 1024).toFixed(2)} MB`);
  }
  console.log('\nNow reduce it and derive the mp4 + poster:\n  node scripts/optimize-gifs.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
