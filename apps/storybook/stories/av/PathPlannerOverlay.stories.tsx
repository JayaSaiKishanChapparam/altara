import type { Meta, StoryObj } from '@storybook/react';
import { PathPlannerOverlay } from '@altara/av';

const meta: Meta<typeof PathPlannerOverlay> = {
  title: 'AV/PathPlannerOverlay',
  component: PathPlannerOverlay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Top-down planned (cyan dashed) vs actual (yellow) trajectory with a deviation corridor and live cross-track-error readout.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PathPlannerOverlay>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, width: 600, height: 400 },
};
