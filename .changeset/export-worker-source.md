---
'@altara/core': minor
---

Export `WORKER_SOURCE`, the worker body as source text.

`createWorkerDataSource` spawns its worker from a Blob URL built out of this
string. It was module-internal, which meant the pipeline could not be inspected,
driven deterministically in a test, or reconstructed by a host that cannot use
Blob URLs — a strict CSP or some Electron configurations, for instance. Paired
with the existing `workerImpl` option it is now possible to run the genuine
worker body against a socket you control.

Documented in the README as a low-level escape hatch rather than the main path.
The contents of the string are an implementation detail and will change; what is
stable is that evaluating it in a worker scope installs the message handler
`createWorkerDataSource` speaks to.
