# Contributing to Altara

Thanks for the interest. Altara is an MIT-licensed React component library for real-time telemetry visualization. The fastest way to help is to fix a bug, sharpen a docstring, write a recipe for the cookbook, or open an issue with a clear repro.

## Prerequisites

- **Node.js** 20 LTS or higher (`node --version`)
- **pnpm** 8 or higher (`corepack enable && corepack prepare pnpm@8.15.4 --activate`)
- **Git**
- **Docker** (only required if you want to run the rosbridge integration locally)

## Development setup

```bash
git clone https://github.com/JayaSaiKishanChapparam/altara.git
cd altara
pnpm install
pnpm turbo build

# Optional — start the rosbridge dev environment for ROS2 integration
docker compose -f docker/ros2/docker-compose.yml up

# Watch mode — Storybook with HMR; component changes hot-reload
pnpm --filter @altara/storybook storybook
# → http://localhost:6006
```

## Repository layout

```
packages/
  core/        # @altara/core — components, hooks, MQTT/mock adapters, design tokens
  ros/         # @altara/ros — rosbridge adapter + typed factories for common ROS msg types
  mqtt/        # @altara/mqtt — placeholder for the MQTT-specific extras package
apps/
  storybook/   # @altara/storybook — interactive docs (storybook.altara.dev)
  demo/        # Vite demo app
docker/
  ros2/        # rosbridge dev environment
.changeset/    # pending version bumps; consumed by the release pipeline
docs/          # cross-cutting docs (accessibility audit, etc.)
scripts/       # tooling — GIF recorder, smoke tests, etc.
```

## Day-to-day commands

| Command | What it does |
|---|---|
| `pnpm turbo build` | Build every package and the Storybook |
| `pnpm turbo test` | Run all unit tests |
| `pnpm turbo lint` | Run ESLint everywhere |
| `pnpm --filter @altara/core dev` | Watch + rebuild `@altara/core` |
| `pnpm --filter @altara/storybook storybook` | Run Storybook locally on http://localhost:6006 |
| `pnpm --filter @altara/core exec size-limit` | Check the bundle-size gate |

## Adding a component

Use the existing components as templates. Each new component must hit the bar from the docs brief §4.2 and the implementation brief §6.3:

1. **TypeScript strict** — props typed and exported with full **JSDoc on every prop** (the Docs tab is auto-generated from these). No `any`, no `@ts-ignore`.
2. **Story file at `apps/storybook/stories/components/<Component>.stories.tsx`** following the template in docs brief §4.1: `tags: ['autodocs']`, a component-level description, a `Default` story that works with `mockMode` only, and a `Playground` story exposing every prop via Controls.
3. **Render test** at `packages/core/src/components/<Component>/<Component>.test.tsx` using `@testing-library/react`, covering at least the critical render path.
4. **Tree-shakable** — re-export from `packages/core/src/index.ts`; importing the new component must not pull in the rest of the library.
5. **Accessibility** — `role`, `aria-label`, keyboard support where applicable. Canvas-rendered components have `role="img"` plus a meaningful `aria-label`.
6. **Both themes** — renders correctly under `data-altara-theme="dark"` and `="light"`. Read CSS custom properties; never hard-code colors.
7. **`mockMode`** — works with zero other props for any component that accepts a `dataSource`.
8. **Changeset** — every PR touching public API includes a changeset.

## Adding a guide or cookbook page

Written content lives in `apps/storybook/stories/{guides,cookbook,comparisons}/`. To add a new page:

1. Create the MDX file — e.g. `apps/storybook/stories/guides/MyTopic.mdx`.
2. Front-matter:
   ```mdx
   import { Canvas, Meta } from '@storybook/blocks';

   <Meta title="Guides/My topic" />

   # My topic
   ```
3. To embed a live story, import it and use `<Canvas of={...} />`:
   ```mdx
   import * as TimeSeriesStories from '../components/TimeSeries.stories';
   <Canvas of={TimeSeriesStories.Default} />
   ```
4. All code examples must compile against `@altara/core` / `@altara/ros`. Use `mockMode` so examples work zero-config.
5. The smoketest at `scripts/check-mdx.mjs` walks every page — add a sentinel substring there if the page makes a strong promise.

## Hot path discipline

Performance is non-negotiable. Read [`docs/accessibility.md`](docs/accessibility.md) and §13 of the implementation blueprint, then keep these in mind:

- High-frequency telemetry must not call `setState`. Write to a `RingBuffer` via a `useRef` and read in your `requestAnimationFrame` loop.
- Never push to a plain JS array for telemetry data. The `RingBuffer` (Float64Array) is fixed-capacity and overwrites oldest.
- For ≥500 Hz feeds use `createWorkerDataSource` so the WebSocket runs off-thread.
- Canvas sizing must respect `window.devicePixelRatio` to avoid retina blurriness.
- Heavy peer deps (`leaflet`, `react-leaflet`, `react-grid-layout`, `three`, `mqtt`) stay external — they're optional peer deps, dynamically imported, and externalized in `tsup.config.ts`.

## Changesets

Every PR that changes public API needs a changeset describing the change.

```bash
pnpm changeset
# pick the affected packages
# pick "patch" / "minor" / "major"
# write a short summary
git add .changeset
git commit -m "chore: add changeset"
```

Releases are automated. Merging to `main` opens a "Version Packages" PR; merging that PR triggers `npm publish`.

## PR checklist

Before opening a PR, confirm each item:

- [ ] `pnpm turbo lint` passes.
- [ ] `pnpm turbo test` passes.
- [ ] `pnpm turbo build` passes.
- [ ] `pnpm --filter @altara/core exec size-limit` is green.
- [ ] Behavior changes have new or updated tests.
- [ ] New / changed component props have **JSDoc on every prop**.
- [ ] If adding a component: at least one story under `apps/storybook/stories/components/` and a render test.
- [ ] If changing public API: a `pnpm changeset` entry is committed.
- [ ] One topic per PR — refactors and feature work shouldn't share a branch.

## Reporting issues

When opening an issue please include:

- Altara version, React version, browser/Node version.
- A minimal Storybook story or CodeSandbox that reproduces it.
- Expected vs. actual behavior, plus any console output.

After the repo is public, **Discussions** is enabled in `Settings → General → Features`. Categories: Q&A, Ideas, Show and Tell, Announcements. Pin the "What are you building with Altara?" thread for the showcase.

## License

By contributing you agree that your contribution is licensed under the MIT License (the same license as the project).
