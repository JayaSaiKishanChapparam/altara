---
'@altara/core': patch
'@altara/ros': patch
---

Add per-package `README.md`, bundled `LICENSE`, and the npm-rendered metadata fields (`repository`, `homepage`, `bugs`, `keywords`, `author`). The npm package pages had no README, no source link, and no description — `npm install @altara/core` worked but the discovery story was broken. Both packages now ship a focused README and link back to the GitHub repo and the sibling package.
