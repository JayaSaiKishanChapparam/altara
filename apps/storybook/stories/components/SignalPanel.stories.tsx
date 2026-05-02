import type { Meta, StoryObj } from '@storybook/react';
import {
  SignalPanel,
  createMockDataSource,
  sineWave,
  randomWalk,
  stepFunction,
} from '@altara/core';
import {
  createBatteryStateAdapter,
  createRangeAdapter,
  createTemperatureAdapter,
} from '@altara/ros';
import type {
  AltaraDataSource,
  SignalPanelSignal,
  TelemetryValue,
} from '@altara/core';

const meta: Meta<typeof SignalPanel> = {
  title: 'Components/SignalPanel',
  component: SignalPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact React grid of named telemetry values. Each row owns its subscription, flashes briefly on each new sample, turns amber/red on threshold breach, and grays out when the latest sample is older than `staleAfterMs`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof SignalPanel>;

// Source that emits a single sample then goes silent — used to demo
// staleness detection.
function oneShotSource(value: number): AltaraDataSource {
  const subs = new Set<(v: TelemetryValue) => void>();
  let history: TelemetryValue[] = [];
  setTimeout(() => {
    const sample = { value, timestamp: Date.now() };
    history = [sample];
    for (const cb of subs) cb(sample);
  }, 200);
  return {
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getHistory: () => history.slice(),
    status: 'connected',
    destroy() {
      subs.clear();
    },
  };
}

// ── Story 1: Default ───────────────────────────────────────────────────
export const Default: Story = {
  name: 'Default',
  args: {
    signals: [
      {
        key: 'alt',
        label: 'Altitude',
        unit: 'm',
        dataSource: createMockDataSource({ generator: sineWave(0.2, 50), hz: 5 }),
      },
      {
        key: 'spd',
        label: 'Speed',
        unit: 'm/s',
        dataSource: createMockDataSource({ generator: sineWave(0.4, 8), hz: 5 }),
      },
      {
        key: 'temp',
        label: 'Temp',
        unit: '°C',
        warnAt: 60,
        dangerAt: 80,
        dataSource: createMockDataSource({
          generator: randomWalk(0.05, 100, 0.4),
          hz: 5,
        }),
      },
    ],
  },
};

// ── Story 2: WithStaleness — one row stops updating ────────────────────
export const WithStaleness: Story = {
  name: 'With staleness',
  parameters: {
    docs: {
      description: {
        story:
          'The middle row receives one sample, then the source goes silent. After `staleAfterMs` (here 3 s) the row\'s status dot turns gray.',
      },
    },
  },
  args: {
    staleAfterMs: 3000,
    signals: [
      {
        key: 'live',
        label: 'Battery',
        unit: '%',
        dataSource: createMockDataSource({
          generator: () => 70 + Math.random() * 5,
          hz: 5,
        }),
      },
      {
        key: 'silent',
        label: 'GPS sats',
        unit: '',
        dataSource: oneShotSource(8),
      },
      {
        key: 'live2',
        label: 'Heading',
        unit: '°',
        dataSource: createMockDataSource({ generator: sineWave(0.1, 180), hz: 5 }),
      },
    ],
  },
};

// ── Story 3: Dense layout — many rows in a multi-column grid ───────────
export const DenseLayout: Story = {
  name: 'Dense layout',
  args: {
    columns: 3,
    signals: Array.from({ length: 12 }, (_, i) => ({
      key: `s${i}`,
      label: ['Roll', 'Pitch', 'Yaw', 'Vx', 'Vy', 'Vz', 'Alt', 'Spd', 'Hdg', 'Lat', 'Lon', 'Sat'][
        i
      ]!,
      unit: ['°', '°', '°', 'm/s', 'm/s', 'm/s', 'm', 'm/s', '°', '°', '°', ''][i]!,
      dataSource: createMockDataSource({
        generator:
          i % 3 === 0
            ? sineWave(0.2 + i * 0.05, 30)
            : i % 3 === 1
              ? randomWalk(0.05, 100, 0.5)
              : stepFunction(2000, 0, 1),
        hz: 5,
      }),
    })) as SignalPanelSignal[],
  },
};

// ── Story 4: ROS2 wiring — three typed adapters from @altara/ros ───────
export const WithROS2: Story = {
  name: 'With ROS2',
  parameters: {
    docs: {
      description: {
        story:
          'Three rows wired to typed ROS adapters: battery percentage, sonar range, and a temperature probe. Requires `rosbridge_server` on `ws://localhost:9090`.',
      },
    },
  },
  render: () => (
    <SignalPanel
      staleAfterMs={5000}
      signals={[
        {
          key: 'battery',
          label: 'Battery',
          unit: '%',
          warnAt: 30,
          dangerAt: 15,
          thresholdDirection: 'below',
          dataSource: createBatteryStateAdapter({
            url: 'ws://localhost:9090',
            topic: '/battery',
          }),
        },
        {
          key: 'range',
          label: 'Sonar',
          unit: 'm',
          dataSource: createRangeAdapter({
            url: 'ws://localhost:9090',
            topic: '/sonar',
          }),
        },
        {
          key: 'temp',
          label: 'Temp',
          unit: '°C',
          warnAt: 60,
          dangerAt: 80,
          dataSource: createTemperatureAdapter({
            url: 'ws://localhost:9090',
            topic: '/onboard/temperature',
          }),
        },
      ]}
    />
  ),
};
