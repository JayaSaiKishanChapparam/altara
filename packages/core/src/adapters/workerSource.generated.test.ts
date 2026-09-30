import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
// @ts-expect-error — plain .mjs build script, no type declarations by design.
import { OUTPUT, renderGeneratedModule, buildWorkerSource } from '../../scripts/generate-worker-source.mjs';
import { WORKER_SOURCE } from './workerSource.generated';

/**
 * The committed worker string is generated from `workerEntry.ts`. If someone
 * edits the worker body and forgets to re-run codegen, the published Blob would
 * silently keep running the old logic — so the drift is a test failure, not a
 * build-time surprise.
 */
describe('WORKER_SOURCE codegen', () => {
  it('is up to date with the worker body source', async () => {
    const [expected, actual] = await Promise.all([
      renderGeneratedModule() as Promise<string>,
      readFile(OUTPUT as string, 'utf8'),
    ]);
    expect(actual).toBe(expected);
  }, 30_000);

  it('bundles its dependencies rather than emitting bare imports', async () => {
    const source = (await buildWorkerSource()) as string;
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bfrom\s*["']\.\./);
    // RingBuffer and the decimation kernels must be inlined, not referenced.
    expect(source).toContain('postMessage');
  }, 30_000);

  it('evaluates to a worker that installs a message handler on its scope', () => {
    const scope: { onmessage: ((ev: { data: unknown }) => void) | null; postMessage: () => void } = {
      onmessage: null,
      postMessage: () => {},
    };
    // Mimic the Blob-URL worker: run the source with `self` bound to our scope.
    new Function('self', WORKER_SOURCE)(scope);
    expect(typeof scope.onmessage).toBe('function');
  });
});
