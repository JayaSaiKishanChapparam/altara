import type { Meta, StoryObj } from '@storybook/react';
import { MultiAxisPlot } from '@altara/core';

const meta: Meta<typeof MultiAxisPlot> = {
  title: 'Components/MultiAxisPlot',
  component: MultiAxisPlot,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Time-series chart with independent left and right Y-axes — pair signals on different scales (e.g. battery % on the left, current draw in A on the right). Same canvas + rAF + RingBuffer hot path as `TimeSeries`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof MultiAxisPlot>;

export const Default: Story = {
  name: 'Default',
  args: {
    mockMode: true,
    height: 240,
    leftAxisLabel: 'Battery (%)',
    rightAxisLabel: 'Current (A)',
    channels: [
      { key: 'battery', label: 'Battery', unit: '%', axis: 'left' },
      { key: 'current', label: 'Current', unit: 'A', axis: 'right' },
    ],
  },
};

export const ThreeChannels: Story = {
  name: 'Three channels',
  args: {
    mockMode: true,
    height: 280,
    leftAxisLabel: 'Pitch (°)',
    rightAxisLabel: 'Throttle (%)',
    channels: [
      { key: 'pitch', label: 'Pitch', unit: '°', axis: 'left' },
      { key: 'roll', label: 'Roll', unit: '°', axis: 'left' },
      { key: 'throttle', label: 'Throttle', unit: '%', axis: 'right' },
    ],
  },
};

export const WithThresholds: Story = {
  name: 'With thresholds',
  args: {
    mockMode: true,
    height: 240,
    leftAxisLabel: 'Pitch (°)',
    rightAxisLabel: 'Throttle (%)',
    channels: [
      { key: 'pitch', label: 'Pitch', unit: '°', axis: 'left' },
      { key: 'throttle', label: 'Throttle', unit: '%', axis: 'right' },
    ],
    thresholds: [
      { value: 30, color: 'var(--vt-color-warn)', axis: 'left' },
      { value: 80, color: 'var(--vt-color-danger)', axis: 'right' },
    ],
  },
};
