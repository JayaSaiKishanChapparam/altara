import type { Meta, StoryObj } from '@storybook/react';
import { OEEDashboard } from '@altara/industrial';

const meta: Meta<typeof OEEDashboard> = {
  title: 'Industrial/OEEDashboard',
  component: OEEDashboard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Overall Equipment Effectiveness dashboard — the universal manufacturing KPI. Three ring gauges (availability × performance × quality) plus a Pareto chart of loss categories.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof OEEDashboard>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, shift: 'A1' },
};

export const WorldClass: Story = {
  name: 'World-class (≥85%)',
  args: { availability: 0.92, performance: 0.94, quality: 0.99, oeeTarget: 0.85, shift: 'B1' },
};

export const Underperforming: Story = {
  name: 'Underperforming',
  args: {
    availability: 0.72,
    performance: 0.68,
    quality: 0.91,
    oeeTarget: 0.85,
    shift: 'C1',
    lossCategories: [
      { category: 'Changeover', minutes: 92 },
      { category: 'Material wait', minutes: 71 },
      { category: 'Minor stops', minutes: 44 },
      { category: 'Speed loss', minutes: 33 },
    ],
  },
};
