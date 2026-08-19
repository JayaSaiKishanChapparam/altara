/**
 * LiveMap test scope: leaflet/react-leaflet are dynamically imported, and the
 * real rendering is exercised in Storybook (which has a browser DOM). Here we
 * cover the synchronous wrapper behavior — placeholder, role, error branch —
 * plus the auto-follow contract, for which react-leaflet is stubbed with a
 * fake map instance so `setView` calls and map events are observable.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveMap } from './LiveMap';

/** Stand-in for the Leaflet `Map` instance react-leaflet's hooks hand out. */
const mapMock = vi.hoisted(() => {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    setView: vi.fn(),
    bind(handlers: Record<string, (e: unknown) => void>) {
      for (const [type, fn] of Object.entries(handlers)) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      }
    },
    unbind(handlers: Record<string, (e: unknown) => void>) {
      for (const [type, fn] of Object.entries(handlers)) listeners.get(type)?.delete(fn);
    },
    /** Emit a Leaflet map event, the way a real user gesture would. */
    fire(type: string) {
      for (const fn of listeners.get(type) ?? []) fn({ type });
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
    reset() {
      listeners.clear();
      this.setView.mockClear();
    },
  };
});

vi.mock('react-leaflet', async () => {
  const { createElement, useEffect } = await import('react');
  const nothing = () => null;
  return {
    MapContainer: ({ children }: { children?: unknown }) =>
      createElement('div', { 'data-testid': 'map-container' }, children as never),
    TileLayer: nothing,
    Polyline: nothing,
    Circle: nothing,
    Marker: nothing,
    useMap: () => mapMock,
    // Mirrors react-leaflet's own implementation: bind on mount, unbind on
    // cleanup, re-run when the handlers object identity changes.
    useMapEvents: (handlers: Record<string, (e: unknown) => void>) => {
      useEffect(() => {
        mapMock.bind(handlers);
        return () => mapMock.unbind(handlers);
      }, [handlers]);
      return mapMock;
    },
  };
});

vi.mock('leaflet', () => ({
  default: { divIcon: (opts: Record<string, unknown>) => ({ ...opts }) },
}));

beforeEach(() => {
  mapMock.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LiveMap', () => {
  it('renders an application-role placeholder while the map is loading', () => {
    const { container } = render(<LiveMap mockMode />);
    expect(container.querySelector('.vt-live-map')).toBeTruthy();
    const wrapper = screen.getByRole('application');
    expect(wrapper.getAttribute('aria-label')).toMatch(/loading/i);
    expect(container.textContent).toMatch(/loading/i);
  });

  it('applies a custom className alongside the base class', () => {
    const { container } = render(<LiveMap className="custom-class" />);
    const root = container.querySelector('.vt-live-map') as HTMLElement;
    expect(root.classList.contains('vt-live-map')).toBe(true);
    expect(root.classList.contains('custom-class')).toBe(true);
  });

  it('does not throw when given controlled position + heading + geofences', () => {
    expect(() =>
      render(
        <LiveMap
          position={{ lat: 37.77, lng: -122.42 }}
          heading={45}
          trackLength={50}
          geofences={[{ center: [37.77, -122.42], radius: 100, color: 'red' }]}
        />,
      ),
    ).not.toThrow();
  });

  describe('auto-follow', () => {
    /** Render and wait for the dynamically-imported map to mount. */
    async function renderMap(lat: number, lng: number) {
      const utils = render(<LiveMap position={{ lat, lng }} />);
      await waitFor(() => expect(screen.getByTestId('map-container')).toBeTruthy());
      return utils;
    }

    it('binds its disengage handlers to the map instance, not to MapContainer', async () => {
      await renderMap(37.77, -122.42);
      // Regression guard: react-leaflet forwards `eventHandlers` to layers
      // only, so the handlers must be registered on the map itself.
      expect(mapMock.listenerCount('dragstart')).toBe(1);
      expect(mapMock.listenerCount('zoomstart')).toBe(1);
    });

    it('recenters on each new position while following', async () => {
      const { rerender } = await renderMap(37.77, -122.42);
      mapMock.setView.mockClear();
      rerender(<LiveMap position={{ lat: 37.78, lng: -122.43 }} />);
      await waitFor(() => expect(mapMock.setView).toHaveBeenCalledWith([37.78, -122.43]));
    });

    it('stops following once the user drags the map', async () => {
      const { rerender } = await renderMap(37.77, -122.42);

      // Following to start with.
      mapMock.setView.mockClear();
      rerender(<LiveMap position={{ lat: 37.78, lng: -122.43 }} />);
      await waitFor(() => expect(mapMock.setView).toHaveBeenCalled());

      // The user grabs the map.
      act(() => mapMock.fire('dragstart'));

      // Subsequent telemetry must no longer move the view.
      mapMock.setView.mockClear();
      rerender(<LiveMap position={{ lat: 37.79, lng: -122.44 }} />);
      await waitFor(() => expect(screen.getByTestId('map-container')).toBeTruthy());
      expect(mapMock.setView).not.toHaveBeenCalled();
    });

    it('stops following once the user zooms the map', async () => {
      const { rerender } = await renderMap(37.77, -122.42);
      mapMock.setView.mockClear();
      rerender(<LiveMap position={{ lat: 37.78, lng: -122.43 }} />);
      await waitFor(() => expect(mapMock.setView).toHaveBeenCalled());

      act(() => mapMock.fire('zoomstart'));

      mapMock.setView.mockClear();
      rerender(<LiveMap position={{ lat: 37.79, lng: -122.44 }} />);
      await waitFor(() => expect(screen.getByTestId('map-container')).toBeTruthy());
      expect(mapMock.setView).not.toHaveBeenCalled();
    });
  });
});
