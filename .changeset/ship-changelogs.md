---
'@altara/aerospace': patch
'@altara/industrial': patch
'@altara/core': patch
'@altara/mqtt': patch
'@altara/ros': patch
'@altara/av': patch
---

Ship CHANGELOG.md inside the published tarballs

`files` listed only `dist`, `README.md` and `LICENSE`, so no changelog ever
reached npm — verified against the real `@altara/core@0.2.1` tarball, which
contains exactly those three entries plus `package.json`. Anyone evaluating the
package on npm had no version history at all.

`CHANGELOG.md` is now in `files` for all six packages.

Packaging only — no code change.
