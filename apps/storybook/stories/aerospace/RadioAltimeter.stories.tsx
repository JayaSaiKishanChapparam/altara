import type { Meta, StoryObj } from '@storybook/react';
import { RadioAltimeter } from '@altara/aerospace';

const meta: Meta<typeof RadioAltimeter> = {
  title: 'Aerospace/RadioAltimeter',
  component: RadioAltimeter,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Digital radar/radio altitude readout with a decision-height bug. Display flashes amber when below DH; onDecisionHeight fires once per descent through the bug.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof RadioAltimeter>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 'md', decisionHeight: 200 },
};

export const Approach: Story = {
  name: 'Approach (200 ft DH)',
  args: { radioAltitude: 180, decisionHeight: 200, size: 'lg' },
};

export const Playground: Story = {
  name: 'Playground',
  args: { radioAltitude: 850, decisionHeight: 200, maxAltitude: 2500, size: 'md' },
};
