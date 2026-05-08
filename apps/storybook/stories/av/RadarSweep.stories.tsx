import type { Meta, StoryObj } from '@storybook/react';
import { RadarSweep } from '@altara/av';

const meta: Meta<typeof RadarSweep> = {
  title: 'AV/RadarSweep',
  component: RadarSweep,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'PPI radar sweep with a rotating wedge. Targets light up when the sweep crosses them and decay over `persistence` seconds.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof RadarSweep>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 380, range: 50 },
};

export const FasterSweep: Story = {
  name: 'Faster sweep (2 rps)',
  args: { mockMode: true, size: 380, range: 50, sweepRate: 2 },
};
