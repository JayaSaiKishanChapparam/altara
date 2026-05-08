import type { Meta, StoryObj } from '@storybook/react';
import { MotorDashboard } from '@altara/industrial';

const meta: Meta<typeof MotorDashboard> = {
  title: 'Industrial/MotorDashboard',
  component: MotorDashboard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Motor health dashboard — RPM, torque, current, temperature in arc gauges plus an active-fault log. Useful for servo drives, AC induction motors, and stepper motors.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof MotorDashboard>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, ratedRPM: 3000, ratedCurrent: 10 },
};

export const FaultedMotor: Story = {
  name: 'Faulted motor',
  args: {
    rpm: 2950, torque: 14.2, current: 11.1, temperature: 108,
    faults: [
      { code: 'OT_001', description: 'Winding over-temperature', timestamp: Date.now() - 18_000 },
      { code: 'OC_023', description: 'Phase current excessive', timestamp: Date.now() - 4_000 },
    ],
  },
};
