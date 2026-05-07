import type { Meta, StoryObj } from '@storybook/react';
import { EngineInstrumentCluster } from '@altara/aerospace';

const meta: Meta<typeof EngineInstrumentCluster> = {
  title: 'Aerospace/EngineInstrumentCluster',
  component: EngineInstrumentCluster,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Engine telemetry panel with bar gauges for RPM, EGT, fuel flow, oil pressure, and oil temp. Per-parameter warn/danger thresholds drive the bar color (oil pressure uses low-side semantics).',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof EngineInstrumentCluster>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, engineCount: 1 },
};

export const Twin: Story = {
  name: 'Twin engine',
  args: { mockMode: true, engineCount: 2 },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    engineCount: 1,
    rpm: 2400,
    egt: 690,
    fuelFlow: 11,
    oilPressure: 65,
    oilTemp: 90,
  },
};
