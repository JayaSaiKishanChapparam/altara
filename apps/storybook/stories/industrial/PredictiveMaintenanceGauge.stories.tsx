import type { Meta, StoryObj } from '@storybook/react';
import { PredictiveMaintenanceGauge } from '@altara/industrial';

const meta: Meta<typeof PredictiveMaintenanceGauge> = {
  title: 'Industrial/PredictiveMaintenanceGauge',
  component: PredictiveMaintenanceGauge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Predictive-maintenance health-index gauge. Combines weighted contributor scores into a single 0..100 health number plus an estimated remaining-useful-life with confidence band.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PredictiveMaintenanceGauge>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 'md' },
};

export const Static: Story = {
  name: 'Static health snapshot',
  args: {
    healthScore: 82,
    rulDays: 65,
    confidence: 7,
    contributors: [
      { name: 'Vibration RMS', score: 78, weight: 0.4 },
      { name: 'Temperature trend', score: 86, weight: 0.3 },
      { name: 'Current signature', score: 71, weight: 0.2 },
      { name: 'Acoustic emission', score: 92, weight: 0.1 },
    ],
    lastMaintenance: '2026-02-12',
    nextScheduled: '2026-07-12',
    size: 'md',
  },
};
