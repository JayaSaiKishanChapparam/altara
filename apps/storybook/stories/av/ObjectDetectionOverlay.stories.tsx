import type { Meta, StoryObj } from '@storybook/react';
import { ObjectDetectionOverlay } from '@altara/av';

const meta: Meta<typeof ObjectDetectionOverlay> = {
  title: 'AV/ObjectDetectionOverlay',
  component: ObjectDetectionOverlay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Bounding-box overlay for object detection (YOLO/SSD-style). Pass an `imageSource` URL or run `mockMode` for a synthetic scene with animated detections. Confidence threshold and per-class colors are customisable.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ObjectDetectionOverlay>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true },
};

export const HighConfidence: Story = {
  name: 'minConfidence = 0.7',
  args: { mockMode: true, minConfidence: 0.7 },
};
