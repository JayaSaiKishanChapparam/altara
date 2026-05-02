import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

addons.setConfig({
  theme: create({
    base: 'dark',
    brandTitle: 'Altara',
    brandUrl: 'https://github.com/JayaSaiKishanChapparam/altara',
    brandTarget: '_blank',
    colorPrimary: '#1D9E75',
    colorSecondary: '#378ADD',
    appBg: '#0E0F10',
    appContentBg: '#181A1B',
    appBorderRadius: 6,
    barBg: '#181A1B',
    inputBg: '#1F2224',
    fontBase: '"Inter", system-ui, sans-serif',
    fontCode: '"JetBrains Mono", monospace',
  }),
  sidebar: { showRoots: true },
});
