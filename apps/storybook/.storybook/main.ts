import type { StorybookConfig } from '@storybook/react-vite';
import { resolve } from 'node:path';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
    defaultName: 'API Reference',
  },
  // Storybook's built-in `typescript.reactDocgen: 'react-docgen-typescript'`
  // didn't reliably extract JSDoc from our workspace imports — it kept
  // falling back to the JS-only `react-docgen`. We turn it off and run the
  // joshwooding vite plugin ourselves with the right tsconfig + propFilter.
  typescript: { reactDocgen: false },
  async viteFinal(config) {
    const { default: docgen } = await import(
      '@joshwooding/vite-plugin-react-docgen-typescript'
    );
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      docgen({
        tsconfigPath: resolve(__dirname, '../tsconfig.json'),
        // Explicit include — the plugin's default glob is relative to
        // the Vite root (apps/storybook), so without this it doesn't
        // reach the workspace component sources.
        include: [
          '../../packages/core/src/**/*.{ts,tsx}',
          '../../packages/ros/src/**/*.{ts,tsx}',
          '../../packages/aerospace/src/**/*.{ts,tsx}',
          '../../packages/av/src/**/*.{ts,tsx}',
          '../../packages/industrial/src/**/*.{ts,tsx}',
          'stories/**/*.{ts,tsx}',
        ],
        shouldExtractLiteralValuesFromEnum: true,
        // Allow @altara/* + workspace source through; pnpm symlinks
        // workspace packages into node_modules so a default
        // /node_modules/ filter would also drop our own JSDoc'd props.
        propFilter: (prop) => {
          if (!prop.parent) return true;
          const f = prop.parent.fileName;
          if (
            /node_modules\/@altara\//.test(f) ||
            /packages\/core\/src/.test(f) ||
            /packages\/ros\/src/.test(f) ||
            /packages\/aerospace\/src/.test(f) ||
            /packages\/av\/src/.test(f) ||
            /packages\/industrial\/src/.test(f)
          ) {
            return true;
          }
          return !/node_modules/.test(f);
        },
      }),
    );

    // Resolve @altara/core and @altara/ros to their source .tsx files
    // (rather than the published dist .mjs) so the docgen plugin can read
    // JSDoc directly from the typed prop interfaces. The .d.ts in dist
    // preserves the JSDoc, but the plugin only parses .ts/.tsx.
    config.resolve = config.resolve ?? {};
    const existingAlias = config.resolve.alias;
    const aliasEntries: Array<{ find: string; replacement: string }> = Array.isArray(
      existingAlias,
    )
      ? [...existingAlias]
      : Object.entries((existingAlias ?? {}) as Record<string, string>).map(
          ([find, replacement]) => ({ find, replacement }),
        );
    aliasEntries.push(
      {
        find: /^@altara\/core$/,
        replacement: resolve(__dirname, '../../../packages/core/src/index.ts'),
      } as unknown as { find: string; replacement: string },
      {
        find: /^@altara\/core\/styles\.css$/,
        replacement: resolve(__dirname, '../../../packages/core/src/tokens/tokens.css'),
      } as unknown as { find: string; replacement: string },
      {
        find: /^@altara\/ros$/,
        replacement: resolve(__dirname, '../../../packages/ros/src/index.ts'),
      } as unknown as { find: string; replacement: string },
      {
        find: /^@altara\/aerospace$/,
        replacement: resolve(__dirname, '../../../packages/aerospace/src/index.ts'),
      } as unknown as { find: string; replacement: string },
      {
        find: /^@altara\/av$/,
        replacement: resolve(__dirname, '../../../packages/av/src/index.ts'),
      } as unknown as { find: string; replacement: string },
      {
        find: /^@altara\/industrial$/,
        replacement: resolve(__dirname, '../../../packages/industrial/src/index.ts'),
      } as unknown as { find: string; replacement: string },
    );
    config.resolve.alias = aliasEntries;
    return config;
  },
  staticDirs: ['../public'],
};

export default config;
