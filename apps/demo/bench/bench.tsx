/**
 * Canvas vs SVG benchmark harness.
 *
 * Renders N "telemetry-ish" widgets (a rotating needle, a numeric readout, and
 * a scrolling sparkline) three ways and measures frame timing as N scales. All
 * three paths draw the identical picture from the identical per-frame math, so
 * the only variable is how the picture reaches the screen:
 *
 *  - svg-react      React owns the DOM. Each frame bumps state and flushSync-
 *                   commits, so React reconciles the whole <svg> subtree. This
 *                   measures React reconciliation + SVG, not SVG alone.
 *  - svg-imperative The SVG node tree is built ONCE at mount; one shared rAF
 *                   loop mutates nodes by ref (transform / textContent / points).
 *                   Zero React in the hot path — isolates the raw SVG/DOM cost.
 *  - canvas         One <canvas>, one rAF loop, clearRect + full repaint. No
 *                   React state in the hot path (Altara's shipped architecture).
 *
 * The decomposition the article needs:
 *   svg-react − svg-imperative = React reconciliation cost
 *   svg-imperative − canvas    = genuine SVG/DOM format cost (mutate+layout+paint)
 *
 * A second, separate bench (alloc-copy vs alloc-reuse) measures the RingBuffer
 * per-frame allocation effect using the real @altara/core RingBuffer.
 *
 * Run it yourself:
 *   pnpm install
 *   pnpm --filter @altara/demo dev
 *   open http://localhost:5173/bench/
 *
 * Or headless via the Playwright runner: node scripts/bench/run-bench.mjs
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
// Import RingBuffer straight from source so the alloc bench reflects the current
// implementation without a package rebuild.
import { RingBuffer } from '../../../packages/core/src/utils/RingBuffer';

const STAGE_H = 420;
const TARGET_FPS = 60;
const FRAME_BUDGET_MS = 1000 / TARGET_FPS; // 16.667
const SPARK_POINTS = 24;

type RenderMode = 'svg-react' | 'svg-imperative' | 'canvas';

interface Metrics {
  mode: RenderMode;
  n: number;
  frames: number;
  durationMs: number;
  achievedFps: number;
  meanFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  /** Frames whose interval missed the next vsync deadline (>1.5x budget). */
  droppedFrames: number;
  /** % of frames whose JS work alone exceeded the 16.67ms budget. */
  jankPct: number;
  meanWorkMs: number;
  p95WorkMs: number;
}

// ---- shared geometry -------------------------------------------------------

interface Layout {
  cols: number;
  rows: number;
  cell: number;
  cx: (i: number) => number;
  cy: (i: number) => number;
}

function layoutFor(n: number, width: number, height: number): Layout {
  const cols = Math.ceil(Math.sqrt((n * width) / height));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(width / cols, height / rows);
  return {
    cols,
    rows,
    cell,
    cx: (i) => (i % cols) * cell + cell / 2,
    cy: (i) => Math.floor(i / cols) * cell + cell / 2,
  };
}

function needleAngle(t: number, i: number): number {
  return Math.sin(t * 0.8 + i) * 60; // degrees
}
function readout(t: number, i: number): number {
  return 50 + 50 * Math.sin(t * 0.5 + i);
}
function sparkY(t: number, i: number, k: number): number {
  return Math.sin(t * 2 + i + k * 0.3);
}

const PALETTE = ['#378ADD', '#1D9E75', '#EF9F27', '#E24B4A', '#9E7CD5', '#3FBFB5'];

// ---- svg-react renderer (React-driven attribute updates) -------------------

function SvgGrid({ n, t, layout }: { n: number; t: number; layout: Layout }) {
  const { cell } = layout;
  const r = cell * 0.32;
  const items = [];
  for (let i = 0; i < n; i++) {
    const cx = layout.cx(i);
    const cy = layout.cy(i);
    const color = PALETTE[i % PALETTE.length]!;
    const ang = (needleAngle(t, i) * Math.PI) / 180;
    const nx = cx + r * Math.sin(ang);
    const ny = cy - r * Math.cos(ang);
    let pts = '';
    const sw = cell * 0.7;
    for (let k = 0; k < SPARK_POINTS; k++) {
      const px = cx - sw / 2 + (sw * k) / (SPARK_POINTS - 1);
      const py = cy + r + 6 + sparkY(t, i, k) * (cell * 0.12);
      pts += `${px.toFixed(1)},${py.toFixed(1)} `;
    }
    items.push(
      <g key={i}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2e3133" strokeWidth={1} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1} opacity={0.8} />
        <text x={cx} y={cy - r - 4} fill="#e8e6df" fontSize={10} textAnchor="middle">
          {readout(t, i).toFixed(1)}
        </text>
      </g>,
    );
  }
  return (
    <svg width="100%" height={STAGE_H} viewBox={`0 0 ${layout.cols * cell} ${layout.rows * cell}`}>
      {items}
    </svg>
  );
}

