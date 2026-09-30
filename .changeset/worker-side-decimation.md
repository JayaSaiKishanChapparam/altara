---
'@altara/core': minor
---

Move min/max decimation off the main thread.

`createWorkerDataSource` now owns the per-channel ring buffers and the min/max
reduction, and pushes render-ready geometry to the renderer. `TimeSeries` and
`MultiAxisPlot` feature-detect the new optional `AltaraDataSource.decimator`:
when it is present they never touch a raw sample, so per-frame main-thread work
drops from O(samples buffered) to O(pixel columns). Previously each frame copied
every ring buffer, scanned it for the y-extent, and bucketed it again — three
O(n) passes per channel at 60 Hz.

The protocol is push-based rather than request/response, because the time window
is wall-clock anchored and so advances every frame on its own. The renderer
sends a viewport only when the plot width, window, or channel list actually
changes; the worker derives the window itself and flushes frames at `flushHz`.
Frames carry an epoch so geometry decimated for a superseded viewport is never
drawn, and the worker keeps at most one unacknowledged frame in flight, skipping
flushes rather than queueing them when the main thread stalls. Frames are whole
snapshots, never deltas, so a dropped one is always safe.

Additive and opt-in. `decimator` is optional, so every other adapter — mock,
replay, rosbridge, MQTT — is unchanged and charts fall back to the existing local
path. Raw `subscribe`/`getHistory` delivery is untouched, so `Gauge`,
`SignalPanel`, and `Attitude` behave exactly as before. Note that `bufferSize` on
the chart is ignored for decimating sources; capacity belongs to the worker.

The worker body is now real linted and unit-tested source (`workerBody.ts`),
compiled to the embedded `WORKER_SOURCE` string at build time, so `RingBuffer`
and the decimation kernels have a single implementation instead of a copy
maintained by hand inside a template literal.
