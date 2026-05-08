import type { Meta, StoryObj } from '@storybook/react';
import { CameraFeed } from '@altara/av';

const meta: Meta<typeof CameraFeed> = {
  title: 'AV/CameraFeed',
  component: CameraFeed,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Camera-feed display. Renders an image URL or — in mockMode — a synthetic forward road scene. Supports overlay descriptors (crosshair, grid, box) painted on top of each frame.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CameraFeed>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, label: 'Front Camera' },
};

export const WithOverlays: Story = {
  name: 'With overlays',
  args: {
    mockMode: true,
    label: 'Front Camera',
    overlays: [
      { type: 'grid', color: 'rgba(255,255,255,0.18)' },
      { type: 'crosshair', color: 'rgba(244,208,63,0.7)' },
    ],
  },
};
