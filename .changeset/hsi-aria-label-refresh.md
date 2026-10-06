---
'@altara/aerospace': patch
---

Keep `HorizontalSituationIndicator`'s accessible label current when a `dataSource` drives it (#20).

The `aria-label` ("HSI heading …°, course …°") is built at render time from a ref. Samples from a `dataSource` go straight into that ref and are drawn by the animation loop, and neither of those re-renders the component. So the label kept its mount-time values, and a screen reader announced the starting heading no matter how the aircraft turned. The component now re-renders every 500 ms purely to refresh the label, the same way `Attitude` already does. The canvas drawing is unchanged.