// ---- svg-imperative scene (built once, mutated by ref) ---------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

interface ImperativeScene {
  needles: SVGLineElement[];
  texts: SVGTextElement[];
  sparks: SVGPolylineElement[];
  cxs: number[];
  cys: number[];
  r: number;
  cell: number;
}

function buildSvgScene(host: HTMLElement, n: number, layout: Layout): ImperativeScene {
  const { cell, cols, rows } = layout;
  const r = cell * 0.32;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(STAGE_H));
  svg.setAttribute('viewBox', `0 0 ${cols * cell} ${rows * cell}`);
  const needles: SVGLineElement[] = [];
  const texts: SVGTextElement[] = [];
  const sparks: SVGPolylineElement[] = [];
  const cxs: number[] = [];
  const cys: number[] = [];
  for (let i = 0; i < n; i++) {
    const cx = layout.cx(i);
    const cy = layout.cy(i);
    cxs.push(cx);
    cys.push(cy);
    const color = PALETTE[i % PALETTE.length]!;
    const g = document.createElementNS(SVG_NS, 'g');
    const dial = document.createElementNS(SVG_NS, 'circle');
    dial.setAttribute('cx', String(cx));
    dial.setAttribute('cy', String(cy));
    dial.setAttribute('r', String(r));
    dial.setAttribute('fill', 'none');
    dial.setAttribute('stroke', '#2e3133');
    dial.setAttribute('stroke-width', '1');
    // Needle drawn pointing straight up; rotated each frame via transform —
    // rotate(deg cx cy) maps the up-vector to (cx+r·sin, cy−r·cos), identical
    // to the canvas/react needle math.
    const needle = document.createElementNS(SVG_NS, 'line');
    needle.setAttribute('x1', String(cx));
    needle.setAttribute('y1', String(cy));
    needle.setAttribute('x2', String(cx));
    needle.setAttribute('y2', String(cy - r));
    needle.setAttribute('stroke', color);
    needle.setAttribute('stroke-width', '2');
    const spark = document.createElementNS(SVG_NS, 'polyline');
    spark.setAttribute('fill', 'none');
    spark.setAttribute('stroke', color);
    spark.setAttribute('stroke-width', '1');
    spark.setAttribute('opacity', '0.8');
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy - r - 4));
    text.setAttribute('fill', '#e8e6df');
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle');
    g.append(dial, needle, spark, text);
    svg.appendChild(g);
    needles.push(needle);
    texts.push(text);
    sparks.push(spark);
  }
  host.appendChild(svg);
  return { needles, texts, sparks, cxs, cys, r, cell };
}

function updateSvgScene(scene: ImperativeScene, n: number, t: number) {
  const { cell } = scene;
  const sw = cell * 0.7;
  for (let i = 0; i < n; i++) {
    const cx = scene.cxs[i]!;
    const cy = scene.cys[i]!;
    scene.needles[i]!.setAttribute(
      'transform',
      `rotate(${needleAngle(t, i).toFixed(2)} ${cx} ${cy})`,
    );
    scene.texts[i]!.textContent = readout(t, i).toFixed(1);
    let pts = '';
    for (let k = 0; k < SPARK_POINTS; k++) {
      const px = cx - sw / 2 + (sw * k) / (SPARK_POINTS - 1);
      const py = cy + scene.r + 6 + sparkY(t, i, k) * (cell * 0.12);
      pts += `${px.toFixed(1)},${py.toFixed(1)} `;
    }
    scene.sparks[i]!.setAttribute('points', pts);
  }
}

// ---- canvas renderer (one rAF loop, full repaint) --------------------------

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  n: number,
  t: number,
  layout: Layout,
  cssW: number,
  cssH: number,
) {
  const { cell } = layout;
  const r = cell * 0.32;
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#181a1b';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const cx = layout.cx(i);
    const cy = layout.cy(i);
    const color = PALETTE[i % PALETTE.length]!;
    ctx.strokeStyle = '#2e3133';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const ang = (needleAngle(t, i) * Math.PI) / 180;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.sin(ang), cy - r * Math.cos(ang));
    ctx.stroke();
    const sw = cell * 0.7;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < SPARK_POINTS; k++) {
      const px = cx - sw / 2 + (sw * k) / (SPARK_POINTS - 1);
      const py = cy + r + 6 + sparkY(t, i, k) * (cell * 0.12);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8e6df';
    ctx.fillText(readout(t, i).toFixed(1), cx, cy - r - 4);
  }
}

