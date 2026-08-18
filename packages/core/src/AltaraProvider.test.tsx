import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AltaraProvider, useAltara } from './AltaraProvider';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-altara-theme');
});

/** Renders the context value so assertions can read it out of the DOM. */
function ThemeProbe() {
  const { theme } = useAltara();
  return <span data-testid="probe">{theme}</span>;
}

describe('AltaraProvider', () => {
  it('sets data-altara-theme on <html> and exposes the theme through useAltara', () => {
    const { getByTestId } = render(
      <AltaraProvider theme="light">
        <ThemeProbe />
      </AltaraProvider>,
    );

    expect(document.documentElement.getAttribute('data-altara-theme')).toBe('light');
    expect(getByTestId('probe').textContent).toBe('light');
  });

  it('defaults to dark, and restores the previous attribute on unmount', () => {
    // A host app that already set its own theme must get it back — the provider
    // is not the only thing allowed to own this attribute.
    document.documentElement.setAttribute('data-altara-theme', 'light');

    const { unmount, getByTestId } = render(
      <AltaraProvider>
        <ThemeProbe />
      </AltaraProvider>,
    );

    expect(getByTestId('probe').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-altara-theme')).toBe('dark');

    unmount();

    expect(document.documentElement.getAttribute('data-altara-theme')).toBe('light');
  });

  it('removes the attribute on unmount when there was none to begin with', () => {
    const { unmount } = render(
      <AltaraProvider theme="dark">
        <ThemeProbe />
      </AltaraProvider>,
    );

    expect(document.documentElement.getAttribute('data-altara-theme')).toBe('dark');

    unmount();

    expect(document.documentElement.hasAttribute('data-altara-theme')).toBe(false);
  });

  it('throws a useful error when useAltara is called outside a provider', () => {
    expect(() => render(<ThemeProbe />)).toThrow(/useAltara must be used inside an <AltaraProvider>/);
  });
});
