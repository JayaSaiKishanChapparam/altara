#!/usr/bin/env node
/**
 * Record demo GIFs of selected Storybook stories using Playwright,
 * then convert each WebM → optimised GIF via a two-pass ffmpeg
 * palette pipeline. Output lands in apps/storybook/public/gifs/ so
 * Storybook serves them at /gifs/*.gif (and the same files are linked
 * from the README hero shot).
 *
 * Usage:
 *   1. In one terminal: pnpm --filter @altara/storybook storybook
 *   2. Wait until http://localhost:6006 is ready.
 *   3. In a second terminal: node scripts/record-gifs.js
 *
 * Requirements:
 *   - playwright (installed at the repo root: `pnpm add -Dw playwright`)
 *   - chromium  (`npx playwright install chromium`)
 *   - ffmpeg    (`brew install ffmpeg` / `apt install ffmpeg`)
 */
const { chromium } = require('playwright');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const STORYBOOK = process.env.STORYBOOK_URL || 'http://localhost:6006';
const OUT = path.join(__dirname, '../apps/storybook/public/gifs');
const TMP = path.join(__dirname, '../.gif-tmp');

// Stories to record. IDs match the entries in Storybook's /index.json.
//
// Set STORY_FILTER=<substring> to record only entries whose `name` contains
// it (case-insensitive). Useful when adding new stories — avoids
// re-recording the entire set.
const ALL_STORIES = [
  { id: 'dashboard--hero', name: 'hero', w: 1200, h: 700, ms: 12_000 },
  { id: 'components-timeseries--multi-channel', name: 'time-series', w: 800, h: 300, ms: 8000 },
  { id: 'components-gauge--sizes', name: 'gauge', w: 500, h: 300, ms: 6000 },
  { id: 'components-attitude--combined-motion', name: 'attitude', w: 400, h: 400, ms: 8000 },
  { id: 'components-signalpanel--default', name: 'signal-panel', w: 500, h: 400, ms: 6000 },
  { id: 'components-livemap--default', name: 'live-map', w: 700, h: 400, ms: 10_000 },
  // ── @altara/aerospace ───────────────────────────────────────────────
  { id: 'aerospace-primaryflightdisplay--default', name: 'aerospace-pfd', w: 520, h: 390, ms: 8000 },
  { id: 'aerospace-primaryflightdisplay--with-flight-director', name: 'aerospace-pfd-fd', w: 680, h: 510, ms: 8000 },
  { id: 'aerospace-horizontalsituationindicator--default', name: 'aerospace-hsi', w: 280, h: 280, ms: 8000 },
  { id: 'aerospace-airspeedindicator--default', name: 'aerospace-asi', w: 180, h: 180, ms: 6000 },
  { id: 'aerospace-terrainawareness--default', name: 'aerospace-taws', w: 360, h: 240, ms: 8000 },
  { id: 'aerospace-tcasdisplay--default', name: 'aerospace-tcas', w: 320, h: 320, ms: 8000 },
  // ── @altara/av ──────────────────────────────────────────────────────
  { id: 'av-lidarpointcloud--default', name: 'av-lidar', w: 520, h: 320, ms: 6000 },
  { id: 'av-occupancygrid--default', name: 'av-occgrid', w: 480, h: 480, ms: 8000 },
  { id: 'av-radarsweep--default', name: 'av-radar', w: 380, h: 380, ms: 8000 },
  { id: 'av-controltrace--default', name: 'av-controltrace', w: 720, h: 320, ms: 8000 },
  { id: 'av-perceptionstatemachine--default', name: 'av-perception', w: 720, h: 240, ms: 9000 },
  { id: 'av-slammap--default', name: 'av-slam', w: 480, h: 480, ms: 9000 },
];

const STORY_FILTER = (process.env.STORY_FILTER || '').toLowerCase();
const STORIES = STORY_FILTER
  ? ALL_STORIES.filter((s) => s.name.toLowerCase().includes(STORY_FILTER))
  : ALL_STORIES;

function which(bin) {
  try {
    execSync(`which ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function recordOne(browser, story) {
  // Each story gets its own browser context so we can size the recording
  // canvas to the story's natural dimensions.
  const ctx = await browser.newContext({
    viewport: { width: story.w, height: story.h },
    recordVideo: { dir: TMP, size: { width: story.w, height: story.h } },
  });
  const page = await ctx.newPage();
  // `theme:Dark` (capitalized) matches the key in addon-themes' `themes`
  // map in apps/storybook/.storybook/preview.tsx. Lowercase silently
  // fails — withThemeByDataAttribute writes the literal string
  // "undefined" to the data attribute and the dark-theme tokens never apply.
  const url = `${STORYBOOK}/iframe.html?id=${story.id}&viewMode=story&globals=theme:Dark`;
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  // Let the canvas / mock data prime before we start recording in earnest.
  await page.waitForTimeout(800);
  await page.waitForTimeout(story.ms);

  // Capture the underlying video file path before closing the page.
  const video = page.video();
  await page.close();
  await ctx.close();
  if (!video) throw new Error(`No video captured for ${story.id}`);
  const webm = await video.path();

  const gif = path.join(OUT, `${story.name}.gif`);
  const palette = path.join(TMP, `${story.name}.palette.png`);

  // Two-pass ffmpeg — palette generation then paletteuse for clean color.
  //
  // Trim the first 0.8 s (`-ss 0.8`) so the GIF doesn't open with the
  // pre-mount blank frame — that's the static thumbnail GitHub shows.
  //
  // 15 fps keeps file size manageable for telemetry traces (live-map's
  // tile imagery is the worst case — accept ~10–15 MB even at this fps).
  const fps = 15;
  const filter = `fps=${fps},scale=${story.w}:-1:flags=lanczos`;
  execSync(
    `ffmpeg -y -ss 0.8 -i "${webm}" -vf "${filter},palettegen=max_colors=128" "${palette}"`,
    { stdio: 'inherit' },
  );
  execSync(
    `ffmpeg -y -ss 0.8 -i "${webm}" -i "${palette}" -lavfi "${filter} [x];[x][1:v]paletteuse=dither=bayer" -loop 0 "${gif}"`,
    { stdio: 'inherit' },
  );
  fs.unlinkSync(webm);
  fs.unlinkSync(palette);
  console.log(`✓ ${path.relative(process.cwd(), gif)}`);
}

async function main() {
  if (!which('ffmpeg')) {
    console.error('ffmpeg is not on PATH. Install it: `brew install ffmpeg` or `apt install ffmpeg`.');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  // Probe Storybook before launching a browser — friendlier error message.
  const probe = await fetch(`${STORYBOOK}/index.json`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(
      `Could not reach ${STORYBOOK}/index.json. Start Storybook first:\n  pnpm --filter @altara/storybook storybook`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    for (const story of STORIES) {
      await recordOne(browser, story);
    }
  } finally {
    await browser.close();
    // Best-effort cleanup; OK if nothing's there.
    try {
      fs.rmSync(TMP, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  console.log(`\nAll GIFs landed in ${path.relative(process.cwd(), OUT)}.`);
  console.log('Copy the hero to the repo root for the README:');
  console.log('  cp apps/storybook/public/gifs/hero.gif ./hero.gif');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
