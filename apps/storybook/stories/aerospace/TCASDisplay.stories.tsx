import type { Meta, StoryObj } from '@storybook/react';
import { TCASDisplay } from '@altara/aerospace';

const meta: Meta<typeof TCASDisplay> = {
  title: 'Aerospace/TCASDisplay',
  component: TCASDisplay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Plan-position TCAS display centered on ownship, north-up. Glyph shape and color encode threat level (other / proximate / TA / RA); relative altitude and vertical-trend arrows render beside each glyph.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TCASDisplay>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 320, rangeNm: 6, rings: 2 },
};

export const StaticTraffic: Story = {
  name: 'Static traffic picture',
  args: {
    size: 360,
    rangeNm: 6,
    rings: 2,
    traffic: [
      { id: 'A1', bearing: 30, rangeNm: 4, relAltFL: 8, level: 'other', verticalTrend: 0, callsign: 'AAL123' },
      { id: 'A2', bearing: 280, rangeNm: 2.5, relAltFL: -4, level: 'proximate', verticalTrend: -300 },
      { id: 'A3', bearing: 350, rangeNm: 1.4, relAltFL: 1, level: 'ta', verticalTrend: -700 },
      { id: 'A4', bearing: 70, rangeNm: 0.9, relAltFL: 0, level: 'ra', verticalTrend: 200 },
    ],
  },
};

export const Playground: Story = {
  name: 'Playground',
  args: { size: 320, rangeNm: 6, rings: 2, traffic: [] },
};
