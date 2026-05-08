import type { Meta, StoryObj } from '@storybook/react';
import { ControlTrace } from '@altara/av';

const meta: Meta<typeof ControlTrace> = {
  title: 'AV/ControlTrace',
  component: ControlTrace,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Three vertically stacked time-series panels — throttle, brake, steering — sharing an X axis. Useful for analysing handoffs, takeovers, and disengagements in autonomous driving.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ControlTrace>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, windowMs: 15_000 },
};

export const ShortWindow: Story = {
  name: '5-second window',
  args: { mockMode: true, windowMs: 5_000 },
};
