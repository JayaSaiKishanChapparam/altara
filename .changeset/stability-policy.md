---
'@altara/aerospace': patch
'@altara/industrial': patch
'@altara/core': patch
'@altara/mqtt': patch
'@altara/ros': patch
'@altara/av': patch
---

Document the pre-1.0 stability policy in every package README

The policy existed in one sentence on line 5 of the root `CHANGELOG.md` — a
file that does not ship to npm. Anyone evaluating a `0.x` package on npm had no
stated contract about what a minor bump could do to them.

Each README now has a "Stability" section spelling out what patch and minor
mean before 1.0, and how to pin if a minor break is unacceptable.

Docs only.
