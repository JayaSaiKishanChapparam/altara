import type { Meta, StoryObj } from '@storybook/react';
import { HorizontalSituationIndicator } from '@altara/aerospace';

const meta: Meta<typeof HorizontalSituationIndicator> = {
  title: 'Aerospace/HorizontalSituationIndicator',
  component: HorizontalSituationIndicator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Garmin G1000-style HSI — rotating compass card, heading bug, course needle with CDI, two optional bearing pointers, and TO/FROM annunciator.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof HorizontalSituationIndicator>;

export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 280 },
};

export const StaticReading: Story = {
  name: 'Static reading',
  args: {
    heading: 145,
    headingBug: 160,
    course: 150,
    courseDev: 0.3,
    toFrom: 'to',
    bearing1: 90,
    bearing2: 230,
    groundSpeed: 142,
    distanceToWaypoint: 12.4,
    size: 320,
  },
};

export const Playground: Story = {
  name: 'Playground',
  args: {
    heading: 0,
    headingBug: 30,
    course: 25,
    courseDev: 0,
    toFrom: 'to',
    size: 280,
  },
};
