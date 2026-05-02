import type { Meta, StoryObj } from '@storybook/react';
import {
  ConnectionBar,
  DashboardLayout,
  Gauge,
  SignalPanel,
  TimeSeries,
  createMockDataSource,
  sineWave,
} from '@altara/core';
import type { DashboardItem } from '@altara/core';

const meta: Meta<typeof DashboardLayout> = {
  title: 'Components/DashboardLayout',
  component: DashboardLayout,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Draggable / resizable grid for telemetry panels, built on the optional `react-grid-layout` peer dep. Children are placed by matching their React `key` against the layout entry\'s `i` field.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 1100 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof DashboardLayout>;

const baseLayout: DashboardItem[] = [
  { i: 'plot', x: 0, y: 0, w: 8, h: 4 },
  { i: 'gauge', x: 8, y: 0, w: 4, h: 4 },
  { i: 'signals', x: 0, y: 4, w: 5, h: 3 },
  { i: 'status', x: 5, y: 4, w: 7, h: 1 },
];

export const Default: Story = {
  name: 'Default',
  args: { layout: baseLayout },
  render: (args) => (
    <DashboardLayout {...args}>
      <div key="plot" style={{ height: '100%' }}>
        <TimeSeries mockMode height={200} />
      </div>
      <div key="gauge" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <Gauge min={0} max={100} mockMode label="Battery" unit="%" size="md" />
      </div>
      <div key="signals" style={{ height: '100%' }}>
        <SignalPanel
          signals={[
            {
              key: 'a',
              label: 'Alt',
              unit: 'm',
              dataSource: createMockDataSource({ generator: sineWave(0.2, 50), hz: 5 }),
            },
            {
              key: 'b',
              label: 'Spd',
              unit: 'm/s',
              dataSource: createMockDataSource({ generator: sineWave(0.4, 8), hz: 5 }),
            },
          ]}
        />
      </div>
      <div key="status">
        <ConnectionBar
          url="ws://localhost:9090"
          status="connected"
          latencyMs={14}
          messagesPerSecond={250}
        />
      </div>
    </DashboardLayout>
  ),
};

export const Locked: Story = {
  name: 'Drag/resize disabled',
  args: { layout: baseLayout, isDraggable: false, isResizable: false },
  render: Default.render,
};
