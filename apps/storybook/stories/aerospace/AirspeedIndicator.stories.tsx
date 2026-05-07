import type { Meta, StoryObj } from '@storybook/react';
import { AirspeedIndicator } from '@altara/aerospace';

const meta: Meta<typeof AirspeedIndicator> = {
  title: 'Aerospace/AirspeedIndicator',
  component: AirspeedIndicator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Round airspeed indicator with FAA arc zones — white (flap range), green (normal), yellow (caution) — and a red Vne line.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AirspeedIndicator>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 'md' },
};

export const ApproachConfig: Story = {
  name: 'Approach configuration',
  args: { airspeed: 80, size: 'lg', vso: 50, vs1: 60, vfe: 110, vno: 165, vne: 200 },
};

export const Playground: Story = {
  name: 'Playground',
  args: { airspeed: 120, size: 'md', vso: 45, vs1: 55, vfe: 100, vno: 165, vne: 200 },
};
