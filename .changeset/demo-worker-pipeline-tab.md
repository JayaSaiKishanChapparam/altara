---
'@altara/demo': patch
---

Add a Worker Pipeline tab driven by a real socket, and stop the status strip
reporting a fake message rate.

The new tab is the first consumer of `createWorkerDataSource` and the
`decimator` capability. A synthetic quadrotor feed (scripts/telemetry-server.mjs,
mounted on the Vite dev and preview servers) streams ~5,000 samples/s across
seven channels; the charts render it with decimation running in the worker. A
toggle swaps the same live data onto the local decimation path so the two can be
compared, and the panel above reports measured values — inbound rate, samples
behind the plot, bucket columns, frame epoch and sequence, frame pacing — read
from the source rather than hardcoded.

The signal is a small flight model rather than sine waves, specifically so it
produces the short transients min/max decimation exists to preserve.

`ConnectionBar` on the other tabs previously showed `ws://demo.altara.dev:9090`
at `284 msg/s` with 14 ms latency, none of which was real. Those tabs run on
in-browser generators, so the strip now reads `mock://in-browser-generators`
with no latency or rate. The Worker Pipeline tab renders its own strip with the
actual URL, connection state, and measured sample rate; with no server reachable
it shows Disconnected and explains how to start one instead of showing data.
