import type { Meta, StoryObj } from '@storybook/react';
import { WaterfallSpectrogram } from '@altara/industrial';

const meta: Meta<typeof WaterfallSpectrogram> = {
  title: 'Industrial/WaterfallSpectrogram',
  component: WaterfallSpectrogram,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Real-time spectrogram waterfall — a Hann-windowed radix-2 FFT runs on every incoming frame; magnitude (dB) is encoded as colour and one row of pixels per frame scrolls the canvas downward. Built for vibration analysis, acoustic monitoring, and RF survey.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof WaterfallSpectrogram>;

export const Default: Story = {
  name: 'Default (heat colormap)',
  args: { mockMode: true, width: 720, height: 360, colorMap: 'heat' },
};

export const Viridis: Story = {
  name: 'Viridis colormap',
  args: { mockMode: true, width: 720, height: 360, colorMap: 'viridis' },
};

export const HighResolution: Story = {
  name: 'FFT 2048',
  args: { mockMode: true, width: 720, height: 360, fftSize: 2048, freqMax: 500 },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    width: 720,
    height: 360,
    fftSize: 512,
    sampleRate: 1000,
    freqMin: 0,
    freqMax: 500,
    colorMap: 'heat',
    dbRange: [-80, 0],
    scrollRate: 30,
  },
};
