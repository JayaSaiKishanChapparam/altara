---
'@altara/core': patch
---

fix(core): stop `Attitude` folding foreign channels into roll

`Attitude` routed `'pitch'` and treated **every other** sample as roll, so any
multi-channel source — a `mergeChannels` fan-in, or a rosbridge adapter
publishing several channels — drove the artificial horizon from unrelated
streams. A battery reading of 85.9% banked the horizon to 85.9°.

Channels are now routed explicitly: `'roll'` and untagged samples drive roll,
`'pitch'` drives pitch, and anything else is dropped — matching how
`TimeSeries` and `PrimaryFlightDisplay` already handle channels they don't own.

Single-channel sources are unaffected: samples with no `channel` tag still
drive roll.
