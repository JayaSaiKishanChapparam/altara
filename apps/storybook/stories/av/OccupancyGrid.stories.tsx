import type { Meta, StoryObj } from '@storybook/react';
import { OccupancyGrid } from '@altara/av';

const meta: Meta<typeof OccupancyGrid> = {
  title: 'AV/OccupancyGrid',
  component: OccupancyGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '2D overhead occupancy-grid map. Free cells render white, occupied black, unknown grey. Vehicle pose, goal marker, and planned path overlay in grid-frame coordinates.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof OccupancyGrid>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, width: 480, height: 480 },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    width: 480,
    height: 480,
    grid: Array.from({ length: 30 }, (_, r) =>
      Array.from({ length: 30 }, (_, c) =>
        r === 0 || c === 0 || r === 29 || c === 29 ? 100 : 0,
      ),
    ),
    vehiclePos: { x: 14, y: 18, theta: 0 },
    goal: { x: 4, y: 4 },
  },
};
