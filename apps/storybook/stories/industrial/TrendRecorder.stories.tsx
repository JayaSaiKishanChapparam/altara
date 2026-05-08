import type { Meta, StoryObj } from '@storybook/react';
import { TrendRecorder } from '@altara/industrial';

const meta: Meta<typeof TrendRecorder> = {
  title: 'Industrial/TrendRecorder',
  component: TrendRecorder,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Multi-pen chart recorder — up to 8 channels render as overlapping coloured lines, each on its own normalised Y range, sharing a single time axis. Styled after classic Honeywell / ABB industrial recorders.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TrendRecorder>;

export const Default: Story = {
  name: 'Default (1h window)',
  args: { mockMode: true, timeScale: '1h' },
};

export const ShortWindow: Story = {
  name: '5-minute window',
  args: { mockMode: true, timeScale: '5m' },
};
