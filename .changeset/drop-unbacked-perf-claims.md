---
'@altara/industrial': patch
'@altara/core': patch
---

Remove throughput claims from the package READMEs that no benchmark backs

`@altara/core`'s README asserted SVG libraries jank "at 100 Hz+ sensor data
rates"; `@altara/industrial`'s asserted `WaterfallSpectrogram` is "fine at
`fftSize ≤ 2048` and `scrollRate ≤ 30 Hz`… to keep the main thread at 60 fps".

The benchmark in `scripts/bench/` varies the number of rendered widgets. It
does not vary ingest rate, and it does not exercise the FFT at all, so none of
those numbers were measured. They are replaced with qualitative wording that
promises nothing numeric.

The bundle-size figure is now the measured 12.2 KB gzipped rather than the
"under 30 KB" ceiling, with the CI gate named.

Docs only — no code change.
