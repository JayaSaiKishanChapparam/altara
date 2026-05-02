import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

/** Available themes. Drives which `data-altara-theme` attribute is set on `<html>`. */
export type AltaraTheme = 'dark' | 'light';

/** Value exposed by `useAltara()`. */
export interface AltaraContextValue {
  /** Currently active theme. */
  theme: AltaraTheme;
}

const AltaraContext = createContext<AltaraContextValue | null>(null);

export interface AltaraProviderProps {
  /** Theme to apply. Sets `data-altara-theme` on `<html>`. Default: `'dark'`. */
  theme?: AltaraTheme;
  /** Application tree. */
  children: ReactNode;
}

export function AltaraProvider({ theme = 'dark', children }: AltaraProviderProps) {
  useEffect(() => {
    const previous = document.documentElement.getAttribute('data-altara-theme');
    document.documentElement.setAttribute('data-altara-theme', theme);
    return () => {
      if (previous === null) {
        document.documentElement.removeAttribute('data-altara-theme');
      } else {
        document.documentElement.setAttribute('data-altara-theme', previous);
      }
    };
  }, [theme]);

  const value = useMemo<AltaraContextValue>(() => ({ theme }), [theme]);

  return <AltaraContext.Provider value={value}>{children}</AltaraContext.Provider>;
}

export function useAltara(): AltaraContextValue {
  const ctx = useContext(AltaraContext);
  if (!ctx) {
    throw new Error('useAltara must be used inside an <AltaraProvider>');
  }
  return ctx;
}
