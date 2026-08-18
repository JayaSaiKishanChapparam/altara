/**
 * Prepends the `"use client"` directive to tsup's emitted bundles.
 *
 * ## Why this exists instead of tsup's `banner` option
 *
 * `tsup.config.ts` does set `banner: { js: '"use client";' }`, but every
 * package also sets `treeshake: true`. That flag makes tsup run a second,
 * Rollup-based pass over esbuild's output — and that pass re-emits the bundle
 * **without** the esbuild banner. The directive is silently dropped: the build
 * succeeds, the config looks correct, and `dist/index.mjs` has no directive.
 *
 * So the banner stays in the config (it is what applies if `treeshake` is ever
 * turned off) and this script guarantees the directive regardless.
 *
 * ## Why it writes onto line 1 rather than adding a line
 *
 * Prepending `"use client";\n` would shift every line down by one and
 * invalidate the committed `.map` files. Writing the directive onto the front
 * of the existing first line keeps every line number identical, so the
 * sourcemaps stay correct untouched.
 *
 * In CJS output the result is `"use client";'use strict';…` — both are still in
 * the directive prologue, which is valid.
 *
 * Idempotent: re-running on an already-stamped file is a no-op.
 *
 * Usage: `node ../../scripts/add-use-client.mjs` from a package root.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIRECTIVE = '"use client";';
const TARGETS = ['dist/index.mjs', 'dist/index.js'];

let stamped = 0;

for (const rel of TARGETS) {
  const file = resolve(process.cwd(), rel);
  if (!existsSync(file)) continue;

  const source = readFileSync(file, 'utf8');
  if (source.startsWith(DIRECTIVE) || source.startsWith("'use client';")) continue;

  writeFileSync(file, DIRECTIVE + source);
  stamped += 1;
}

if (stamped > 0) {
  console.log(`use-client: stamped ${stamped} bundle(s)`);
}
