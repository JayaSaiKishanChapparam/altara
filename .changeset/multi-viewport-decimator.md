---
'@altara/core': minor
---

Support several independent viewports per decimating source.

`AltaraDataSource.decimator` previously carried one viewport, so two charts on
the same worker-backed source overwrote each other's `setViewport` call. Last
writer won, the other chart rendered an empty plot, and nothing errored — the
most obvious way to use the feature failed silently.

`Decimator` is now `acquire(): DecimatorSubscription`. Each consumer holds its
own viewport, epoch, send credit, and latest frame, and calls `release()` when it
goes away. `TimeSeries` and `MultiAxisPlot` acquire one per render loop. The
worker keys viewports by id and serves each from the same per-channel ring
buffers, so N charts on one source cost one extra decimation pass each and no
extra memory or ingest — one socket, one set of buffers.

Credit is per viewport: a stalled consumer no longer blocks frames to the
others. `destroy()` invalidates outstanding handles so a chart still holding one
cannot keep drawing from a dead source.

This reshapes `Decimator`, which was added but never released, so no published
API changes. `DecimatorSubscription` is exported alongside it.

Covered by tests for two and three charts sharing one source — the case that had
no coverage, which is why the single-viewport limitation shipped.
