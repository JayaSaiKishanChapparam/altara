---
'@altara/aerospace': patch
---

fix(aerospace): stop `HorizontalSituationIndicator` folding foreign channels into heading

`HorizontalSituationIndicator` routed its four owned channels but sent
**everything else** to heading via the `switch` default, so any multi-channel
source — a `mergeChannels` fan-in, or a rosbridge adapter publishing several
channels — spun the compass card from unrelated streams. A battery reading of
85.9% swung the card to 86°.

Channels are now routed explicitly: `'heading'` and untagged samples drive
heading, `'headingBug'`/`'course'`/`'courseDev'` drive their own fields, and
anything else is dropped — matching how `TimeSeries`, `PrimaryFlightDisplay`
and `Attitude` already handle channels they don't own.

Single-channel sources are unaffected: samples with no `channel` tag still
drive heading.
