import { useEffect, useRef, useState } from 'react';
import type { DashboardItem, DashboardLayoutProps } from '../../adapters/types';

interface RglModule {
  Responsive: React.ComponentType<Record<string, unknown>>;
  WidthProvider: <P>(c: React.ComponentType<P>) => React.ComponentType<P>;
  default: React.ComponentType<Record<string, unknown>>;
}

interface LoadedRgl {
  WidthProviderGrid: React.ComponentType<Record<string, unknown>>;
}

async function loadGrid(): Promise<LoadedRgl> {
  // Direct import so the consumer's bundler can pre-bundle the optional
  // peer dep. tsup keeps it `external` in @altara/core's dist.
  const mod = (await import('react-grid-layout')) as RglModule & {
    default?: RglModule['default'];
  };
  const GridLayout = mod.default ?? (mod as unknown as RglModule['default']);
  return { WidthProviderGrid: mod.WidthProvider(GridLayout) };
}

/**
 * Draggable / resizable dashboard grid built on `react-grid-layout` (an
 * optional peer dep). Children are placed by matching their React `key`
 * against the layout's `i` field — same convention as RGL.
 *
 * The layout prop is treated as the initial layout when uncontrolled.
 * Pass `onLayoutChange` to receive live updates as the user drags.
 */
export function DashboardLayout({
  layout,
  cols = 12,
  rowHeight = 60,
  width,
  isDraggable = true,
  isResizable = true,
  onLayoutChange,
  className,
  children,
}: DashboardLayoutProps) {
  const [loaded, setLoaded] = useState<LoadedRgl | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [internalLayout, setInternalLayout] = useState<DashboardItem[]>(layout);
  const lastLayoutPropRef = useRef(layout);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    loadGrid()
      .then((mod) => {
        if (!cancelled) setLoaded(mod);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'Unknown error loading react-grid-layout';
        setLoadError(
          `DashboardLayout requires the optional peer dependency "react-grid-layout". ${msg}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep internal layout in sync if the prop reference changes.
  useEffect(() => {
    if (lastLayoutPropRef.current !== layout) {
      lastLayoutPropRef.current = layout;
      setInternalLayout(layout);
    }
  }, [layout]);

  const handleChange = (next: DashboardItem[]) => {
    setInternalLayout(next);
    onLayoutChange?.(next);
  };

  if (loadError) {
    return (
      <div
        className={['vt-dashboard', className].filter(Boolean).join(' ')}
        role="alert"
        aria-label="Dashboard error"
      >
        <div className="vt-live-map__placeholder">{loadError}</div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div
        className={['vt-dashboard', className].filter(Boolean).join(' ')}
        role="region"
        aria-label="Dashboard (loading)"
      >
        <div className="vt-live-map__placeholder">Loading dashboard…</div>
      </div>
    );
  }

  const Grid = loaded.WidthProviderGrid;
  return (
    <div
      className={['vt-dashboard', className].filter(Boolean).join(' ')}
      role="region"
      aria-label="Telemetry dashboard"
    >
      <Grid
        layout={internalLayout}
        cols={cols}
        rowHeight={rowHeight}
        isDraggable={isDraggable}
        isResizable={isResizable}
        onLayoutChange={handleChange}
        {...(width !== undefined ? { width } : {})}
      >
        {children}
      </Grid>
    </div>
  );
}
