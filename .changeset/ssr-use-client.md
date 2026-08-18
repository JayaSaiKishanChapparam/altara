---
'@altara/aerospace': patch
'@altara/industrial': patch
'@altara/core': patch
'@altara/mqtt': patch
'@altara/ros': patch
'@altara/av': patch
---

Emit `"use client"` in every published bundle for Next.js App Router support

Nothing shipped the directive before, so importing any Altara component from a
Next.js App Router server-component file failed on first import — consumers had
to hand-wrap each import in their own `'use client'` module.

Both the ESM and CJS bundles of all six packages now carry the directive.

Note for maintainers: setting tsup's `banner` option alone is not sufficient.
Every package also sets `treeshake: true`, which makes tsup run a second
Rollup pass that re-emits the bundle **without** the esbuild banner — the build
succeeds and the directive silently disappears. `scripts/add-use-client.mjs`
runs after `tsup` and stamps the directive onto line 1 (not as a new line, so
the emitted sourcemaps keep their line numbers).

No API or runtime behavior change.
