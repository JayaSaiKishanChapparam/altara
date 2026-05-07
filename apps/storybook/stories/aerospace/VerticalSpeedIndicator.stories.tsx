import type { Meta, StoryObj } from '@storybook/react';
import { VerticalSpeedIndicator } from '@altara/aerospace';

const meta: Meta<typeof VerticalSpeedIndicator> = {
  title: 'Aerospace/VerticalSpeedIndicator',
  component: VerticalSpeedIndicator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'SVG arc gauge. Sweeps ±range ft/min around the dial; numeric readout in the center.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof VerticalSpeedIndicator>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 'md' },
};

export const Climbing: Story = {
  name: 'Climbing 1500 fpm',
  args: { vs: 1500, size: 'lg' },
};

export const Playground: Story = {
  name: 'Playground',
  args: { vs: 0, range: 2000, size: 'md' },
};
