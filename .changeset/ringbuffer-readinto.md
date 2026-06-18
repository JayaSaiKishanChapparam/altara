---
"@altara/core": minor
---

RingBuffer: add zero-copy `readInto(out)` / `readTimesInto(out)` read path

`getValues()` / `getTimes()` allocate a fresh `Float64Array` per call. The rAF
render loops in `TimeSeries` and `MultiAxisPlot` called them once for the extent
pass and again for the draw pass — ~4 array allocations per channel per frame at
the default 10k buffer. `readInto(out)` / `readTimesInto(out)` fill a
caller-owned buffer and return the sample count, allocating nothing. The two
chart components now read each channel once per frame into a reused scratch
buffer, dropping per-frame allocation in the draw loop to zero.

`getValues()` / `getTimes()` are unchanged for non-hot-path callers.
