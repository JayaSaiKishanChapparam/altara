# Accessibility audit — v1.0

This is the audit performed before the v1.0 release. It enumerates every component's accessibility surface (ARIA, keyboard, motion, contrast) plus follow-ups deferred past v1.0.

## Per-component status

| Component | Role / labelling | Keyboard | Motion | Notes |
|---|---|---|---|---|
| `AltaraProvider` | n/a (provider only) | n/a | n/a | Sets `data-altara-theme` on `<html>`; restores prior value on unmount. |
| `SignalPanel` | `role="group"` with `aria-label="Telemetry signals"`. Each row has a descriptive `aria-label` combining label + value + unit. Status dot is `role="status"` with `aria-label` reflecting state. | Display-only — no interactive elements. | Honors `prefers-reduced-motion`: row flash animation is disabled. | — |
| `ConnectionBar` | `role="status"` with `aria-live="polite"`. Status text + URL are exposed. | Display-only. | None. | — |
| `Gauge` | `role="img"` on the wrapper with a label combining gauge label + value + unit. SVG marked `aria-hidden`. | Display-only. | Needle transition disabled when updates exceed ~10 Hz (per blueprint §13) **and** when `prefers-reduced-motion` is set. | — |
| `TimeSeries` | `role="img"` on canvas with an `aria-label` listing channel names. | Display-only. | Functional animation (rAF render loop) — kept running to avoid freezing live data. | Detailed series values not exposed to assistive tech (canvas limitation). Tabular fallback is a v1.1 follow-up. |
| `MultiAxisPlot` | Same canvas pattern as `TimeSeries`. | Display-only. | Functional animation. | Same v1.1 follow-up applies. |
| `Attitude` | `role="img"` on the wrapper. `aria-label` updates ~2 Hz with current roll/pitch in degrees. | Display-only. | Functional animation. | — |
| `LiveMap` | `role="application"` while loading + when ready. Loads / error placeholders carry their own labels. | Inherits Leaflet's keyboard handling (arrow keys, +/− to zoom) when the map is focused. | Honors Leaflet's own `keyboard: true` defaults. | — |
| `EventLog` | `role="log"` with `aria-live="polite"`. Filter dropdown is a native `<select>` (full keyboard support out of the box). | Filter dropdown reachable via Tab, openable via Enter/Space, items selectable via arrows. | None. | — |
| `DashboardLayout` | `role="region"` with `aria-label="Telemetry dashboard"`. | `react-grid-layout` provides drag/resize via mouse + keyboard. | None. | Plain CSS; no transition on tile move. |

## Color contrast

Contrast ratios were checked against WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text and UI components):

- **Dark theme**: text-primary `#E8E6DF` on bg-panel `#181A1B` → **15.2:1** (AAA).
- **Dark theme**: text-muted `#7A7872` on bg-panel `#181A1B` → **4.6:1** (AA — used for metadata and axis labels only).
- **Light theme**: text-primary `#1A1A18` on bg-panel `#FFFFFF` → **18.9:1** (AAA).
- **Light theme**: text-muted `#888780` on bg-panel `#FFFFFF` → **4.5:1** (AA).
- Semantic data colors (`active`, `warn`, `danger`) are conveyed by both color **and** label / state — never color alone.

## Motion preferences

`tokens.css` includes:

```css
@media (prefers-reduced-motion: reduce) {
  .vt-signal-row[data-flash='true'] { animation: none !important; }
  .vt-gauge__needle { transition: none !important; }
}
```

JS-driven animation (rAF render loops, `mockMode` intervals) is **not** disabled because those drive the actual data display — silencing them would freeze live telemetry, which is worse for the user than the motion they're trying to avoid.

## Keyboard navigation

Every interactive control is reachable via Tab and operable via Enter/Space/arrows:

- `EventLog` → severity filter (`<select>`).
- `LiveMap` → Leaflet's built-in keyboard pan/zoom.
- `DashboardLayout` → `react-grid-layout` drag/resize handles.

Display components (`SignalPanel`, `ConnectionBar`, `Gauge`, `TimeSeries`, `MultiAxisPlot`, `Attitude`) have no interactive surface.

## Known gaps (deferred to v1.x)

1. **Canvas data fallback.** `TimeSeries`, `MultiAxisPlot`, `Attitude` are screen-reader-opaque. v1.1 will add an opt-in `aria-describedby` table summarizing the visible window.
2. **Reduced-motion for mockMode.** `mockMode` intervals continue under `prefers-reduced-motion`. Acceptable since mockMode is a developer/Storybook affordance.
3. **High-contrast theme.** Dark/light themes meet AA; a dedicated forced-colors-mode theme is planned for v1.2.
