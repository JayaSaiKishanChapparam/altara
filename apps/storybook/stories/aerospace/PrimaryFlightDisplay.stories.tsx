import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo } from 'react';
import { PrimaryFlightDisplay } from '@altara/aerospace';
import { createImuAdapter, createRosbridgeAdapter, mergeChannels } from '@altara/ros';

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

// MAVROS wiring on two sockets — IMU (roll/pitch) + VFR_HUD (heading/airspeed/
// altitude) — unioned by mergeChannels into one channel-tagged dataSource.
export const WithMAVROS: Story = {
  name: 'With MAVROS (rosbridge)',
  parameters: {
    docs: {
      description: {
        story:
          'A full PFD wires on **two** sockets: `createImuAdapter` for roll/pitch off `sensor_msgs/Imu`, and a `channels` map over `mavros_msgs/VFR_HUD` for heading/airspeed/altitude. `mergeChannels` unions them into one source. Requires `rosbridge_server` on `ws://localhost:9090`.',
      },
    },
  },
  render: () => {
    const Component = () => {
      const source = useMemo(() => {
        const url = 'ws://localhost:9090';
        const imu = createImuAdapter({ url, topic: '/mavros/imu/data' });
        const hud = createRosbridgeAdapter({
          url,
          topic: '/mavros/vfr_hud',
          messageType: 'mavros_msgs/VFR_HUD',
          channels: {
            heading: (m) => m.heading,
            airspeed: (m) => m.airspeed * 1.94384, // m/s -> kt
            altitude: (m) => m.altitude * 3.28084, // m -> ft
          },
        });
        return mergeChannels({
          roll: imu.roll,
          pitch: imu.pitch,
          heading: hud.heading,
          airspeed: hud.airspeed,
          altitude: hud.altitude,
        });
      }, []);
      useEffect(() => () => source.destroy(), [source]);
      return <PrimaryFlightDisplay dataSource={source} size="lg" showFlightDirector />;
    };
    return <Component />;
  },
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
