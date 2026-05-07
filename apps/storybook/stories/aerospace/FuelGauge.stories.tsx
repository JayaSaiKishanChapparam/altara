import type { Meta, StoryObj } from '@storybook/react';
import { FuelGauge } from '@altara/aerospace';

const meta: Meta<typeof FuelGauge> = {
  title: 'Aerospace/FuelGauge',
  component: FuelGauge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Per-tank bar gauges with a totaliser. Status color reflects each tank fraction; the totaliser draws a vertical reserve marker when reserve is supplied.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof FuelGauge>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, unit: 'gal' },
};

export const ThreeTank: Story = {
  name: 'Three-tank wing layout',
  args: {
    unit: 'gal',
    reserve: 30,
    tanks: [
      { id: 'L', label: 'L MAIN', quantity: 42, capacity: 60 },
      { id: 'C', label: 'CTR', quantity: 12, capacity: 40 },
      { id: 'R', label: 'R MAIN', quantity: 41, capacity: 60 },
    ],
  },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    unit: 'gal',
    reserve: 25,
    lowWarn: 0.2,
    lowDanger: 0.1,
    tanks: [
      { id: 'L', label: 'L', quantity: 25, capacity: 50 },
      { id: 'R', label: 'R', quantity: 30, capacity: 50 },
    ],
  },
};