// ---- measurement -----------------------------------------------------------

const WARMUP_FRAMES = 30;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function summarize(
  mode: RenderMode,
  n: number,
  frameDeltas: number[],
  workTimes: number[],
): Metrics {
  const totalMs = frameDeltas.reduce((a, b) => a + b, 0);
  const sortedDelta = [...frameDeltas].sort((a, b) => a - b);
  const sortedWork = [...workTimes].sort((a, b) => a - b);
  const dropped = frameDeltas.filter((d) => d > FRAME_BUDGET_MS * 1.5).length;
  const jank = workTimes.filter((w) => w > FRAME_BUDGET_MS).length;
  return {
    mode,
    n,
    frames: frameDeltas.length,
    durationMs: Math.round(totalMs),
    achievedFps: +((frameDeltas.length / totalMs) * 1000).toFixed(1),
    meanFrameMs: +(totalMs / frameDeltas.length).toFixed(2),
    p95FrameMs: +percentile(sortedDelta, 95).toFixed(2),
    maxFrameMs: +Math.max(...frameDeltas).toFixed(2),
    droppedFrames: dropped,
    jankPct: +((jank / workTimes.length) * 100).toFixed(1),
    meanWorkMs: +(sortedWork.reduce((a, b) => a + b, 0) / sortedWork.length).toFixed(2),
    p95WorkMs: +percentile(sortedWork, 95).toFixed(2),
  };
}

const stage = document.getElementById('stage')!;
const out = document.getElementById('out')!;

function clearStage() {
  stage.replaceChildren();
}

/** Shared driver: one rAF loop, a per-frame `step(t)` callback that does the work. */
function measure(
  mode: RenderMode,
  n: number,
  durationMs: number,
  step: (t: number) => void,
  teardown: () => void,
): Promise<Metrics> {
  const frameDeltas: number[] = [];
  const workTimes: number[] = [];
  return new Promise((resolve) => {
    let frame = 0;
    let last = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const t = (now - start) / 1000;
      const w0 = performance.now();
      step(t);
      const work = performance.now() - w0;
      if (frame > WARMUP_FRAMES) {
        if (last !== 0) frameDeltas.push(now - last);
        workTimes.push(work);
      }
      last = now;
      frame++;
      if (now - start < durationMs) requestAnimationFrame(tick);
      else {
        teardown();
        resolve(summarize(mode, n, frameDeltas, workTimes));
      }
    };
    requestAnimationFrame(tick);
  });
}

function runCanvas(n: number, durationMs: number): Promise<Metrics> {
  clearStage();
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  const cssW = stage.clientWidth;
  const cssH = STAGE_H;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const layout = layoutFor(n, cssW, cssH);
  return measure(
    'canvas',
    n,
    durationMs,
    (t) => drawCanvas(ctx, n, t, layout, cssW, cssH),
    () => {},
  );
}

function runSvgReact(n: number, durationMs: number): Promise<Metrics> {
  clearStage();
  const host = document.createElement('div');
  stage.appendChild(host);
  const cssW = stage.clientWidth;
  const layout = layoutFor(n, cssW, STAGE_H);
  const root: Root = createRoot(host);
  return measure(
    'svg-react',
    n,
    durationMs,
    (t) => {
      // flushSync forces React to reconcile + commit now; getBoundingClientRect
      // forces layout, so the measured work covers reconcile + writes + layout.
      flushSync(() => root.render(<SvgGrid n={n} t={t} layout={layout} />));
      void host.getBoundingClientRect().height;
    },
    () => root.unmount(),
  );
}

function runSvgImperative(n: number, durationMs: number): Promise<Metrics> {
  clearStage();
  const host = document.createElement('div');
  stage.appendChild(host);
  const cssW = stage.clientWidth;
  const layout = layoutFor(n, cssW, STAGE_H);
  const scene = buildSvgScene(host, n, layout);
  return measure(
    'svg-imperative',
    n,
    durationMs,
    (t) => {
      updateSvgScene(scene, n, t);
      // Force layout, matching the svg-react measurement window.
      void host.getBoundingClientRect().height;
    },
    () => {},
  );
}

