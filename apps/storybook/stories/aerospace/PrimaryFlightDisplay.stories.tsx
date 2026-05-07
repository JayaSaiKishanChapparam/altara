import type { Meta, StoryObj } from '@storybook/react';
import { PrimaryFlightDisplay } from '@altara/aerospace';

const meta: Meta<typeof PrimaryFlightDisplay> = {
  title: 'Aerospace/PrimaryFlightDisplay',
  component: PrimaryFlightDisplay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Composite Primary Flight Display — attitude sphere + airspeed/altitude/heading tapes + VSI + flight director, all painted to a single canvas. Styled after Garmin G1000 / Honeywell Primus layouts and intended as the centerpiece of any drone ground station.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PrimaryFlightDisplay>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 'md' },
};

export const Large: Story = {
  name: 'Large',
  args: { mockMode: true, size: 'lg' },
};

export const WithFlightDirector: Story = {
  name: 'With flight director',
  parameters: {
    docs: {
      description: {
        story: 'Magenta flight-director crossbars overlaid on the attitude sphere — drives toward fdRoll/fdPitch.',
      },
    },
  },
  args: { mockMode: true, size: 'lg', showFlightDirector: true },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    size: 'md',
    roll: -8,
    pitch: 4,
    heading: 90,
    airspeed: 120,
    altitude: 4500,
    vs: 200,
    altimeterSetting: 29.92,
    showFlightDirector: false,
    fdRoll: 0,
    fdPitch: 0,
  },
};
