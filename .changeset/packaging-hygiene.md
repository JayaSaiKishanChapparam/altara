---
'@altara/aerospace': patch
'@altara/industrial': patch
'@altara/core': patch
'@altara/mqtt': patch
'@altara/ros': patch
'@altara/av': patch
---

Fix the exports map, and declare `type`, `engines.node` and `sideEffects`

`publint` errored identically on all six packages: `exports["."].types` came
last, and export conditions are order-sensitive, so TypeScript could not reach
it. Resolution happened to work only because tsup emits declarations adjacent
to the bundles.

The exports map is now condition-specific, which is the correct dual-package
shape and what `@arethetypeswrong/cli` requires:

```json
"exports": {
  ".": {
    "import":  { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
    "require": { "types": "./dist/index.d.ts",  "default": "./dist/index.js"  }
  }
}
```

Pointing both conditions at `index.d.ts` (CJS declarations) while the `import`
condition serves ESM makes attw report "Masquerading as CJS" from ESM — so each
condition now gets the declaration file that matches it.

Also:
- `"type": "commonjs"` on all six. **Not `"module"`** — `main`/`require` resolve
  to `dist/index.js`, which tsup emits as CommonJS. Declaring `"module"` makes
  Node parse it as ESM and `require()` of any package throws. Verified.
- `"engines": { "node": ">=20" }`, matching the workspace root.
- `"sideEffects": false` on `@altara/ros`, which was missing it and so opted
  itself out of bundler tree-shaking.

All six now pass publint and attw clean. No API change.
