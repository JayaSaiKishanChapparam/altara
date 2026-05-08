import type { Meta, StoryObj } from '@storybook/react';
import { SLAMMap } from '@altara/av';

const meta: Meta<typeof SLAMMap> = {
  title: 'AV/SLAMMap',
  component: SLAMMap,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Live SLAM map combining an occupancy grid with a pose-graph overlay. Loop-closure events show as ringed red nodes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof SLAMMap>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 480 },
};

export const NoPoseGraph: Story = {
  name: 'Map only',
  args: { mockMode: true, size: 480, showPoseGraph: false },
};
