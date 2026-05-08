import type { Meta, StoryObj } from '@storybook/react';
import { SensorHealthMatrix } from '@altara/av';

const meta: Meta<typeof SensorHealthMatrix> = {
  title: 'AV/SensorHealthMatrix',
  component: SensorHealthMatrix,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Grid of sensor-health tiles — name, topic, expected rate, last-update age, and current status. Inspired by the Autoware diagnostic panel layout.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof SensorHealthMatrix>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true },
};

export const Compact: Story = {
  name: 'Compact (single row)',
  args: { mockMode: true, compact: true },
};
