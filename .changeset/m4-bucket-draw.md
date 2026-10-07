---
'@altara/core': patch
---

Fix `TimeSeries` and `MultiAxisPlot` drawing flat lines and lone spikes blank (#39).

Once a chart has more than about one sample per pixel column, it draws each column's min/max range instead of every sample. Each column was a separate vertical stroke, which caused two problems:

- Adjacent columns were never joined.
- A column whose min equals its max (any flat stretch, and any column holding one sample) was a zero-length stroke, and a zero-length stroke paints nothing.

The result: a steady signal rendered as an empty chart, a one-sample spike could disappear, and a sine just past the threshold drew as a faint dotted trace. This affected both the local path (since 0.2.1) and the `createWorkerDataSource` path (since 0.3.0).

Columns are now drawn as one continuous line (M4). Each column also records its first and last sample, and the path runs from the previous column's last sample into this column's first, across its min and max, and out at its last. Spikes keep the min/max guarantee, and flat signals render as lines.

- `DecimatedChannel` gains optional `firstV`/`lastV` arrays, sent by `createWorkerDataSource`. A custom decimator that omits them still gets a connected line, joined through min/max.
- `DecimatedChannel.bucket` is now always in ascending column order, including for out-of-order timestamps.
- First and last are chosen by timestamp, not arrival order, so merged or replayed feeds join correctly.

Also adds `pnpm --filter @altara/core test:pixels`, which renders both charts in Chromium on both data paths and checks the painted pixels. It runs in CI.
