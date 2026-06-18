---
"@altara/ros": patch
"@altara/aerospace": patch
"@altara/av": patch
"@altara/industrial": patch
"@altara/mqtt": patch
---

Sync `@altara/core` peer range to `^0.2.0` (no API change). Keeps the core minor
in range so the changesets peer cascade stays a patch sync rather than forcing a
1.0.0 major (same fix as #8 for the 0.1.0 release).
