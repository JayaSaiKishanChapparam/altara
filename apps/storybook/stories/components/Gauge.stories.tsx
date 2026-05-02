import type { Meta, StoryObj } from '@storybook/react';
import { Gauge } from '@altara/core';
import { createBatteryStateAdapter } from '@altara/ros';

const meta: Meta<typeof Gauge> = {
  title: 'Components/Gauge',
  component: Gauge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Analog-style SVG gauge with a 270° sweep (135°→45°, opening at the bottom). The needle uses the SVG `transform` attribute for an unambiguous rotation pivot across browsers; smooth motion comes from the data source itself emitting at 30+ Hz rather than a CSS transition.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Gauge>;

// ── Story 1: Default — works with mockMode and minimal props ───────────
export const Default: Story = {
  name: 'Default',
  args: { min: 0, max: 100, mockMode: true, label: 'Battery', unit: '%' },
};

// ── Story 2: Threshold zones ───────────────────────────────────────────
export const WithThresholds: Story = {
  name: 'With thresholds',
  args: {
    min: 0,
    max: 100,
    mockMode: true,
    label: 'Battery',
    unit: '%',
    thresholds: [
      { value: 0, color: 'var(--vt-color-danger)' },
      { value: 20, color: 'var(--vt-color-warn)' },
      { value: 40, color: 'var(--vt-color-active)' },
    ],
  },
};

// ── Story 3: All three sizes side by side ──────────────────────────────
export const Sizes: Story = {
  name: 'Sizes',
  parameters: {
    docs: {
      description: { story: 'sm 120 px · md 180 px · lg 240 px.' },
    },
  },
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      <Gauge min={0} max={100} mockMode label="sm" unit="%" size="sm" />
      <Gauge min={0} max={100} mockMode label="md" unit="%" size="md" />
      <Gauge min={0} max={100} mockMode label="lg" unit="%" size="lg" />
    </div>
  ),
};

// ── Story 4: ROS2 BatteryState adapter ─────────────────────────────────
export const WithROS2: Story = {
  name: 'With ROS2',
  parameters: {
    docs: {
      description: {
        story:
          'Live battery percentage via `createBatteryStateAdapter` from `@altara/ros`. The adapter scales `sensor_msgs/BatteryState.percentage` (`0..1`) into the gauge\'s `0..100` range. Requires `rosbridge_server` on `ws://localhost:9090`.',
      },
    },
  },
  render: () => {
    const source = createBatteryStateAdapter({
      url: 'ws://localhost:9090',
      topic: '/battery',
    });
    return (
      <Gauge
        dataSource={source}
        min={0}
        max={100}
        label="Battery"
        unit="%"
        thresholds={[
          { value: 0, color: 'var(--vt-color-danger)' },
          { value: 20, color: 'var(--vt-color-warn)' },
          { value: 40, color: 'var(--vt-color-active)' },
        ]}
      />
    );
  },
};

// ── Story 5: All props as Controls ─────────────────────────────────────
export const Playground: Story = {
  name: 'Playground (all props)',
  args: {
    min: 0,
    max: 100,
    mockMode: true,
    label: 'Battery',
    unit: '%',
    size: 'md',
  },
  argTypes: {
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    label: { control: 'text' },
    unit: { control: 'text' },
    size: { control: { type: 'select', options: ['sm', 'md', 'lg'] } },
    className: { control: 'text' },
  },
};
