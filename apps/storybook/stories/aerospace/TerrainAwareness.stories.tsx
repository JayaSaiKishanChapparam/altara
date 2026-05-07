import type { Meta, StoryObj } from '@storybook/react';
import { TerrainAwareness } from '@altara/aerospace';

const meta: Meta<typeof TerrainAwareness> = {
  title: 'Aerospace/TerrainAwareness',
  component: TerrainAwareness,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Lightweight TAWS-style display. Color-codes a forward terrain footprint by elevation relative to ownship: green safely below, yellow within 500–1000 ft, red within 500 ft.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TerrainAwareness>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, width: 360, height: 240 },
};

export const Wide: Story = {
  name: 'Wide',
  args: { mockMode: true, width: 520, height: 280 },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    altitude: 3500,
    radioAltitude: 800,
    heading: 45,
    vs: -300,
    cellSizeNm: 0.5,
    width: 360,
    height: 240,
  },
};
