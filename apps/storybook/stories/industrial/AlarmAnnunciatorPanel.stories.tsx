import type { Meta, StoryObj } from '@storybook/react';
import { AlarmAnnunciatorPanel } from '@altara/industrial';

const meta: Meta<typeof AlarmAnnunciatorPanel> = {
  title: 'Industrial/AlarmAnnunciatorPanel',
  component: AlarmAnnunciatorPanel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Industrial control-room alarm panel. Tiles blink while alarms are unacknowledged; clicking transitions them to the acknowledged state and fires `onAcknowledge`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AlarmAnnunciatorPanel>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, columns: 6 },
};

export const TwoActive: Story = {
  name: 'Static alarm states',
  args: {
    columns: 4,
    alarms: [
      { id: 'A1', label: 'PUMP HIGH', priority: 1 },
      { id: 'A2', label: 'TEMP HIGH', priority: 1 },
      { id: 'A3', label: 'TANK LOW', priority: 2 },
      { id: 'A4', label: 'COMM LOST', priority: 1 },
      { id: 'A5', label: 'DOOR OPEN', priority: 3 },
      { id: 'A6', label: 'E-STOP', priority: 1 },
      { id: 'A7', label: 'FLOW LOW', priority: 2 },
      { id: 'A8', label: 'LUBE LOW', priority: 2 },
    ],
    states: { A1: 'alarm', A2: 'warning', A4: 'acknowledged' },
  },
};
