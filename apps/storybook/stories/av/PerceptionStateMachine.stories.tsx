import type { Meta, StoryObj } from '@storybook/react';
import { PerceptionStateMachine } from '@altara/av';

const meta: Meta<typeof PerceptionStateMachine> = {
  title: 'AV/PerceptionStateMachine',
  component: PerceptionStateMachine,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Real-time perception-pipeline visualisation. Localization → Lidar/Camera Detection → Sensor Fusion → Tracking → Prediction → Planning. Each node displays current status and per-module latency.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PerceptionStateMachine>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true },
};

export const AllActive: Story = {
  name: 'All active',
  args: {
    modules: [
      { name: 'Localization', status: 'active', latencyMs: 12 },
      { name: 'Lidar Detection', status: 'active', latencyMs: 32 },
      { name: 'Camera Detection', status: 'active', latencyMs: 48 },
      { name: 'Sensor Fusion', status: 'active', latencyMs: 10 },
      { name: 'Tracking', status: 'active', latencyMs: 8 },
      { name: 'Prediction', status: 'active', latencyMs: 22 },
      { name: 'Planning', status: 'active', latencyMs: 18 },
    ],
  },
};
