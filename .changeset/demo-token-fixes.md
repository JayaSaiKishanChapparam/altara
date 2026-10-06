---
'@altara/demo': patch
---

Point the Worker Pipeline tab at one shared worker, and fix two dead CSS tokens.

With several viewports now supported per source, both charts and the stats panel
read one `createWorkerDataSource` instead of needing a worker each. The panel's
counters come from its own third viewport, which is labelled as such.

The inbound-rate counter divided by an assumed 1000 ms tick. A backgrounded tab
throttles timers, so it reported rates several times higher than the feed was
delivering; it now divides by the interval that actually elapsed and says "tab
inactive" when animation frames are not running at all rather than showing a
stale figure.

`CoreView` and `styles.css` referenced `--vt-data-danger`, `--vt-data-warn`, and
`--vt-data-active`. Those tokens do not exist — the palette is `--vt-color-*` —
so the gauge arc rendered grey and the selected-tab underline fell back to the
text colour.

Adds `scripts/measure-worker-path.mjs` (`pnpm --filter @altara/demo measure`),
which drives both decimation paths and prints the spread across repeated
samples.
