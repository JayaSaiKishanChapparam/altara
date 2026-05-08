import type { Meta, StoryObj } from '@storybook/react';
import { PIDNode } from '@altara/industrial';

const meta: Meta<typeof PIDNode> = {
  title: 'Industrial/PIDNode',
  component: PIDNode,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single P&ID instrument symbol per the ISA 5.1 standard. First letter = measured variable (F/T/P/L/A); function letters = function (I/C/T/R/A). Location styles: solid (field), dashed (panel), DCS (line through circle).',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PIDNode>;

export const FlowController: Story = {
  name: 'FIC flow indicating controller',
  args: { firstLetter: 'F', functionLetters: 'IC', value: 24.3, unit: 'm³/h', status: 'normal', size: 100 },
};

export const TempAlarm: Story = {
  name: 'TAH temperature alarm (alarm state)',
  args: { firstLetter: 'T', functionLetters: 'AH', value: 132, unit: '°C', status: 'alarm', size: 100 },
};

export const PanelMounted: Story = {
  name: 'PIC pressure (panel-mounted, dashed)',
  args: { firstLetter: 'P', functionLetters: 'IC', location: 'panel', value: 5.2, unit: 'bar', size: 100 },
};

export const DcsShared: Story = {
  name: 'LIC level (DCS shared display)',
  args: { firstLetter: 'L', functionLetters: 'IC', location: 'dcs', value: 64, unit: '%', size: 100 },
};
