---
'@altara/aerospace': patch
'@altara/av': patch
'@altara/industrial': patch
'@altara/mqtt': patch
'@altara/ros': patch
---

Widen the `@altara/core` peer range from `^0.2.0` to `>=0.2.0 <1.0.0`. This
accepts `@altara/core@0.3.0`. There is no API change.

A caret range on a 0.x version covers a single minor, so every core minor left
the range. Changesets treats a peer dependency leaving its range as a breaking
change for the dependent, so each core minor would have pushed every package
here to 1.0.0 even though none of them had changed. Until core reaches 1.0, the
peer range now covers all of 0.x.
