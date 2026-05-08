import type { Meta, StoryObj } from '@storybook/react';
import { PIDTuningPanel } from '@altara/industrial';

const meta: Meta<typeof PIDTuningPanel> = {
  title: 'Industrial/PIDTuningPanel',
  component: PIDTuningPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Real-time PID controller view — setpoint (cyan dashed), process value (green), controller output (amber) on a synchronised canvas with the live error band drawn around the active setpoint and Kp/Ki/Kd readouts in the corner.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PIDTuningPanel>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, kp: 1.2, ki: 0.4, kd: 0.05, errorBand: 5, unit: '°C' },
};

export const HeavyP: Story = {
  name: 'High Kp (oscillation)',
  args: { mockMode: true, kp: 3.5, ki: 0.1, kd: 0.0, errorBand: 5, unit: '°C' },
};
