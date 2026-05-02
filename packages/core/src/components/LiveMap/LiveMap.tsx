import { useEffect, useMemo, useRef, useState } from 'react';
import type { LiveMapGeofence, LiveMapProps } from '../../adapters/types';

interface ReactLeafletModule {
  MapContainer: React.ComponentType<Record<string, unknown>>;
  TileLayer: React.ComponentType<Record<string, unknown>>;
  Polyline: React.ComponentType<Record<string, unknown>>;
  Circle: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<Record<string, unknown>>;
  useMap: () => { setView: (latlng: [number, number], zoom?: number) => void };
}

interface LeafletModule {
  divIcon: (opts: Record<string, unknown>) => unknown;
}

interface LoadedLeaflet {
  rl: ReactLeafletModule;
  L: LeafletModule;
}

const DEFAULT_TILES_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

async function loadLeaflet(): Promise<LoadedLeaflet> {
  // Direct dynamic imports so the consumer's bundler (Vite, webpack,
  // Next.js) can pre-bundle them. tsup keeps these as `external` so
  // they're never included in @altara/core's own dist (blueprint §13,
  // "Leaflet in SSR" — defer the import out of the module top-level).
  const [rlMod, lMod] = await Promise.all([
    import('react-leaflet'),
    import('leaflet'),
  ]);
  const L =
    (lMod as unknown as { default?: LeafletModule }).default ??
    (lMod as unknown as LeafletModule);
  return { rl: rlMod as unknown as ReactLeafletModule, L };
}

function circlePathPositions(
  center: [number, number],
  radiusMeters: number,
  step: number,
): Array<[number, number]> {
  // Quick & dirty equirectangular projection — fine for the small circles
  // the mockMode renders. For real GPS data the consumer feeds positions
  // straight in.
  const earthR = 6_378_137;
  const latRad = (center[0] * Math.PI) / 180;
  const dLat = (radiusMeters / earthR) * (180 / Math.PI);
  const dLng = ((radiusMeters / earthR) * (180 / Math.PI)) / Math.cos(latRad);
  const t = (Date.now() / 1000) * step;
  return [[center[0] + dLat * Math.sin(t), center[1] + dLng * Math.cos(t)]];
}

interface AutoFollowProps {
  position: [number, number] | null;
  follow: boolean;
  useMap: ReactLeafletModule['useMap'];
}

function AutoFollow({ position, follow, useMap }: AutoFollowProps) {
  const map = useMap();
  useEffect(() => {
    if (follow && position) map.setView(position);
  }, [follow, position, map]);
  return null;
}

/**
 * Map view of a moving GPS asset. Leaflet + react-leaflet are optional
 * peer deps — installed only when the consumer needs maps. The component
 * dynamically imports them and renders a friendly placeholder until they
 * resolve (or surfaces a setup hint if installation is missing).
 */
export function LiveMap({
  position: positionProp,
  heading = 0,
  trackLength = 200,
  geofences,
  mockMode,
  className,
}: LiveMapProps) {
  const [loaded, setLoaded] = useState<LoadedLeaflet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const trackRef = useRef<Array<[number, number]>>([]);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(
    positionProp ? [positionProp.lat, positionProp.lng] : null,
  );

  // Lazy load Leaflet when first mounted in a browser.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    loadLeaflet()
      .then((mod) => {
        if (!cancelled) setLoaded(mod);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'Unknown error loading map dependencies';
        setLoadError(
          `LiveMap requires the optional peer dependencies "leaflet" and "react-leaflet". ${msg}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ingest controlled position prop.
  useEffect(() => {
    if (!positionProp) return;
    const next: [number, number] = [positionProp.lat, positionProp.lng];
    setCurrentPosition(next);
    trackRef.current.push(next);
    if (trackRef.current.length > trackLength) {
      trackRef.current.splice(0, trackRef.current.length - trackLength);
    }
  }, [positionProp, trackLength]);

  // mockMode: simulated drone orbiting a fixed point at ~120m radius.
  useEffect(() => {
    if (!mockMode || positionProp) return;
    const center: [number, number] = [37.7749, -122.4194];
    const id = setInterval(() => {
      const [next] = circlePathPositions(center, 120, 0.4);
      setCurrentPosition(next!);
      trackRef.current.push(next!);
      if (trackRef.current.length > trackLength) {
        trackRef.current.splice(0, trackRef.current.length - trackLength);
      }
    }, 100);
    return () => clearInterval(id);
  }, [mockMode, positionProp, trackLength]);

  const headingIcon = useMemo(() => {
    if (!loaded) return null;
    return loaded.L.divIcon({
      className: 'vt-live-map__heading-arrow-wrapper',
      html: `<div class="vt-live-map__heading-arrow" style="transform: rotate(${heading}deg)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }, [loaded, heading]);

  // Disable auto-follow once the user manually drags the map.
  const handleDragStart = () => setFollow(false);

  if (loadError) {
    return (
      <div
        className={['vt-live-map', className].filter(Boolean).join(' ')}
        role="alert"
        aria-label="Map error"
      >
        <div className="vt-live-map__placeholder">{loadError}</div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div
        className={['vt-live-map', className].filter(Boolean).join(' ')}
        role="application"
        aria-label="Live map (loading)"
      >
        <div className="vt-live-map__placeholder">Loading map…</div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Polyline, Circle, Marker, useMap } = loaded.rl;
  const positions = trackRef.current.slice();
  const initialCenter: [number, number] = currentPosition ?? [37.7749, -122.4194];

  return (
    <div
      className={['vt-live-map', className].filter(Boolean).join(' ')}
      role="application"
      aria-label="Live map"
    >
      <MapContainer
        center={initialCenter}
        zoom={16}
        scrollWheelZoom
        className="vt-live-map__inner"
        whenReady={() => setFollow(true)}
        eventHandlers={{ dragstart: handleDragStart }}
      >
        <TileLayer attribution="© OpenStreetMap" url={DEFAULT_TILES_URL} />
        {positions.length > 1 ? <Polyline positions={positions} color="#378ADD" /> : null}
        {(geofences ?? []).map((g: LiveMapGeofence, i: number) => (
          <Circle
            key={i}
            center={g.center}
            radius={g.radius}
            pathOptions={{ color: g.color ?? 'var(--vt-color-warn)' }}
          />
        ))}
        {currentPosition && headingIcon ? (
          <Marker position={currentPosition} icon={headingIcon} />
        ) : null}
        <AutoFollow position={currentPosition} follow={follow} useMap={useMap} />
      </MapContainer>
    </div>
  );
}