function run(mode: RenderMode, n: number, durationMs = 4000): Promise<Metrics> {
  if (mode === 'canvas') return runCanvas(n, durationMs);
  if (mode === 'svg-imperative') return runSvgImperative(n, durationMs);
  return runSvgReact(n, durationMs);
}

function fmt(m: Metrics): string {
  return (
    `${m.mode.padEnd(15)} N=${String(m.n).padStart(4)}  ` +
    `fps=${String(m.achievedFps).padStart(5)}  ` +
    `frame mean=${String(m.meanFrameMs).padStart(6)}ms p95=${String(m.p95FrameMs).padStart(6)}ms max=${String(m.maxFrameMs).padStart(7)}ms  ` +
    `dropped=${String(m.droppedFrames).padStart(3)}  ` +
    `work mean=${String(m.meanWorkMs).padStart(6)}ms p95=${String(m.p95WorkMs).padStart(6)}ms  ` +
    `jank=${m.jankPct}%`
  );
}

const RENDER_MODES: RenderMode[] = ['svg-react', 'svg-imperative', 'canvas'];

async function runMatrix(ns = [1, 50, 200], durationMs = 4000): Promise<Metrics[]> {
  const results: Metrics[] = [];
  for (const mode of RENDER_MODES) {
    for (const n of ns) {
      out.textContent = `running ${mode} N=${n} ...`;
      results.push(await run(mode, n, durationMs));
      out.textContent = results.map(fmt).join('\n');
    }
  }
  clearStage();
  return results;
}

// ---- allocation bench (real RingBuffer: copy vs reuse) ---------------------

type AllocMode = 'alloc-copy' | 'alloc-reuse';

interface AllocMetrics {
  mode: AllocMode;
  channels: number;
  bufferSize: number;
  allocPerFrame: number;
  frames: number;
  durationMs: number;
  p50FrameMs: number;
  p99FrameMs: number;
  maxFrameMs: number;
  /** Frames over 1.5x budget (~25ms) — vsync misses. */
  longFrames25: number;
  /** Frames over 50ms — the spikes that read as visible stutter. */
  longFrames50: number;
  /** Per-frame JS work (read+scan, incl. any synchronous GC pause). */
  workP50Ms: number;
  workP99Ms: number;
  workMaxMs: number;
  /** Work spikes >5ms — GC pauses that frame-delta hides under vsync. */
  workSpikes5: number;
}

function runAlloc(
  mode: AllocMode,
  channels: number,
  bufferSize: number,
  durationMs: number,
): Promise<AllocMetrics> {
  clearStage();

  // Build `channels` ring buffers filled to capacity, mirroring a live dashboard.
  const buffers: RingBuffer[] = [];
  for (let c = 0; c < channels; c++) {
    const rb = new RingBuffer(bufferSize);
    for (let i = 0; i < bufferSize; i++) rb.push(Math.sin(i * 0.01 + c), i);
    buffers.push(rb);
  }
  // Reusable scratch for the reuse path.
  const scratchV = buffers.map(() => new Float64Array(bufferSize));
  const scratchT = buffers.map(() => new Float64Array(bufferSize));

  const allocPerFrame = mode === 'alloc-copy' ? channels * 4 : 0;
  const frameDeltas: number[] = [];
  const workTimes: number[] = [];
  let checksum = 0;

  // Both modes read the full buffer and run the identical extent scan (the real
  // TimeSeries read cost). Paint is intentionally omitted so the baseline frame
  // is a fraction of the budget — that way the ONLY material difference between
  // modes is the per-frame allocation, and any GC pause shows up as a p99/max
  // spike in alloc-copy that alloc-reuse does not have.
  const scanExtent = (vals: Float64Array, len: number) => {
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < len; i++) {
      const v = vals[i]!;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
    checksum += yMax - yMin;
  };

  const step = () => {
    for (let c = 0; c < channels; c++) {
      const rb = buffers[c]!;
      if (mode === 'alloc-copy') {
        // Mirror TimeSeries: extent pass reads (alloc x2), draw pass reads again
        // (alloc x2) -> 4 fresh Float64Arrays per channel per frame.
        const ev = rb.getValues();
        const et = rb.getTimes();
        scanExtent(ev, ev.length);
        checksum += et.length;
        const dv = rb.getValues();
        const dt = rb.getTimes();
        scanExtent(dv, dv.length);
        checksum += dt.length;
      } else {
        const lenV = rb.readInto(scratchV[c]!);
        rb.readTimesInto(scratchT[c]!);
        scanExtent(scratchV[c]!, lenV);
        // Second read per frame (extent + draw passes both read), still zero-alloc.
        rb.readInto(scratchV[c]!);
        rb.readTimesInto(scratchT[c]!);
        scanExtent(scratchV[c]!, lenV);
      }
    }
  };

  return new Promise((resolve) => {
    let frame = 0;
    let last = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const w0 = performance.now();
      step();
      const work = performance.now() - w0;
      if (frame > WARMUP_FRAMES) {
        if (last !== 0) frameDeltas.push(now - last);
        workTimes.push(work);
      }
      last = now;
      frame++;
      if (now - start < durationMs) requestAnimationFrame(tick);
      else {
        clearStage();
        // Park the checksum where it can't be optimized away.
        (window as unknown as { __allocChecksum: number }).__allocChecksum = checksum;
        const sorted = [...frameDeltas].sort((a, b) => a - b);
        const sortedWork = [...workTimes].sort((a, b) => a - b);
        const total = frameDeltas.reduce((a, b) => a + b, 0);
        resolve({
          mode,
          channels,
          bufferSize,
          allocPerFrame,
          frames: frameDeltas.length,
          durationMs: Math.round(total),
          p50FrameMs: +percentile(sorted, 50).toFixed(2),
          p99FrameMs: +percentile(sorted, 99).toFixed(2),
          maxFrameMs: +Math.max(...frameDeltas).toFixed(2),
          workP50Ms: +percentile(sortedWork, 50).toFixed(3),
          workP99Ms: +percentile(sortedWork, 99).toFixed(3),
          workMaxMs: +Math.max(...workTimes).toFixed(3),
          workSpikes5: workTimes.filter((w) => w > 5).length,
          longFrames25: frameDeltas.filter((d) => d > FRAME_BUDGET_MS * 1.5).length,
          longFrames50: frameDeltas.filter((d) => d > 50).length,
        });
      }
    };
    requestAnimationFrame(tick);
  });
}

