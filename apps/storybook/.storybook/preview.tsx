import '@altara/core/styles.css';
// Optional peer-dep stylesheets — needed by LiveMap (Leaflet tiles + markers)
// and DashboardLayout (react-grid-layout drag/resize handles). End-consumers
// should import these themselves; here we wire them into Storybook so the
// stories render with full visual fidelity.
import 'leaflet/dist/leaflet.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { AltaraProvider } from '@altara/core';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react';

const preview: Preview = {
  decorators: [
    // Theme toggle — sets the data-altara-theme attribute that AltaraProvider
    // also uses, so the toolbar control and the provider stay in sync.
    withThemeByDataAttribute({
      themes: { Dark: 'dark', Light: 'light' },
      defaultTheme: 'Dark',
      attributeName: 'data-altara-theme',
    }),
    (Story) => (
      <AltaraProvider>
        <div
          style={{
            padding: '24px',
            minHeight: '300px',
            background: 'var(--vt-bg-base)',
            color: 'var(--vt-text-primary)',
          }}
        >
          <Story />
        </div>
      </AltaraProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    docs: {
      canvas: { sourceState: 'shown' },
      story: { inline: true },
    },
  },
};

export default preview;
