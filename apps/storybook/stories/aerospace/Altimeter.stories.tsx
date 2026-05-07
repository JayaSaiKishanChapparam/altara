import type { Meta, StoryObj } from '@storybook/react';
import { Altimeter } from '@altara/aerospace';

const meta: Meta<typeof Altimeter> = {
  title: 'Aerospace/Altimeter',
  component: Altimeter,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'SVG drum-and-pointer altimeter. Hundreds-of-feet pointer sweeps the dial; thousands appear in a center drum and the Kollsman setting in a side window.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Altimeter>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 'md' },
};

export const WithAGL: Story = {
  name: 'With AGL readout',
  args: { mockMode: true, size: 'md', showAGL: true, groundElevation: 1200 },
};

export const Playground: Story = {
  name: 'Playground',
  args: { altitude: 5500, altimeterSetting: 30.06, size: 'md' },
};
