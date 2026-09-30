---
'@altara/core': patch
'@altara/industrial': patch
'@altara/ros': patch
'@altara/mqtt': patch
---

Document the worker pipeline and correct several stale README claims.

`@altara/core` gains a section on `createWorkerDataSource`: per-channel ring
buffers and min/max decimation in the worker, data-space frames carrying each
channel's extent, the epoch plus single-credit push protocol, the `decimator`
capability and how charts feature-detect it, several viewports per source via
`acquire()`, and the two gotchas (`bufferSize` is ignored for decimating sources;
`mergeChannels` exposes no decimator).

`@altara/industrial` previously suggested offloading `WaterfallSpectrogram`'s FFT
"via `createWorkerDataSource`". That API cannot do it — it moves socket ingest,
buffering, and decimation into its worker, not arbitrary component work. The
advice now says to compute the spectrum upstream instead.

`@altara/ros` and `@altara/mqtt` state plainly that their sources expose no
`decimator` and therefore use the main-thread render path.

Core's stated bundle size was 12.2 KB against a measured 14.4 KB; corrected, with
the version and date it was measured at.
