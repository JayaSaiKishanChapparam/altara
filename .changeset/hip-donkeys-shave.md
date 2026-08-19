---
'@altara/core': patch
---

**LiveMap:** fix auto-follow never disengaging on user interaction.

The `dragstart` handler was passed to `<MapContainer>` via `eventHandlers`, which
react-leaflet forwards to *layers* only — so it was silently dropped and never
fired. Auto-follow therefore recentred the map on every position update forever,
and a user could not pan away from the tracked asset.

The handler is now bound to the map instance itself via `useMapEvents`, and
`zoomstart` disengages follow too, since a user zoom is equally an intent to
take the view over. Programmatic recentring does not fire either event, so
follow never disengages itself.
