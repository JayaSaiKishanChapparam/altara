# Canvas vs SVG benchmark

Measures frame timing for rendering **N telemetry widgets** (rotating needle +
numeric readout + scrolling sparkline) two ways as N scales:

- **SVG** — React owns the DOM; each frame `flushSync`-commits a re-render of the
  whole `<svg>` subtree (the "SVG re-renders per update" path Altara avoids).
- **Canvas** — one `<canvas>`, one `requestAnimationFrame` loop, `clearRect` +
  full repaint, no React state in the hot path (Altara's shipped architecture).

Both paths draw the identical picture from the identical math, so rendering
technology is the only variable.

## Run it yourself

```bash
pnpm install
pnpm --filter @altara/demo dev          # serves http://localhost:5173/bench/
```

Open <http://localhost:5173/bench/> and click **Run full matrix**, or use the
buttons to run one renderer at a chosen N. Results print on the page and are
exposed at `window.__bench` for automation.

### Automated (headed Chromium, real vsync)

```bash
pnpm --filter @altara/demo dev &         # note the port it prints
BENCH_URL=http://localhost:5173/bench/ node scripts/bench/run-bench.mjs
```

Writes `scripts/bench/results.json` and prints a table plus the exact
browser/machine the numbers were taken on.

Env knobs:

| var | default | meaning |
|---|---|---|
| `BENCH_URL` | `http://localhost:5173/bench/` | dev-server URL |
| `BENCH_NS` | `1,10,50,200` | comma list of N |
| `BENCH_MS` | `4000` | per-config duration (ms) |
| `HEADLESS` | unset | `1` = headless (no true vsync; numbers differ) |
| `CPU_THROTTLE` | `1` | CDP CPU slowdown factor, e.g. `6` ≈ a mid-tier laptop |

## Metrics

- **achievedFps** — frames ÷ wall-clock. Caps at the display refresh (60).
- **frame mean / p95 / max (ms)** — `requestAnimationFrame` timestamp deltas;
  includes everything the user waits on (JS + layout + paint + composite).
- **dropped** — frames whose interval missed the next vsync deadline (>1.5×16.67ms).
- **work mean / p95 (ms)** — main-thread time inside the per-frame callback
  (SVG: reconcile + commit + forced layout; Canvas: the draw call).
  Vsync-independent, so it's identical headed vs headless.
- **jank%** — share of frames whose *work alone* blew the 16.67ms budget.

## Honest caveats

- `flushSync` makes the SVG path commit synchronously so it can be timed; this is
  marginally more pessimistic than React's default batched commit, but guarantees
  exactly one render per frame (no coalescing that would flatter SVG).
- Achieved-fps caps at the display's refresh rate; `work` is the
  hardware-independent signal. Headless has no true vsync — use headed for fps.
- Numbers are hardware-specific. The committed `results-*.json` were taken on the
  machine recorded inside each file. Re-run to get yours.
