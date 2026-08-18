/**
 * Shrinks the oversized demo GIFs and derives a video + poster for each.
 *
 * `scripts/record-gifs.js` captures at full frame rate and full size, which is
 * right for capture but produces files up to 11 MB. A README that leads with an
 * 11 MB image is a bad first impression on mobile and on npm, so this pass runs
 * afterwards.
 *
 * For every GIF over THRESHOLD_BYTES it writes:
 *
 * - `docs/assets/video/<name>.mp4`  — h264, for the root README. GitHub renders
 *   `<video>`; npm does not, which is why the GIF still has to exist.
 * - `docs/assets/video/<name>.png`  — a poster frame, also the still that npm
 *   falls back to if a `<video>` ever needs replacing.
 * - `<name>.gif` (rewritten in place) — reduced frame rate, scale and palette.
 *   Rewriting in place keeps every existing README and Storybook reference
 *   working, and is where most of the repo-weight saving comes from.
 *
 * Only h264 is emitted. VP9/WebM was measured on this content and came out
 * *larger* than h264 (2.2 MB vs 1.8 MB on `av-lidar`), so it earns nothing.
 *
 * Idempotent in the sense that re-running re-derives from whatever the GIF
 * currently is — so do not run it twice expecting the same output. Re-record
 * with `record-gifs.js` first if you need to start clean.
 *
 * Requires `ffmpeg` on PATH. Usage: `node scripts/optimize-gifs.mjs`
 */
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';

const THRESHOLD_BYTES = 2 * 1024 * 1024;

const GIF_DIRS = ['apps/storybook/public/gifs', 'docs/assets'];
const VIDEO_OUT = 'docs/assets/video';

/** Frames per second for the reduced GIF. Motion stays readable at 10. */
const GIF_FPS = 10;
/** Horizontal scale for the reduced GIF, relative to the capture. */
const GIF_SCALE = 0.55;
/** Palette size for the reduced GIF. */
const GIF_COLORS = 64;

const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'pipe' });

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function collect() {
  const out = [];
  for (const dir of GIF_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (extname(name) !== '.gif') continue;
      const path = join(dir, name);
      const size = statSync(path).size;
      if (size > THRESHOLD_BYTES) out.push({ path, name: basename(name, '.gif'), size });
    }
  }
  return out.sort((a, b) => b.size - a.size);
}

const targets = collect();

if (targets.length === 0) {
  console.log(`Nothing over ${mb(THRESHOLD_BYTES)}.`);
  process.exit(0);
}

mkdirSync(VIDEO_OUT, { recursive: true });

let before = 0;
let after = 0;

for (const { path, name, size } of targets) {
  const mp4 = join(VIDEO_OUT, `${name}.mp4`);
  const png = join(VIDEO_OUT, `${name}.png`);

  // h264 at 20fps. `trunc(iw/2)*2` because yuv420p requires even dimensions.
  ff([
    '-i', path,
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    '-vf', 'fps=20,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-an',
    mp4,
  ]);

  // Frame 8 rather than 0 — the first frames are often a blank canvas.
  ff(['-i', path, '-vf', `select=eq(n\\,8),scale=iw*${GIF_SCALE}:-1`, '-vframes', '1', png]);

  // Reduced GIF, written over the original.
  const tmp = join(VIDEO_OUT, `${name}.tmp.gif`);
  ff([
    '-i', path,
    '-vf',
    `fps=${GIF_FPS},scale=iw*${GIF_SCALE}:-1:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=${GIF_COLORS}[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    tmp,
  ]);
  execFileSync('mv', [tmp, path]);

  const now = statSync(path).size;
  before += size;
  after += now + statSync(mp4).size + statSync(png).size;

  console.log(
    `${path.padEnd(50)} ${mb(size).padStart(8)} -> gif ${mb(now).padStart(8)}` +
      `  mp4 ${mb(statSync(mp4).size).padStart(8)}  png ${mb(statSync(png).size).padStart(8)}`,
  );
}

console.log(`\n${targets.length} files. GIF bytes ${mb(before)} -> ${mb(after)} including derived video + posters.`);
