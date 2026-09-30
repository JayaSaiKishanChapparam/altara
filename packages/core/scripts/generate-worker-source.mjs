#!/usr/bin/env node
/**
 * Compiles `src/adapters/workerEntry.ts` into a single self-contained IIFE and
 * writes it out as `src/adapters/workerSource.generated.ts`.
 *
 * Why codegen rather than a second build entry: the library spawns its worker
 * from a Blob URL so published consumers need no bundler support for
 * `new URL(..., import.meta.url)`, and a Blob needs the body as a *string*.
 * Generating that string from real source keeps `RingBuffer` and the decimation
 * kernels to one implementation instead of a hand-copied duplicate living
 * inside a template literal.
 *
 * Run via `pnpm --filter @altara/core generate:worker`. `build` runs it first,
 * and `workerSource.generated.test.ts` fails if the committed output has
 * drifted from the source.
 */
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

export const ENTRY = resolve(packageRoot, 'src/adapters/workerEntry.ts');
export const OUTPUT = resolve(packageRoot, 'src/adapters/workerSource.generated.ts');

const HEADER = `// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT.
//
// Built from src/adapters/workerEntry.ts by scripts/generate-worker-source.mjs.
// Edit the worker body there and re-run \`pnpm generate:worker\`.
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable */

/** Self-contained worker body, Blob-URL'd at runtime by \`createWorkerDataSource\`. */
export const WORKER_SOURCE = `;

/** Bundle the worker entry and return the IIFE source as a string. */
export async function buildWorkerSource() {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
  });
  return result.outputFiles[0].text.trim();
}

/** Render the full contents of the generated module. */
export async function renderGeneratedModule() {
  const source = await buildWorkerSource();
  return `${HEADER}${JSON.stringify(source)};\n`;
}

// Only write when invoked directly, so tests can import the builders above.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const contents = await renderGeneratedModule();
  await writeFile(OUTPUT, contents, 'utf8');
  console.log(`generated ${OUTPUT} (${contents.length} bytes)`);
}
