import type { Meta, StoryObj } from '@storybook/react';
import { VelocityVectorDisplay } from '@altara/av';

const meta: Meta<typeof VelocityVectorDisplay> = {
  title: 'AV/VelocityVectorDisplay',
  component: VelocityVectorDisplay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Top-down vehicle diagram with velocity arrows. Linear velocity drives the cyan arrow length / direction; angular velocity (yaw rate) renders as a magenta arc.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof VelocityVectorDisplay>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 240 },
};

export const ForwardOnly: Story = {
  name: 'Forward 8 m/s',
  args: { vx: 8, vy: 0, omega: 0, size: 240 },
};

export const RightTurn: Story = {
  name: 'Right turn',
  args: { vx: 5, vy: 0.5, omega: -0.6, size: 240 },
};
