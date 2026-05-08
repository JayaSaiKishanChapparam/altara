import type { Meta, StoryObj } from '@storybook/react';
import { LiDARPointCloud } from '@altara/av';

const meta: Meta<typeof LiDARPointCloud> = {
  title: 'AV/LiDARPointCloud',
  component: LiDARPointCloud,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Three.js-powered 3D LiDAR point-cloud renderer. Decodes incoming PointCloud2-style frames into a single BufferGeometry + Points object. Color modes: intensity, height, return, flat. Three.js is loaded via dynamic import — the component renders a friendly placeholder if `three` is not installed.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof LiDARPointCloud>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, width: 800, height: 500, colorMode: 'intensity' },
};

export const ColorByHeight: Story = {
  name: 'Color by height',
  args: { mockMode: true, width: 800, height: 500, colorMode: 'height' },
};

export const TopDown: Story = {
  name: 'Top-down camera',
  args: { mockMode: true, width: 600, height: 600, cameraPreset: 'top' },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    width: 640,
    height: 480,
    colorMode: 'intensity',
    cameraPreset: 'iso',
    pointSize: 2,
    maxPoints: 50_000,
    showGrid: true,
    vehicleFrame: true,
  },
};
