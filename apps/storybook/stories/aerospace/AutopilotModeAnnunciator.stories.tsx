import type { Meta, StoryObj } from '@storybook/react';
import { AutopilotModeAnnunciator } from '@altara/aerospace';

const meta: Meta<typeof AutopilotModeAnnunciator> = {
  title: 'Aerospace/AutopilotModeAnnunciator',
  component: AutopilotModeAnnunciator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Flight mode annunciator strip — A/T, lateral, vertical, AP, FD slots. Active modes are green; armed modes cyan; caution amber; off slots dim.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AutopilotModeAnnunciator>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true },
};

export const ApproachCapture: Story = {
  name: 'Approach (LOC active, GS armed)',
  args: {
    modes: {
      autothrottle: { label: 'SPD', status: 'active' },
      lateral: { label: 'LOC', status: 'active' },
      vertical: { label: 'GS', status: 'armed' },
      ap: { label: 'AP1', status: 'active' },
      fd: { label: 'FD', status: 'active' },
    },
  },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    modes: {
      autothrottle: { label: 'SPD', status: 'active' },
      lateral: { label: 'HDG', status: 'active' },
      vertical: { label: 'VS', status: 'active' },
      ap: { label: 'AP1', status: 'active' },
      fd: { label: 'FD', status: 'active' },
    },
  },
};
