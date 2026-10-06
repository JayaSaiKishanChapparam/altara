---
'@altara/core': patch
---

Document what `LiveMap` needs from the host app (#26). The README now covers two things:

- **Import `leaflet/dist/leaflet.css`.** `leaflet` is an optional peer dependency, so nothing imports the stylesheet for you. Without it, tiles stack in normal flow and the map grows to thousands of pixels.
- **Give the map's parent a definite height.** `.vt-live-map` is `height: 100%`. Under a parent that only has a `min-height`, the percentage doesn't resolve, and the map's height comes from the surrounding layout instead.

Documentation only. No code changes.
