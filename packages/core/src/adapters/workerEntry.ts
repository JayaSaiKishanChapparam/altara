/**
 * Bundle entry for the worker body. Kept separate from `workerBody.ts` so that
 * module stays side-effect-free and importable by unit tests, while this file
 * is the thing `scripts/generate-worker-source.mjs` compiles to a standalone
 * IIFE string.
 */
import { installWorkerBody, type WorkerScopeLike } from './workerBody';

declare const self: WorkerScopeLike;

installWorkerBody(self);
