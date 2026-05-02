/**
 * LiveMap test scope: leaflet/react-leaflet are dynamically imported and
 * fully exercised in Storybook (which has a real browser DOM). Here we
 * cover the synchronous wrapper behavior — placeholder, role, error
 * branch — without ever resolving the async map module.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveMap } from './LiveMap';

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
});
