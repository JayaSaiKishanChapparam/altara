---
'@altara/mqtt': minor
---

Make `@altara/mqtt` publicly publishable. The package is no longer marked `private`, the `package.json` shape now matches `@altara/core` / `@altara/ros` (homepage, repository, bugs, author, keywords, sideEffects, typecheck script, README + LICENSE in the tarball), and the entry point re-exports `createMqttAdapter`, `MqttAdapterOptions`, and `MqttClientLike` from `@altara/core`. Mirrors how `@altara/ros` is structured — a thin specialised package that signals "this app talks to an MQTT broker".