async function runAllocMatrix(
  channelsList = [6, 24],
  bufferSize = 10000,
  durationMs = 60000,
): Promise<AllocMetrics[]> {
  const results: AllocMetrics[] = [];
  for (const channels of channelsList) {
    for (const mode of ['alloc-copy', 'alloc-reuse'] as const) {
      out.textContent = `running ${mode} channels=${channels} buffer=${bufferSize} ...`;
      results.push(await runAlloc(mode, channels, bufferSize, durationMs));
      out.textContent = results
        .map(
          (m) =>
            `${m.mode.padEnd(11)} ch=${String(m.channels).padStart(3)} buf=${m.bufferSize}  ` +
            `alloc/frame=${String(m.allocPerFrame).padStart(3)}  ` +
            `frame p99=${String(m.p99FrameMs).padStart(7)}ms  ` +
            `work p50=${String(m.workP50Ms).padStart(6)}ms p99=${String(m.workP99Ms).padStart(6)}ms max=${String(m.workMaxMs).padStart(7)}ms  ` +
            `work>5ms=${m.workSpikes5}`,
        )
        .join('\n');
    }
  }
  return results;
}

// ---- public API + UI -------------------------------------------------------

declare global {
  interface Window {
    __bench: {
      ready: boolean;
      run: typeof run;
      runMatrix: typeof runMatrix;
      runAlloc: typeof runAlloc;
      runAllocMatrix: typeof runAllocMatrix;
    };
  }
}

window.__bench = { ready: true, run, runMatrix, runAlloc, runAllocMatrix };

const nInput = document.getElementById('n') as HTMLInputElement;
const getN = () => Math.max(1, parseInt(nInput.value, 10) || 1);

document.getElementById('run-svg-react')!.addEventListener('click', async () => {
  out.textContent = `running svg-react N=${getN()} ...`;
  out.textContent = fmt(await run('svg-react', getN()));
});
document.getElementById('run-svg-imperative')!.addEventListener('click', async () => {
  out.textContent = `running svg-imperative N=${getN()} ...`;
  out.textContent = fmt(await run('svg-imperative', getN()));
});
document.getElementById('run-canvas')!.addEventListener('click', async () => {
  out.textContent = `running canvas N=${getN()} ...`;
  out.textContent = fmt(await run('canvas', getN()));
});
document.getElementById('run-matrix')!.addEventListener('click', async () => {
  await runMatrix();
});
document.getElementById('run-alloc')!.addEventListener('click', async () => {
  await runAllocMatrix([6, 24], 10000, 20000);
});
