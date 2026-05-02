import type { Meta, StoryObj } from '@storybook/react';
import { TimeSeries } from '@altara/core';
import { createRosbridgeAdapter } from '@altara/ros';

const meta: Meta<typeof TimeSeries> = {
  title: 'Components/TimeSeries',
  component: TimeSeries,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Canvas-rendered time-series chart for high-frequency sensor data. Uses `requestAnimationFrame` and writes directly to the canvas — bypasses React reconciliation entirely on the hot path so 60+ Hz feeds render without jank.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TimeSeries>;

// ── Story 1: Default — works with zero non-mock props ──────────────────
export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, height: 240 },
};

// ── Story 2: Multiple channels ─────────────────────────────────────────
export const MultiChannel: Story = {
  name: 'Multi channel',
  args: {
    mockMode: true,
    height: 240,
    channels: [
      { key: 'roll', label: 'Roll', unit: '°', color: '#1D9E75' },
      { key: 'pitch', label: 'Pitch', unit: '°', color: '#378ADD' },
      { key: 'yaw', label: 'Yaw', unit: '°', color: '#EF9F27' },
    ],
  },
};

// ── Story 3: Threshold lines ───────────────────────────────────────────
export const WithThresholds: Story = {
  name: 'With thresholds',
  args: {
    mockMode: true,
    height: 240,
    thresholds: [
      { value: 30, color: 'var(--vt-color-warn)', label: 'Warning' },
      { value: 45, color: 'var(--vt-color-danger)', label: 'Critical' },
    ],
  },
};

// ── Story 4: Live ROS2 wiring ──────────────────────────────────────────
export const WithROS2: Story = {
  name: 'With ROS2',
  parameters: {
    docs: {
      description: {
        story:
          'Wires `TimeSeries` to a live rosbridge WebSocket via `createRosbridgeAdapter` from `@altara/ros`. Requires `rosbridge_server` running on `ws://localhost:9090`; the chart will sit empty until messages arrive.',
      },
    },
  },
  render: () => {
    const source = createRosbridgeAdapter({
      url: 'ws://localhost:9090',
      topic: '/imu/data',
      messageType: 'sensor_msgs/Imu',
      valueExtractor: (msg) =>
        (msg as { angular_velocity: { z: number } }).angular_velocity.z,
    });
    return <TimeSeries dataSource={source} height={240} />;
  },
};

// ── Story 5: All props as Controls ─────────────────────────────────────
export const Playground: Story = {
  name: 'Playground (all props)',
  args: {
    mockMode: true,
    height: 240,
    windowMs: 30_000,
    bufferSize: 10_000,
    fps: 60,
  },
  argTypes: {
    height: { control: { type: 'range', min: 100, max: 600, step: 20 } },
    windowMs: { control: { type: 'range', min: 5000, max: 120_000, step: 5000 } },
    bufferSize: { control: { type: 'select', options: [1000, 5000, 10_000, 50_000] } },
    fps: { control: { type: 'select', options: [15, 30, 60] } },
    theme: { control: { type: 'select', options: ['dark', 'light', 'auto'] } },
    className: { control: 'text' },
  },
};
